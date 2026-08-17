import type {
  SahDiagnostic,
  Stage,
  ValidationClassification,
} from "./contracts.js";
import { stages } from "./contracts.js";
import type { ArtifactRole, LoadedModels } from "./internal-model.js";

type ArtifactPaths = Partial<Record<ArtifactRole, string>>;

const stageRequiredArtifacts: Array<{
  stage: Stage;
  role: ArtifactRole;
  producer: Stage;
}> = [
  { stage: "S0", role: "systemCharacterization", producer: "S0" },
  { stage: "S2", role: "designStrategy", producer: "S2" },
  { stage: "S3", role: "responsibility", producer: "S3" },
  { stage: "S4", role: "invariant", producer: "S4" },
  { stage: "S6", role: "architecture", producer: "S6" },
  { stage: "S9", role: "architectureDecision", producer: "S9" },
];

function atLeast(actual: Stage, threshold: Stage): boolean {
  return stages.indexOf(actual) >= stages.indexOf(threshold);
}

function gateIssue(input: {
  code: string;
  capability: string;
  artifactPath: string | undefined;
  jsonPointer: string;
  reference?: string;
  message: string;
  expected: string;
  repair: string;
  owningStage: Stage;
  severity?: "error" | "warning";
  classification?: ValidationClassification;
}): SahDiagnostic {
  return {
    code: input.code,
    category: "validation",
    capability: input.capability,
    classification: input.classification ?? "deterministic",
    severity: input.severity ?? "error",
    ...(input.artifactPath === undefined
      ? {}
      : { artifactPath: input.artifactPath }),
    jsonPointer: input.jsonPointer,
    ...(input.reference === undefined ? {} : { reference: input.reference }),
    message: input.message,
    expected: input.expected,
    repair: input.repair,
    owningStage: input.owningStage,
  };
}

export function requiredArtifactDiagnostics(
  completedStage: Stage,
  paths: ArtifactPaths,
): SahDiagnostic[] {
  return stageRequiredArtifacts
    .filter(
      ({ stage, role }) =>
        atLeast(completedStage, stage) && paths[role] === undefined,
    )
    .map(({ role, producer }) =>
      gateIssue({
        code: "STAGE_ARTIFACT_REQUIRED",
        capability: "Stage-state completeness",
        artifactPath: "sah.bundle.json",
        jsonPointer: `/artifacts/${role}`,
        reference: role,
        message: `${role} is not declared for completed stage ${completedStage}.`,
        expected: `${role} to be declared at or after ${producer}`,
        repair: `Produce and declare the ${role} artifact in ${producer}, or correct completedStage.`,
        owningStage: producer,
      }),
    );
}

export function validateStageGates(
  completedStage: Stage,
  models: LoadedModels,
  paths: ArtifactPaths,
): SahDiagnostic[] {
  const diagnostics: SahDiagnostic[] = [];
  const responsibilities = models.responsibility;
  const invariants = models.invariant;
  const architecture = models.architecture;
  const decisionLog = models.architectureDecision;

  if (atLeast(completedStage, "S5")) {
    if (responsibilities !== undefined) {
      const conflicted = new Set(
        responsibilities.unresolvedConflicts.flatMap(
          ({ responsibilityRefs }) => responsibilityRefs,
        ),
      );
      responsibilities.responsibilities.forEach((responsibility, index) => {
        if (
          responsibility.owner === undefined &&
          !conflicted.has(responsibility.id)
        ) {
          diagnostics.push(
            gateIssue({
              code: "STAGE_S5_RESPONSIBILITY_OWNER_MISSING",
              capability: "Owner/reference coverage",
              artifactPath: paths.responsibility,
              jsonPointer: `/responsibilities/${index}/owner`,
              reference: responsibility.id,
              message: `Responsibility ${responsibility.id} has neither an owner nor an explicit conflict.`,
              expected:
                "one accountable logical owner or unresolved conflict coverage after S5",
              repair:
                "Assign owner authority or record the ownership conflict and resolution owner.",
              owningStage: "S5",
            }),
          );
        }
      });
    }

    if (invariants !== undefined) {
      const conflicted = new Set(
        invariants.unresolvedConflicts.flatMap(
          ({ invariantRefs }) => invariantRefs,
        ),
      );
      invariants.invariants.forEach((invariant, index) => {
        if (invariant.owner === undefined && !conflicted.has(invariant.id)) {
          diagnostics.push(
            gateIssue({
              code: "STAGE_S5_INVARIANT_OWNER_MISSING",
              capability: "Owner/reference coverage",
              artifactPath: paths.invariant,
              jsonPointer: `/invariants/${index}/owner`,
              reference: invariant.id,
              message: `Invariant ${invariant.id} has neither an owner nor an explicit conflict.`,
              expected:
                "one accountable enforcement owner or unresolved conflict coverage after S5",
              repair:
                "Assign enforcement ownership or record the ownership conflict and resolution owner.",
              owningStage: "S5",
            }),
          );
        }
      });
    }
  }

  if (atLeast(completedStage, "S6") && architecture !== undefined) {
    const elementIds = new Set(architecture.elements.map(({ id }) => id));
    responsibilities?.responsibilities.forEach((responsibility, index) => {
      const ownerRef = responsibility.owner?.logicalOwnerRef;
      if (ownerRef !== undefined && !elementIds.has(ownerRef)) {
        diagnostics.push(
          gateIssue({
            code: "STAGE_S6_LOGICAL_OWNER_UNMATERIALIZED",
            capability: "Owner/reference coverage",
            artifactPath: paths.responsibility,
            jsonPointer: `/responsibilities/${index}/owner/logicalOwnerRef`,
            reference: ownerRef,
            message: `Logical owner ${ownerRef} for responsibility ${responsibility.id} is not an architecture element.`,
            expected:
              "every reserved logical owner to materialize as an architecture element from S6",
            repair:
              "Materialize the logical owner in Architecture IR or correct the S5 assignment.",
            owningStage: "S6",
          }),
        );
      }
    });
    invariants?.invariants.forEach((invariant, index) => {
      const ownerRef = invariant.owner?.logicalOwnerRef;
      if (ownerRef !== undefined && !elementIds.has(ownerRef)) {
        diagnostics.push(
          gateIssue({
            code: "STAGE_S6_LOGICAL_OWNER_UNMATERIALIZED",
            capability: "Owner/reference coverage",
            artifactPath: paths.invariant,
            jsonPointer: `/invariants/${index}/owner/logicalOwnerRef`,
            reference: ownerRef,
            message: `Logical owner ${ownerRef} for invariant ${invariant.id} is not an architecture element.`,
            expected:
              "every reserved logical owner to materialize as an architecture element from S6",
            repair:
              "Materialize the logical owner in Architecture IR or correct the S5 assignment.",
            owningStage: "S6",
          }),
        );
      }
    });
  }

  if (atLeast(completedStage, "S7") && architecture !== undefined) {
    architecture.elements.forEach((element, index) => {
      if (element.representation === "undecided") {
        diagnostics.push(
          gateIssue({
            code: "STAGE_S7_REPRESENTATION_UNDECIDED",
            capability: "Stage-state completeness",
            artifactPath: paths.architecture,
            jsonPointer: `/elements/${index}/representation`,
            reference: element.id,
            message: `Architecture element ${element.id} remains undecided after S7.`,
            expected:
              "a selected representation for every applicable architecture element",
            repair:
              "Choose the least elaborate fitting representation in S7 or correct completedStage.",
            owningStage: "S7",
          }),
        );
      }
    });
  }

  if (atLeast(completedStage, "S10")) {
    if (
      architecture !== undefined &&
      architecture.candidate.status !== "selected"
    ) {
      diagnostics.push(
        gateIssue({
          code: "STAGE_S10_CANDIDATE_NOT_SELECTED",
          capability: "Stage-state completeness",
          artifactPath: paths.architecture,
          jsonPointer: "/candidate/status",
          reference: architecture.candidate.id,
          message: `The sole architecture candidate is ${architecture.candidate.status}, not selected.`,
          expected: "exactly one selected architecture candidate after S10",
          repair:
            "Select the coherent candidate in S10 or correct completedStage.",
          owningStage: "S10",
        }),
      );
    }

    decisionLog?.decisions.forEach((decision, index) => {
      if (decision.status === "accepted") {
        if (decision.selectedOptionRef === null) {
          diagnostics.push(
            gateIssue({
              code: "STAGE_S10_ACCEPTED_OPTION_MISSING",
              capability: "Accepted decision integrity",
              artifactPath: paths.architectureDecision,
              jsonPointer: `/decisions/${index}/selectedOptionRef`,
              reference: decision.id,
              message: `Accepted decision ${decision.id} has no selected option.`,
              expected:
                "a selected option belonging to every accepted decision",
              repair:
                "Select an evaluated option in S10 or return the decision to proposed.",
              owningStage: "S10",
            }),
          );
        }
        if (
          decision.authority.decider.trim() === "" ||
          decision.authority.scope.trim() === ""
        ) {
          diagnostics.push(
            gateIssue({
              code: "STAGE_S10_ACCEPTED_AUTHORITY_MISSING",
              capability: "Accepted decision integrity",
              artifactPath: paths.architectureDecision,
              jsonPointer: `/decisions/${index}/authority`,
              reference: decision.id,
              message: `Accepted decision ${decision.id} has no usable decision authority.`,
              expected: "a non-blank decider and authority scope",
              repair: "Record the authorized decider and scope in S10.",
              owningStage: "S10",
            }),
          );
        }
      } else if (decision.status === "proposed") {
        diagnostics.push(
          gateIssue({
            code: "STAGE_S10_PROPOSED_DECISION_REVIEW",
            capability: "Proposed decision isolation",
            artifactPath: paths.architectureDecision,
            jsonPointer: `/decisions/${index}/status`,
            reference: decision.id,
            message: `Proposed decision ${decision.id} remains after S10; isolation is not observable in the current IR suite.`,
            expected:
              "review evidence that uncertainty is behind an owned seam and dependent S12 slices are blocked",
            repair:
              "Review isolation in S10 and list the decision as a blocker when an S12 handoff is produced.",
            owningStage: "S10",
            severity: "warning",
            classification: "assisted",
          }),
        );
      }
    });
  }

  if (
    atLeast(completedStage, "S11") &&
    architecture !== undefined &&
    decisionLog !== undefined
  ) {
    const decisionsById = new Map(
      decisionLog.decisions.map((decision) => [decision.id, decision]),
    );
    const constraintsByDecision = new Map<string, number>();
    architecture.constraints.forEach((constraint, index) => {
      const decision = decisionsById.get(constraint.decisionRef);
      if (decision !== undefined) {
        constraintsByDecision.set(
          decision.id,
          (constraintsByDecision.get(decision.id) ?? 0) + 1,
        );
        if (decision.status !== "accepted") {
          diagnostics.push(
            gateIssue({
              code: "STAGE_S11_CONSTRAINT_DECISION_NOT_ACCEPTED",
              capability: "Decision-to-constraint trace",
              artifactPath: paths.architecture,
              jsonPointer: `/constraints/${index}/decisionRef`,
              reference: constraint.decisionRef,
              message: `Constraint ${constraint.id} traces to ${decision.status} decision ${decision.id}.`,
              expected: "every constraint to trace to an accepted decision",
              repair:
                "Remove the constraint or accept its source decision through S10 authority.",
              owningStage: "S11",
            }),
          );
        }
      }
      if (
        constraint.classification === "deterministic" &&
        constraint.observable === undefined
      ) {
        diagnostics.push(
          gateIssue({
            code: "STAGE_S11_DETERMINISTIC_OBSERVABLE_MISSING",
            capability: "Constraint observability contract",
            artifactPath: paths.architecture,
            jsonPointer: `/constraints/${index}/observable`,
            reference: constraint.id,
            message: `Deterministic constraint ${constraint.id} has no observable contract.`,
            expected:
              "factSource, selector, predicate, and expected value for deterministic enforcement",
            repair:
              "Define the observable contract in S11 or reclassify the contextual claim through review.",
            owningStage: "S11",
          }),
        );
      }
    });
    decisionLog.decisions.forEach((decision, index) => {
      if (
        decision.status === "accepted" &&
        !constraintsByDecision.has(decision.id)
      ) {
        diagnostics.push(
          gateIssue({
            code: "STAGE_S11_ACCEPTED_DECISION_UNCLASSIFIED",
            capability: "Decision-to-constraint trace",
            artifactPath: paths.architectureDecision,
            jsonPointer: `/decisions/${index}/constraintRefs`,
            reference: decision.id,
            message: `Accepted decision ${decision.id} has no classified enforcement entry.`,
            expected:
              "at least one deterministic, assisted, or judgment constraint for each accepted decision",
            repair:
              "Compile an enforcement entry in S11, even when it is assisted or judgment-only.",
            owningStage: "S11",
          }),
        );
      }
    });
  }

  return diagnostics;
}
