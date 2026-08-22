import { spawn } from "node:child_process";
import {
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  aggregateBenchmarkJudgeReviews,
  assembleBenchmarkVerdict,
  benchmarkJudgeReviewSchemaId,
  benchmarkVerdictSchemaId,
} from "../src/index.js";
import type {
  BenchmarkJudgeCategory,
  BenchmarkJudgeReview,
  BenchmarkScore,
} from "../src/index.js";
import { loadSchemaRegistry } from "../src/schema-validation.js";
import { cliPath, fixtureDirectory } from "./helpers.js";

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

const basePoints: Record<BenchmarkJudgeCategory, number> = {
  characterization: 12,
  strategy: 16,
  responsibilities: 11,
  boundaries: 12,
  "quality-trade-offs": 11,
  "continuous-enforcement": 4,
};

function judgeRecord(judgeId: string): BenchmarkJudgeReview {
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
      points: basePoints[category],
      explanation: `${category} rationale`,
    })),
    penalties: {
      overEngineeringDeduction: 2,
      overEngineeringExplanation: "one extra layer",
    },
    fatalIndicators: [],
  };
}

async function writeScoreFile(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "sah-verdict-test-"));
  temporaryDirectories.push(root);
  const pathA = join(root, "judge-a.json");
  const pathB = join(root, "judge-b.json");
  await writeFile(
    pathA,
    `${JSON.stringify(judgeRecord("judge-a"), null, 2)}\n`,
  );
  await writeFile(
    pathB,
    `${JSON.stringify(judgeRecord("judge-b"), null, 2)}\n`,
  );
  const aggregated = await aggregateBenchmarkJudgeReviews(pathA, pathB);
  if (aggregated.score === undefined)
    throw new Error("fixture aggregation failed");
  const scorePath = join(root, "score.json");
  await writeFile(scorePath, `${JSON.stringify(aggregated.score, null, 2)}\n`);
  return scorePath;
}

async function copyParticipantBundle(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "sah-verdict-bundle-"));
  temporaryDirectories.push(root);
  const bundle = join(root, "bundle");
  await mkdir(bundle);
  for (const file of [
    "sah.bundle.json",
    "system-characterization.json",
    "design-strategy.json",
    "responsibility.json",
    "invariant.json",
    "architecture.json",
    "architecture-decision.json",
    "implementation-handoff.json",
  ]) {
    await copyFile(join(fixtureDirectory, file), join(bundle, file));
  }
  return bundle;
}

describe("benchmark verdict assembly", () => {
  it("assembles a passing verdict with deterministic points on a valid bundle", async () => {
    const scorePath = await writeScoreFile();
    const bundle = await copyParticipantBundle();
    const result = await assembleBenchmarkVerdict(scorePath, {
      bundleDirectory: bundle,
    });

    expect(result.status).toBe("passed");
    const verdict = result.verdict;
    if (!verdict) throw new Error("verdict missing");

    expect(verdict.judgeSubtotalFinal).toBeCloseTo(66);
    expect(verdict.deterministicPoints.artifactIntegrity).toEqual({
      points: 10,
      bundleValidated: true,
    });
    expect(verdict.deterministicPoints.enforcementDeterministic.points).toBe(5);
    expect(verdict.overEngineeringDeductionMean).toBe(2);
    expect(verdict.totalBeforeCap).toBeCloseTo(79);
    expect(verdict.total).toBeCloseTo(79);
    expect(verdict.thresholds).toEqual({
      minimumTotalMet: true,
      strategyMinimumMet: true,
      responsibilitiesMinimumMet: true,
      noFatalIndicator: true,
    });
    expect(verdict.status).toBe("passed");
    expect(verdict.stewardId).toBeNull();

    const loaded = await loadSchemaRegistry();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(
        loaded.registry.validate(benchmarkVerdictSchemaId, verdict, scorePath),
      ).toEqual([]);
    }
  });

  it("caps a fatal-flagged total at 49 and fails the run", async () => {
    const scorePath = await writeScoreFile();
    const raw = JSON.parse(await readFile(scorePath, "utf8")) as BenchmarkScore;
    raw.fatalIndicatorFlagged = true;
    await writeFile(scorePath, `${JSON.stringify(raw, null, 2)}\n`);
    const bundle = await copyParticipantBundle();

    const result = await assembleBenchmarkVerdict(scorePath, {
      bundleDirectory: bundle,
    });
    expect(result.status).toBe("failed");
    expect(result.verdict?.totalBeforeCap).toBeCloseTo(79);
    expect(result.verdict?.total).toBe(49);
    expect(result.verdict?.thresholds.noFatalIndicator).toBe(false);
    expect(result.verdict?.status).toBe("failed");
  });

  it("requires steward adjudication before assembling disputed runs", async () => {
    const root = await mkdtemp(join(tmpdir(), "sah-verdict-dispute-test-"));
    temporaryDirectories.push(root);
    const pathA = join(root, "a.json");
    const pathB = join(root, "b.json");
    const disputed = judgeRecord("judge-b");
    disputed.scores = disputed.scores.map((entry) =>
      entry.category === "responsibilities" ? { ...entry, points: 15 } : entry,
    );
    await writeFile(
      pathA,
      `${JSON.stringify(judgeRecord("judge-a"), null, 2)}\n`,
    );
    await writeFile(pathB, `${JSON.stringify(disputed, null, 2)}\n`);
    const aggregated = await aggregateBenchmarkJudgeReviews(pathA, pathB);
    if (aggregated.score === undefined) throw new Error("fixture failed");
    const scorePath = join(root, "score.json");
    await writeFile(
      scorePath,
      `${JSON.stringify(aggregated.score, null, 2)}\n`,
    );
    const bundle = await copyParticipantBundle();

    const blocked = await assembleBenchmarkVerdict(scorePath, {
      bundleDirectory: bundle,
    });
    expect(blocked.status).toBe("operational-error");
    expect(blocked.diagnostics[0]?.code).toBe(
      "BENCHMARK_VERDICT_ADJUDICATION_REQUIRED",
    );

    const adjudicationPath = join(root, "adjudication.json");
    await writeFile(
      adjudicationPath,
      `${JSON.stringify(
        {
          $schema: "https://sah.dev/schemas/benchmark-adjudication/v0.1.0",
          adjudicationVersion: "0.1.0",
          stewardId: "steward-main",
          runId: "simple-crud-treatment-001",
          comparisonId: "simple-crud-ab-001",
          benchmarkId: "simple-crud",
          mode: "treatment",
          trajectoryDigest: `sha256:${"a".repeat(64)}`,
          problemDigest: `sha256:${"b".repeat(64)}`,
          adjudicatedAt: "2026-08-22T16:00:00.000Z",
          entries: [
            {
              category: "responsibilities",
              points: 13,
              rationale: "Recovery evidence sits between the judges.",
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const resolved = await assembleBenchmarkVerdict(scorePath, {
      bundleDirectory: bundle,
      adjudicationFile: adjudicationPath,
    });
    expect(resolved.status).toBe("passed");
    expect(resolved.verdict?.stewardId).toBe("steward-main");
    const responsibilities = resolved.verdict?.finals.find(
      ({ category }) => category === "responsibilities",
    );
    expect(responsibilities).toMatchObject({
      points: 13,
      source: "adjudication",
    });
    expect(resolved.verdict?.judgeSubtotalFinal).toBeCloseTo(68);
  });

  it("rejects mismatched or over-covering adjudications", async () => {
    const scorePath = await writeScoreFile();
    const root = scorePath.slice(0, scorePath.lastIndexOf("/"));
    const bundle = await copyParticipantBundle();

    const wrongBinding = join(root, "wrong-binding.json");
    await writeFile(
      wrongBinding,
      `${JSON.stringify(
        {
          $schema: "https://sah.dev/schemas/benchmark-adjudication/v0.1.0",
          adjudicationVersion: "0.1.0",
          stewardId: "steward-main",
          runId: "other-run",
          comparisonId: "simple-crud-ab-001",
          benchmarkId: "simple-crud",
          mode: "treatment",
          trajectoryDigest: `sha256:${"a".repeat(64)}`,
          problemDigest: `sha256:${"b".repeat(64)}`,
          adjudicatedAt: "2026-08-22T16:00:00.000Z",
          entries: [
            {
              category: "strategy",
              points: 14,
              rationale: "not disputed",
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    const mismatched = await assembleBenchmarkVerdict(scorePath, {
      bundleDirectory: bundle,
      adjudicationFile: wrongBinding,
    });
    expect(mismatched.status).toBe("violations");
    expect(mismatched.diagnostics.map(({ code }) => code)).toContain(
      "BENCHMARK_VERDICT_BINDING_MISMATCH",
    );

    const overCovering = join(root, "over-covering.json");
    await writeFile(
      overCovering,
      `${JSON.stringify(
        {
          $schema: "https://sah.dev/schemas/benchmark-adjudication/v0.1.0",
          adjudicationVersion: "0.1.0",
          stewardId: "steward-main",
          runId: "simple-crud-treatment-001",
          comparisonId: "simple-crud-ab-001",
          benchmarkId: "simple-crud",
          mode: "treatment",
          trajectoryDigest: `sha256:${"a".repeat(64)}`,
          problemDigest: `sha256:${"b".repeat(64)}`,
          adjudicatedAt: "2026-08-22T16:00:00.000Z",
          entries: [
            {
              category: "characterization",
              points: 12,
              rationale: "judges agreed here",
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    const covering = await assembleBenchmarkVerdict(scorePath, {
      bundleDirectory: bundle,
      adjudicationFile: overCovering,
    });
    expect(covering.status).toBe("violations");
    expect(covering.diagnostics.map(({ code }) => code)).toContain(
      "BENCHMARK_VERDICT_ADJUDICATION_MISMATCH",
    );
  });

  it("fails a valid run whose totals miss the thresholds", async () => {
    const scorePath = await writeScoreFile();
    const raw = JSON.parse(await readFile(scorePath, "utf8")) as BenchmarkScore;
    raw.categories = raw.categories.map((category) =>
      category.category === "strategy"
        ? { ...category, points: [10, 10], mean: 10 }
        : category,
    );
    await writeFile(scorePath, `${JSON.stringify(raw, null, 2)}\n`);
    const bundle = await copyParticipantBundle();

    const result = await assembleBenchmarkVerdict(scorePath, {
      bundleDirectory: bundle,
    });
    expect(result.status).toBe("failed");
    expect(result.verdict?.thresholds.strategyMinimumMet).toBe(false);
    expect(result.verdict?.totalBeforeCap).toBeCloseTo(73);
  });

  it("scores zero when the participant bundle does not validate", async () => {
    const scorePath = await writeScoreFile();
    const emptyBundle = await mkdtemp(join(tmpdir(), "sah-verdict-empty-"));
    temporaryDirectories.push(emptyBundle);

    const result = await assembleBenchmarkVerdict(scorePath, {
      bundleDirectory: emptyBundle,
    });
    expect(result.status).toBe("failed");
    expect(result.verdict?.deterministicPoints.artifactIntegrity).toEqual({
      points: 0,
      bundleValidated: false,
    });
    expect(
      result.verdict?.deterministicPoints.enforcementDeterministic,
    ).toEqual({
      points: 0,
      declaredConstraints: 0,
    });
  });

  it("records the verdict atomically through the CLI", async () => {
    const scorePath = await writeScoreFile();
    const bundle = await copyParticipantBundle();
    const recordPath = join(bundle, "..", "verdict-record.json");

    const execution = await runCli([
      "benchmark-verdict",
      scorePath,
      "--bundle",
      bundle,
      "--record",
      recordPath,
      "--json",
    ]);
    expect(execution.code).toBe(0);

    const output = JSON.parse(execution.stdout) as {
      status: string;
      verdict: { $schema: string; total: number };
      recordPath: string;
    };
    expect(output.status).toBe("passed");
    expect(output.verdict.$schema).toBe(benchmarkVerdictSchemaId);
    expect(output.recordPath).toBe(resolve(recordPath));
    const stored = JSON.parse(await readFile(recordPath, "utf8")) as {
      status: string;
    };
    expect(stored.status).toBe("passed");

    const rerun = await runCli([
      "benchmark-verdict",
      scorePath,
      "--bundle",
      bundle,
      "--record",
      recordPath,
    ]);
    expect(rerun.code).toBe(2);
  });
});
