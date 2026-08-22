import type { SahDiagnostic } from "./contracts.js";
import type {
  ArtifactRole,
  ArchitectureEvolutionModel,
  LoadedModels,
} from "./internal-model.js";

type ArtifactPaths = Partial<Record<ArtifactRole, string>>;

function issue(input: {
  paths: ArtifactPaths;
  pointer: string;
  reference?: string;
  code: string;
  message: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: "validation",
    capability: "Cross-bundle architecture lineage",
    classification: "deterministic",
    severity: "error",
    ...(input.paths.architectureEvolution === undefined
      ? {}
      : { artifactPath: input.paths.architectureEvolution }),
    jsonPointer: input.pointer,
    ...(input.reference === undefined ? {} : { reference: input.reference }),
    message: input.message,
    expected: input.expected,
    repair: input.repair,
  };
}

function checkReferences(
  diagnostics: SahDiagnostic[],
  paths: ArtifactPaths,
  values: string[],
  targets: ReadonlySet<string>,
  pointer: string,
  targetName: string,
): void {
  values.forEach((value, index) => {
    if (targets.has(value)) return;
    diagnostics.push(
      issue({
        paths,
        pointer: `${pointer}/${index}`,
        reference: value,
        code: "EVOLUTION_REFERENCE_DANGLING",
        message: `Evolution reference ${value} does not resolve to ${targetName}.`,
        expected: `an existing ${targetName} ID in the current bundle`,
        repair: `Create ${value} in the current bundle or correct the evolution reference.`,
      }),
    );
  });
}

function duplicateDiagnostics(
  values: string[],
  paths: ArtifactPaths,
  pointer: string,
  code: string,
  label: string,
): SahDiagnostic[] {
  const firstIndex = new Map<string, number>();
  const diagnostics: SahDiagnostic[] = [];
  values.forEach((value, index) => {
    const first = firstIndex.get(value);
    if (first === undefined) {
      firstIndex.set(value, index);
      return;
    }
    diagnostics.push(
      issue({
        paths,
        pointer: `${pointer}/${index}`,
        reference: value,
        code,
        message: `${label} ${value} duplicates its earlier occurrence at index ${first}.`,
        expected: `a unique ${label} within the evolution artifact`,
        repair: `Rename the duplicate ${label} and update its references.`,
      }),
    );
  });
  return diagnostics;
}

export function validateArchitectureEvolution(
  models: LoadedModels,
  currentBundleId: string,
  paths: ArtifactPaths,
): SahDiagnostic[] {
  const evolution = models.architectureEvolution;
  if (evolution === undefined) return [];

  const diagnostics: SahDiagnostic[] = [];
  if (evolution.currentBundleId !== currentBundleId) {
    diagnostics.push(
      issue({
        paths,
        pointer: "/currentBundleId",
        reference: evolution.currentBundleId,
        code: "EVOLUTION_CURRENT_BUNDLE_MISMATCH",
        message: `Evolution artifact names ${evolution.currentBundleId}, but the manifest declares ${currentBundleId}.`,
        expected: "currentBundleId to equal the enclosing manifest bundleId",
        repair: "Update currentBundleId to the enclosing bundleId.",
      }),
    );
  }

  diagnostics.push(
    ...duplicateDiagnostics(
      evolution.parents.map(({ bundleId }) => bundleId),
      paths,
      "/parents",
      "EVOLUTION_PARENT_DUPLICATE",
      "Parent bundle ID",
    ),
    ...duplicateDiagnostics(
      evolution.triggerEvents.map(({ id }) => id),
      paths,
      "/triggerEvents",
      "EVOLUTION_TRIGGER_ID_DUPLICATE",
      "Trigger event ID",
    ),
    ...duplicateDiagnostics(
      evolution.reopenedStages.map(({ stage }) => stage),
      paths,
      "/reopenedStages",
      "EVOLUTION_REOPENED_STAGE_DUPLICATE",
      "Reopened stage",
    ),
    ...duplicateDiagnostics(
      evolution.decisionTransitions.map(({ id }) => id),
      paths,
      "/decisionTransitions",
      "EVOLUTION_TRANSITION_ID_DUPLICATE",
      "Decision transition ID",
    ),
  );

  const evidenceIds = new Set(
    models.systemCharacterization?.evidence.map(({ id }) => id) ?? [],
  );
  checkReferences(
    diagnostics,
    paths,
    evolution.changeRequest.evidenceRefs,
    evidenceIds,
    "/changeRequest/evidenceRefs",
    "current evidence",
  );

  const triggerIds = new Set(evolution.triggerEvents.map(({ id }) => id));
  evolution.triggerEvents.forEach((event, index) => {
    checkReferences(
      diagnostics,
      paths,
      event.evidenceRefs,
      evidenceIds,
      `/triggerEvents/${index}/evidenceRefs`,
      "current evidence",
    );
  });
  evolution.reopenedStages.forEach((reopened, index) => {
    checkReferences(
      diagnostics,
      paths,
      reopened.triggerRefs,
      triggerIds,
      `/reopenedStages/${index}/triggerRefs`,
      "trigger event",
    );
  });

  const decisionIds = new Set(
    models.architectureDecision?.decisions.map(({ id }) => id) ?? [],
  );
  const elementIds = new Set(
    models.architecture?.elements.map(({ id }) => id) ?? [],
  );
  evolution.decisionTransitions.forEach((transition, index) => {
    if (!decisionIds.has(transition.toDecisionRef)) {
      diagnostics.push(
        issue({
          paths,
          pointer: `/decisionTransitions/${index}/toDecisionRef`,
          reference: transition.toDecisionRef,
          code: "EVOLUTION_DECISION_REFERENCE_DANGLING",
          message: `Transition target ${transition.toDecisionRef} does not resolve to a current decision.`,
          expected: "an existing current architecture decision ID",
          repair:
            "Create the target decision in the current decision log or correct the transition.",
        }),
      );
    }
    checkReferences(
      diagnostics,
      paths,
      transition.scopeElementRefs,
      elementIds,
      `/decisionTransitions/${index}/scopeElementRefs`,
      "current architecture element",
    );
    checkReferences(
      diagnostics,
      paths,
      transition.triggerRefs,
      triggerIds,
      `/decisionTransitions/${index}/triggerRefs`,
      "trigger event",
    );
  });

  evolution.triggerEvents.forEach((event, index) => {
    const matches = evolution.decisionTransitions.flatMap(
      (transition, transitionIndex) =>
        transition.triggerRefs.includes(event.id)
          ? [{ transition, transitionIndex }]
          : [],
    );
    if (matches.length === 0) {
      diagnostics.push(
        issue({
          paths,
          pointer: `/triggerEvents/${index}/id`,
          reference: event.id,
          code: "EVOLUTION_TRIGGER_TRANSITION_MISSING",
          message: `Fired trigger ${event.id} is not connected to a decision transition.`,
          expected: "exactly one decision transition for every fired trigger",
          repair:
            "Connect the fired trigger to the decision transition it caused.",
        }),
      );
      return;
    }
    if (matches.length > 1) {
      diagnostics.push(
        issue({
          paths,
          pointer: `/triggerEvents/${index}/id`,
          reference: event.id,
          code: "EVOLUTION_TRIGGER_TRANSITION_AMBIGUOUS",
          message: `Fired trigger ${event.id} is connected to multiple decision transitions.`,
          expected: "exactly one decision transition for every fired trigger",
          repair:
            "Use one transition for this trigger or record separate unambiguous trigger events.",
        }),
      );
      return;
    }
    const match = matches[0];
    if (
      match !== undefined &&
      (match.transition.from.bundleId !== event.source.bundleId ||
        match.transition.from.designFingerprint !==
          event.source.designFingerprint ||
        match.transition.from.decisionId !== event.source.decisionId)
    ) {
      diagnostics.push(
        issue({
          paths,
          pointer: `/decisionTransitions/${match.transitionIndex}/from`,
          reference: match.transition.id,
          code: "EVOLUTION_TRIGGER_TRANSITION_SOURCE_MISMATCH",
          message: `Decision transition ${match.transition.id} does not originate from the source decision pinned by trigger ${event.id}.`,
          expected: "the trigger source bundle, fingerprint, and decision ID",
          repair:
            "Align the transition source with the decision that fired the trigger.",
        }),
      );
    }
  });

  return diagnostics;
}

export type { ArchitectureEvolutionModel };
