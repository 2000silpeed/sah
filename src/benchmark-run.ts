import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import {
  benchmarkRunSchemaId,
  type BenchmarkPreparationOptions,
  type BenchmarkRun,
  type BenchmarkRunMode,
  type BenchmarkRunResult,
  type SahDiagnostic,
} from "./contracts.js";
import { summarize } from "./diagnostics.js";
import { loadSchemaRegistry } from "./schema-validation.js";

const problemFileName = "problem.md";
const recordSuffix = ".benchmark-run.json";

function diagnostic(input: {
  code: string;
  path?: string;
  message: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: "operational",
    capability: "Benchmark run isolation",
    classification: "deterministic",
    severity: "error",
    ...(input.path === undefined ? {} : { artifactPath: input.path }),
    message: input.message,
    expected: input.expected,
    repair: input.repair,
  };
}

function orderDiagnostics(diagnostics: SahDiagnostic[]): SahDiagnostic[] {
  return [...diagnostics].sort((left, right) =>
    [left.artifactPath ?? "", left.code, left.reference ?? ""]
      .join("\0")
      .localeCompare(
        [right.artifactPath ?? "", right.code, right.reference ?? ""].join(
          "\0",
        ),
      ),
  );
}

function preparationResult(
  status: BenchmarkRunResult["status"],
  runDirectory: string,
  diagnostics: SahDiagnostic[],
  run?: BenchmarkRun,
  recordPath?: string,
): BenchmarkRunResult {
  const ordered = orderDiagnostics(diagnostics);
  return {
    status,
    runDirectory,
    ...(recordPath === undefined ? {} : { recordPath }),
    ...(run === undefined ? {} : { run }),
    diagnostics: ordered,
    summary: summarize(ordered),
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function existingPath(
  path: string,
): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
  try {
    return await lstat(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return undefined;
    throw error;
  }
}

function validMode(value: string): value is BenchmarkRunMode {
  return value === "treatment" || value === "control";
}

function digest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export async function prepareBenchmarkRun(
  benchmarkDirectory: string,
  runDirectory: string,
  options: BenchmarkPreparationOptions,
): Promise<BenchmarkRunResult> {
  let runRoot = resolve(runDirectory);
  let recordPath = join(
    dirname(runRoot),
    `${basename(runRoot)}${recordSuffix}`,
  );

  if (!validMode(options.mode)) {
    return preparationResult(
      "operational-error",
      runRoot,
      [
        diagnostic({
          code: "BENCHMARK_MODE_INVALID",
          path: recordPath,
          message: `Benchmark mode ${String(options.mode)} is not supported.`,
          expected: "mode treatment or control",
          repair:
            "Select exactly one A/B mode and retry benchmark preparation.",
        }),
      ],
      undefined,
      recordPath,
    );
  }

  const requestedRunParent = dirname(runRoot);
  try {
    const physicalParent = await realpath(requestedRunParent);
    const parentStat = await lstat(physicalParent);
    if (!parentStat.isDirectory()) {
      return preparationResult(
        "operational-error",
        runRoot,
        [
          diagnostic({
            code: "BENCHMARK_RUN_PARENT_UNSAFE",
            path: requestedRunParent,
            message: "The benchmark run parent is not a regular directory.",
            expected: "a path resolving to a regular run parent directory",
            repair:
              "Choose a regular local directory for benchmark run output.",
          }),
        ],
        undefined,
        recordPath,
      );
    }
    runRoot = join(physicalParent, basename(runRoot));
    recordPath = join(dirname(runRoot), `${basename(runRoot)}${recordSuffix}`);
  } catch (error) {
    return preparationResult(
      "operational-error",
      runRoot,
      [
        diagnostic({
          code: "BENCHMARK_RUN_PARENT_UNREADABLE",
          path: requestedRunParent,
          message: errorMessage(
            error,
            "The benchmark run parent could not be resolved.",
          ),
          expected: "an existing readable run parent directory",
          repair: "Create a writable parent directory for the isolated run.",
        }),
      ],
      undefined,
      recordPath,
    );
  }

  const requestedBenchmarkRoot = resolve(benchmarkDirectory);
  let benchmarkRoot: string;
  try {
    const requestedStat = await lstat(requestedBenchmarkRoot);
    if (requestedStat.isSymbolicLink()) {
      return preparationResult(
        "operational-error",
        runRoot,
        [
          diagnostic({
            code: "BENCHMARK_ROOT_SYMLINK_REJECTED",
            path: benchmarkDirectory,
            message:
              "The benchmark root is a symlink and was not used as an input root.",
            expected: "an existing non-symlink benchmark directory",
            repair: "Pass the real benchmark fixture directory explicitly.",
          }),
        ],
        undefined,
        recordPath,
      );
    }
    if (!requestedStat.isDirectory()) {
      return preparationResult(
        "operational-error",
        runRoot,
        [
          diagnostic({
            code: "BENCHMARK_ROOT_NOT_DIRECTORY",
            path: benchmarkDirectory,
            message: "The benchmark input root is not a directory.",
            expected: "an existing benchmark directory",
            repair: "Pass the directory containing problem.md.",
          }),
        ],
        undefined,
        recordPath,
      );
    }
    benchmarkRoot = await realpath(requestedBenchmarkRoot);
  } catch (error) {
    return preparationResult(
      "operational-error",
      runRoot,
      [
        diagnostic({
          code: "BENCHMARK_ROOT_UNREADABLE",
          path: benchmarkDirectory,
          message: errorMessage(
            error,
            "The benchmark input root could not be opened.",
          ),
          expected: "an existing readable benchmark directory",
          repair: "Restore access to the benchmark directory and retry.",
        }),
      ],
      undefined,
      recordPath,
    );
  }

  const problemPath = join(benchmarkRoot, problemFileName);
  let problemStat;
  try {
    problemStat = await existingPath(problemPath);
  } catch (error) {
    return preparationResult(
      "operational-error",
      runRoot,
      [
        diagnostic({
          code: "BENCHMARK_PROBLEM_UNREADABLE",
          path: problemPath,
          message: errorMessage(error, "problem.md could not be inspected."),
          expected: "a directly-addressable problem.md file",
          repair:
            "Restore access to problem.md and retry benchmark preparation.",
        }),
      ],
      undefined,
      recordPath,
    );
  }
  if (problemStat === undefined) {
    return preparationResult(
      "operational-error",
      runRoot,
      [
        diagnostic({
          code: "BENCHMARK_PROBLEM_MISSING",
          path: problemPath,
          message: "The benchmark directory has no problem.md file.",
          expected: "one direct problem.md input file",
          repair:
            "Add the benchmark problem.md or choose another benchmark fixture.",
        }),
      ],
      undefined,
      recordPath,
    );
  }
  if (problemStat.isSymbolicLink()) {
    return preparationResult(
      "operational-error",
      runRoot,
      [
        diagnostic({
          code: "BENCHMARK_PROBLEM_SYMLINK_REJECTED",
          path: problemPath,
          message: "The benchmark problem.md is a symlink and was not copied.",
          expected: "a regular problem.md file owned by the benchmark root",
          repair: "Replace the symlink with a regular local problem.md file.",
        }),
      ],
      undefined,
      recordPath,
    );
  }
  if (!problemStat.isFile()) {
    return preparationResult(
      "operational-error",
      runRoot,
      [
        diagnostic({
          code: "BENCHMARK_PROBLEM_NOT_REGULAR",
          path: problemPath,
          message: "The benchmark problem.md is not a regular file.",
          expected: "one regular problem.md input file",
          repair: "Replace the special file with a regular problem.md file.",
        }),
      ],
      undefined,
      recordPath,
    );
  }

  let problemBytes: Buffer;
  try {
    problemBytes = await readFile(problemPath);
  } catch (error) {
    return preparationResult(
      "operational-error",
      runRoot,
      [
        diagnostic({
          code: "BENCHMARK_PROBLEM_READ_FAILED",
          path: problemPath,
          message: errorMessage(
            error,
            "The benchmark problem.md could not be read.",
          ),
          expected: "a readable regular problem.md file",
          repair: "Restore read access to problem.md and retry.",
        }),
      ],
      undefined,
      recordPath,
    );
  }

  const run: BenchmarkRun = {
    $schema: benchmarkRunSchemaId,
    runVersion: "0.1.0",
    runId: options.runId,
    comparisonId: options.comparisonId,
    benchmarkId: basename(benchmarkRoot),
    mode: options.mode,
    preparedAt: new Date().toISOString(),
    input: {
      files: ["problem.md"],
      problemPath: "problem.md",
      problemDigest: digest(problemBytes),
      instructionPolicy: "normal-sah-operating-instructions",
    },
    isolatedTarget: {
      root: runRoot,
    },
    capture: {
      outputDirectory: "output",
      trajectoryPath: "trajectory.jsonl",
    },
  };

  const loaded = await loadSchemaRegistry();
  if (!loaded.ok) {
    return preparationResult(
      "operational-error",
      runRoot,
      loaded.diagnostics,
      undefined,
      recordPath,
    );
  }
  const schemaDiagnostics = loaded.registry.validate(
    benchmarkRunSchemaId,
    run,
    recordPath,
    "operational",
  );
  if (schemaDiagnostics.length > 0) {
    return preparationResult(
      "operational-error",
      runRoot,
      schemaDiagnostics,
      undefined,
      recordPath,
    );
  }

  let runEntry;
  try {
    runEntry = await existingPath(runRoot);
  } catch (error) {
    return preparationResult(
      "operational-error",
      runRoot,
      [
        diagnostic({
          code: "BENCHMARK_RUN_TARGET_UNREADABLE",
          path: runRoot,
          message: errorMessage(
            error,
            "The isolated target path could not be inspected.",
          ),
          expected: "an absent isolated target path",
          repair: "Choose a new run directory without an existing entry.",
        }),
      ],
      undefined,
      recordPath,
    );
  }
  if (runEntry !== undefined) {
    return preparationResult(
      "operational-error",
      runRoot,
      [
        diagnostic({
          code: runEntry.isSymbolicLink()
            ? "BENCHMARK_RUN_TARGET_SYMLINK_REJECTED"
            : "BENCHMARK_RUN_TARGET_EXISTS",
          path: runRoot,
          message:
            "The isolated target path already exists and was not overwritten.",
          expected: "an absent isolated target path",
          repair: "Choose a fresh run directory for this preparation.",
        }),
      ],
      undefined,
      recordPath,
    );
  }

  let recordEntry;
  try {
    recordEntry = await existingPath(recordPath);
  } catch (error) {
    return preparationResult(
      "operational-error",
      runRoot,
      [
        diagnostic({
          code: "BENCHMARK_RECORD_UNREADABLE",
          path: recordPath,
          message: errorMessage(
            error,
            "The benchmark record path could not be inspected.",
          ),
          expected: "an absent benchmark record path",
          repair:
            "Choose a new run directory or remove the stale record with its owner.",
        }),
      ],
      undefined,
      recordPath,
    );
  }
  if (recordEntry !== undefined) {
    return preparationResult(
      "operational-error",
      runRoot,
      [
        diagnostic({
          code: "BENCHMARK_RECORD_EXISTS",
          path: recordPath,
          message:
            "The benchmark record path already exists and was not overwritten.",
          expected: "an absent benchmark record path",
          repair:
            "Choose a fresh run directory or retain the existing record unchanged.",
        }),
      ],
      undefined,
      recordPath,
    );
  }

  let targetCreated = false;
  let recordClaimed = false;
  let committed = false;
  let recordHandle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    await mkdir(runRoot, { mode: 0o700 });
    targetCreated = true;
    await writeFile(join(runRoot, problemFileName), problemBytes, {
      flag: "wx",
      mode: 0o600,
    });

    recordHandle = await open(recordPath, "wx", 0o600);
    recordClaimed = true;
    await recordHandle.writeFile(`${JSON.stringify(run, null, 2)}\n`, "utf8");
    await recordHandle.sync();
    await recordHandle.close();
    recordHandle = undefined;

    committed = true;
    return preparationResult("prepared", runRoot, [], run, recordPath);
  } catch (error) {
    return preparationResult(
      "operational-error",
      runRoot,
      [
        diagnostic({
          code: "BENCHMARK_RUN_PREPARE_FAILED",
          path: runRoot,
          message: errorMessage(
            error,
            "The isolated benchmark run could not be prepared.",
          ),
          expected:
            "one fresh target containing only problem.md and one sibling record",
          repair:
            "Remove only the newly-created failed run paths and retry in a writable directory.",
        }),
      ],
      undefined,
      recordPath,
    );
  } finally {
    if (recordHandle !== undefined)
      await recordHandle.close().catch(() => undefined);
    if (!committed) {
      if (recordClaimed) await unlink(recordPath).catch(() => undefined);
      if (targetCreated) await rm(runRoot, { recursive: true, force: true });
    }
  }
}
