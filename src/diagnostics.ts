import type {
  AdvancedBundle,
  AdvanceResult,
  AdvanceStatus,
  SahDiagnostic,
  ValidationResult,
  ValidationStatus,
  ValidatedBundle,
  VerificationCheck,
  VerificationResult,
  VerificationSelection,
  VerificationStatus,
  ResumeResult,
  ResumeStatus,
  LineageBundle,
  LineageConflict,
  LineageEdge,
  LineageResult,
  LineageStatus,
  LineageTriggerEvent,
  CurrentArchitectureConflict,
  CurrentArchitectureDecision,
  CurrentArchitectureHead,
  CurrentArchitecturePendingJudgment,
  CurrentArchitectureResult,
  CurrentArchitectureReviewTrigger,
  CurrentArchitectureStatus,
  CurrentArchitectureSupersededDecision,
} from "./contracts.js";
import {
  currentArchitectureResultSchemaId,
  lineageResultSchemaId,
} from "./contracts.js";

function orderDiagnostics(diagnostics: SahDiagnostic[]): SahDiagnostic[] {
  return [...diagnostics].sort((left, right) =>
    [
      left.artifactPath ?? "",
      left.jsonPointer ?? "",
      left.code,
      left.reference ?? "",
    ]
      .join("\0")
      .localeCompare(
        [
          right.artifactPath ?? "",
          right.jsonPointer ?? "",
          right.code,
          right.reference ?? "",
        ].join("\0"),
      ),
  );
}

export function summarize(diagnostics: SahDiagnostic[]): {
  errors: number;
  warnings: number;
} {
  return {
    errors: diagnostics.filter(({ severity }) => severity === "error").length,
    warnings: diagnostics.filter(({ severity }) => severity === "warning")
      .length,
  };
}

export function result(
  status: ValidationStatus,
  bundleDirectory: string,
  diagnostics: SahDiagnostic[],
  bundle?: ValidatedBundle,
): ValidationResult {
  const ordered = orderDiagnostics(diagnostics);

  return {
    status,
    bundleDirectory,
    ...(bundle === undefined ? {} : { bundle }),
    diagnostics: ordered,
    summary: summarize(ordered),
  };
}

export function lineageResult(
  status: LineageStatus,
  sahRoot: string,
  fields: {
    bundles?: LineageBundle[];
    edges?: LineageEdge[];
    triggerEvents?: LineageTriggerEvent[];
    heads?: string[];
    conflicts?: LineageConflict[];
    diagnostics?: SahDiagnostic[];
  } = {},
): LineageResult {
  const diagnostics = orderDiagnostics(fields.diagnostics ?? []);
  const conflicts = [...(fields.conflicts ?? [])].sort((left, right) =>
    [left.code, ...left.bundleIds]
      .join("\0")
      .localeCompare([right.code, ...right.bundleIds].join("\0")),
  );
  return {
    $schema: lineageResultSchemaId,
    lineageVersion: "0.1.0",
    status,
    sahRoot,
    bundles: [...(fields.bundles ?? [])].sort((left, right) =>
      [left.bundleId, left.path]
        .join("\0")
        .localeCompare([right.bundleId, right.path].join("\0")),
    ),
    edges: [...(fields.edges ?? [])].sort((left, right) =>
      [left.fromBundleId, left.toBundleId]
        .join("\0")
        .localeCompare([right.fromBundleId, right.toBundleId].join("\0")),
    ),
    triggerEvents: [...(fields.triggerEvents ?? [])].sort((left, right) =>
      [left.id, left.sourceDecision]
        .join("\0")
        .localeCompare([right.id, right.sourceDecision].join("\0")),
    ),
    heads: [...(fields.heads ?? [])].sort(),
    conflicts,
    diagnostics,
    summary: {
      bundles: fields.bundles?.length ?? 0,
      edges: fields.edges?.length ?? 0,
      conflicts: conflicts.length,
      ...summarize(diagnostics),
    },
  };
}

export function currentArchitectureResult(
  status: CurrentArchitectureStatus,
  sahRoot: string,
  fields: {
    heads?: CurrentArchitectureHead[];
    activeDecisions?: CurrentArchitectureDecision[];
    supersededDecisions?: CurrentArchitectureSupersededDecision[];
    openReviewTriggers?: CurrentArchitectureReviewTrigger[];
    pendingJudgments?: CurrentArchitecturePendingJudgment[];
    conflicts?: CurrentArchitectureConflict[];
    diagnostics?: SahDiagnostic[];
  } = {},
): CurrentArchitectureResult {
  const diagnostics = orderDiagnostics(fields.diagnostics ?? []);
  const heads = [...(fields.heads ?? [])].sort((left, right) =>
    [left.bundleId, left.path]
      .join("\0")
      .localeCompare([right.bundleId, right.path].join("\0")),
  );
  const activeDecisions = [...(fields.activeDecisions ?? [])].sort(
    (left, right) => left.qualifiedRef.localeCompare(right.qualifiedRef),
  );
  const supersededDecisions = [...(fields.supersededDecisions ?? [])].sort(
    (left, right) =>
      [left.qualifiedRef, left.supersededBy]
        .join("\0")
        .localeCompare([right.qualifiedRef, right.supersededBy].join("\0")),
  );
  const openReviewTriggers = [...(fields.openReviewTriggers ?? [])].sort(
    (left, right) =>
      [left.decisionRef, left.trigger]
        .join("\0")
        .localeCompare([right.decisionRef, right.trigger].join("\0")),
  );
  const pendingJudgments = [...(fields.pendingJudgments ?? [])].sort(
    (left, right) =>
      [left.bundleId, left.constraintId]
        .join("\0")
        .localeCompare([right.bundleId, right.constraintId].join("\0")),
  );
  const conflicts = [...(fields.conflicts ?? [])].sort((left, right) =>
    [left.code, ...left.bundleIds, left.message]
      .join("\0")
      .localeCompare(
        [right.code, ...right.bundleIds, right.message].join("\0"),
      ),
  );
  return {
    $schema: currentArchitectureResultSchemaId,
    currentVersion: "0.1.0",
    status,
    sahRoot,
    heads,
    activeDecisions,
    supersededDecisions,
    openReviewTriggers,
    pendingJudgments,
    conflicts,
    diagnostics,
    summary: {
      heads: heads.length,
      activeDecisions: activeDecisions.length,
      supersededDecisions: supersededDecisions.length,
      openReviewTriggers: openReviewTriggers.length,
      pendingJudgments: pendingJudgments.length,
      conflicts: conflicts.length,
      ...summarize(diagnostics),
    },
  };
}

export function resumeResult(
  status: ResumeStatus,
  bundleDirectory: string,
  diagnostics: SahDiagnostic[],
  fields: Partial<
    Omit<ResumeResult, "status" | "bundleDirectory" | "diagnostics" | "summary">
  > = {},
): ResumeResult {
  const ordered = orderDiagnostics(diagnostics);
  return {
    $schema: "https://sah.dev/schemas/resume-result/v0.1.0",
    resumeVersion: "0.1.0",
    status,
    bundleDirectory,
    ...fields,
    readySliceRefs: fields.readySliceRefs ?? [],
    blockedSliceRefs: fields.blockedSliceRefs ?? [],
    dependencyOrder: fields.dependencyOrder ?? [],
    diagnostics: ordered,
    summary: summarize(ordered),
  };
}

export function advanceResult(
  status: AdvanceStatus,
  bundleDirectory: string,
  diagnostics: SahDiagnostic[],
  bundle?: AdvancedBundle,
): AdvanceResult {
  const ordered = orderDiagnostics(diagnostics);
  return {
    status,
    bundleDirectory,
    ...(bundle === undefined ? {} : { bundle }),
    diagnostics: ordered,
    summary: summarize(ordered),
  };
}

export function verificationResult(
  status: VerificationStatus,
  bundleDirectory: string,
  targetDirectory: string,
  checks: VerificationCheck[],
  diagnostics: SahDiagnostic[],
  bundle?: ValidatedBundle,
  selection?: VerificationSelection,
): VerificationResult {
  const orderedDiagnostics = orderDiagnostics(diagnostics);
  const orderedChecks = [...checks].sort((left, right) =>
    [left.constraintId, left.code]
      .join("\0")
      .localeCompare([right.constraintId, right.code].join("\0")),
  );
  return {
    status,
    bundleDirectory,
    targetDirectory,
    ...(bundle === undefined ? {} : { bundle }),
    ...(selection === undefined ? {} : { selection }),
    checks: orderedChecks,
    diagnostics: orderedDiagnostics,
    summary: {
      ...summarize(orderedDiagnostics),
      passed: orderedChecks.filter(({ status: check }) => check === "pass")
        .length,
      violations: orderedChecks.filter(
        ({ status: check }) => check === "violation",
      ).length,
      pending: orderedChecks.filter(({ status: check }) => check === "pending")
        .length,
      unsupported: orderedChecks.filter(
        ({ status: check }) => check === "unsupported",
      ).length,
    },
  };
}

export function hasErrors(diagnostics: SahDiagnostic[]): boolean {
  return diagnostics.some(({ severity }) => severity === "error");
}

export function escapePointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
