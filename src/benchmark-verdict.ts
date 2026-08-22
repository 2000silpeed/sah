import { open, readFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  benchmarkAdjudicationSchemaId,
  benchmarkScoreSchemaId,
  benchmarkVerdictSchemaId,
  type BenchmarkAdjudication,
  type BenchmarkScore,
  type BenchmarkVerdict,
  type BenchmarkVerdictOptions,
  type BenchmarkVerdictResult,
  type SahDiagnostic,
} from "./contracts.js";
import { categoryMaxima } from "./benchmark-judging.js";
import { validateBundle } from "./model-repository.js";
import { summarize } from "./diagnostics.js";
import { loadSchemaRegistry } from "./schema-validation.js";

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
    capability: "Benchmark verdict assembly",
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
    code: "BENCHMARK_VERDICT_INPUT_UNREADABLE",
    category: "operational",
    capability: "Benchmark verdict assembly",
    severity: "error",
    artifactPath,
    message,
    expected: "a readable, well-formed JSON input for verdict assembly",
    repair: "Restore the input file or correct its path and rerun the command.",
  };
}

function verdictResult(
  status: BenchmarkVerdictResult["status"],
  scorePath: string,
  diagnostics: SahDiagnostic[],
  fields: { verdict?: BenchmarkVerdict; recordPath?: string } = {},
): BenchmarkVerdictResult {
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
    scorePath,
    ...fields,
    diagnostics: ordered,
    summary: summarize(ordered),
  };
}

async function readJsonFile(
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
          : "The JSON input is unreadable.",
      ),
    };
  }
}

function scoreBinding(score: BenchmarkScore): string[] {
  return [
    score.runId,
    score.comparisonId,
    score.benchmarkId,
    score.mode,
    score.trajectoryDigest,
    score.problemDigest,
  ];
}

function adjudicationBinding(adjudication: BenchmarkAdjudication): string[] {
  return [
    adjudication.runId,
    adjudication.comparisonId,
    adjudication.benchmarkId,
    adjudication.mode,
    adjudication.trajectoryDigest,
    adjudication.problemDigest,
  ];
}

const bindingLabels = [
  "runId",
  "comparisonId",
  "benchmarkId",
  "mode",
  "trajectoryDigest",
  "problemDigest",
] as const;

function deterministicPoints(bundleDirectory: string): Promise<{
  ok: true;
  integrity: 0 | 10;
  enforcement: 0 | 5;
  declaredConstraints: number;
  bundleValidated: boolean;
}> {
  return (async () => {
    const resolved = resolve(bundleDirectory);
    const validation = await validateBundle(resolved);
    const bundleValidated = validation.status === "passed";
    const integrity: 0 | 10 = bundleValidated ? 10 : 0;
    let declaredConstraints = 0;
    let enforcement: 0 | 5 = 0;
    if (bundleValidated) {
      const architectureBytes = await readFile(
        join(resolved, "architecture.json"),
        "utf8",
      );
      const architecture = JSON.parse(architectureBytes) as {
        constraints?: Array<{
          decisionRef?: unknown;
          classification?: unknown;
          observable?: { predicate?: unknown };
        }>;
      };
      const constraints = Array.isArray(architecture.constraints)
        ? architecture.constraints
        : [];
      declaredConstraints = constraints.length;
      const tracesToDecisions =
        declaredConstraints > 0 &&
        constraints.every(
          (constraint) => typeof constraint.decisionRef === "string",
        );
      const observablesDeclared = constraints.every(
        (constraint) =>
          constraint.classification !== "deterministic" ||
          typeof constraint.observable?.predicate === "string",
      );
      enforcement =
        tracesToDecisions && observablesDeclared && declaredConstraints > 0
          ? 5
          : 0;
    }
    return {
      ok: true as const,
      integrity,
      enforcement,
      declaredConstraints,
      bundleValidated,
    };
  })();
}

export async function assembleBenchmarkVerdict(
  scoreFile: string,
  options: BenchmarkVerdictOptions,
): Promise<BenchmarkVerdictResult> {
  const scorePathResolved = resolve(scoreFile);
  const scoreInput = await readJsonFile(scoreFile);
  if (!scoreInput.ok) {
    return verdictResult("operational-error", scorePathResolved, [
      scoreInput.diagnostic,
    ]);
  }

  const loaded = await loadSchemaRegistry();
  if (!loaded.ok) {
    return verdictResult(
      "operational-error",
      scorePathResolved,
      loaded.diagnostics,
    );
  }

  const scoreSchemaDiagnostics = loaded.registry.validate(
    benchmarkScoreSchemaId,
    scoreInput.data,
    scoreInput.path,
  );
  if (
    scoreSchemaDiagnostics.length > 0 ||
    typeof scoreInput.data !== "object" ||
    scoreInput.data === null
  ) {
    return verdictResult(
      "violations",
      scorePathResolved,
      scoreSchemaDiagnostics,
    );
  }
  const score = scoreInput.data as BenchmarkScore;

  let adjudication: BenchmarkAdjudication | undefined;
  if (score.adjudicationRequired && options.adjudicationFile === undefined) {
    return verdictResult("operational-error", scorePathResolved, [
      diagnostic({
        code: "BENCHMARK_VERDICT_ADJUDICATION_REQUIRED",
        artifactPath: scorePathResolved,
        message:
          "The two-judge projection has unresolved disputes that a steward must adjudicate first.",
        expected: `steward adjudication covering ${score.disputedCategories.join(", ")}`,
        repair:
          "Supply --adjudication with final steward points for every disputed category.",
      }),
    ]);
  }
  if (options.adjudicationFile !== undefined) {
    const adjudicationInput = await readJsonFile(options.adjudicationFile);
    if (!adjudicationInput.ok) {
      return verdictResult("operational-error", scorePathResolved, [
        adjudicationInput.diagnostic,
      ]);
    }
    const adjudicationSchemaDiagnostics = loaded.registry.validate(
      benchmarkAdjudicationSchemaId,
      adjudicationInput.data,
      adjudicationInput.path,
    );
    if (
      adjudicationSchemaDiagnostics.length > 0 ||
      typeof adjudicationInput.data !== "object" ||
      adjudicationInput.data === null
    ) {
      return verdictResult(
        "violations",
        scorePathResolved,
        adjudicationSchemaDiagnostics,
      );
    }
    adjudication = adjudicationInput.data as BenchmarkAdjudication;

    const diagnostics: SahDiagnostic[] = [];
    adjudicationBinding(adjudication).forEach((value, index) => {
      if (value !== scoreBinding(score)[index]) {
        diagnostics.push(
          diagnostic({
            code: "BENCHMARK_VERDICT_BINDING_MISMATCH",
            artifactPath: adjudicationInput.path,
            jsonPointer: `/${bindingLabels[index]}`,
            message: `The adjudication disagrees with the score projection on ${String(bindingLabels[index])}.`,
            expected: "adjudication bound to the same frozen run as the judges",
            repair: "Re-adjudicate the disputed categories of this exact run.",
          }),
        );
      }
    });
    const entryCategories = new Set(
      adjudication.entries.map((entry) => entry.category),
    );
    for (const category of score.disputedCategories) {
      if (!entryCategories.has(category)) {
        diagnostics.push(
          diagnostic({
            code: "BENCHMARK_VERDICT_ADJUDICATION_MISMATCH",
            artifactPath: adjudicationInput.path,
            reference: category,
            message: `Disputed category ${category} has no steward adjudication.`,
            expected: "one adjudicated value per disputed category",
            repair: "Cover every disputed category exactly once.",
          }),
        );
      }
    }
    for (const [index, entry] of adjudication.entries.entries()) {
      if (!score.disputedCategories.includes(entry.category)) {
        diagnostics.push(
          diagnostic({
            code: "BENCHMARK_VERDICT_ADJUDICATION_MISMATCH",
            artifactPath: adjudicationInput.path,
            jsonPointer: `/entries/${index}/category`,
            message: `Adjudicated category ${entry.category} was not disputed.`,
            expected: "adjudication limited to the disputed categories",
            repair:
              "Remove entries for categories the judges already agreed on.",
          }),
        );
        continue;
      }
      if (entry.points < 0 || entry.points > categoryMaxima[entry.category]) {
        diagnostics.push(
          diagnostic({
            code: "BENCHMARK_VERDICT_POINTS_OUT_OF_RANGE",
            artifactPath: adjudicationInput.path,
            jsonPointer: `/entries/${index}/points`,
            message: `Steward awarded ${String(entry.points)} for ${entry.category}, whose maximum is ${String(categoryMaxima[entry.category])}.`,
            expected: `points between 0 and ${String(categoryMaxima[entry.category])}`,
            repair: "Award within the published rubric maximum.",
          }),
        );
      }
    }
    if (diagnostics.length > 0) {
      return verdictResult("violations", scorePathResolved, diagnostics);
    }
  }

  let deterministic;
  try {
    deterministic = await deterministicPoints(options.bundleDirectory);
  } catch (error) {
    return verdictResult("operational-error", scorePathResolved, [
      operationalDiagnostic(
        resolve(options.bundleDirectory),
        error instanceof Error
          ? error.message
          : "The participant bundle could not be scored deterministically.",
      ),
    ]);
  }

  const adjudicatedByCategory = new Map(
    (adjudication?.entries ?? []).map((entry) => [entry.category, entry]),
  );
  const finals = score.categories.map((category) => {
    const adjudicated = adjudicatedByCategory.get(category.category);
    if (!category.agreed && adjudicated !== undefined) {
      return {
        category: category.category,
        maxPoints: categoryMaxima[category.category],
        points: adjudicated.points,
        source: "adjudication" as const,
      };
    }
    return {
      category: category.category,
      maxPoints: categoryMaxima[category.category],
      points: category.mean ?? 0,
      source: "agreement" as const,
    };
  });

  const judgeSubtotalFinal = finals.reduce(
    (total, final) => total + final.points,
    0,
  );
  const overEngineeringDeductionMean =
    (score.overEngineeringDeductions[0] + score.overEngineeringDeductions[1]) /
    2;
  const totalBeforeCap =
    Math.round(
      (judgeSubtotalFinal +
        deterministic.integrity +
        deterministic.enforcement -
        overEngineeringDeductionMean) *
        100,
    ) / 100;
  const total = score.fatalIndicatorFlagged
    ? Math.min(totalBeforeCap, 49)
    : totalBeforeCap;
  const strategyFinal =
    finals.find((final) => final.category === "strategy")?.points ?? 0;
  const responsibilitiesFinal =
    finals.find((final) => final.category === "responsibilities")?.points ?? 0;

  const thresholds = {
    minimumTotalMet: total >= 70,
    strategyMinimumMet: strategyFinal >= 12,
    responsibilitiesMinimumMet: responsibilitiesFinal >= 9,
    noFatalIndicator: !score.fatalIndicatorFlagged,
  };
  const status: BenchmarkVerdict["status"] =
    thresholds.minimumTotalMet &&
    thresholds.strategyMinimumMet &&
    thresholds.responsibilitiesMinimumMet &&
    thresholds.noFatalIndicator
      ? "passed"
      : "failed";

  const verdict: BenchmarkVerdict = {
    $schema: benchmarkVerdictSchemaId,
    verdictVersion: "0.1.0",
    runId: score.runId,
    comparisonId: score.comparisonId,
    benchmarkId: score.benchmarkId,
    mode: score.mode,
    trajectoryDigest: score.trajectoryDigest,
    problemDigest: score.problemDigest,
    judges: score.judges,
    stewardId: adjudication?.stewardId ?? null,
    finals,
    judgeSubtotalFinal,
    deterministicPoints: {
      artifactIntegrity: {
        points: deterministic.integrity,
        bundleValidated: deterministic.bundleValidated,
      },
      enforcementDeterministic: {
        points: deterministic.enforcement,
        declaredConstraints: deterministic.declaredConstraints,
      },
    },
    overEngineeringDeductionMean,
    fatalIndicatorFlagged: score.fatalIndicatorFlagged,
    totalBeforeCap,
    total,
    thresholds,
    status,
  };

  const verdictSchemaDiagnostics = loaded.registry.validate(
    benchmarkVerdictSchemaId,
    verdict,
    scoreInput.path,
  );
  if (verdictSchemaDiagnostics.length > 0) {
    return verdictResult(
      "violations",
      scorePathResolved,
      verdictSchemaDiagnostics,
    );
  }

  if (options.recordFile !== undefined) {
    const recordPath = resolve(options.recordFile);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(recordPath, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(verdict, null, 2)}\n`, "utf8");
      await handle.sync();
      await handle.close();
      handle = undefined;
      return verdictResult(verdict.status, scorePathResolved, [], {
        verdict,
        recordPath,
      });
    } catch (error) {
      await unlink(recordPath).catch(() => undefined);
      return verdictResult("operational-error", scorePathResolved, [
        operationalDiagnostic(
          recordPath,
          error instanceof Error
            ? error.message
            : "The benchmark verdict could not be recorded.",
        ),
      ]);
    } finally {
      if (handle !== undefined) await handle.close().catch(() => undefined);
    }
  }

  return verdictResult(verdict.status, scorePathResolved, [], { verdict });
}
