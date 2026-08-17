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
