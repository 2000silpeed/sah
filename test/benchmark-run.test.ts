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

import { benchmarkRunSchemaId, prepareBenchmarkRun } from "../src/index.js";
import type { BenchmarkRunMode } from "../src/index.js";
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

async function createBenchmarkFixture(): Promise<{
  root: string;
  benchmark: string;
  runs: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "sah-benchmark-run-test-"));
  temporaryDirectories.push(root);
  const benchmark = join(root, "bookmark");
  const runs = join(root, "runs");
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
  await writeFile(
    join(benchmark, "scoring.md"),
    "HIDDEN SCORING SECRET: evaluator-only.\n",
  );
  return { root, benchmark, runs };
}

describe("benchmark run preparation", () => {
  it("rejects an unsupported mode before creating output paths", async () => {
    const fixture = await createBenchmarkFixture();
    const result = await prepareBenchmarkRun(
      fixture.benchmark,
      join(fixture.runs, "invalid-mode"),
      {
        runId: "bookmark-invalid-mode-001",
        comparisonId: "bookmark-ab-invalid",
        mode: "unsupported" as BenchmarkRunMode,
      },
    );

    expect(result.status).toBe("operational-error");
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "BENCHMARK_MODE_INVALID",
    ]);
    expect(await readdir(fixture.runs)).toEqual([]);
  });

  it("creates treatment and control targets with only problem.md", async () => {
    const fixture = await createBenchmarkFixture();
    const treatment = await prepareBenchmarkRun(
      fixture.benchmark,
      join(fixture.runs, "treatment"),
      {
        runId: "bookmark-treatment-001",
        comparisonId: "bookmark-ab-001",
        mode: "treatment",
      },
    );
    const control = await prepareBenchmarkRun(
      fixture.benchmark,
      join(fixture.runs, "control"),
      {
        runId: "bookmark-control-001",
        comparisonId: "bookmark-ab-001",
        mode: "control",
      },
    );

    expect(treatment.status).toBe("prepared");
    expect(control.status).toBe("prepared");
    expect(treatment.run?.mode).toBe("treatment");
    expect(control.run?.mode).toBe("control");
    expect(treatment.run?.comparisonId).toBe("bookmark-ab-001");
    expect(treatment.run?.input.files).toEqual(["problem.md"]);
    expect(treatment.run?.capture).toEqual({
      outputDirectory: "output",
      trajectoryPath: "trajectory.jsonl",
    });
    expect(await readdir(join(fixture.runs, "treatment"))).toEqual([
      "problem.md",
    ]);
    expect(
      await readFile(join(fixture.runs, "treatment", "problem.md"), "utf8"),
    ).toBe("Keep the bookmark command local and reviewable.\n");

    const record = await readFile(treatment.recordPath ?? "", "utf8");
    expect(record).not.toContain("HIDDEN EXPECTATION SECRET");
    expect(record).not.toContain("HIDDEN SCORING SECRET");

    const loaded = await loadSchemaRegistry();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(
        loaded.registry.validate(
          benchmarkRunSchemaId,
          treatment.run,
          treatment.recordPath ?? "benchmark-run.json",
        ),
      ).toEqual([]);
    }
  });

  it("does not overwrite an existing target or record", async () => {
    const fixture = await createBenchmarkFixture();
    const target = join(fixture.runs, "existing");
    await mkdir(target);
    await writeFile(join(target, "keep.txt"), "caller-owned\n");

    const targetResult = await prepareBenchmarkRun(fixture.benchmark, target, {
      runId: "bookmark-existing-001",
      comparisonId: "bookmark-ab-002",
      mode: "treatment",
    });
    expect(targetResult.status).toBe("operational-error");
    expect(targetResult.diagnostics.map(({ code }) => code)).toContain(
      "BENCHMARK_RUN_TARGET_EXISTS",
    );
    expect(await readFile(join(target, "keep.txt"), "utf8")).toBe(
      "caller-owned\n",
    );

    const cleanTarget = join(fixture.runs, "recorded");
    const recordPath = join(fixture.runs, "recorded.benchmark-run.json");
    await writeFile(recordPath, "caller-owned-record\n");
    const recordResult = await prepareBenchmarkRun(
      fixture.benchmark,
      cleanTarget,
      {
        runId: "bookmark-recorded-001",
        comparisonId: "bookmark-ab-003",
        mode: "control",
      },
    );
    expect(recordResult.status).toBe("operational-error");
    expect(recordResult.diagnostics.map(({ code }) => code)).toContain(
      "BENCHMARK_RECORD_EXISTS",
    );
    expect(await readFile(recordPath, "utf8")).toBe("caller-owned-record\n");
  });

  it("rejects symlinked benchmark roots, parents, and problem files", async () => {
    const fixture = await createBenchmarkFixture();
    const linkedRoot = join(fixture.root, "linked-benchmark");
    await symlink(fixture.benchmark, linkedRoot);
    const linkedRootResult = await prepareBenchmarkRun(
      linkedRoot,
      join(fixture.runs, "linked-root"),
      {
        runId: "bookmark-linked-root-001",
        comparisonId: "bookmark-ab-004",
        mode: "treatment",
      },
    );
    expect(linkedRootResult.status).toBe("operational-error");
    expect(linkedRootResult.diagnostics.map(({ code }) => code)).toContain(
      "BENCHMARK_ROOT_SYMLINK_REJECTED",
    );

    const linkedParent = join(fixture.root, "linked-runs");
    await symlink(fixture.runs, linkedParent);
    const linkedParentResult = await prepareBenchmarkRun(
      fixture.benchmark,
      join(linkedParent, "run"),
      {
        runId: "bookmark-linked-parent-001",
        comparisonId: "bookmark-ab-005",
        mode: "control",
      },
    );
    expect(linkedParentResult.status).toBe("prepared");
    expect(await readdir(join(fixture.runs, "run"))).toEqual(["problem.md"]);

    const linkedProblem = join(fixture.root, "linked-problem");
    await writeFile(linkedProblem, "outside problem\n");
    await rm(join(fixture.benchmark, "problem.md"));
    await symlink(linkedProblem, join(fixture.benchmark, "problem.md"));
    const linkedProblemResult = await prepareBenchmarkRun(
      fixture.benchmark,
      join(fixture.runs, "linked-problem"),
      {
        runId: "bookmark-linked-problem-001",
        comparisonId: "bookmark-ab-006",
        mode: "treatment",
      },
    );
    expect(linkedProblemResult.status).toBe("operational-error");
    expect(linkedProblemResult.diagnostics.map(({ code }) => code)).toContain(
      "BENCHMARK_PROBLEM_SYMLINK_REJECTED",
    );
  });

  it("exposes the isolation contract through the CLI", async () => {
    const root = await mkdtemp(join(tmpdir(), "sah-benchmark-cli-test-"));
    temporaryDirectories.push(root);
    const run = join(root, "simple-crud-treatment");
    const execution = await runCli([
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
    const output = JSON.parse(execution.stdout) as {
      status: string;
      run: {
        $schema: string;
        mode: string;
        input: { files: string[] };
      };
      diagnostics: unknown[];
    };

    expect(execution.code).toBe(0);
    expect(execution.stderr).toBe("");
    expect(output.status).toBe("prepared");
    expect(output.run.$schema).toBe(benchmarkRunSchemaId);
    expect(output.run.mode).toBe("treatment");
    expect(output.run.input.files).toEqual(["problem.md"]);
    expect(await readdir(run)).toEqual(["problem.md"]);
    expect(output.diagnostics).toEqual([]);
  });
});
