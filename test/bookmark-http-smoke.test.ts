import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validateBundle } from "../src/index.js";
import {
  bindIterationContext,
  recordIterationOutcome,
  runIterationChecks,
} from "../src/iteration-loop.js";
import type { IterationContextOptions } from "../src/contracts.js";
import { loadBundleForLineage } from "../src/model-repository.js";
import {
  bookmarkLineageDirectory,
  cleanupFixtures,
  cliPath,
  copyBookmarkHttpTarget,
  copyBookmarkLineage,
  copyIterationLoop,
  mutateJson,
} from "./helpers.js";

afterEach(cleanupFixtures);

const targetRevision = "git:bookmark-http-smoke";
const outcomeRelativePath = ".sah/bookmark-smoke.outcome.json";
const verificationRecordPath = "bookmark-verification-record.json";

type Constraint = {
  observable?: {
    factSource: string;
    selector: string;
    predicate: string;
    expected: string;
  };
  enforcement: { adapterCapability: string };
};

type LoopFixture = {
  workContext: {
    targetRoot: string;
    targetRevision: string;
    designBundlePath: string;
    designFingerprint: string;
  };
  currentIteration: {
    checks: Array<{
      id: string;
      kind:
        | "format"
        | "lint"
        | "typecheck"
        | "test"
        | "build"
        | "sah-verify"
        | "other";
      command: string;
      expected: string;
      required: boolean;
    }>;
  };
  completion: {
    workContext: IterationContextOptions;
  };
};

type CliResult = {
  code: number;
  stdout: string;
  stderr: string;
};

async function runCli(arguments_: string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...arguments_], {
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
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

async function startBookmarkServer(target: string): Promise<{
  port: number;
  stop: () => Promise<void>;
}> {
  const child = spawn(process.execPath, [join(target, "server.mjs")], {
    cwd: target,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`HTTP fixture did not start: ${output}`));
    }, 5_000);
    const onError = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(
        new Error(
          `HTTP fixture exited before readiness: code=${String(code)}, signal=${String(signal)}, output=${output}`,
        ),
      );
    };
    child.once("error", onError);
    child.once("exit", onExit);
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk;
      const ready = /^READY 127\.0\.0\.1:(\d+)$/mu.exec(output);
      if (ready === null || settled) return;
      settled = true;
      clearTimeout(timeout);
      child.off("error", onError);
      child.off("exit", onExit);
      const port = Number.parseInt(ready[1] ?? "", 10);
      resolve({
        port,
        stop: async () => {
          if (child.exitCode !== null || child.signalCode !== null) return;
          await new Promise<void>((stopResolve) => {
            child.once("close", () => stopResolve());
            child.kill("SIGTERM");
          });
        },
      });
    });
  });
}

async function bindBookmarkConstraints(bundle: string): Promise<void> {
  await mutateJson<{ constraints: Constraint[] }>(
    bundle,
    "architecture.json",
    (architecture) => {
      const selectors = ["bookmark-loopback", "bookmark-surface"];
      if (architecture.constraints.length !== selectors.length)
        throw new Error(
          "The shared bookmark fixture changed its constraint count.",
        );
      architecture.constraints.forEach((constraint, index) => {
        const selector = selectors[index];
        if (selector === undefined)
          throw new Error("Missing bookmark check selector.");
        constraint.observable = {
          factSource: "iteration-check-record",
          selector,
          predicate: "required-check-passed",
          expected: "true",
        };
        constraint.enforcement.adapterCapability = "target-check-evidence";
      });
    },
  );
}

async function configureBookmarkLoop(
  loopFile: string,
  target: string,
  bundle: string,
  port: number,
  context: IterationContextOptions,
): Promise<void> {
  const loop = JSON.parse(await readFile(loopFile, "utf8")) as LoopFixture;
  loop.workContext.targetRoot = target;
  loop.workContext.designBundlePath = bundle;
  loop.currentIteration.checks = [
    {
      id: "bookmark-loopback",
      kind: "test",
      command: `node smoke.mjs ${port} loopback`,
      expected: "exit 0",
      required: true,
    },
    {
      id: "bookmark-surface",
      kind: "test",
      command: `node smoke.mjs ${port} surface`,
      expected: "exit 0",
      required: true,
    },
  ];
  loop.completion.workContext = context;
  await writeFile(loopFile, `${JSON.stringify(loop, null, 2)}\n`);
}

describe("bookmark HTTP smoke fixture", () => {
  it("proves loopback bookmark checks can reach S13 through the production CLI", async () => {
    const lineage = await copyBookmarkLineage();
    const bundle = join(lineage, "shared-operations");
    const target = await copyBookmarkHttpTarget();
    const loopDirectory = await copyIterationLoop();
    const loopFile = join(loopDirectory, "sah.loop.json");
    const directManifestPath = join(
      bookmarkLineageDirectory,
      "direct-cli",
      "sah.bundle.json",
    );
    const sharedManifestPath = join(
      bookmarkLineageDirectory,
      "shared-operations",
      "sah.bundle.json",
    );
    const directManifestBefore = await readFile(directManifestPath);
    const sharedManifestBefore = await readFile(sharedManifestPath);

    await bindBookmarkConstraints(bundle);
    const loaded = await loadBundleForLineage(bundle);
    if (!loaded.ok) throw new Error("The shared bookmark bundle did not load.");
    const context: IterationContextOptions = {
      targetRevision,
      designFingerprint: loaded.snapshot.fingerprint,
    };
    const server = await startBookmarkServer(target);
    try {
      await configureBookmarkLoop(
        loopFile,
        target,
        bundle,
        server.port,
        context,
      );
      const bound = await bindIterationContext(loopFile, context);
      expect(bound.status).toBe("ready");

      const checks = await runIterationChecks(loopFile, target, context);
      expect(checks.status).toBe("passed");
      expect(checks.outcome?.checkResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            checkId: "bookmark-loopback",
            command: `node smoke.mjs ${server.port} loopback`,
            cwd: target,
            status: "passed",
            exitCode: 0,
          }),
          expect.objectContaining({
            checkId: "bookmark-surface",
            command: `node smoke.mjs ${server.port} surface`,
            cwd: target,
            status: "passed",
            exitCode: 0,
          }),
        ]),
      );
      const outcome = checks.outcome;
      if (outcome === undefined)
        throw new Error("Checks did not emit an outcome.");
      await mkdir(join(target, ".sah"), { recursive: true });
      const outcomePath = join(target, outcomeRelativePath);
      await writeFile(outcomePath, `${JSON.stringify(outcome, null, 2)}\n`);
      const recorded = await recordIterationOutcome(loopFile, outcomePath);
      expect(recorded.operation).toBe("recorded");

      const verification = await runCli([
        "verify",
        bundle,
        target,
        "--check-record",
        outcomeRelativePath,
        "--target-revision",
        targetRevision,
        "--record",
        verificationRecordPath,
        "--json",
      ]);
      const verificationOutput = JSON.parse(verification.stdout) as {
        status: string;
        checks: Array<{
          constraintId: string;
          status: string;
          capability: string;
        }>;
      };
      expect(verification.code).toBe(0);
      expect(verification.stderr).toBe("");
      expect(verificationOutput.status).toBe("passed");
      expect(verificationOutput.checks).toHaveLength(2);
      expect(verificationOutput.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "pass",
            capability: "target-check-evidence",
          }),
        ]),
      );

      const advancement = await runCli([
        "advance",
        bundle,
        "S13",
        "--verification-record",
        verificationRecordPath,
        "--json",
      ]);
      expect(advancement.code).toBe(0);
      expect(
        (JSON.parse(advancement.stdout) as { status: string }).status,
      ).toBe("advanced");
      expect((await validateBundle(bundle)).status).toBe("passed");
      expect(await readFile(directManifestPath)).toEqual(directManifestBefore);
      expect(await readFile(sharedManifestPath)).toEqual(sharedManifestBefore);
    } finally {
      await server.stop();
    }
  }, 15_000);
});
