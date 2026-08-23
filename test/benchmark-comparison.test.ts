import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  benchmarkComparisonSchemaId,
  benchmarkVerdictSchemaId,
  compareBenchmarkVerdicts,
} from "../src/index.js";
import type { BenchmarkJudgeCategory, BenchmarkVerdict } from "../src/index.js";
import { loadSchemaRegistry } from "../src/schema-validation.js";
import { cliPath } from "./helpers.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

type ProcessResult = {
  code: number;
  stdout: string;
  stderr: string;
};

async function runCli(arguments_: string[]): Promise<ProcessResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...arguments_], {
      cwd: resolve("."),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      resolveResult({ code: code ?? -1, stdout, stderr });
    });
  });
}

const maxima: Record<BenchmarkJudgeCategory, number> = {
  boundaries: 15,
  characterization: 15,
  "continuous-enforcement": 5,
  "quality-trade-offs": 15,
  responsibilities: 15,
  strategy: 20,
};

function verdict(
  runId: string,
  mode: "treatment" | "control",
  overrides: Partial<BenchmarkVerdict> = {},
  categoryPoints: Partial<Record<BenchmarkJudgeCategory, number>> = {},
): BenchmarkVerdict {
  const finals = (Object.keys(maxima) as BenchmarkJudgeCategory[]).map(
    (category) => ({
      category,
      maxPoints: maxima[category],
      points: categoryPoints[category] ?? 10,
      source: "agreement" as const,
    }),
  );
  const judgedTotal = finals.reduce((sum, final) => sum + final.points, 0);
  return {
    $schema: benchmarkVerdictSchemaId,
    verdictVersion: "0.1.0",
    runId,
    comparisonId: "simple-crud-ab-001",
    benchmarkId: "simple-crud",
    mode,
    trajectoryDigest: `sha256:${"a".repeat(64)}`,
    problemDigest: `sha256:${"b".repeat(64)}`,
    judges: ["judge-a", "judge-b"],
    stewardId: null,
    finals,
    judgeSubtotalFinal: judgedTotal,
    deterministicPoints: {
      artifactIntegrity: { points: 10, bundleValidated: true },
      enforcementDeterministic: { points: 5, declaredConstraints: 1 },
    },
    overEngineeringDeductionMean: 2,
    fatalIndicatorFlagged: false,
    totalBeforeCap: judgedTotal + 15 - 2,
    total: judgedTotal + 15 - 2,
    thresholds: {
      minimumTotalMet: true,
      strategyMinimumMet: true,
      responsibilitiesMinimumMet: true,
      noFatalIndicator: true,
    },
    status: "passed",
    ...overrides,
  };
}

async function writePair(
  treatment: BenchmarkVerdict,
  control: BenchmarkVerdict,
): Promise<[string, string]> {
  const root = await mkdtemp(join(tmpdir(), "sah-compare-test-"));
  temporaryDirectories.push(root);
  const treatmentPath = join(root, "treatment.json");
  const controlPath = join(root, "control.json");
  await writeFile(treatmentPath, `${JSON.stringify(treatment, null, 2)}\n`);
  await writeFile(controlPath, `${JSON.stringify(control, null, 2)}\n`);
  return [treatmentPath, controlPath];
}

describe("benchmark verdict comparison", () => {
  it("computes per-category and total deltas for a within-tolerance pair", async () => {
    const [treatmentPath, controlPath] = await writePair(
      verdict("run-treatment", "treatment", {}, { strategy: 12 }),
      verdict("run-control", "control"),
    );
    const result = await compareBenchmarkVerdicts(treatmentPath, controlPath);

    expect(result.status).toBe("compared");
    expect(result.comparison?.treatmentRunId).toBe("run-treatment");
    expect(result.comparison?.totalDelta).toBeCloseTo(2);
    expect(result.comparison?.outcome).toBe("treatment-improved");
    expect(result.comparison?.regressionBeyondTolerance).toBe(false);
    const strategyDelta = result.comparison?.categoryDeltas.find(
      ({ category }) => category === "strategy",
    );
    expect(strategyDelta).toMatchObject({ delta: 2, toleranceBreached: false });

    const loaded = await loadSchemaRegistry();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(
        loaded.registry.validate(
          benchmarkComparisonSchemaId,
          result.comparison,
          treatmentPath,
        ),
      ).toEqual([]);
    }
  });

  it("flags regressions beyond the published five-point tolerance", async () => {
    const [treatmentPath, controlPath] = await writePair(
      verdict("run-treatment", "treatment", {}, { strategy: 4 }),
      verdict("run-control", "control"),
    );
    const result = await compareBenchmarkVerdicts(treatmentPath, controlPath);

    expect(result.status).toBe("compared");
    expect(result.comparison?.totalDelta).toBeCloseTo(-6);
    expect(result.comparison?.regressionBeyondTolerance).toBe(true);
    expect(result.comparison?.outcome).toBe("treatment-regressed");
    const strategyDelta = result.comparison?.categoryDeltas.find(
      ({ category }) => category === "strategy",
    );
    expect(strategyDelta).toMatchObject({
      delta: -6,
      toleranceBreached: true,
    });
  });

  it("rejects same-mode pairs and cross-benchmark pairs", async () => {
    const [treatmentPath, secondTreatmentPath] = await writePair(
      verdict("run-treatment-1", "treatment"),
      verdict("run-treatment-2", "treatment"),
    );

    const sameMode = await compareBenchmarkVerdicts(
      treatmentPath,
      secondTreatmentPath,
    );
    expect(sameMode.status).toBe("violations");
    expect(sameMode.diagnostics.map(({ code }) => code)).toEqual([
      "BENCHMARK_COMPARE_MODE_MISMATCH",
    ]);

    const [crossPath] = await writePair(
      verdict("run-control-x", "control", { benchmarkId: "other-benchmark" }),
      verdict("run-control-y", "control"),
    );
    const cross = await compareBenchmarkVerdicts(
      crossPath,
      secondTreatmentPath,
    );
    expect(cross.status).toBe("violations");
    expect(cross.diagnostics.map(({ code }) => code)).toContain(
      "BENCHMARK_COMPARE_BINDING_MISMATCH",
    );
  });

  it("fails operationally on unreadable files and rejects schema-invalid verdicts", async () => {
    const root = await mkdtemp(join(tmpdir(), "sah-compare-invalid-test-"));
    temporaryDirectories.push(root);
    const missing = join(root, "missing.json");

    const unreadable = await compareBenchmarkVerdicts(missing, missing);
    expect(unreadable.status).toBe("operational-error");
    expect(unreadable.diagnostics[0]?.code).toBe(
      "BENCHMARK_COMPARE_INPUT_UNREADABLE",
    );

    const invalidPath = join(root, "invalid.json");
    await writeFile(invalidPath, `${JSON.stringify({ nope: true })}\n`);
    const invalid = await compareBenchmarkVerdicts(invalidPath, invalidPath);
    expect(invalid.status).toBe("violations");
  });

  it("exposes comparisons through the CLI with mapped exit codes", async () => {
    const [treatmentPath, controlPath] = await writePair(
      verdict("run-treatment", "treatment"),
      verdict("run-control", "control"),
    );

    const compared = await runCli([
      "benchmark-compare",
      treatmentPath,
      controlPath,
      "--json",
    ]);
    expect(compared.code).toBe(0);
    expect(compared.stderr).toBe("");
    const output = JSON.parse(compared.stdout) as {
      status: string;
      comparison: { outcome: string; totalDelta: number };
    };
    expect(output.status).toBe("compared");
    expect(output.comparison.totalDelta).toBeCloseTo(0);

    const rejected = await runCli([
      "benchmark-compare",
      controlPath,
      controlPath,
    ]);
    expect(rejected.code).toBe(1);
    expect(rejected.stdout).toContain("rejected");
  });
});
