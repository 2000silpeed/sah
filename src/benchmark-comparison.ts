import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  benchmarkComparisonSchemaId,
  benchmarkVerdictSchemaId,
  type BenchmarkComparison,
  type BenchmarkComparisonResult,
  type BenchmarkVerdict,
  type SahDiagnostic,
} from "./contracts.js";
import { summarize } from "./diagnostics.js";
import { loadSchemaRegistry } from "./schema-validation.js";

const tolerancePoints = 5;

function diagnostic(input: {
  code: string;
  artifactPath: string;
  jsonPointer?: string;
  reference?: string;
  message: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: "validation",
    capability: "Benchmark verdict comparison",
    classification: "deterministic",
    severity: "error",
    artifactPath: input.artifactPath,
    ...(input.jsonPointer === undefined
      ? {}
      : { jsonPointer: input.jsonPointer }),
    ...(input.reference === undefined ? {} : { reference: input.reference }),
    message: input.message,
    expected: input.expected,
    repair: input.repair,
  };
}

function operationalDiagnostic(
  artifactPath: string,
  message: string,
): SahDiagnostic {
  return {
    code: "BENCHMARK_COMPARE_INPUT_UNREADABLE",
    category: "operational",
    capability: "Benchmark verdict comparison",
    severity: "error",
    artifactPath,
    message,
    expected: "a readable, well-formed benchmark verdict JSON file",
    repair: "Restore the verdict record or correct its path and rerun.",
  };
}

async function readVerdictFile(
  file: string,
): Promise<
  | { ok: true; data: unknown; path: string }
  | { ok: false; diagnostic: SahDiagnostic }
> {
  const path = resolve(file);
  try {
    const source = await readFile(path, "utf8");
    return { ok: true, path, data: JSON.parse(source) as unknown };
  } catch (error) {
    return {
      ok: false,
      diagnostic: operationalDiagnostic(
        path,
        error instanceof Error
          ? error.message
          : "The verdict file is unreadable.",
      ),
    };
  }
}

function comparisonResult(
  status: BenchmarkComparisonResult["status"],
  treatmentPath: string,
  controlPath: string,
  diagnostics: SahDiagnostic[],
  comparison?: BenchmarkComparison,
): BenchmarkComparisonResult {
  const ordered = [...diagnostics].sort((left, right) =>
    [left.artifactPath ?? "", left.code, left.reference ?? ""]
      .join("\0")
      .localeCompare(
        [right.artifactPath ?? "", right.code, right.reference ?? ""].join(
          "\0",
        ),
      ),
  );
  return {
    status,
    treatmentPath,
    controlPath,
    ...(comparison === undefined ? {} : { comparison }),
    diagnostics: ordered,
    summary: summarize(ordered),
  };
}

export async function compareBenchmarkVerdicts(
  treatmentFile: string,
  controlFile: string,
): Promise<BenchmarkComparisonResult> {
  const treatmentPath = resolve(treatmentFile);
  const controlPath = resolve(controlFile);

  const treatmentInput = await readVerdictFile(treatmentFile);
  if (!treatmentInput.ok) {
    return comparisonResult("operational-error", treatmentPath, controlPath, [
      treatmentInput.diagnostic,
    ]);
  }
  const controlInput = await readVerdictFile(controlFile);
  if (!controlInput.ok) {
    return comparisonResult("operational-error", treatmentPath, controlPath, [
      controlInput.diagnostic,
    ]);
  }

  const loaded = await loadSchemaRegistry();
  if (!loaded.ok) {
    return comparisonResult(
      "operational-error",
      treatmentPath,
      controlPath,
      loaded.diagnostics,
    );
  }

  const treatmentDiagnostics = loaded.registry.validate(
    benchmarkVerdictSchemaId,
    treatmentInput.data,
    treatmentInput.path,
  );
  const controlDiagnostics = loaded.registry.validate(
    benchmarkVerdictSchemaId,
    controlInput.data,
    controlInput.path,
  );
  if (treatmentDiagnostics.length > 0 || controlDiagnostics.length > 0) {
    return comparisonResult("violations", treatmentPath, controlPath, [
      ...treatmentDiagnostics,
      ...controlDiagnostics,
    ]);
  }

  const treatment = treatmentInput.data as BenchmarkVerdict;
  const control = controlInput.data as BenchmarkVerdict;

  const violations: SahDiagnostic[] = [];
  if (
    treatment.benchmarkId !== control.benchmarkId ||
    treatment.problemDigest !== control.problemDigest ||
    treatment.comparisonId !== control.comparisonId
  ) {
    violations.push(
      diagnostic({
        code: "BENCHMARK_COMPARE_BINDING_MISMATCH",
        artifactPath: controlPath,
        message:
          "The two verdicts do not describe the same benchmark problem and comparison.",
        expected: "identical benchmarkId, problemDigest, and comparisonId",
        repair:
          "Compare treatment and control runs of one benchmark comparison only.",
      }),
    );
  }
  if (treatment.mode !== "treatment") {
    violations.push(
      diagnostic({
        code: "BENCHMARK_COMPARE_MODE_MISMATCH",
        artifactPath: treatmentPath,
        jsonPointer: "/mode",
        message: `The first verdict records mode ${treatment.mode}.`,
        expected: "the first argument to be the treatment run's verdict",
        repair:
          "Pass the treatment verdict first and the control verdict second.",
      }),
    );
  }
  if (control.mode !== "control") {
    violations.push(
      diagnostic({
        code: "BENCHMARK_COMPARE_MODE_MISMATCH",
        artifactPath: controlPath,
        jsonPointer: "/mode",
        message: `The second verdict records mode ${control.mode}.`,
        expected: "the second argument to be the control run's verdict",
        repair:
          "Pass the treatment verdict first and the control verdict second.",
      }),
    );
  }
  if (violations.length > 0) {
    return comparisonResult(
      "violations",
      treatmentPath,
      controlPath,
      violations,
    );
  }

  const controlByCategory = new Map(
    control.finals.map((final) => [final.category, final]),
  );
  const categoryDeltas = treatment.finals.map((final) => {
    const counterpart = controlByCategory.get(final.category);
    const delta = final.points - (counterpart?.points ?? 0);
    return {
      category: final.category,
      delta,
      toleranceBreached: delta < -tolerancePoints,
    };
  });
  const totalDelta = treatment.total - control.total;
  const regressionBeyondTolerance = totalDelta < -tolerancePoints;

  const comparison: BenchmarkComparison = {
    $schema: benchmarkComparisonSchemaId,
    comparisonVersion: "0.1.0",
    comparisonId: treatment.comparisonId,
    benchmarkId: treatment.benchmarkId,
    problemDigest: treatment.problemDigest,
    treatmentRunId: treatment.runId,
    controlRunId: control.runId,
    categoryDeltas,
    treatmentTotal: treatment.total,
    controlTotal: control.total,
    totalDelta,
    tolerancePoints: 5,
    regressionBeyondTolerance,
    outcome: regressionBeyondTolerance
      ? "treatment-regressed"
      : totalDelta > 0
        ? "treatment-improved"
        : "within-tolerance",
  };

  const comparisonDiagnostics = loaded.registry.validate(
    benchmarkComparisonSchemaId,
    comparison,
    treatmentPath,
  );
  if (comparisonDiagnostics.length > 0) {
    return comparisonResult(
      "violations",
      treatmentPath,
      controlPath,
      comparisonDiagnostics,
    );
  }

  return comparisonResult(
    "compared",
    treatmentPath,
    controlPath,
    [],
    comparison,
  );
}
