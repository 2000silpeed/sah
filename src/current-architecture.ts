import { relative, resolve, sep } from "node:path";

import { resolveArchitectureLineage } from "./architecture-lineage.js";
import { currentArchitectureResult } from "./diagnostics.js";
import type {
  CurrentArchitectureConflict,
  CurrentArchitectureHead,
  CurrentArchitecturePendingJudgment,
  CurrentArchitectureResult,
  CurrentArchitectureReviewTrigger,
  CurrentArchitectureSupersededDecision,
  LineageBundle,
  LineageEdge,
  SahDiagnostic,
} from "./contracts.js";
import type {
  ArchitectureDecisionModel,
  ArchitectureEvolutionModel,
} from "./internal-model.js";
import {
  loadBundleForLineage,
  type LineageBundleSnapshot,
} from "./model-repository.js";

type CurrentEntry = {
  bundle: LineageBundle;
  snapshot: LineageBundleSnapshot;
};

type Decision = ArchitectureDecisionModel["decisions"][number];
type DecisionCandidate = {
  headBundleId: string;
  decision: Decision;
  qualifiedRef: string;
};

type HeadProjection = {
  head: LineageBundle;
  candidates: DecisionCandidate[];
  supersededDecisions: CurrentArchitectureSupersededDecision[];
  openReviewTriggers: CurrentArchitectureReviewTrigger[];
  pendingJudgments: CurrentArchitecturePendingJudgment[];
  conflicts: CurrentArchitectureConflict[];
  diagnostics: SahDiagnostic[];
  resolvedPairs: Set<string>;
};

function isWithin(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith("..") && !pathFromRoot.includes(`..${sep}`))
  );
}

function qualifiedRef(bundleId: string, decisionId: string): string {
  return `${bundleId}#${decisionId}`;
}

function pairKey(left: string, right: string): string {
  return [left, right].sort().join("\0");
}

function currentDiagnostic(input: {
  code: string;
  category: "validation" | "operational";
  reference?: string;
  message: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: input.category,
    capability: "Current architecture projection",
    classification: "deterministic",
    severity: "error",
    ...(input.reference === undefined ? {} : { reference: input.reference }),
    message: input.message,
    expected: input.expected,
    repair: input.repair,
  };
}

async function loadCurrentEntries(
  lineage: Awaited<ReturnType<typeof resolveArchitectureLineage>>,
): Promise<{ entries: CurrentEntry[]; diagnostics: SahDiagnostic[] }> {
  const loaded = await Promise.all(
    lineage.bundles.map(async (bundle) => {
      const directory = resolve(lineage.sahRoot, bundle.path);
      if (!isWithin(lineage.sahRoot, directory)) {
        return {
          diagnostics: [
            currentDiagnostic({
              code: "CURRENT_BUNDLE_PATH_OUTSIDE_ROOT",
              category: "operational",
              reference: bundle.bundleId,
              message: `Current projection path ${bundle.path} escapes the explicit SAH root.`,
              expected:
                "every projected bundle path to remain below the explicit SAH root",
              repair:
                "Repair the lineage resolver output or pass a safe explicit SAH root.",
            }),
          ],
        };
      }
      const result = await loadBundleForLineage(directory);
      if (!result.ok) return { diagnostics: result.validation.diagnostics };
      if (
        result.snapshot.manifest.bundleId !== bundle.bundleId ||
        result.snapshot.fingerprint !== bundle.fingerprint
      ) {
        return {
          diagnostics: [
            currentDiagnostic({
              code: "CURRENT_SNAPSHOT_CHANGED",
              category: "operational",
              reference: bundle.bundleId,
              message: `Bundle ${bundle.bundleId} changed while the current projection was being resolved.`,
              expected:
                "the same bundle ID and fingerprint observed by lineage resolution",
              repair:
                "Retry after restoring a stable immutable bundle snapshot.",
            }),
          ],
        };
      }
      return { entry: { bundle, snapshot: result.snapshot } };
    }),
  );
  const entries: CurrentEntry[] = [];
  const diagnostics: SahDiagnostic[] = [];
  for (const item of loaded) {
    if (item.entry !== undefined) entries.push(item.entry);
    diagnostics.push(...(item.diagnostics ?? []));
  }
  return { entries, diagnostics };
}

function entriesById(entries: CurrentEntry[]): Map<string, CurrentEntry[]> {
  const byId = new Map<string, CurrentEntry[]>();
  for (const entry of entries) {
    const candidates = byId.get(entry.bundle.bundleId) ?? [];
    candidates.push(entry);
    byId.set(entry.bundle.bundleId, candidates);
  }
  return byId;
}

function ancestorIds(headBundleId: string, edges: LineageEdge[]): Set<string> {
  const parentsByChild = new Map<string, string[]>();
  for (const edge of edges) {
    const parents = parentsByChild.get(edge.toBundleId) ?? [];
    parents.push(edge.fromBundleId);
    parentsByChild.set(edge.toBundleId, parents);
  }
  const ancestors = new Set<string>([headBundleId]);
  const pending = [headBundleId];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    for (const parent of parentsByChild.get(current) ?? []) {
      if (ancestors.has(parent)) continue;
      ancestors.add(parent);
      pending.push(parent);
    }
  }
  return ancestors;
}

function transitionsForHead(
  headBundleId: string,
  entries: CurrentEntry[],
  edges: LineageEdge[],
): Array<{
  childBundleId: string;
  evolution: ArchitectureEvolutionModel;
}> {
  const ancestors = ancestorIds(headBundleId, edges);
  return entries.flatMap(({ bundle, snapshot }) => {
    if (
      !ancestors.has(bundle.bundleId) ||
      snapshot.validation.status !== "passed"
    )
      return [];
    const evolution = snapshot.models.architectureEvolution;
    return evolution === undefined
      ? []
      : [{ childBundleId: bundle.bundleId, evolution }];
  });
}

function addSuperseded(
  superseded: Map<string, string>,
  source: string,
  target: string,
  conflicts: CurrentArchitectureConflict[],
  diagnostics: SahDiagnostic[],
): void {
  const existing = superseded.get(source);
  if (existing === undefined || existing === target) {
    superseded.set(source, target);
    return;
  }
  const bundleIds = [
    source.split("#")[0],
    target.split("#")[0],
    existing.split("#")[0],
  ]
    .filter((value): value is string => value !== undefined)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  const message = `Decision ${source} is mapped to multiple superseding decisions: ${existing} and ${target}.`;
  conflicts.push({
    code: "CURRENT_DECISION_MULTIPLE_SUPERSEDERS",
    bundleIds,
    message,
  });
  diagnostics.push(
    currentDiagnostic({
      code: "CURRENT_DECISION_MULTIPLE_SUPERSEDERS",
      category: "validation",
      reference: source,
      message,
      expected:
        "one deterministic superseding decision for each source decision",
      repair:
        "Keep one explicit supersedes transition or create a resolving successor bundle.",
    }),
  );
}

function removeCandidate(
  candidates: Map<string, DecisionCandidate>,
  headBundleId: string,
  decisionId: string,
): void {
  candidates.delete(qualifiedRef(headBundleId, decisionId));
}

function projectHead(
  head: LineageBundle,
  entry: CurrentEntry | undefined,
  entries: CurrentEntry[],
  edges: LineageEdge[],
): HeadProjection {
  const candidates = new Map<string, DecisionCandidate>();
  const superseded = new Map<string, string>();
  const conflicts: CurrentArchitectureConflict[] = [];
  const diagnostics: SahDiagnostic[] = [];
  const resolvedPairs = new Set<string>();
  if (entry?.snapshot.validation.status !== "passed") {
    return {
      head,
      candidates: [],
      supersededDecisions: [],
      openReviewTriggers: [],
      pendingJudgments: [],
      conflicts,
      diagnostics,
      resolvedPairs,
    };
  }

  const decisions = entry.snapshot.models.architectureDecision?.decisions ?? [];
  for (const decision of decisions) {
    if (decision.status !== "accepted") continue;
    const ref = qualifiedRef(head.bundleId, decision.id);
    candidates.set(ref, {
      headBundleId: head.bundleId,
      decision,
      qualifiedRef: ref,
    });
  }

  for (const decision of decisions) {
    if (decision.status !== "accepted") continue;
    const targetRef = qualifiedRef(head.bundleId, decision.id);
    for (const sourceId of decision.supersedes) {
      const sourceRef = qualifiedRef(head.bundleId, sourceId);
      resolvedPairs.add(pairKey(sourceRef, targetRef));
      addSuperseded(superseded, sourceRef, targetRef, conflicts, diagnostics);
      removeCandidate(candidates, head.bundleId, sourceId);
    }
  }

  const transitions = transitionsForHead(head.bundleId, entries, edges);
  for (const { childBundleId, evolution } of transitions) {
    for (const transition of evolution.decisionTransitions) {
      const sourceRef = qualifiedRef(
        transition.from.bundleId,
        transition.from.decisionId,
      );
      const targetRef = qualifiedRef(childBundleId, transition.toDecisionRef);
      const currentSourceRef = qualifiedRef(
        head.bundleId,
        transition.from.decisionId,
      );
      const currentTargetRef = qualifiedRef(
        head.bundleId,
        transition.toDecisionRef,
      );
      if (
        candidates.has(currentSourceRef) &&
        candidates.has(currentTargetRef)
      ) {
        resolvedPairs.add(pairKey(currentSourceRef, currentTargetRef));
      }
      if (transition.transition !== "supersedes") continue;
      addSuperseded(superseded, sourceRef, targetRef, conflicts, diagnostics);
      removeCandidate(candidates, head.bundleId, transition.from.decisionId);
    }
  }

  const supersededRefs = new Set(superseded.keys());
  for (const decision of decisions) {
    if (decision.status !== "superseded") continue;
    const ref = qualifiedRef(head.bundleId, decision.id);
    if (supersededRefs.has(ref)) continue;
    diagnostics.push(
      currentDiagnostic({
        code: "CURRENT_SUPERSEDED_TARGET_MISSING",
        category: "validation",
        reference: ref,
        message: `Superseded decision ${ref} has no deterministic superseding decision in the current projection.`,
        expected: "an explicit local or cross-bundle supersedes relation",
        repair:
          "Add the superseding relation to the canonical decision or evolution artifact.",
      }),
    );
  }

  const firedTriggers = new Set<string>();
  for (const { evolution } of transitions) {
    for (const event of evolution.triggerEvents) {
      firedTriggers.add(
        `${event.source.decisionId}\0${event.source.reviewTriggerText}`,
      );
    }
  }
  const openReviewTriggers: CurrentArchitectureReviewTrigger[] = [];
  const pendingJudgments: CurrentArchitecturePendingJudgment[] = [];
  const constraints = entry.snapshot.models.architecture?.constraints ?? [];
  for (const candidate of candidates.values()) {
    for (const trigger of candidate.decision.reviewTriggers) {
      if (firedTriggers.has(`${candidate.decision.id}\0${trigger}`)) continue;
      openReviewTriggers.push({
        decisionRef: candidate.qualifiedRef,
        trigger,
      });
    }
    for (const constraint of constraints) {
      if (
        constraint.decisionRef === candidate.decision.id &&
        constraint.classification === "judgment"
      ) {
        pendingJudgments.push({
          bundleId: head.bundleId,
          constraintId: constraint.id,
        });
      }
    }
  }

  return {
    head,
    candidates: [...candidates.values()],
    supersededDecisions: [...superseded.entries()].map(
      ([qualified, supersededBy]) => ({
        qualifiedRef: qualified,
        supersededBy,
      }),
    ),
    openReviewTriggers,
    pendingJudgments,
    conflicts,
    diagnostics,
    resolvedPairs,
  };
}

function headConflict(
  left: DecisionCandidate,
  right: DecisionCandidate,
  resolvedPairs: Set<string>,
): CurrentArchitectureConflict | undefined {
  if (resolvedPairs.has(pairKey(left.qualifiedRef, right.qualifiedRef)))
    return undefined;
  const sharedScope = left.decision.affectedElementRefs.filter((ref) =>
    right.decision.affectedElementRefs.includes(ref),
  );
  if (sharedScope.length === 0) return undefined;
  const bundleIds = [left.headBundleId, right.headBundleId]
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  return {
    code: "CURRENT_DECISION_SCOPE_CONFLICT",
    bundleIds,
    message: `Active decisions ${left.qualifiedRef} and ${right.qualifiedRef} overlap on ${sharedScope.sort().join(", ")} without an explicit resolving transition.`,
  };
}

function uniqueConflicts(
  conflicts: CurrentArchitectureConflict[],
): CurrentArchitectureConflict[] {
  const seen = new Set<string>();
  return conflicts.filter((conflict) => {
    const key = [conflict.code, ...conflict.bundleIds, conflict.message].join(
      "\0",
    );
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function resolveCurrentArchitecture(
  sahRoot: string,
): Promise<CurrentArchitectureResult> {
  const lineage = await resolveArchitectureLineage(sahRoot);
  if (lineage.status === "operational-error") {
    return currentArchitectureResult("operational-error", lineage.sahRoot, {
      diagnostics: lineage.diagnostics,
    });
  }

  const loaded = await loadCurrentEntries(lineage);
  const byId = entriesById(loaded.entries);
  const heads: CurrentArchitectureHead[] = lineage.heads.flatMap((bundleId) => {
    const bundle = lineage.bundles.find(
      (candidate) => candidate.bundleId === bundleId,
    );
    return bundle === undefined
      ? []
      : [
          {
            bundleId: bundle.bundleId,
            fingerprint: bundle.fingerprint,
            path: bundle.path,
          },
        ];
  });
  const projections = lineage.heads.map((bundleId) =>
    projectHead(
      lineage.bundles.find((bundle) => bundle.bundleId === bundleId) ?? {
        bundleId,
        path: ".",
        fingerprint: "sha256:" + "0".repeat(64),
        completedStage: "S0",
      },
      byId.get(bundleId)?.length === 1 ? byId.get(bundleId)?.[0] : undefined,
      loaded.entries,
      lineage.edges,
    ),
  );
  const activeCandidates = projections.flatMap(({ candidates }) => candidates);
  const conflicts: CurrentArchitectureConflict[] = [
    ...lineage.conflicts,
    ...projections.flatMap(({ conflicts: headConflicts }) => headConflicts),
  ];
  const diagnostics: SahDiagnostic[] = [
    ...lineage.diagnostics,
    ...loaded.diagnostics,
    ...projections.flatMap(
      ({ diagnostics: headDiagnostics }) => headDiagnostics,
    ),
  ];
  const resolvedPairs = new Set(
    projections.flatMap(({ resolvedPairs: pairs }) => [...pairs]),
  );
  for (let leftIndex = 0; leftIndex < activeCandidates.length; leftIndex += 1) {
    const left = activeCandidates[leftIndex];
    if (left === undefined) continue;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < activeCandidates.length;
      rightIndex += 1
    ) {
      const right = activeCandidates[rightIndex];
      if (right === undefined) continue;
      const conflict = headConflict(left, right, resolvedPairs);
      if (conflict === undefined) continue;
      conflicts.push(conflict);
      diagnostics.push(
        currentDiagnostic({
          code: conflict.code,
          category: "validation",
          reference: `${left.qualifiedRef},${right.qualifiedRef}`,
          message: conflict.message,
          expected: "non-overlapping active scopes or an explicit transition",
          repair:
            "Record an explicit successor/coexistence decision instead of selecting a latest head.",
        }),
      );
    }
  }

  const status = loaded.diagnostics.some(
    ({ category }) => category === "operational",
  )
    ? "operational-error"
    : lineage.status === "incomplete"
      ? "incomplete"
      : lineage.status === "violations" ||
          conflicts.length > 0 ||
          diagnostics.some(
            ({ category, severity }) =>
              category === "validation" && severity === "error",
          )
        ? "conflicted"
        : "ready";
  return currentArchitectureResult(status, lineage.sahRoot, {
    heads,
    activeDecisions: activeCandidates.map(({ qualifiedRef, decision }) => ({
      qualifiedRef,
      title: decision.title,
      scopeElementRefs: [...decision.affectedElementRefs],
    })),
    supersededDecisions: projections.flatMap(
      ({ supersededDecisions }) => supersededDecisions,
    ),
    openReviewTriggers: projections.flatMap(
      ({ openReviewTriggers }) => openReviewTriggers,
    ),
    pendingJudgments: projections.flatMap(
      ({ pendingJudgments }) => pendingJudgments,
    ),
    conflicts: uniqueConflicts(conflicts),
    diagnostics,
  });
}
