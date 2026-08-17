import type {
  SahDiagnostic,
  ValidationResult,
  ValidationStatus,
  ValidatedBundle,
} from "./contracts.js";

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
  const ordered = [...diagnostics].sort((left, right) =>
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

  return {
    status,
    bundleDirectory,
    ...(bundle === undefined ? {} : { bundle }),
    diagnostics: ordered,
    summary: summarize(ordered),
  };
}

export function hasErrors(diagnostics: SahDiagnostic[]): boolean {
  return diagnostics.some(({ severity }) => severity === "error");
}

export function escapePointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
