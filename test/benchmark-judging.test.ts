import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  aggregateBenchmarkJudgeReviews,
  benchmarkJudgeReviewSchemaId,
  benchmarkScoreSchemaId,
} from "../src/index.js";
import type {
  BenchmarkJudgeCategory,
  BenchmarkJudgeReview,
} from "../src/index.js";
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

const categories: BenchmarkJudgeCategory[] = [
  "characterization",
  "strategy",
  "responsibilities",
  "boundaries",
  "quality-trade-offs",
  "continuous-enforcement",
];

const categoryPoints: Record<BenchmarkJudgeCategory, number> = {
  characterization: 12,
  strategy: 16,
  responsibilities: 11,
  boundaries: 12,
  "quality-trade-offs": 11,
  "continuous-enforcement": 4,
};

function judgeRecord(
  judgeId: string,
  overrides: Partial<BenchmarkJudgeReview> = {},
  pointOverrides: Partial<Record<BenchmarkJudgeCategory, number>> = {},
): BenchmarkJudgeReview {
  return {
    $schema: benchmarkJudgeReviewSchemaId,
    judgeVersion: "0.1.0",
    judgeId,
    runId: "simple-crud-treatment-001",
    comparisonId: "simple-crud-ab-001",
    benchmarkId: "simple-crud",
    mode: "treatment",
    trajectoryDigest: `sha256:${"a".repeat(64)}`,
    problemDigest: `sha256:${"b".repeat(64)}`,
    rubricVersion: "benchmark-strategy@2026-08-22",
    reviewedAt: "2026-08-22T14:00:00.000Z",
    scores: categories.map((category) => ({
      category,
      points: pointOverrides[category] ?? categoryPoints[category],
      explanation: `${category} rationale`,
    })),
    penalties: overrides.penalties ?? {
      overEngineeringDeduction: 2,
      overEngineeringExplanation: "one extra layer",
    },
    fatalIndicators: [],
    ...overrides,
  };
}

async function writeRecords(
  left: BenchmarkJudgeReview,
  right: BenchmarkJudgeReview,
): Promise<[string, string]> {
  const root = await mkdtemp(join(tmpdir(), "sah-judge-test-"));
  temporaryDirectories.push(root);
  const pathA = join(root, `${left.judgeId}.json`);
  const pathB = join(root, `${right.judgeId}.json`);
  await writeFile(pathA, `${JSON.stringify(left, null, 2)}\n`);
  await writeFile(pathB, `${JSON.stringify(right, null, 2)}\n`);
  return [pathA, pathB];
}

describe("benchmark judge aggregation", () => {
  it("agrees within tolerance and computes means and subtotal", async () => {
    const [pathA, pathB] = await writeRecords(
      judgeRecord("judge-b", {}, { strategy: 17 }),
      judgeRecord("judge-a"),
    );
    const result = await aggregateBenchmarkJudgeReviews(pathA, pathB);

    expect(result.status).toBe("scored");
    expect(result.score?.judges).toEqual(["judge-a", "judge-b"]);
    const strategy = result.score?.categories.find(
      (category) => category.category === "strategy",
    );
    expect(strategy).toEqual({
      category: "strategy",
      points: [16, 17],
      mean: 16.5,
      agreed: true,
    });
    expect(result.score?.adjudicationRequired).toBe(false);
    expect(result.score?.disputedCategories).toEqual([]);
    expect(result.score?.judgeSubtotal).toBeCloseTo(66.5);
    expect(result.diagnostics).toEqual([]);

    const loaded = await loadSchemaRegistry();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(
        loaded.registry.validate(benchmarkScoreSchemaId, result.score, pathA),
      ).toEqual([]);
    }
  });

  it("routes disagreements beyond three points to human adjudication", async () => {
    const [pathA, pathB] = await writeRecords(
      judgeRecord("judge-a"),
      judgeRecord("judge-b", {}, { responsibilities: 15, boundaries: 8 }),
    );
    const result = await aggregateBenchmarkJudgeReviews(pathA, pathB);

    expect(result.status).toBe("adjudication-required");
    expect(result.score?.disputedCategories.sort()).toEqual([
      "boundaries",
      "responsibilities",
    ]);
    expect(
      result.score?.categories.find(
        ({ category }) => category === "responsibilities",
      ),
    ).toMatchObject({ points: [11, 15], mean: null, agreed: false });
    expect(result.score?.judgeSubtotal).toBeNull();
    expect(result.score?.fatalIndicatorFlagged).toBe(false);
  });

  it("rejects binding mismatches between the two judges", async () => {
    const [pathA, pathB] = await writeRecords(
      judgeRecord("judge-a"),
      judgeRecord("judge-b", { runId: "simple-crud-control-001" }),
    );
    const result = await aggregateBenchmarkJudgeReviews(pathA, pathB);
    expect(result.status).toBe("violations");
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "BENCHMARK_JUDGE_BINDING_MISMATCH",
    );
    expect(result.score).toBeUndefined();
  });

  it("rejects a duplicated judge identity", async () => {
    const [pathA, pathB] = await writeRecords(
      judgeRecord("judge-a"),
      judgeRecord("judge-a"),
    );
    const result = await aggregateBenchmarkJudgeReviews(pathA, pathB);
    expect(result.status).toBe("violations");
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "BENCHMARK_JUDGE_DUPLICATE_JUDGE",
    );
  });

  it("enforces per-category maxima and completeness", async () => {
    const [pathA, pathB] = await writeRecords(
      judgeRecord("judge-a", {}, { "continuous-enforcement": 6 }),
      judgeRecord("judge-b", {
        scores: [
          ...categories
            .filter(
              (category) =>
                category !== "continuous-enforcement" &&
                category !== "boundaries",
            )
            .map((category) => ({
              category,
              points: categoryPoints[category],
              explanation: `${category} rationale`,
            })),
          { category: "boundaries", points: 12, explanation: "first pass" },
          { category: "boundaries", points: 13, explanation: "second pass" },
        ],
      }),
    );
    const result = await aggregateBenchmarkJudgeReviews(pathA, pathB);
    expect(result.status).toBe("violations");
    const codes = result.diagnostics.map(({ code }) => code);
    expect(codes).toContain("BENCHMARK_JUDGE_POINTS_OUT_OF_RANGE");
    expect(codes).toContain("BENCHMARK_JUDGE_SCORES_INCOMPLETE");
    expect(
      result.diagnostics.find(
        ({ code }) => code === "BENCHMARK_JUDGE_POINTS_OUT_OF_RANGE",
      )?.jsonPointer,
    ).toBe("/scores/5/points");
  });

  it("flags any reported fatal indicator without dropping raw points", async () => {
    const [pathA, pathB] = await writeRecords(
      judgeRecord("judge-a", { fatalIndicators: ["fabricated-evidence"] }),
      judgeRecord("judge-b"),
    );
    const result = await aggregateBenchmarkJudgeReviews(pathA, pathB);
    expect(result.status).toBe("scored");
    expect(result.score?.fatalIndicatorFlagged).toBe(true);
    expect(result.score?.judgeSubtotal).not.toBeNull();
  });

  it("fails operationally on unreadable or schema-invalid records", async () => {
    const root = await mkdtemp(join(tmpdir(), "sah-judge-invalid-test-"));
    temporaryDirectories.push(root);

    const missingPath = join(root, "missing.json");
    const missing = await aggregateBenchmarkJudgeReviews(
      missingPath,
      missingPath,
    );
    expect(missing.status).toBe("operational-error");
    expect(missing.diagnostics[0]?.code).toBe(
      "BENCHMARK_JUDGE_RECORD_UNREADABLE",
    );

    const brokenPath = join(root, "broken.json");
    await writeFile(brokenPath, "{ not json");
    const malformed = await aggregateBenchmarkJudgeReviews(
      brokenPath,
      brokenPath,
    );
    expect(malformed.status).toBe("operational-error");

    const invalidRecord = judgeRecord("judge-x") as Record<string, unknown>;
    delete invalidRecord.scores;
    const invalidPath = join(root, "invalid.json");
    await writeFile(invalidPath, JSON.stringify(invalidRecord));
    const invalid = await aggregateBenchmarkJudgeReviews(
      invalidPath,
      invalidPath,
    );
    expect(invalid.status).toBe("violations");
  });

  it("keeps the score projection stable through the CLI", async () => {
    const [pathA, pathB] = await writeRecords(
      judgeRecord("judge-a"),
      judgeRecord("judge-b", {}, { "continuous-enforcement": 5 }),
    );

    const execution = await runCli(["benchmark-judge", pathA, pathB, "--json"]);
    expect(execution.code).toBe(0);
    expect(execution.stderr).toBe("");

    const output = JSON.parse(execution.stdout) as {
      status: string;
      score: { $schema: string; adjudicationRequired: boolean };
      diagnostics: unknown[];
    };
    expect(output.status).toBe("scored");
    expect(output.score.$schema).toBe(benchmarkScoreSchemaId);
    expect(output.score.adjudicationRequired).toBe(false);
    expect(output.diagnostics).toEqual([]);
  });

  it("exits nonzero when steward adjudication is required", async () => {
    const [pathA, pathB] = await writeRecords(
      judgeRecord("judge-a"),
      judgeRecord("judge-b", {}, { responsibilities: 15 }),
    );
    const execution = await runCli(["benchmark-judge", pathA, pathB]);
    expect(execution.code).toBe(1);
    expect(execution.stdout).toContain("steward adjudication required");
  });
});
