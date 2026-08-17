import type { VerificationCheck, VerificationStatus } from "./contracts.js";
import type { CodeFactAdapter } from "./code-fact-adapter.js";
import type { LoadedModels } from "./internal-model.js";

export type VerificationExecutionFailure = {
  code: string;
  constraintId?: string;
  capability: string;
  message: string;
  expected: string;
  repair: string;
};

export type ConstraintVerification = {
  status: VerificationStatus;
  checks: VerificationCheck[];
  failures: VerificationExecutionFailure[];
};

type Assignment = {
  sliceRefs: string[];
  readySliceRefs: string[];
  blockerDecisionRefs: string[];
};

function aggregateStatus(
  checks: VerificationCheck[],
  failures: VerificationExecutionFailure[],
): VerificationStatus {
  if (failures.length > 0) return "operational-error";
  if (checks.some(({ status }) => status === "violation")) return "violations";
  if (
    checks.some(
      ({ status }) => status === "pending" || status === "unsupported",
    )
  )
    return "incomplete";
  return "passed";
}

export async function verifyConstraints(
  models: LoadedModels,
  adapters: readonly CodeFactAdapter[],
): Promise<ConstraintVerification> {
  const architecture = models.architecture;
  const handoff = models.implementationHandoff;
  if (architecture === undefined || handoff === undefined) {
    return {
      status: "operational-error",
      checks: [],
      failures: [
        {
          code: "VERIFICATION_CONTEXT_MISSING",
          capability: "Continuous constraint verification",
          message:
            "Validated Architecture and Implementation Handoff models are required for verification.",
          expected:
            "schema-valid Architecture and S12 Implementation Handoff IR",
          repair:
            "Restore the declared S12 artifacts and rerun bundle validation.",
        },
      ],
    };
  }

  const assignments = new Map<string, Assignment>();
  for (const slice of handoff.slices) {
    for (const constraintRef of slice.constraintRefs) {
      const assignment = assignments.get(constraintRef) ?? {
        sliceRefs: [],
        readySliceRefs: [],
        blockerDecisionRefs: [],
      };
      assignment.sliceRefs.push(slice.id);
      if (slice.status === "ready") assignment.readySliceRefs.push(slice.id);
      else assignment.blockerDecisionRefs.push(...slice.blockedByDecisionRefs);
      assignments.set(constraintRef, assignment);
    }
  }

  const checks: VerificationCheck[] = [];
  const failures: VerificationExecutionFailure[] = [];
  for (const constraint of architecture.constraints) {
    const assignment = assignments.get(constraint.id);
    if (assignment === undefined) continue;
    const common = {
      constraintId: constraint.id,
      decisionRef: constraint.decisionRef,
      classification: constraint.classification,
      capability: constraint.enforcement.adapterCapability,
      scopeElementRefs: constraint.scopeElementRefs,
      invariantRefs: constraint.invariantRefs,
      sliceRefs: [...new Set(assignment.sliceRefs)],
    };

    if (assignment.readySliceRefs.length === 0) {
      const blockerDecisionRefs = [...new Set(assignment.blockerDecisionRefs)];
      checks.push({
        ...common,
        code: "CONSTRAINT_SLICE_BLOCKED",
        blockerDecisionRefs,
        status: "pending",
        message: `Constraint ${constraint.id} is assigned only to blocked implementation slices.`,
        expected: "at least one ready slice before deterministic execution",
        repair:
          "Resolve the proposed decision blockers in S10 and mark the affected slice ready in S12.",
      });
      continue;
    }

    if (constraint.classification !== "deterministic") {
      checks.push({
        ...common,
        code: "CONSTRAINT_REVIEW_PENDING",
        status: "pending",
        message: `${constraint.classification} constraint ${constraint.id} requires contextual review.`,
        expected:
          "an assisted or judgment review with evidence and disposition",
        repair:
          "Run the owning review capability; do not reinterpret this result as deterministic pass.",
      });
      continue;
    }

    if (constraint.observable === undefined) {
      checks.push({
        ...common,
        code: "CONSTRAINT_BINDING_UNSUPPORTED",
        status: "unsupported",
        message: `Deterministic constraint ${constraint.id} has no observable contract.`,
        expected: "an S11 observable contract and matching adapter",
        repair: "Return to S11 and define the observable contract.",
      });
      continue;
    }

    const adapter = adapters.find(
      ({ capability }) =>
        capability === constraint.enforcement.adapterCapability,
    );
    if (adapter === undefined) {
      checks.push({
        ...common,
        code: "CONSTRAINT_ADAPTER_UNSUPPORTED",
        status: "unsupported",
        message: `No adapter provides capability ${constraint.enforcement.adapterCapability} for constraint ${constraint.id}.`,
        expected:
          "an available adapter matching the declared enforcement capability",
        observed: constraint.observable.factSource,
        repair:
          "Install or implement the declared adapter, or recompile the constraint in S11.",
      });
      continue;
    }

    const outcome = await adapter.observe(constraint.observable);
    if (outcome.kind === "operational-error") {
      failures.push({
        code: outcome.code,
        constraintId: constraint.id,
        capability: constraint.enforcement.adapterCapability,
        message: outcome.message,
        expected: outcome.expected,
        repair: outcome.repair,
      });
    } else if (outcome.kind === "unsupported") {
      checks.push({
        ...common,
        code: outcome.code,
        status: "unsupported",
        message: outcome.message,
        expected: outcome.expected,
        ...(outcome.observed === undefined
          ? {}
          : { observed: outcome.observed }),
        repair: outcome.repair,
      });
    } else if (outcome.matches) {
      checks.push({
        ...common,
        code: "CONSTRAINT_PASSED",
        status: "pass",
        message: `Constraint ${constraint.id} observed its expected condition.`,
        expected: constraint.observable.expected,
        observed: outcome.observed,
      });
    } else {
      checks.push({
        ...common,
        code: "CONSTRAINT_VIOLATION",
        status: "violation",
        message: constraint.enforcement.failureMessage,
        expected: constraint.observable.expected,
        observed: outcome.observed,
        repair:
          "Repair the target artifact or revise the accepted decision and constraint through S10–S11 authority.",
      });
    }
  }

  return {
    status: aggregateStatus(checks, failures),
    checks,
    failures,
  };
}
