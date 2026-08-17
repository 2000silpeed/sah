import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { Stage } from "../src/contracts.js";
import {
  cleanupFixtures,
  cliPath,
  copyFixture,
  fixtureDirectory,
  mutateJson,
} from "./helpers.js";

afterEach(cleanupFixtures);

type ProcessResult = {
  code: number;
  stdout: string;
  stderr: string;
};

async function runCli(arguments_: string[]): Promise<ProcessResult> {
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

describe("sah validate CLI", () => {
  it("returns exit 0 and human-readable success", async () => {
    const execution = await runCli(["validate", fixtureDirectory]);

    expect(execution.code).toBe(0);
    expect(execution.stderr).toBe("");
    expect(execution.stdout).toContain("SAH validation passed");
    expect(execution.stdout).toContain(
      "Bundle: equipment-register (S11, short)",
    );
    expect(execution.stdout).toContain("Summary: 0 error(s), 0 warning(s)");
  });

  it("returns exit 1 and stable JSON diagnostics for a validly loaded violation", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      responsibilities: Array<{ evidenceRefs: string[] }>;
    }>(bundle, "responsibility.json", (model) => {
      const responsibility = model.responsibilities[0];
      if (responsibility !== undefined)
        responsibility.evidenceRefs[0] = "ev-missing";
    });

    const execution = await runCli(["validate", bundle, "--json"]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      diagnostics: Array<{ code: string; jsonPointer?: string }>;
    };

    expect(execution.code).toBe(1);
    expect(execution.stderr).toBe("");
    expect(output.status).toBe("violations");
    expect(output.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "REFERENCE_DANGLING",
        jsonPointer: "/responsibilities/0/evidenceRefs/0",
      }),
    );
  });

  it("returns exit 2 for malformed declared JSON", async () => {
    const bundle = await copyFixture();
    await writeFile(join(bundle, "invariant.json"), "{\n");

    const execution = await runCli(["validate", bundle, "--json"]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      diagnostics: Array<{ code: string }>;
    };

    expect(execution.code).toBe(2);
    expect(output.status).toBe("operational-error");
    expect(output.diagnostics.map(({ code }) => code)).toContain(
      "JSON_MALFORMED",
    );
  });

  it("returns exit 2 for invalid invocation", async () => {
    const execution = await runCli(["validate", fixtureDirectory, "extra"]);

    expect(execution.code).toBe(2);
    expect(execution.stdout).toContain("CLI_INVALID_INVOCATION");
    expect(execution.stdout).toContain("Usage: sah validate");
  });
});

async function setStage(bundle: string, completedStage: Stage): Promise<void> {
  await mutateJson<{ lifecycle: { completedStage: Stage } }>(
    bundle,
    "sah.bundle.json",
    (manifest) => {
      manifest.lifecycle.completedStage = completedStage;
    },
  );
}

describe("sah advance CLI", () => {
  it("returns exit 0 and human-readable transition evidence", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S10");

    const execution = await runCli(["advance", bundle, "S11"]);

    expect(execution.code).toBe(0);
    expect(execution.stderr).toBe("");
    expect(execution.stdout).toContain("SAH bundle advanced");
    expect(execution.stdout).toContain(
      "Bundle: equipment-register (S10 -> S11, short)",
    );
    expect(execution.stdout).toContain("Completed stage: S11");
  });

  it("returns exit 1 and JSON gate diagnostics without changing the stage", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S10");
    await mutateJson<{ constraints: Array<{ observable?: unknown }> }>(
      bundle,
      "architecture.json",
      (model) => {
        delete model.constraints[0]?.observable;
      },
    );

    const execution = await runCli(["advance", bundle, "S11", "--json"]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      bundle: { completedStage: string };
      diagnostics: Array<{ code: string }>;
    };

    expect(execution.code).toBe(1);
    expect(execution.stderr).toBe("");
    expect(output.status).toBe("blocked");
    expect(output.bundle.completedStage).toBe("S10");
    expect(output.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S11_DETERMINISTIC_OBSERVABLE_MISSING",
    );
  });

  it.each([
    ["S10", "S10", "ADVANCE_STAGE_NOT_FORWARD"],
    ["S10", "S9", "ADVANCE_STAGE_NOT_FORWARD"],
    ["S7", "S10", "ADVANCE_STAGE_SKIPPED"],
    ["S7", "S8", "ADVANCE_STAGE_UNSUPPORTED"],
  ] as const)(
    "returns exit 2 for the %s to %s transition",
    async (current, target, code) => {
      const bundle = await copyFixture();
      await setStage(bundle, current);

      const execution = await runCli(["advance", bundle, target, "--json"]);
      const output = JSON.parse(execution.stdout) as {
        status: string;
        diagnostics: Array<{ code: string }>;
      };

      expect(execution.code).toBe(2);
      expect(output.status).toBe("operational-error");
      expect(output.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
        code,
      );
    },
  );

  it("returns exit 2 for an invalid target stage", async () => {
    const bundle = await copyFixture();

    const execution = await runCli(["advance", bundle, "S99", "--json"]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      diagnostics: Array<{ code: string }>;
    };

    expect(execution.code).toBe(2);
    expect(output.status).toBe("operational-error");
    expect(output.diagnostics.map(({ code }) => code)).toContain(
      "CLI_INVALID_INVOCATION",
    );
  });
});
