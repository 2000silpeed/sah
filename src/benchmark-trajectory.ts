import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import {
  benchmarkRunSchemaId,
  benchmarkTrajectoryEntrySchemaId,
  type BenchmarkRun,
  type BenchmarkTrajectoryAppendOptions,
  type BenchmarkTrajectoryAppendResult,
  type BenchmarkTrajectoryEntry,
  type BenchmarkTrajectoryInspectResult,
  type BenchmarkTrajectoryView,
  type SahDiagnostic,
} from "./contracts.js";
import { summarize } from "./diagnostics.js";
import { loadSchemaRegistry } from "./schema-validation.js";

const recordSuffix = ".benchmark-run.json";
const outputDirectoryName = "output";
const trajectoryFileName = "trajectory.jsonl";

function diagnostic(input: {
  code: string;
  path?: string;
  reference?: string;
  message: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: "operational",
    capability: "Benchmark trajectory capture",
    classification: "deterministic",
    severity: "error",
    ...(input.path === undefined ? {} : { artifactPath: input.path }),
    ...(input.reference === undefined ? {} : { reference: input.reference }),
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

function digest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

type ResolvedRunContext =
  | {
      ok: true;
      runRoot: string;
      trajectoryPath: string;
      outputDirectory: string;
      record: BenchmarkRun;
    }
  | { ok: false; diagnostics: SahDiagnostic[] };

async function resolveRunContext(
  runDirectory: string,
): Promise<ResolvedRunContext> {
  let runRoot = resolve(runDirectory);
  try {
    const physicalRoot = await realpath(runRoot);
    const rootStat = await lstat(physicalRoot);
    if (!rootStat.isDirectory()) {
      return {
        ok: false,
        diagnostics: [
          diagnostic({
            code: "BENCHMARK_TRAJECTORY_RUN_UNSAFE",
            path: runDirectory,
            message: "The benchmark run path is not a regular directory.",
            expected: "an existing regular prepared run directory",
            repair:
              "Pass the isolated run directory created by benchmark-prepare.",
          }),
        ],
      };
    }
    runRoot = physicalRoot;
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        diagnostic({
          code: "BENCHMARK_TRAJECTORY_RUN_UNSAFE",
          path: runDirectory,
          message: errorMessage(
            error,
            "The benchmark run path could not be resolved.",
          ),
          expected: "an existing readable prepared run directory",
          repair:
            "Create the run with sah benchmark-prepare and pass its directory.",
        }),
      ],
    };
  }

  const recordPath = join(
    dirname(runRoot),
    `${basename(runRoot)}${recordSuffix}`,
  );
  let recordValue: unknown;
  try {
    const recordRaw = await readFile(recordPath, "utf8");
    recordValue = JSON.parse(recordRaw) as unknown;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {
        ok: false,
        diagnostics: [
          diagnostic({
            code: "BENCHMARK_TRAJECTORY_RECORD_MISSING",
            path: recordPath,
            message:
              "No sibling benchmark-run record exists for this run directory.",
            expected: "one sibling <run>.benchmark-run.json preparation record",
            repair:
              "Prepare the run with sah benchmark-prepare before capturing trajectory entries.",
          }),
        ],
      };
    }
    return {
      ok: false,
      diagnostics: [
        diagnostic({
          code: "BENCHMARK_TRAJECTORY_RECORD_INVALID",
          path: recordPath,
          message: errorMessage(
            error,
            "The benchmark-run record could not be read or parsed.",
          ),
          expected: "one parseable sibling benchmark-run record",
          repair:
            "Repair or re-prepare the benchmark run record unchanged elsewhere.",
        }),
      ],
    };
  }

  const loaded = await loadSchemaRegistry();
  if (!loaded.ok) {
    return { ok: false, diagnostics: loaded.diagnostics };
  }
  const schemaDiagnostics = loaded.registry.validate(
    benchmarkRunSchemaId,
    recordValue,
    recordPath,
    "operational",
  );
  if (
    schemaDiagnostics.length > 0 ||
    typeof recordValue !== "object" ||
    recordValue === null
  ) {
    const pointer = schemaDiagnostics[0]?.jsonPointer;
    return {
      ok: false,
      diagnostics: [
        diagnostic({
          code: "BENCHMARK_TRAJECTORY_RECORD_INVALID",
          path: recordPath,
          ...(pointer === undefined ? {} : { reference: pointer }),
          message:
            "The sibling benchmark-run record does not satisfy its schema.",
          expected: "a schema-valid benchmark-run preparation record",
          repair:
            "Re-prepare a fresh benchmark run instead of editing the evaluator record.",
        }),
      ],
    };
  }

  const record = recordValue as BenchmarkRun;
  let boundRoot: string;
  try {
    boundRoot = await realpath(record.isolatedTarget.root);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        diagnostic({
          code: "BENCHMARK_TRAJECTORY_RUN_MISMATCH",
          path: record.isolatedTarget.root,
          message: errorMessage(
            error,
            "The recorded isolated target root could not be resolved.",
          ),
          expected:
            "a record whose isolated target root matches the run directory",
          repair:
            "Capture inside the original prepared run directory referenced by the record.",
        }),
      ],
    };
  }
  if (boundRoot !== runRoot) {
    return {
      ok: false,
      diagnostics: [
        diagnostic({
          code: "BENCHMARK_TRAJECTORY_RUN_MISMATCH",
          path: runRoot,
          message:
            "The benchmark-run record references a different isolated target root.",
          expected:
            "a record whose isolated target root matches the run directory",
          repair:
            "Capture inside the original prepared run directory referenced by the record.",
        }),
      ],
    };
  }

  const outputDirectory = join(runRoot, outputDirectoryName);
  const trajectoryPath = join(outputDirectory, trajectoryFileName);

  const outputStat = await existingPath(outputDirectory).catch(() => undefined);
  if (
    outputStat !== undefined &&
    (outputStat.isSymbolicLink() || !outputStat.isDirectory())
  ) {
    return {
      ok: false,
      diagnostics: [
        diagnostic({
          code: "BENCHMARK_TRAJECTORY_OUTPUT_UNSAFE",
          path: outputDirectory,
          message:
            "The reserved output path is not a regular directory and was not used.",
          expected: "an absent or regular output directory inside the run root",
          repair:
            "Remove the unsafe output path only with its owner's consent.",
        }),
      ],
    };
  }

  const trajectoryStat = await existingPath(trajectoryPath).catch(
    () => undefined,
  );
  if (
    trajectoryStat !== undefined &&
    (trajectoryStat.isSymbolicLink() || !trajectoryStat.isFile())
  ) {
    return {
      ok: false,
      diagnostics: [
        diagnostic({
          code: "BENCHMARK_TRAJECTORY_OUTPUT_UNSAFE",
          path: trajectoryPath,
          message:
            "The reserved trajectory path is not a regular file and was not used.",
          expected: "an absent or regular trajectory.jsonl file",
          repair:
            "Remove the unsafe trajectory path only with its owner's consent.",
        }),
      ],
    };
  }

  return { ok: true, runRoot, trajectoryPath, outputDirectory, record };
}

function emptyView(): BenchmarkTrajectoryView {
  return {
    byteSize: 0,
    sha256Digest: null,
    entryCount: 0,
    firstSeq: null,
    lastSeq: null,
    firstRecordedAt: null,
    lastRecordedAt: null,
  };
}

function trajectoryLines(bytes: Buffer): string[] {
  return bytes
    .toString("utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0);
}

function viewFromBytes(bytes: Buffer): BenchmarkTrajectoryView {
  const lines = trajectoryLines(bytes);
  const view = emptyView();
  view.byteSize = bytes.byteLength;
  view.sha256Digest = digest(bytes);
  view.entryCount = lines.length;
  for (const line of lines) {
    const value = JSON.parse(line) as BenchmarkTrajectoryEntry;
    if (view.firstSeq === null) {
      view.firstSeq = value.seq;
      view.firstRecordedAt = value.recordedAt;
    }
    view.lastSeq = value.seq;
    view.lastRecordedAt = value.recordedAt;
  }
  return view;
}

export async function appendBenchmarkTrajectoryEntry(
  runDirectory: string,
  entry: BenchmarkTrajectoryAppendOptions,
): Promise<BenchmarkTrajectoryAppendResult> {
  const context = await resolveRunContext(runDirectory);
  if (!context.ok) {
    return appendResult("operational-error", runDirectory, context.diagnostics);
  }

  const envelope: BenchmarkTrajectoryEntry = {
    $schema: benchmarkTrajectoryEntrySchemaId,
    seq: entry.seq,
    recordedAt: entry.recordedAt,
    kind: entry.kind,
    payload: entry.payload,
  };

  const loaded = await loadSchemaRegistry();
  if (!loaded.ok) {
    return appendResult("operational-error", runDirectory, loaded.diagnostics);
  }
  const envelopeDiagnostics = loaded.registry.validate(
    benchmarkTrajectoryEntrySchemaId,
    envelope,
    context.trajectoryPath,
    "operational",
  );
  if (envelopeDiagnostics.length > 0) {
    const first = envelopeDiagnostics[0];
    return appendResult("operational-error", runDirectory, [
      diagnostic({
        code: "BENCHMARK_TRAJECTORY_ENTRY_INVALID",
        path: context.trajectoryPath,
        ...(first?.jsonPointer === undefined
          ? {}
          : { reference: first.jsonPointer }),
        message: `The trajectory entry envelope is invalid. ${first?.message ?? "It violates the entry schema."}`,
        expected: "one schema-valid trajectory entry envelope without $schema",
        repair:
          "Supply seq, recordedAt, kind, and a non-empty payload object and retry.",
      }),
    ]);
  }

  let priorBytes: Buffer | undefined;
  try {
    priorBytes = await readFile(context.trajectoryPath);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
  let lastSeq: number | null = null;
  let lastRecordedAt: string | null = null;
  if (priorBytes !== undefined && priorBytes.byteLength > 0) {
    const lines = trajectoryLines(priorBytes);
    if (lines.length > 0) {
      const anchorLine = lines[lines.length - 1] ?? "";
      let anchor: unknown;
      try {
        anchor = JSON.parse(anchorLine) as unknown;
      } catch {
        return anchorFailure(context, runDirectory, lines.length);
      }
      const anchorDiagnostics = loaded.registry.validate(
        benchmarkTrajectoryEntrySchemaId,
        anchor,
        context.trajectoryPath,
        "operational",
      );
      if (anchorDiagnostics.length > 0)
        return anchorFailure(context, runDirectory, lines.length);
      const anchorEntry = anchor as BenchmarkTrajectoryEntry;
      lastSeq = anchorEntry.seq;
      lastRecordedAt = anchorEntry.recordedAt;
    }
  }

  const expectedSeq = lastSeq === null ? 1 : lastSeq + 1;
  if (entry.seq !== expectedSeq) {
    return appendResult("operational-error", runDirectory, [
      diagnostic({
        code: "BENCHMARK_TRAJECTORY_SEQ_MISMATCH",
        path: context.trajectoryPath,
        message: `Sequence ${String(entry.seq)} breaks trajectory continuity.`,
        expected: `seq ${String(expectedSeq)} following ${
          lastSeq === null ? "an empty trajectory" : `seq ${String(lastSeq)}`
        }`,
        repair: "Append the next consecutive sequence number for this run.",
      }),
    ]);
  }
  if (lastRecordedAt !== null && entry.recordedAt < lastRecordedAt) {
    return appendResult("operational-error", runDirectory, [
      diagnostic({
        code: "BENCHMARK_TRAJECTORY_TIME_REGRESSED",
        path: context.trajectoryPath,
        message: "recordedAt moved backwards relative to the previous entry.",
        expected: `recordedAt at or after ${lastRecordedAt}`,
        repair: "Supply non-decreasing capture timestamps within one run.",
      }),
    ]);
  }

  let handle: Awaited<ReturnType<typeof open>> | undefined;
  const outputExisted =
    (await existingPath(context.outputDirectory).catch(() => undefined)) !==
    undefined;
  try {
    await mkdir(context.outputDirectory, { recursive: true, mode: 0o700 });
    handle = await open(context.trajectoryPath, "a", 0o600);
    await handle.writeFile(`${JSON.stringify(envelope)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
  } catch (error) {
    if (!outputExisted) {
      const trajectoryAfter = await existingPath(context.trajectoryPath).catch(
        () => undefined,
      );
      if (trajectoryAfter === undefined || trajectoryAfter.size === 0)
        await rm(context.outputDirectory, { recursive: true, force: true });
    }
    return appendResult("operational-error", runDirectory, [
      diagnostic({
        code: "BENCHMARK_TRAJECTORY_APPEND_FAILED",
        path: context.trajectoryPath,
        message: errorMessage(
          error,
          "The trajectory entry could not be appended.",
        ),
        expected: "one durable JSONL line appended to trajectory.jsonl",
        repair: "Restore writability of the run output directory and retry.",
      }),
    ]);
  } finally {
    if (handle !== undefined) await handle.close().catch(() => undefined);
  }

  const finalBytes = await readFile(context.trajectoryPath);
  return appendResult("appended", runDirectory, [], {
    trajectoryPath: context.trajectoryPath,
    entry: envelope,
    view: viewFromBytes(finalBytes),
  });
}

function anchorFailure(
  context: { trajectoryPath: string },
  runDirectory: string,
  lineNumber: number,
): BenchmarkTrajectoryAppendResult {
  return appendResult("operational-error", runDirectory, [
    diagnostic({
      code: "BENCHMARK_TRAJECTORY_LAST_LINE_CORRUPT",
      path: context.trajectoryPath,
      reference: `line ${String(lineNumber)}`,
      message: "The final stored trajectory line is corrupt or schema-invalid.",
      expected: "every stored line to parse as one valid trajectory entry",
      repair:
        "Inspect the capture with --status, then restore the corrupt tail from its owner before appending.",
    }),
  ]);
}

function appendResult(
  status: BenchmarkTrajectoryAppendResult["status"],
  runDirectory: string,
  diagnostics: SahDiagnostic[],
  fields: {
    trajectoryPath?: string;
    entry?: BenchmarkTrajectoryEntry;
    view?: BenchmarkTrajectoryView;
  } = {},
): BenchmarkTrajectoryAppendResult {
  const ordered = orderDiagnostics(diagnostics);
  return {
    status,
    runDirectory,
    ...fields,
    diagnostics: ordered,
    summary: summarize(ordered),
  };
}

function inspectResult(
  status: BenchmarkTrajectoryInspectResult["status"],
  runDirectory: string,
  diagnostics: SahDiagnostic[],
  fields: { trajectoryPath?: string; view?: BenchmarkTrajectoryView } = {},
): BenchmarkTrajectoryInspectResult {
  const ordered = orderDiagnostics(diagnostics);
  return {
    status,
    runDirectory,
    ...fields,
    diagnostics: ordered,
    summary: summarize(ordered),
  };
}

export async function inspectBenchmarkTrajectory(
  runDirectory: string,
): Promise<BenchmarkTrajectoryInspectResult> {
  const context = await resolveRunContext(runDirectory);
  if (!context.ok) {
    return inspectResult(
      "operational-error",
      runDirectory,
      context.diagnostics,
    );
  }

  const loaded = await loadSchemaRegistry();
  if (!loaded.ok) {
    return inspectResult("operational-error", runDirectory, loaded.diagnostics);
  }

  let bytes: Buffer | undefined;
  try {
    bytes = await readFile(context.trajectoryPath);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }

  if (bytes === undefined || bytes.byteLength === 0) {
    return inspectResult("ok", runDirectory, [], {
      trajectoryPath: context.trajectoryPath,
      view: emptyView(),
    });
  }

  const rawLines = bytes.toString("utf8").split("\n");
  const meaningful: Array<{ number: number; text: string }> = [];
  for (let index = 0; index < rawLines.length; index += 1) {
    const text = rawLines[index] ?? "";
    if (text.trim().length === 0) continue;
    meaningful.push({ number: index + 1, text });
  }

  const view = emptyView();
  view.byteSize = bytes.byteLength;
  view.sha256Digest = digest(bytes);
  view.entryCount = meaningful.length;

  let firstSeq: number | null = null;
  let firstRecordedAt: string | null = null;
  let lastSeq: number | null = null;
  let lastRecordedAt: string | null = null;

  for (const line of meaningful) {
    let value: unknown;
    try {
      value = JSON.parse(line.text) as unknown;
    } catch {
      return inspectResult("operational-error", runDirectory, [
        diagnostic({
          code: "BENCHMARK_TRAJECTORY_CORRUPT",
          path: context.trajectoryPath,
          reference: `line ${String(line.number)}`,
          message: "A stored trajectory line is not parseable JSON.",
          expected: "every stored line to parse as one valid trajectory entry",
          repair:
            "Restore the captured trajectory from its owner before evaluation.",
        }),
      ]);
    }
    const lineDiagnostics = loaded.registry.validate(
      benchmarkTrajectoryEntrySchemaId,
      value,
      context.trajectoryPath,
      "operational",
    );
    if (lineDiagnostics.length > 0) {
      return inspectResult("operational-error", runDirectory, [
        diagnostic({
          code: "BENCHMARK_TRAJECTORY_CORRUPT",
          path: context.trajectoryPath,
          reference: `line ${String(line.number)}`,
          message: "A stored trajectory line violates the entry schema.",
          expected: "every stored line to satisfy the trajectory entry schema",
          repair:
            "Restore the captured trajectory from its owner before evaluation.",
        }),
      ]);
    }
    const entry = value as BenchmarkTrajectoryEntry;
    if (firstSeq === null) {
      firstSeq = entry.seq;
      firstRecordedAt = entry.recordedAt;
    }
    lastSeq = entry.seq;
    lastRecordedAt = entry.recordedAt;
  }

  view.firstSeq = firstSeq;
  view.firstRecordedAt = firstRecordedAt;
  view.lastSeq = lastSeq;
  view.lastRecordedAt = lastRecordedAt;

  return inspectResult("ok", runDirectory, [], {
    trajectoryPath: context.trajectoryPath,
    view,
  });
}
