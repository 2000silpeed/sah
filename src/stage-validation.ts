import type {
  LifecycleProfile,
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
  profile: LifecycleProfile,
  models: LoadedModels,
  paths: ArtifactPaths,
): SahDiagnostic[] {
  const diagnostics: SahDiagnostic[] = [];
  const responsibilities = models.responsibility;
  const invariants = models.invariant;
  const architecture = models.architecture;
  const decisionLog = models.architectureDecision;
  const strategy = models.designStrategy;

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

  if (atLeast(completedStage, "S8") && architecture !== undefined) {
    if (!atLeast(completedStage, "S10")) {
      architecture.candidates.forEach((candidate, index) => {
        if (candidate.status !== "proposed") {
          diagnostics.push(
            gateIssue({
              code: "STAGE_S8_CANDIDATE_STATUS_INVALID",
              capability: "Candidate count or single-option evidence",
              artifactPath: paths.architecture,
              jsonPointer: `/candidates/${index}/status`,
              reference: candidate.id,
              message: `Candidate ${candidate.id} is ${candidate.status} before S10 selection.`,
              expected: "every candidate to remain proposed through S8 and S9",
              repair:
                "Return the candidate to proposed, or record selection only after S10.",
              owningStage: "S8",
            }),
          );
        }
      });
    }

    const justification = architecture.singleCandidateJustification;
    if (architecture.candidates.length > 1 && justification !== undefined) {
      diagnostics.push(
        gateIssue({
          code: "STAGE_S8_SINGLE_JUSTIFICATION_NOT_APPLICABLE",
          capability: "Candidate count or single-option evidence",
          artifactPath: paths.architecture,
          jsonPointer: "/singleCandidateJustification",
          message:
            "A single-candidate justification is present for a multi-candidate set.",
          expected:
            "singleCandidateJustification only when exactly one candidate exists",
          repair:
            "Remove the waiver and compare the serialized candidates through S9.",
          owningStage: "S8",
        }),
      );
    }

    if (architecture.candidates.length === 1) {
      const singleCandidateId = architecture.candidates[0]?.id;
      if (justification === undefined) {
        diagnostics.push(
          gateIssue({
            code: "STAGE_S8_SINGLE_CANDIDATE_JUSTIFICATION_MISSING",
            capability: "Candidate count or single-option evidence",
            artifactPath: paths.architecture,
            jsonPointer: "/singleCandidateJustification",
            ...(singleCandidateId === undefined
              ? {}
              : { reference: singleCandidateId }),
            message:
              "The S8 candidate set contains only one candidate without a waiver.",
            expected:
              "at least two candidates, or structured short-path/forcing evidence for one",
            repair:
              "Add a credible candidate or record the applicable evidence-owned justification in S8.",
            owningStage: "S8",
          }),
        );
      } else if (justification.kind === "short-path") {
        if (profile !== "short" || strategy?.shortPath.eligible !== true) {
          diagnostics.push(
            gateIssue({
              code: "STAGE_S8_SHORT_PATH_NOT_ELIGIBLE",
              capability: "Candidate count or single-option evidence",
              artifactPath: paths.architecture,
              jsonPointer: "/singleCandidateJustification/kind",
              ...(singleCandidateId === undefined
                ? {}
                : { reference: singleCandidateId }),
              message:
                "The single candidate claims short-path justification without both manifest and S2 eligibility.",
              expected:
                "manifest profile short and Design Strategy shortPath.eligible true",
              repair:
                "Correct the lifecycle/profile evidence or produce multiple candidates in S8.",
              owningStage: "S8",
            }),
          );
        }

        strategy?.selections.forEach((selection, index) => {
          if (
            !selection.alternatives.some(({ strategy: alternative }) =>
              justification.strategyAlternativeRefs.includes(alternative),
            )
          ) {
            diagnostics.push(
              gateIssue({
                code: "STAGE_S8_SHORT_PATH_ALTERNATIVE_COVERAGE_MISSING",
                capability: "Candidate count or single-option evidence",
                artifactPath: paths.architecture,
                jsonPointer:
                  "/singleCandidateJustification/strategyAlternativeRefs",
                reference: selection.subsystemRef,
                message: `No referenced S2 alternative covers subsystem ${selection.subsystemRef}.`,
                expected:
                  "at least one referenced S2 alternative for every strategy selection",
                repair: `Reference an evaluated alternative from /selections/${index}/alternatives or produce another candidate.`,
                owningStage: "S8",
              }),
            );
          }
          if (
            !selection.rationale.evidenceRefs.some((reference) =>
              justification.evidenceRefs.includes(reference),
            )
          ) {
            diagnostics.push(
              gateIssue({
                code: "STAGE_S8_SHORT_PATH_EVIDENCE_COVERAGE_MISSING",
                capability: "Candidate count or single-option evidence",
                artifactPath: paths.architecture,
                jsonPointer: "/singleCandidateJustification/evidenceRefs",
                reference: selection.subsystemRef,
                message: `No justification evidence traces through the S2 rationale for ${selection.subsystemRef}.`,
                expected:
                  "at least one S2 rationale evidence reference for every strategy selection",
                repair:
                  "Reference the proportionality evidence used by S2 or produce another candidate.",
                owningStage: "S8",
              }),
            );
          }
        });
      } else if (justification.hardConstraintRefs.length === 0) {
        diagnostics.push(
          gateIssue({
            code: "STAGE_S8_FORCING_CONSTRAINT_MISSING",
            capability: "Candidate count or single-option evidence",
            artifactPath: paths.architecture,
            jsonPointer: "/singleCandidateJustification/hardConstraintRefs",
            ...(singleCandidateId === undefined
              ? {}
              : { reference: singleCandidateId }),
            message:
              "The single candidate claims forcing-constraint justification without a constraint.",
            expected: "at least one referenced hard constraint",
            repair:
              "Reference the forcing S1 constraint or produce another candidate.",
            owningStage: "S8",
          }),
        );
      }
    }
  }

  if (atLeast(completedStage, "S9")) {
    if (
      architecture !== undefined &&
      models.systemCharacterization !== undefined
    ) {
      const mustScenarios =
        models.systemCharacterization.qualityScenarios.filter(
          ({ priority }) => priority === "must",
        );
      const firstAssessmentByPair = new Map<string, number>();

      architecture.qualityAssessments.forEach((assessment, index) => {
        const pairKey = `${assessment.candidateRef}:${assessment.scenarioRef}`;
        const firstIndex = firstAssessmentByPair.get(pairKey);
        if (firstIndex === undefined) {
          firstAssessmentByPair.set(pairKey, index);
        } else {
          diagnostics.push(
            gateIssue({
              code: "STAGE_S9_ASSESSMENT_DUPLICATE",
              capability: "Quality-scenario assessment coverage",
              artifactPath: paths.architecture,
              jsonPointer: `/qualityAssessments/${index}`,
              reference: pairKey,
              message: `Assessment ${pairKey} duplicates /qualityAssessments/${firstIndex}.`,
              expected:
                "exactly one assessment for each candidate and quality-scenario pair",
              repair:
                "Keep one canonical assessment for the candidate/scenario pair in S9.",
              owningStage: "S9",
            }),
          );
        }
      });

      architecture.candidates.forEach((candidate) => {
        mustScenarios.forEach((scenario) => {
          const pairKey = `${candidate.id}:${scenario.id}`;
          if (!firstAssessmentByPair.has(pairKey)) {
            diagnostics.push(
              gateIssue({
                code: "STAGE_S9_MUST_ASSESSMENT_MISSING",
                capability: "Quality-scenario assessment coverage",
                artifactPath: paths.architecture,
                jsonPointer: "/qualityAssessments",
                reference: pairKey,
                message: `Candidate ${candidate.id} has no assessment for must scenario ${scenario.id}.`,
                expected:
                  "exactly one assessment for every candidate and must-priority quality scenario",
                repair:
                  "Evaluate this candidate/scenario pair in S9 and add the traced assessment.",
                owningStage: "S9",
              }),
            );
          }
        });
      });

      const mustScenarioIds = new Set(mustScenarios.map(({ id }) => id));
      architecture.qualityAssessments.forEach((assessment, index) => {
        if (
          mustScenarioIds.has(assessment.scenarioRef) &&
          assessment.result !== "pass"
        ) {
          diagnostics.push(
            gateIssue({
              code: "STAGE_S9_MUST_SCENARIO_REVIEW",
              capability: "Quality-scenario satisfaction",
              artifactPath: paths.architecture,
              jsonPointer: `/qualityAssessments/${index}/result`,
              reference: `${assessment.candidateRef}:${assessment.scenarioRef}`,
              message: `Must-scenario assessment is ${assessment.result}; satisfaction or risk acceptance requires contextual review.`,
              expected:
                "review of the measured result, causal evidence, and authorized risk disposition",
              repair:
                "Review the assessment in S9; return to S8 for a failed candidate or record authorized risk in S10.",
              owningStage: "S9",
              severity: "warning",
              classification: "assisted",
            }),
          );
        }
      });
    }

    if (!atLeast(completedStage, "S10")) {
      decisionLog?.decisions.forEach((decision, index) => {
        if (decision.status !== "proposed") {
          diagnostics.push(
            gateIssue({
              code: "STAGE_S9_DECISION_STATUS_INVALID",
              capability: "Stage-state completeness",
              artifactPath: paths.architectureDecision,
              jsonPointer: `/decisions/${index}/status`,
              reference: decision.id,
              message: `Decision ${decision.id} is ${decision.status} before S10 selection.`,
              expected: "every S9 architecture decision to remain proposed",
              repair:
                "Return the decision to proposed and defer disposition to S10 authority.",
              owningStage: "S9",
            }),
          );
        }
        if (decision.selectedOptionRef !== null) {
          diagnostics.push(
            gateIssue({
              code: "STAGE_S9_OPTION_SELECTED_EARLY",
              capability: "Stage-state completeness",
              artifactPath: paths.architectureDecision,
              jsonPointer: `/decisions/${index}/selectedOptionRef`,
              reference: decision.selectedOptionRef,
              message: `Decision ${decision.id} selects an option before S10.`,
              expected: "a null selectedOptionRef through S9",
              repair:
                "Clear the selected option in S9 and select it through S10 authority.",
              owningStage: "S9",
            }),
          );
        }
      });
    }
  }

  if (atLeast(completedStage, "S10")) {
    if (architecture !== undefined) {
      const selectedCandidates = architecture.candidates.filter(
        ({ status }) => status === "selected",
      );
      if (selectedCandidates.length !== 1) {
        diagnostics.push(
          gateIssue({
            code: "STAGE_S10_CANDIDATE_SELECTION_COUNT",
            capability: "Stage-state completeness",
            artifactPath: paths.architecture,
            jsonPointer: "/candidates",
            message: `${selectedCandidates.length} architecture candidates are selected after S10.`,
            expected: "exactly one selected architecture candidate after S10",
            repair:
              "Select one coherent candidate and reject the remaining candidates in S10.",
            owningStage: "S10",
          }),
        );
      }
      architecture.candidates.forEach((candidate, index) => {
        if (candidate.status === "proposed") {
          diagnostics.push(
            gateIssue({
              code: "STAGE_S10_CANDIDATE_NOT_DISPOSITIONED",
              capability: "Stage-state completeness",
              artifactPath: paths.architecture,
              jsonPointer: `/candidates/${index}/status`,
              reference: candidate.id,
              message: `Candidate ${candidate.id} remains proposed after S10.`,
              expected:
                "one selected candidate and every other candidate rejected",
              repair: "Select or reject the candidate through S10 authority.",
              owningStage: "S10",
            }),
          );
        }
      });
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
