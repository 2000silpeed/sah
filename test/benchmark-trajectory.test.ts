import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  appendBenchmarkTrajectoryEntry,
  benchmarkTrajectoryEntrySchemaId,
  inspectBenchmarkTrajectory,
  prepareBenchmarkRun,
} from "../src/index.js";
import type { BenchmarkTrajectoryAppendOptions } from "../src/index.js";
import type { BenchmarkTrajectoryEntryKind } from "../src/index.js";
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

async function createPreparedRun(): Promise<{
  root: string;
  benchmark: string;
  run: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "sah-trajectory-test-"));
  temporaryDirectories.push(root);
  const benchmark = join(root, "bookmark");
  const runs = join(root, "runs");
  const run = join(runs, "treatment");
  await mkdir(benchmark);
  await mkdir(runs);
  await writeFile(
    join(benchmark, "problem.md"),
    "Keep the bookmark command local and reviewable.\n",
  );
  await writeFile(
    join(benchmark, "expectations.md"),
    "HIDDEN EXPECTATION SECRET: never enter participant context.\n",
  );
  const prepared = await prepareBenchmarkRun(benchmark, run, {
    runId: "bookmark-treatment-001",
    comparisonId: "bookmark-ab-001",
    mode: "treatment",
  });
  if (prepared.status !== "prepared")
    throw new Error("fixture preparation failed");
  return { root, benchmark, run };
}

function entry(
  seq: number,
  recordedAt: string,
  kind: BenchmarkTrajectoryEntryKind = "agent-message",
): BenchmarkTrajectoryAppendOptions {
  return {
    seq,
    recordedAt,
    kind,
    payload: { note: `entry ${String(seq)}` },
  };
}

async function trajectoryBytes(run: string): Promise<Buffer> {
  return readFile(join(run, "output", "trajectory.jsonl"));
}

describe("benchmark trajectory capture", () => {
  it("appends contiguous schema-valid entries to the reserved path", async () => {
    const fixture = await createPreparedRun();
    const first = await appendBenchmarkTrajectoryEntry(
      fixture.run,
      entry(1, "2026-08-22T00:00:01.000Z", "agent-message"),
    );
    const second = await appendBenchmarkTrajectoryEntry(fixture.run, {
      ...entry(2, "2026-08-22T00:00:02.000Z", "tool-invocation"),
      payload: { command: "npm test" },
    });

    expect(first.status).toBe("appended");
    expect(first.entry?.$schema).toBe(benchmarkTrajectoryEntrySchemaId);
    expect(second.status).toBe("appended");
    expect(second.view?.entryCount).toBe(2);
    expect(second.view?.firstSeq).toBe(1);
    expect(second.view?.lastSeq).toBe(2);
    expect(second.view?.sha256Digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(await readdir(join(fixture.run, "output"))).toEqual([
      "trajectory.jsonl",
    ]);

    const stored = (await trajectoryBytes(fixture.run))
      .toString("utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0);
    expect(stored).toHaveLength(2);
    for (const line of stored) expect(JSON.parse(line)).toBeTypeOf("object");
  });

  it("rejects a non-contiguous first sequence without creating output paths", async () => {
    const fixture = await createPreparedRun();
    const before = await readdir(fixture.run);
    const result = await appendBenchmarkTrajectoryEntry(
      fixture.run,
      entry(3, "2026-08-22T00:00:01.000Z"),
    );

    expect(result.status).toBe("operational-error");
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "BENCHMARK_TRAJECTORY_SEQ_MISMATCH",
    ]);
    expect(await readdir(fixture.run)).toEqual(before);
    expect(await readdir(fixture.run)).not.toContain("output");
  });

  it("rejects sequence gaps and time regressions without mutating bytes", async () => {
    const fixture = await createPreparedRun();
    await appendBenchmarkTrajectoryEntry(
      fixture.run,
      entry(1, "2026-08-22T00:00:01.000Z"),
    );
    const bytesBefore = await trajectoryBytes(fixture.run);

    const gap = await appendBenchmarkTrajectoryEntry(
      fixture.run,
      entry(3, "2026-08-22T00:00:02.000Z"),
    );
    expect(gap.status).toBe("operational-error");
    expect(gap.diagnostics.map(({ code }) => code)).toEqual([
      "BENCHMARK_TRAJECTORY_SEQ_MISMATCH",
    ]);

    const duplicate = await appendBenchmarkTrajectoryEntry(
      fixture.run,
      entry(1, "2026-08-22T00:00:02.000Z"),
    );
    expect(duplicate.status).toBe("operational-error");

    const regressed = await appendBenchmarkTrajectoryEntry(
      fixture.run,
      entry(2, "2026-08-22T00:00:00.000Z"),
    );
    expect(regressed.status).toBe("operational-error");
    expect(regressed.diagnostics.map(({ code }) => code)).toEqual([
      "BENCHMARK_TRAJECTORY_TIME_REGRESSED",
    ]);

    expect(await trajectoryBytes(fixture.run)).toEqual(bytesBefore);
  });

  it("rejects invalid envelopes before touching the filesystem", async () => {
    const fixture = await createPreparedRun();
    const invalidEntries: BenchmarkTrajectoryAppendOptions[] = [
      { ...entry(1, "2026-08-22T00:00:01.000Z"), payload: {} },
      entry(1, "not-a-timestamp"),
    ];
    for (const invalid of invalidEntries) {
      const result = await appendBenchmarkTrajectoryEntry(fixture.run, invalid);
      expect(result.status).toBe("operational-error");
      expect(result.diagnostics[0]?.code).toBe(
        "BENCHMARK_TRAJECTORY_ENTRY_INVALID",
      );
    }
    expect(await readdir(fixture.run)).toEqual(["problem.md"]);
  });

  it("binds capture to the sibling preparation record", async () => {
    const fixture = await createPreparedRun();
    const unprepared = join(fixture.root, "runs", "unprepared");
    await mkdir(unprepared);
    const missing = await appendBenchmarkTrajectoryEntry(
      unprepared,
      entry(1, "2026-08-22T00:00:01.000Z"),
    );
    expect(missing.status).toBe("operational-error");
    expect(missing.diagnostics.map(({ code }) => code)).toEqual([
      "BENCHMARK_TRAJECTORY_RECORD_MISSING",
    ]);

    const recordPath = `${fixture.run}.benchmark-run.json`;
    const originalRecord = await readFile(recordPath, "utf8");
    const tampered = originalRecord.replace(
      '"trajectoryPath": "trajectory.jsonl"',
      '"trajectoryPath": "other.jsonl"',
    );
    await writeFile(recordPath, tampered);
    const invalidRecord = await appendBenchmarkTrajectoryEntry(
      fixture.run,
      entry(1, "2026-08-22T00:00:01.000Z"),
    );
    expect(invalidRecord.status).toBe("operational-error");
    expect(invalidRecord.diagnostics.map(({ code }) => code)).toEqual([
      "BENCHMARK_TRAJECTORY_RECORD_INVALID",
    ]);
    await writeFile(recordPath, originalRecord);

    const otherRun = join(fixture.root, "elsewhere");
    await mkdir(otherRun);
    const mismatched = await prepareBenchmarkRun(
      fixture.benchmark,
      join(fixture.root, "runs", "mismatch"),
      {
        runId: "bookmark-mismatch-001",
        comparisonId: "bookmark-ab-002",
        mode: "control",
      },
    );
    expect(mismatched.status).toBe("prepared");
    const movedRecord = JSON.parse(originalRecord) as {
      isolatedTarget: { root: string };
    };
    movedRecord.isolatedTarget.root = otherRun;
    await writeFile(recordPath, `${JSON.stringify(movedRecord, null, 2)}\n`);
    const mismatch = await appendBenchmarkTrajectoryEntry(
      fixture.run,
      entry(1, "2026-08-22T00:00:01.000Z"),
    );
    expect(mismatch.status).toBe("operational-error");
    expect(mismatch.diagnostics.map(({ code }) => code)).toEqual([
      "BENCHMARK_TRAJECTORY_RUN_MISMATCH",
    ]);
  });

  it("refuses to append after the anchor line is corrupt", async () => {
    const fixture = await createPreparedRun();
    await appendBenchmarkTrajectoryEntry(
      fixture.run,
      entry(1, "2026-08-22T00:00:01.000Z"),
    );
    const trajectoryPath = join(fixture.run, "output", "trajectory.jsonl");
    const bytesBefore = await trajectoryBytes(fixture.run);
    await writeFile(
      trajectoryPath,
      `${bytesBefore.toString("utf8")}${bytesBefore.toString("utf8").slice(0, 20)}`,
    );

    const appended = await appendBenchmarkTrajectoryEntry(
      fixture.run,
      entry(2, "2026-08-22T00:00:02.000Z"),
    );
    expect(appended.status).toBe("operational-error");
    expect(appended.diagnostics.map(({ code }) => code)).toEqual([
      "BENCHMARK_TRAJECTORY_LAST_LINE_CORRUPT",
    ]);
    expect(appended.diagnostics[0]?.reference).toBe("line 2");

    const inspected = await inspectBenchmarkTrajectory(fixture.run);
    expect(inspected.status).toBe("operational-error");
    expect(inspected.diagnostics.map(({ code }) => code)).toEqual([
      "BENCHMARK_TRAJECTORY_CORRUPT",
    ]);
  });

  it("reports an honest read-only view without creating output paths", async () => {
    const fixture = await createPreparedRun();
    const empty = await inspectBenchmarkTrajectory(fixture.run);
    expect(empty.status).toBe("ok");
    expect(empty.view?.entryCount).toBe(0);
    expect(empty.view?.sha256Digest).toBeNull();
    expect(empty.trajectoryPath).toContain("trajectory.jsonl");
    expect(await readdir(fixture.run)).toEqual(["problem.md"]);

    await appendBenchmarkTrajectoryEntry(
      fixture.run,
      entry(1, "2026-08-22T00:00:01.000Z"),
    );
    const captured = await inspectBenchmarkTrajectory(fixture.run);
    expect(captured.status).toBe("ok");
    expect(captured.view).toEqual({
      byteSize: (await trajectoryBytes(fixture.run)).byteLength,
      sha256Digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      entryCount: 1,
      firstSeq: 1,
      lastSeq: 1,
      firstRecordedAt: "2026-08-22T00:00:01.000Z",
      lastRecordedAt: "2026-08-22T00:00:01.000Z",
    });
  });

  it("rejects symlinked output paths without following them", async () => {
    const fixture = await createPreparedRun();
    const outside = join(fixture.root, "outside-output");
    await mkdir(outside);
    await symlink(outside, join(fixture.run, "output"));

    const appended = await appendBenchmarkTrajectoryEntry(
      fixture.run,
      entry(1, "2026-08-22T00:00:01.000Z"),
    );
    expect(appended.status).toBe("operational-error");
    expect(appended.diagnostics.map(({ code }) => code)).toEqual([
      "BENCHMARK_TRAJECTORY_OUTPUT_UNSAFE",
    ]);
    expect(await readdir(outside)).toEqual([]);
  });

  it("exposes append and status through the CLI", async () => {
    const root = await mkdtemp(join(tmpdir(), "sah-trajectory-cli-test-"));
    temporaryDirectories.push(root);
    const run = join(root, "simple-crud-run");
    const prepared = await runCli([
      "benchmark-prepare",
      resolve("benchmarks/simple-crud"),
      run,
      "--run-id",
      "simple-crud-treatment-001",
      "--comparison-id",
      "simple-crud-ab-001",
      "--mode",
      "treatment",
      "--json",
    ]);
    expect(prepared.code).toBe(0);

    const entryPath = join(root, "entry.json");
    await writeFile(
      entryPath,
      `${JSON.stringify({
        seq: 1,
        recordedAt: "2026-08-22T00:00:01.000Z",
        kind: "system-event",
        payload: { note: "runner started" },
      })}\n`,
    );
    const appended = await runCli([
      "benchmark-trajectory",
      run,
      "--entry-file",
      entryPath,
      "--json",
    ]);
    const appendOutput = JSON.parse(appended.stdout) as {
      status: string;
      trajectoryPath: string;
      view: { entryCount: number };
      diagnostics: unknown[];
    };
    expect(appended.code).toBe(0);
    expect(appended.stderr).toBe("");
    expect(appendOutput.status).toBe("appended");
    expect(appendOutput.trajectoryPath).toContain("trajectory.jsonl");
    expect(appendOutput.view.entryCount).toBe(1);
    expect(appendOutput.diagnostics).toEqual([]);

    const status = await runCli(["benchmark-trajectory", run, "--status"]);
    expect(status.code).toBe(0);
    expect(status.stdout).toContain("1 entr");

    const missingAction = await runCli(["benchmark-trajectory", run]);
    expect(missingAction.code).toBe(2);

    const bothActions = await runCli([
      "benchmark-trajectory",
      run,
      "--status",
      "--entry-file",
      entryPath,
    ]);
    expect(bothActions.code).toBe(2);

    const badKindPath = join(root, "bad-kind.json");
    await writeFile(
      badKindPath,
      `${JSON.stringify({
        seq: 2,
        recordedAt: "2026-08-22T00:00:02.000Z",
        kind: "unknown",
        payload: { note: "nope" },
      })}\n`,
    );
    const badKind = await runCli([
      "benchmark-trajectory",
      run,
      "--entry-file",
      badKindPath,
    ]);
    expect(badKind.code).toBe(2);

    const extraFieldPath = join(root, "extra-field.json");
    await writeFile(
      extraFieldPath,
      `${JSON.stringify({
        seq: 2,
        recordedAt: "2026-08-22T00:00:02.000Z",
        kind: "system-event",
        payload: { note: "extra" },
        $schema: benchmarkTrajectoryEntrySchemaId,
      })}\n`,
    );
    const extraField = await runCli([
      "benchmark-trajectory",
      run,
      "--entry-file",
      extraFieldPath,
    ]);
    expect(extraField.code).toBe(2);

    const emptyPayloadPath = join(root, "empty-payload.json");
    await writeFile(
      emptyPayloadPath,
      `${JSON.stringify({
        seq: 2,
        recordedAt: "2026-08-22T00:00:02.000Z",
        kind: "system-event",
        payload: {},
      })}\n`,
    );
    const emptyPayload = await runCli([
      "benchmark-trajectory",
      run,
      "--entry-file",
      emptyPayloadPath,
    ]);
    expect(emptyPayload.code).toBe(2);
    expect(await inspectBenchmarkTrajectory(run)).toMatchObject({
      status: "ok",
    });

    const loaded = await loadSchemaRegistry();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      const inspected = await inspectBenchmarkTrajectory(run);
      expect(inspected.status).toBe("ok");
    }
  });
});
