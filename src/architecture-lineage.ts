import { readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { sha256 } from "./verification-record.js";
import { lineageResult } from "./diagnostics.js";
import type {
  LineageBundle,
  LineageConflict,
  LineageEdge,
  LineageResult,
  LineageTriggerEvent,
  SahDiagnostic,
} from "./contracts.js";
import type { ArchitectureEvolutionModel } from "./internal-model.js";
import {
  loadBundleForLineage,
  type LineageBundleSnapshot,
} from "./model-repository.js";

const manifestName = "sah.bundle.json";
const ignoredDirectoryNames = new Set([".git", "node_modules"]);

type DiscoveryResult =
  | { ok: true; root: string; bundleDirectories: string[] }
  | { ok: false; root: string; diagnostics: SahDiagnostic[] };

type LineageEntry = {
  path: string;
  snapshot: LineageBundleSnapshot;
};

function isWithin(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))
  );
}

function rootRelative(root: string, path: string): string {
  const value = relative(root, path).split(sep).join("/");
  return value === "" ? "." : value;
}

function diagnostic(input: {
  code: string;
  category: "validation" | "operational";
  path?: string;
  reference?: string;
  message: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: input.category,
    capability: "Cross-bundle architecture lineage",
    classification: "deterministic",
    severity: "error",
    ...(input.path === undefined ? {} : { artifactPath: input.path }),
    ...(input.reference === undefined ? {} : { reference: input.reference }),
    message: input.message,
    expected: input.expected,
    repair: input.repair,
  };
}

async function discoverBundles(sahRoot: string): Promise<DiscoveryResult> {
  const requestedRoot = resolve(sahRoot);
  let root: string;
  try {
    root = await realpath(requestedRoot);
    if (!(await stat(root)).isDirectory())
      throw new Error("SAH root is not a directory.");
  } catch (error) {
    return {
      ok: false,
      root: requestedRoot,
      diagnostics: [
        diagnostic({
          code: "LINEAGE_ROOT_UNREADABLE",
          category: "operational",
          path: sahRoot,
          message:
            error instanceof Error ? error.message : `Cannot open ${sahRoot}.`,
          expected: "an existing readable SAH root directory",
          repair:
            "Pass an existing directory containing one or more SAH bundles.",
        }),
      ],
    };
  }

  const bundleDirectories: string[] = [];
  const diagnostics: SahDiagnostic[] = [];
  const visited = new Set<string>();

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      diagnostics.push(
        diagnostic({
          code: "LINEAGE_DIRECTORY_UNREADABLE",
          category: "operational",
          path: rootRelative(root, current),
          message:
            error instanceof Error ? error.message : `Cannot read ${current}.`,
          expected: "a readable directory within the explicit SAH root",
          repair:
            "Restore directory access or remove it from the lineage root.",
        }),
      );
      return;
    }

    const manifestEntry = entries.find((entry) => entry.name === manifestName);
    if (manifestEntry !== undefined) bundleDirectories.push(current);

    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (ignoredDirectoryNames.has(entry.name)) continue;
      const candidate = resolve(current, entry.name);
      if (entry.isSymbolicLink()) {
        try {
          const physical = await realpath(candidate);
          if (!isWithin(root, physical)) {
            diagnostics.push(
              diagnostic({
                code: "LINEAGE_SYMLINK_OUTSIDE_ROOT",
                category: "operational",
                path: rootRelative(root, candidate),
                message: `Symlink ${entry.name} resolves outside the explicit SAH root.`,
                expected:
                  "lineage discovery not to traverse outside the supplied root",
                repair:
                  "Replace the escaping symlink with a local directory or remove it.",
              }),
            );
          } else if (
            !visited.has(physical) &&
            (await stat(physical)).isDirectory()
          ) {
            visited.add(physical);
            await walk(candidate);
          }
        } catch (error) {
          diagnostics.push(
            diagnostic({
              code: "LINEAGE_SYMLINK_UNRESOLVED",
              category: "operational",
              path: rootRelative(root, candidate),
              message:
                error instanceof Error
                  ? error.message
                  : `Cannot resolve ${candidate}.`,
              expected: "a resolvable local directory entry",
              repair:
                "Remove the broken symlink or replace it with a regular directory.",
            }),
          );
        }
        continue;
      }
      let physical: string;
      try {
        physical = await realpath(candidate);
      } catch {
        physical = candidate;
      }
      if (!isWithin(root, physical) || visited.has(physical)) continue;
      visited.add(physical);
      await walk(candidate);
    }
  }

  visited.add(root);
  await walk(root);
  const uniqueDirectories = [...new Set(bundleDirectories)].sort(
    (left, right) =>
      rootRelative(root, left).localeCompare(rootRelative(root, right)),
  );
  return diagnostics.length > 0
    ? { ok: false, root, diagnostics }
    : { ok: true, root, bundleDirectories: uniqueDirectories };
}

function findDecision(entry: LineageEntry | undefined, decisionId: string) {
  return entry?.snapshot.models.architectureDecision?.decisions.find(
    ({ id }) => id === decisionId,
  );
}

function addSourceDiagnostics(input: {
  entry: LineageEntry;
  sourceBundleId: string;
  sourceFingerprint: string;
  decisionId: string;
  path: string;
  diagnostics: SahDiagnostic[];
}): boolean {
  const {
    entry,
    sourceBundleId,
    sourceFingerprint,
    decisionId,
    path,
    diagnostics,
  } = input;
  if (entry.snapshot.fingerprint !== sourceFingerprint) {
    diagnostics.push(
      diagnostic({
        code: "LINEAGE_SOURCE_FINGERPRINT_MISMATCH",
        category: "validation",
        path,
        reference: sourceBundleId,
        message: `Source bundle ${sourceBundleId} does not have the pinned design fingerprint.`,
        expected: sourceFingerprint,
        repair:
          "Recreate the evolution record from the exact immutable source bundle.",
      }),
    );
    return false;
  }
  if (entry.snapshot.validation.status !== "passed") return false;
  const decision = findDecision(entry, decisionId);
  if (decision === undefined) {
    diagnostics.push(
      diagnostic({
        code: "LINEAGE_SOURCE_DECISION_DANGLING",
        category: "validation",
        path,
        reference: `${sourceBundleId}#${decisionId}`,
        message: `Source decision ${decisionId} does not exist in pinned bundle ${sourceBundleId}.`,
        expected: "an existing decision ID in the pinned source decision log",
        repair:
          "Correct the source decision reference or create the referenced decision in the source snapshot.",
      }),
    );
    return false;
  }
  return true;
}

function checkTrigger(
  event: ArchitectureEvolutionModel["triggerEvents"][number],
  source: LineageEntry | undefined,
  path: string,
  diagnostics: SahDiagnostic[],
): void {
  if (source === undefined) return;
  const sourcePinned = addSourceDiagnostics({
    entry: source,
    sourceBundleId: event.source.bundleId,
    sourceFingerprint: event.source.designFingerprint,
    decisionId: event.source.decisionId,
    path,
    diagnostics,
  });
  if (sourcePinned) {
    const decision = findDecision(source, event.source.decisionId);
    if (
      decision !== undefined &&
      !decision.reviewTriggers.includes(event.source.reviewTriggerText)
    ) {
      diagnostics.push(
        diagnostic({
          code: "LINEAGE_TRIGGER_TEXT_MISMATCH",
          category: "validation",
          path,
          reference: event.id,
          message: `Trigger text for ${event.id} is not an exact review trigger on the source decision.`,
          expected: "the exact source decision review trigger text",
          repair:
            "Copy the trigger text exactly without normalization or paraphrase.",
        }),
      );
    }
  }
  const actualDigest = `sha256:${sha256(Buffer.from(event.source.reviewTriggerText, "utf8"))}`;
  if (actualDigest !== event.source.reviewTriggerDigest) {
    diagnostics.push(
      diagnostic({
        code: "LINEAGE_TRIGGER_DIGEST_MISMATCH",
        category: "validation",
        path,
        reference: event.id,
        message: `Trigger digest for ${event.id} does not match its exact trigger text.`,
        expected: actualDigest,
        repair: "Regenerate the digest from the exact UTF-8 trigger text.",
      }),
    );
  }
}

function detectCycles(bundleIds: string[], edges: LineageEdge[]): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const id of bundleIds) adjacency.set(id, []);
  for (const edge of edges)
    adjacency.get(edge.fromBundleId)?.push(edge.toBundleId);
  for (const children of adjacency.values()) children.sort();

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  function visit(id: string): void {
    if (visiting.has(id)) {
      const index = stack.indexOf(id);
      cycles.push(
        (index < 0 ? [...stack, id] : [...stack.slice(index), id]).sort(),
      );
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    for (const child of adjacency.get(id) ?? []) visit(child);
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of [...bundleIds].sort()) visit(id);
  return cycles.filter(
    (cycle, index) =>
      cycles.findIndex(
        (candidate) => candidate.join("\0") === cycle.join("\0"),
      ) === index,
  );
}

function ancestorSet(
  bundleId: string,
  parentsByChild: Map<string, Set<string>>,
): Set<string> {
  const ancestors = new Set<string>([bundleId]);
  const pending = [bundleId];
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

export async function resolveArchitectureLineage(
  sahRoot: string,
): Promise<LineageResult> {
  const discovery = await discoverBundles(sahRoot);
  if (!discovery.ok) {
    return lineageResult("operational-error", discovery.root, {
      diagnostics: discovery.diagnostics,
    });
  }
  if (discovery.bundleDirectories.length === 0) {
    return lineageResult("operational-error", discovery.root, {
      diagnostics: [
        diagnostic({
          code: "LINEAGE_BUNDLE_NOT_FOUND",
          category: "operational",
          path: rootRelative(discovery.root, discovery.root),
          message: "The explicit SAH root contains no bundle manifest.",
          expected: `at least one ${manifestName} within the supplied root`,
          repair:
            "Place a design bundle below the explicit SAH root and retry.",
        }),
      ],
    });
  }

  const loaded = await Promise.all(
    discovery.bundleDirectories.map(async (directory) => ({
      path: rootRelative(discovery.root, directory),
      loaded: await loadBundleForLineage(directory),
    })),
  );
  const entries: LineageEntry[] = [];
  const diagnostics: SahDiagnostic[] = [];
  for (const item of loaded) {
    if (!item.loaded.ok) {
      diagnostics.push(...item.loaded.validation.diagnostics);
      continue;
    }
    entries.push({ path: item.path, snapshot: item.loaded.snapshot });
    diagnostics.push(...item.loaded.snapshot.validation.diagnostics);
  }

  const bundles: LineageBundle[] = entries.map(({ path, snapshot }) => ({
    bundleId: snapshot.manifest.bundleId,
    path,
    fingerprint: snapshot.fingerprint,
    completedStage: snapshot.manifest.lifecycle.completedStage,
  }));
  const byId = new Map<string, LineageEntry[]>();
  for (const entry of entries) {
    const current = byId.get(entry.snapshot.manifest.bundleId) ?? [];
    current.push(entry);
    byId.set(entry.snapshot.manifest.bundleId, current);
  }

  const conflicts: LineageConflict[] = [];
  for (const [bundleId, candidates] of byId) {
    if (candidates.length < 2) continue;
    const paths = candidates.map(({ path }) => path).sort();
    diagnostics.push(
      diagnostic({
        code: "LINEAGE_BUNDLE_ID_DUPLICATE",
        category: "validation",
        ...(paths[0] === undefined ? {} : { path: paths[0] }),
        reference: bundleId,
        message: `Bundle ID ${bundleId} occurs at multiple lineage paths: ${paths.join(", ")}.`,
        expected: "one unambiguous bundle snapshot per bundle ID",
        repair:
          "Rename the bundle ID or remove the duplicate snapshot; do not choose by path or date.",
      }),
    );
    conflicts.push({
      code: "LINEAGE_BUNDLE_ID_DUPLICATE",
      bundleIds: [bundleId],
      message: `Bundle ID ${bundleId} has multiple physical snapshots.`,
    });
  }

  const uniqueEntry = (bundleId: string): LineageEntry | undefined => {
    const candidates = byId.get(bundleId);
    return candidates?.length === 1 ? candidates[0] : undefined;
  };
  const edges: LineageEdge[] = [];
  const parentsByChild = new Map<string, Set<string>>();
  const triggerEvents: LineageTriggerEvent[] = [];
  let incomplete = false;

  for (const entry of entries) {
    const evolution = entry.snapshot.models.architectureEvolution;
    if (
      entry.snapshot.validation.status !== "passed" ||
      evolution === undefined
    )
      continue;
    const bundleId = entry.snapshot.manifest.bundleId;
    for (const parent of evolution.parents) {
      const parentEntry = uniqueEntry(parent.bundleId);
      if (parentEntry === undefined) {
        incomplete = true;
        diagnostics.push(
          diagnostic({
            code: "LINEAGE_PARENT_MISSING",
            category: "validation",
            path: `${entry.path}/architecture-evolution.json`,
            reference: parent.bundleId,
            message: `Parent bundle ${parent.bundleId} referenced by ${bundleId} is not available exactly once.`,
            expected: "one discoverable parent bundle with the referenced ID",
            repair:
              "Restore the exact parent snapshot under the explicit SAH root.",
          }),
        );
        continue;
      }
      if (parentEntry.snapshot.fingerprint !== parent.designFingerprint) {
        diagnostics.push(
          diagnostic({
            code: "LINEAGE_PARENT_FINGERPRINT_MISMATCH",
            category: "validation",
            path: `${entry.path}/architecture-evolution.json`,
            reference: parent.bundleId,
            message: `Parent fingerprint for ${bundleId} does not match the discovered source snapshot.`,
            expected: parentEntry.snapshot.fingerprint,
            repair:
              "Pin the fingerprint of the immutable parent bundle or create a new evolution snapshot.",
          }),
        );
        conflicts.push({
          code: "LINEAGE_PARENT_FINGERPRINT_MISMATCH",
          bundleIds: [parent.bundleId, bundleId].sort(),
          message: `The parent fingerprint pinned by ${bundleId} is stale.`,
        });
        edges.push({
          fromBundleId: parent.bundleId,
          toBundleId: bundleId,
          relationship: "derives-from",
        });
        const staleParents = parentsByChild.get(bundleId) ?? new Set<string>();
        staleParents.add(parent.bundleId);
        parentsByChild.set(bundleId, staleParents);
        continue;
      }
      edges.push({
        fromBundleId: parent.bundleId,
        toBundleId: bundleId,
        relationship: "derives-from",
      });
      const parents = parentsByChild.get(bundleId) ?? new Set<string>();
      parents.add(parent.bundleId);
      parentsByChild.set(bundleId, parents);
    }

    for (const [eventIndex, event] of evolution.triggerEvents.entries()) {
      const source = uniqueEntry(event.source.bundleId);
      if (source === undefined) {
        incomplete = true;
        diagnostics.push(
          diagnostic({
            code: "LINEAGE_TRIGGER_SOURCE_BUNDLE_MISSING",
            category: "validation",
            path: `${entry.path}/architecture-evolution.json`,
            reference: event.source.bundleId,
            message: `Trigger event ${event.id} has no unique source bundle.`,
            expected: "a discoverable source bundle with the referenced ID",
            repair: "Restore the source snapshot under the explicit SAH root.",
          }),
        );
      } else {
        checkTrigger(
          event,
          source,
          `${entry.path}/architecture-evolution.json#/triggerEvents/${eventIndex}/source`,
          diagnostics,
        );
      }
      const resulting = evolution.decisionTransitions.find((transition) =>
        transition.triggerRefs.includes(event.id),
      );
      triggerEvents.push({
        id: event.id,
        status: event.status,
        sourceDecision: `${event.source.bundleId}#${event.source.decisionId}`,
        resultingDecision: `${bundleId}#${resulting?.toDecisionRef ?? "unknown"}`,
      });
    }

    for (const [
      transitionIndex,
      transition,
    ] of evolution.decisionTransitions.entries()) {
      const source = uniqueEntry(transition.from.bundleId);
      if (source === undefined) {
        incomplete = true;
        diagnostics.push(
          diagnostic({
            code: "LINEAGE_TRANSITION_SOURCE_BUNDLE_MISSING",
            category: "validation",
            path: `${entry.path}/architecture-evolution.json`,
            reference: transition.from.bundleId,
            message: `Decision transition ${transition.id} has no unique source bundle.`,
            expected: "a discoverable source bundle with the referenced ID",
            repair: "Restore the source snapshot under the explicit SAH root.",
          }),
        );
        continue;
      }
      const sourceValid = addSourceDiagnostics({
        entry: source,
        sourceBundleId: transition.from.bundleId,
        sourceFingerprint: transition.from.designFingerprint,
        decisionId: transition.from.decisionId,
        path: `${entry.path}/architecture-evolution.json#/decisionTransitions/${transitionIndex}/from`,
        diagnostics,
      });
      if (!sourceValid) continue;
      const sourceDecision = findDecision(source, transition.from.decisionId);
      const resultingDecision = findDecision(entry, transition.toDecisionRef);
      if (resultingDecision === undefined) {
        diagnostics.push(
          diagnostic({
            code: "LINEAGE_RESULTING_DECISION_DANGLING",
            category: "validation",
            path: `${entry.path}/architecture-evolution.json#/decisionTransitions/${transitionIndex}/toDecisionRef`,
            reference: transition.toDecisionRef,
            message: `Decision transition ${transition.id} does not resolve to a current decision.`,
            expected: "an existing current architecture decision ID",
            repair:
              "Create the resulting decision in the current snapshot or correct the transition.",
          }),
        );
      }
      if (
        transition.transition === "supersedes" &&
        sourceDecision !== undefined &&
        !transition.scopeElementRefs.some((ref) =>
          sourceDecision.affectedElementRefs.includes(ref),
        )
      ) {
        diagnostics.push(
          diagnostic({
            code: "LINEAGE_TRANSITION_SCOPE_NON_OVERLAP",
            category: "validation",
            path: `${entry.path}/architecture-evolution.json#/decisionTransitions/${transitionIndex}/scopeElementRefs`,
            reference: transition.id,
            message: `Superseding transition ${transition.id} has no scope overlap with its source decision.`,
            expected:
              "at least one scope element shared with the source decision",
            repair:
              "Correct the transition scope or use an extends/coexists relationship.",
          }),
        );
      }
    }
  }

  const bundleIds = [
    ...new Set(entries.map(({ snapshot }) => snapshot.manifest.bundleId)),
  ];
  const cycles = detectCycles(bundleIds, edges);
  for (const cycle of cycles) {
    diagnostics.push(
      diagnostic({
        code: "LINEAGE_CYCLE",
        category: "validation",
        reference: cycle.join(" -> "),
        message: `Lineage graph contains a cycle: ${cycle.join(" -> ")}.`,
        expected: "an acyclic parent-to-child lineage graph",
        repair:
          "Create a new snapshot from an earlier immutable parent and remove the cyclic reference.",
      }),
    );
    conflicts.push({
      code: "LINEAGE_CYCLE",
      bundleIds: cycle.filter((id, index) => cycle.indexOf(id) === index),
      message: `Lineage cycle: ${cycle.join(" -> ")}.`,
    });
  }

  const outgoing = new Set(edges.map(({ fromBundleId }) => fromBundleId));
  const heads = bundleIds.filter((bundleId) => !outgoing.has(bundleId)).sort();
  const headAncestors = new Map(
    heads.map((head) => [head, ancestorSet(head, parentsByChild)]),
  );
  for (let leftIndex = 0; leftIndex < heads.length; leftIndex += 1) {
    const left = heads[leftIndex];
    if (left === undefined) continue;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < heads.length;
      rightIndex += 1
    ) {
      const right = heads[rightIndex];
      if (right === undefined) continue;
      const common = [...(headAncestors.get(left) ?? [])]
        .filter((id) => headAncestors.get(right)?.has(id))
        .sort();
      if (common.length === 0) continue;
      const bundleIdsForConflict = [
        ...new Set([left, right, ...common]),
      ].sort();
      diagnostics.push(
        diagnostic({
          code: "LINEAGE_PARALLEL_HEAD",
          category: "validation",
          reference: `${left},${right}`,
          message: `Parallel lineage heads ${left} and ${right} share an ancestor and require an explicit resolution.`,
          expected: "one explicit successor or an intentional coexisting scope",
          repair:
            "Do not choose by date or filename; create an explicit merge/evolution decision.",
        }),
      );
      conflicts.push({
        code: "LINEAGE_PARALLEL_HEAD",
        bundleIds: bundleIdsForConflict,
        message: `Parallel heads ${left} and ${right} share ${common.join(", ")}.`,
      });
    }
  }

  const hasOperational = diagnostics.some(
    ({ category }) => category === "operational",
  );
  const incompleteCodes = new Set([
    "LINEAGE_PARENT_MISSING",
    "LINEAGE_TRIGGER_SOURCE_BUNDLE_MISSING",
    "LINEAGE_TRANSITION_SOURCE_BUNDLE_MISSING",
  ]);
  const hasSemanticViolation = diagnostics.some(
    ({ category, code }) =>
      category === "validation" && !incompleteCodes.has(code),
  );
  const status = hasOperational
    ? "operational-error"
    : hasSemanticViolation
      ? "violations"
      : incomplete
        ? "incomplete"
        : "passed";
  return lineageResult(status, discovery.root, {
    bundles,
    edges,
    triggerEvents,
    heads,
    conflicts,
    diagnostics,
  });
}
