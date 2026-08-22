import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  benchmarkJudgeReviewSchemaId,
  benchmarkScoreSchemaId,
  type BenchmarkJudgeCategory,
  type BenchmarkJudgeReview,
  type BenchmarkScore,
  type BenchmarkScoreResult,
  type SahDiagnostic,
} from "./contracts.js";
import { summarize } from "./diagnostics.js";
import { loadSchemaRegistry } from "./schema-validation.js";

export const categoryMaxima: Record<BenchmarkJudgeCategory, number> = {
  characterization: 15,
  strategy: 20,
  responsibilities: 15,
  boundaries: 15,
  "quality-trade-offs": 15,
  "continuous-enforcement": 5,
};

const agreementTolerance = 3;

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
    capability: "Benchmark judge aggregation",
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
    code: "BENCHMARK_JUDGE_RECORD_UNREADABLE",
    category: "operational",
    capability: "Benchmark judge aggregation",
    severity: "error",
    artifactPath,
    message,
    expected: "a readable, well-formed benchmark judge review JSON file",
    repair:
      "Restore the judge record or correct its path and rerun the command.",
  };
}

function scoreResult(
  status: BenchmarkScoreResult["status"],
  recordAPath: string,
  recordBPath: string,
  diagnostics: SahDiagnostic[],
  score?: BenchmarkScore,
): BenchmarkScoreResult {
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
    recordAPath,
    recordBPath,
    ...(score === undefined ? {} : { score }),
    diagnostics: ordered,
    summary: summarize(ordered),
  };
}

async function readJudgeRecord(
  file: string,
): Promise<
  | { ok: true; data: unknown; path: string }
  | { ok: false; diagnostic: SahDiagnostic; path: string }
> {
  const path = resolve(file);
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    return {
      ok: false,
      path,
      diagnostic: operationalDiagnostic(
        path,
        error instanceof Error
          ? error.message
          : "The judge record is unreadable.",
      ),
    };
  }
  try {
    return { ok: true, path, data: JSON.parse(source) as unknown };
  } catch (error) {
    return {
      ok: false,
      path,
      diagnostic: operationalDiagnostic(
        path,
        error instanceof Error
          ? `The judge record is malformed JSON: ${error.message}`
          : "The judge record is malformed JSON.",
      ),
    };
  }
}

function bindingOf(record: BenchmarkJudgeReview): string[] {
  return [
    record.runId,
    record.comparisonId,
    record.benchmarkId,
    record.mode,
    record.trajectoryDigest,
    record.problemDigest,
  ];
}

function mechanicalDiagnostics(
  left: BenchmarkJudgeReview,
  right: BenchmarkJudgeReview,
  leftPath: string,
  rightPath: string,
): SahDiagnostic[] {
  const diagnostics: SahDiagnostic[] = [];

  const labels = [
    "runId",
    "comparisonId",
    "benchmarkId",
    "mode",
    "trajectoryDigest",
    "problemDigest",
  ];
  bindingOf(left).forEach((value, index) => {
    if (value !== bindingOf(right)[index]) {
      diagnostics.push(
        diagnostic({
          code: "BENCHMARK_JUDGE_BINDING_MISMATCH",
          artifactPath: rightPath,
          jsonPointer: `/${labels[index]}`,
          message: `The two judge records disagree on ${String(labels[index])}.`,
          expected: "both judges to review the same frozen run and problem",
          repair:
            "Regenerate both reviews against one frozen capture before aggregating.",
        }),
      );
    }
  });

  if (left.judgeId === right.judgeId) {
    diagnostics.push(
      diagnostic({
        code: "BENCHMARK_JUDGE_DUPLICATE_JUDGE",
        artifactPath: rightPath,
        jsonPointer: "/judgeId",
        message: `Both records carry judge identity ${left.judgeId}.`,
        expected: "two distinct independent judge identities",
        repair: "Run a second independent judge session before aggregating.",
      }),
    );
  }

  for (const [record, recordPath] of [
    [left, leftPath],
    [right, rightPath],
  ] as const) {
    const seen = new Set<string>();
    for (const [index, entry] of record.scores.entries()) {
      if (seen.has(entry.category)) {
        diagnostics.push(
          diagnostic({
            code: "BENCHMARK_JUDGE_SCORES_INCOMPLETE",
            artifactPath: recordPath,
            jsonPointer: `/scores/${index}/category`,
            message: `Judge ${record.judgeId} scored category ${entry.category} more than once.`,
            expected: "exactly one score per LLM-judged category",
            repair: "Emit one entry for each of the six judged categories.",
          }),
        );
        continue;
      }
      seen.add(entry.category);
      if (entry.points > categoryMaxima[entry.category] || entry.points < 0) {
        diagnostics.push(
          diagnostic({
            code: "BENCHMARK_JUDGE_POINTS_OUT_OF_RANGE",
            artifactPath: recordPath,
            jsonPointer: `/scores/${index}/points`,
            message: `Judge ${record.judgeId} scored ${String(entry.points)} for ${entry.category}, whose maximum is ${String(categoryMaxima[entry.category])}.`,
            expected: `points between 0 and ${String(categoryMaxima[entry.category])} for ${entry.category}`,
            repair:
              "Score within the published common-rubric category maximum.",
          }),
        );
      }
    }
    for (const category of Object.keys(
      categoryMaxima,
    ) as BenchmarkJudgeCategory[]) {
      if (!seen.has(category)) {
        diagnostics.push(
          diagnostic({
            code: "BENCHMARK_JUDGE_SCORES_INCOMPLETE",
            artifactPath: recordPath,
            jsonPointer: "/scores",
            reference: category,
            message: `Judge ${record.judgeId} did not score category ${category}.`,
            expected: "exactly one score per LLM-judged category",
            repair: "Emit one entry for each of the six judged categories.",
          }),
        );
      }
    }
    if (
      record.penalties.overEngineeringDeduction < 0 ||
      record.penalties.overEngineeringDeduction > 20
    ) {
      diagnostics.push(
        diagnostic({
          code: "BENCHMARK_JUDGE_POINTS_OUT_OF_RANGE",
          artifactPath: recordPath,
          jsonPointer: "/penalties/overEngineeringDeduction",
          message: `Judge ${record.judgeId} deducted ${String(record.penalties.overEngineeringDeduction)} for over-engineering.`,
          expected: "a deduction between 0 and 20",
          repair: "Apply the published over-engineering penalty bounds.",
        }),
      );
    }
  }

  return diagnostics;
}

export async function aggregateBenchmarkJudgeReviews(
  recordAFile: string,
  recordBFile: string,
): Promise<BenchmarkScoreResult> {
  const recordAPath = resolve(recordAFile);
  const recordBPath = resolve(recordBFile);

  const readA = await readJudgeRecord(recordAFile);
  if (!readA.ok) {
    return scoreResult("operational-error", recordAPath, recordBPath, [
      readA.diagnostic,
    ]);
  }
  const readB = await readJudgeRecord(recordBFile);
  if (!readB.ok) {
    return scoreResult("operational-error", recordAPath, recordBPath, [
      readB.diagnostic,
    ]);
  }

  const loaded = await loadSchemaRegistry();
  if (!loaded.ok) {
    return scoreResult(
      "operational-error",
      recordAPath,
      recordBPath,
      loaded.diagnostics,
    );
  }

  const schemaA = loaded.registry.validate(
    benchmarkJudgeReviewSchemaId,
    readA.data,
    recordAPath,
  );
  const schemaB = loaded.registry.validate(
    benchmarkJudgeReviewSchemaId,
    readB.data,
    recordBPath,
  );
  const schemaViolations = [...schemaA, ...schemaB];
  if (schemaViolations.length > 0) {
    return scoreResult(
      "violations",
      recordAPath,
      recordBPath,
      schemaViolations,
    );
  }

  let left = { record: readA.data as BenchmarkJudgeReview, path: recordAPath };
  let right = { record: readB.data as BenchmarkJudgeReview, path: recordBPath };
  if (right.record.judgeId.localeCompare(left.record.judgeId) < 0) {
    const previousLeft = left;
    left = right;
    right = previousLeft;
  }

  const mechanical = mechanicalDiagnostics(
    left.record,
    right.record,
    left.path,
    right.path,
  );
  if (mechanical.length > 0) {
    return scoreResult("violations", recordAPath, recordBPath, mechanical);
  }

  const categories: BenchmarkScore["categories"] = Object.keys(categoryMaxima)
    .sort()
    .map((category) => {
      const pointsFor = (record: BenchmarkJudgeReview): number =>
        record.scores.find((entry) => entry.category === category)?.points ?? 0;
      const first = pointsFor(left.record);
      const second = pointsFor(right.record);
      const agreed = Math.abs(first - second) <= agreementTolerance;
      return {
        category: category as BenchmarkJudgeCategory,
        points: [first, second],
        mean: agreed ? (first + second) / 2 : null,
        agreed,
      };
    });

  const disputedCategories = categories
    .filter((category) => !category.agreed)
    .map((category) => category.category);
  const adjudicationRequired = disputedCategories.length > 0;
  const judgeSubtotal = adjudicationRequired
    ? null
    : categories.reduce((total, category) => total + (category.mean ?? 0), 0);

  const score: BenchmarkScore = {
    $schema: benchmarkScoreSchemaId,
    scoreVersion: "0.1.0",
    runId: left.record.runId,
    comparisonId: left.record.comparisonId,
    benchmarkId: left.record.benchmarkId,
    mode: left.record.mode,
    trajectoryDigest: left.record.trajectoryDigest,
    problemDigest: left.record.problemDigest,
    judges: [left.record.judgeId, right.record.judgeId],
    rubricVersions: [left.record.rubricVersion, right.record.rubricVersion],
    categories,
    disputedCategories,
    adjudicationRequired,
    fatalIndicatorFlagged:
      left.record.fatalIndicators.length > 0 ||
      right.record.fatalIndicators.length > 0,
    overEngineeringDeductions: [
      left.record.penalties.overEngineeringDeduction,
      right.record.penalties.overEngineeringDeduction,
    ],
    judgeSubtotal,
  };

  const scoreSchemaDiagnostics = loaded.registry.validate(
    benchmarkScoreSchemaId,
    score,
    recordAPath,
  );
  if (scoreSchemaDiagnostics.length > 0) {
    return scoreResult(
      "violations",
      recordAPath,
      recordBPath,
      scoreSchemaDiagnostics,
    );
  }

  return scoreResult(
    adjudicationRequired ? "adjudication-required" : "scored",
    recordAPath,
    recordBPath,
    [],
    score,
  );
}
