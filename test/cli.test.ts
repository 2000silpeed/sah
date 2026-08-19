import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { Stage } from "../src/contracts.js";
import {
  cleanupFixtures,
  cliPath,
  copyFixture,
  copyIterationLoop,
  copyTypeScriptTarget,
  fixtureDirectory,
  iterationLoopFixtureDirectory,
  mutateJson,
  typescriptTargetDirectory,
  verificationTargetDirectory,
} from "./helpers.js";

afterEach(cleanupFixtures);

type ProcessResult = {
  code: number;
  stdout: string;
  stderr: string;
};

const initialDesignFingerprint =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000";

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

describe("sah resume CLI", () => {
  it("emits a schema-tagged deterministic handoff", async () => {
    const execution = await runCli(["resume", fixtureDirectory, "--json"]);
    const output = JSON.parse(execution.stdout) as {
      $schema: string;
      resumeVersion: string;
      status: string;
      bundleFingerprint: string;
      nextAction: string;
      readySliceRefs: string[];
    };
    expect(execution.code).toBe(0);
    expect(output.$schema).toBe("https://sah.dev/schemas/resume-result/v0.1.0");
    expect(output.resumeVersion).toBe("0.1.0");
    expect(output.status).toBe("ready");
    expect(output.bundleFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(output.nextAction).toBe("implement-ready-slices");
    expect(output.readySliceRefs).toContain("implement-equipment-operations");
  });
});

describe("sah loop CLI", () => {
  it("routes a declared local task to the fast path", async () => {
    const execution = await runCli([
      "loop",
      join(iterationLoopFixtureDirectory, "sah.loop.json"),
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      route: string;
      escalation: { triggered: boolean };
    };

    expect(execution.code).toBe(0);
    expect(output.status).toBe("ready");
    expect(output.route).toBe("fast");
    expect(output.escalation.triggered).toBe(false);
  });

  it("binds an explicit revision and design fingerprint", async () => {
    const loopDirectory = await copyIterationLoop();
    const execution = await runCli([
      "loop-bind",
      join(loopDirectory, "sah.loop.json"),
      "--target-revision",
      "git:next",
      "--design-fingerprint",
      initialDesignFingerprint,
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      operation: string;
      status: string;
      workContext: { targetRevision: string };
    };

    expect(execution.code).toBe(0);
    expect(output.operation).toBe("bound");
    expect(output.status).toBe("ready");
    expect(output.workContext.targetRevision).toBe("git:next");
  });

  it("records an outcome and returns the learned next task", async () => {
    const loopDirectory = await copyIterationLoop();
    const execution = await runCli([
      "loop-record",
      join(loopDirectory, "sah.loop.json"),
      join(loopDirectory, "iteration-001.outcome.json"),
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      operation: string;
      nextTask?: { goal: string };
    };

    expect(execution.code).toBe(0);
    expect(output.operation).toBe("recorded");
    expect(output.nextTask?.goal).toBe("Clarify first-run copy");
  });

  it("accepts the learned task through an explicit transition", async () => {
    const loopDirectory = await copyIterationLoop();
    const record = await runCli([
      "loop-record",
      join(loopDirectory, "sah.loop.json"),
      join(loopDirectory, "iteration-001.outcome.json"),
      "--json",
    ]);
    expect(record.code).toBe(0);

    const execution = await runCli([
      "loop-accept-next",
      join(loopDirectory, "sah.loop.json"),
      "--target-revision",
      "git:initial",
      "--design-fingerprint",
      initialDesignFingerprint,
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      operation: string;
      status: string;
      currentTask?: { goal: string };
    };

    expect(execution.code).toBe(0);
    expect(output.operation).toBe("advanced");
    expect(output.status).toBe("ready");
    expect(output.currentTask?.goal).toBe("Clarify first-run copy");
  });

  it("completes a loop from a schema-valid evidence reference", async () => {
    const loopDirectory = await copyIterationLoop();
    const loopFile = join(loopDirectory, "sah.loop.json");
    const record = await runCli([
      "loop-record",
      loopFile,
      join(loopDirectory, "iteration-001.outcome.json"),
      "--json",
    ]);
    expect(record.code).toBe(0);
    const completionFile = join(loopDirectory, "completion.json");
    await writeFile(
      completionFile,
      `${JSON.stringify(
        {
          $schema: "https://sah.dev/schemas/iteration-completion/v0.2.0",
          completionVersion: "0.2.0",
          status: "completed",
          workContext: {
            targetRevision: "git:initial",
            designFingerprint: initialDesignFingerprint,
          },
          criterionResults: [
            {
              criterionId: "success-1",
              evidenceRefs: ["iteration-001:lint"],
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const execution = await runCli([
      "loop-complete",
      loopFile,
      completionFile,
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      operation: string;
      status: string;
      route: string;
    };

    expect(execution.code).toBe(0);
    expect(output.operation).toBe("completed");
    expect(output.status).toBe("complete");
    expect(output.route).toBe("complete");
  });

  it("runs declared checks only with an explicit working directory", async () => {
    const loopDirectory = await copyIterationLoop();
    await mutateJson<{ workContext: { targetRoot: string } }>(
      loopDirectory,
      "sah.loop.json",
      (loop) => {
        loop.workContext.targetRoot = process.cwd();
      },
    );
    const execution = await runCli([
      "loop-checks",
      join(loopDirectory, "sah.loop.json"),
      "--cwd",
      process.cwd(),
      "--target-revision",
      "git:initial",
      "--design-fingerprint",
      initialDesignFingerprint,
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      $schema: string;
      outcomeVersion: string;
      evidence: { executor: { name: string }; cwd: string };
      checkResults: Array<{
        command: string;
        status: string;
        exitCode: number | null;
      }>;
    };

    expect(execution.code).toBe(0);
    expect(output.$schema).toBe(
      "https://sah.dev/schemas/iteration-outcome/v0.4.0",
    );
    expect(output.outcomeVersion).toBe("0.4.0");
    expect(output.evidence.executor.name).toBe("sah-loop-checks");
    expect(output.evidence.cwd).toBe(process.cwd());
    expect(output.checkResults[0]).toMatchObject({
      command: "npm run lint",
      status: "passed",
      exitCode: 0,
    });
  });
});

describe("sah validate CLI", () => {
  it("returns exit 0 and human-readable success", async () => {
    const execution = await runCli(["validate", fixtureDirectory]);

    expect(execution.code).toBe(0);
    expect(execution.stderr).toBe("");
    expect(execution.stdout).toContain("SAH validation passed");
    expect(execution.stdout).toContain(
      "Bundle: equipment-register (S12, short)",
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

async function setFilesystemConstraint(
  bundle: string,
  selector: string,
): Promise<void> {
  await mutateJson<{
    constraints: Array<{
      observable: {
        factSource: string;
        selector: string;
        predicate: string;
        expected: string;
      };
      enforcement: { adapterCapability: string };
    }>;
  }>(bundle, "architecture.json", (architecture) => {
    const constraint = architecture.constraints[0];
    if (constraint === undefined) return;
    constraint.observable = {
      factSource: "filesystem",
      selector,
      predicate: "regular-file-exists",
      expected: "true",
    };
    constraint.enforcement.adapterCapability = "filesystem-artifact-presence";
  });
}

async function prepareForS9(bundle: string): Promise<void> {
  await setStage(bundle, "S8");
  await mutateJson<{ candidates: Array<{ status: string }> }>(
    bundle,
    "architecture.json",
    (model) => {
      model.candidates.forEach((candidate) => {
        candidate.status = "proposed";
      });
    },
  );
  await mutateJson<{
    decisions: Array<{ status: string; selectedOptionRef: string | null }>;
  }>(bundle, "architecture-decision.json", (model) => {
    model.decisions.forEach((decision) => {
      decision.status = "proposed";
      decision.selectedOptionRef = null;
    });
  });
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

  it("advances S7 to S8 through the production JSON CLI", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S7");
    await mutateJson<{ candidates: Array<{ status: string }> }>(
      bundle,
      "architecture.json",
      (model) => {
        model.candidates.forEach((candidate) => {
          candidate.status = "proposed";
        });
      },
    );

    const execution = await runCli(["advance", bundle, "S8", "--json"]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      bundle: { previousStage: string; completedStage: string };
    };

    expect(execution.code).toBe(0);
    expect(output.status).toBe("advanced");
    expect(output.bundle).toEqual(
      expect.objectContaining({
        previousStage: "S7",
        completedStage: "S8",
      }),
    );
  });

  it("advances S8 to S9 through the production JSON CLI", async () => {
    const bundle = await copyFixture();
    await prepareForS9(bundle);

    const execution = await runCli(["advance", bundle, "S9", "--json"]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      bundle: { previousStage: string; completedStage: string };
    };

    expect(execution.code).toBe(0);
    expect(output.status).toBe("advanced");
    expect(output.bundle).toEqual(
      expect.objectContaining({
        previousStage: "S8",
        completedStage: "S9",
      }),
    );
  });

  it("returns exit 1 for incomplete S9 coverage without changing the manifest", async () => {
    const bundle = await copyFixture();
    await prepareForS9(bundle);
    await mutateJson<{ qualityAssessments: unknown[] }>(
      bundle,
      "architecture.json",
      (model) => {
        model.qualityAssessments = [];
      },
    );
    const manifestPath = join(bundle, "sah.bundle.json");
    const before = await readFile(manifestPath);

    const execution = await runCli(["advance", bundle, "S9", "--json"]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      bundle: { completedStage: string };
      diagnostics: Array<{ code: string }>;
    };

    expect(execution.code).toBe(1);
    expect(output.status).toBe("blocked");
    expect(output.bundle.completedStage).toBe("S8");
    expect(output.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S9_MUST_ASSESSMENT_MISSING",
    );
    expect(await readFile(manifestPath)).toEqual(before);
  });

  it("advances S11 to S12 through the production JSON CLI", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S11");

    const execution = await runCli(["advance", bundle, "S12", "--json"]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      bundle: { previousStage: string; completedStage: string };
    };

    expect(execution.code).toBe(0);
    expect(output.status).toBe("advanced");
    expect(output.bundle).toEqual(
      expect.objectContaining({
        previousStage: "S11",
        completedStage: "S12",
      }),
    );
  });

  it("returns exit 1 for incomplete S12 handoff without changing the manifest", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S11");
    await mutateJson<{ slices: Array<{ decisionRefs: string[] }> }>(
      bundle,
      "implementation-handoff.json",
      (handoff) => {
        const slice = handoff.slices[0];
        if (slice !== undefined) slice.decisionRefs = [];
      },
    );
    const manifestPath = join(bundle, "sah.bundle.json");
    const before = await readFile(manifestPath);

    const execution = await runCli(["advance", bundle, "S12", "--json"]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      bundle: { completedStage: string };
      diagnostics: Array<{ code: string }>;
    };

    expect(execution.code).toBe(1);
    expect(output.status).toBe("blocked");
    expect(output.bundle.completedStage).toBe("S11");
    expect(output.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S12_ACCEPTED_DECISION_MISSING",
    );
    expect(await readFile(manifestPath)).toEqual(before);
  });

  it("records full verification and advances S12 to S13 through the production CLI", async () => {
    const bundle = await copyFixture();
    const recordPath = "verification-record.json";

    const verification = await runCli([
      "verify",
      bundle,
      typescriptTargetDirectory,
      "--mapping",
      "sah.source-map.json",
      "--record",
      recordPath,
      "--json",
    ]);
    const verified = JSON.parse(verification.stdout) as { status: string };
    const advancement = await runCli([
      "advance",
      bundle,
      "S13",
      "--verification-record",
      recordPath,
      "--json",
    ]);
    const advanced = JSON.parse(advancement.stdout) as {
      status: string;
      bundle: { previousStage: string; completedStage: string };
    };
    const manifest = JSON.parse(
      await readFile(join(bundle, "sah.bundle.json"), "utf8"),
    ) as {
      lifecycle: { completedStage: string };
      verificationRecord: { path: string; sha256: string };
    };

    expect(verification.code).toBe(0);
    expect(verified.status).toBe("passed");
    expect(advancement.code).toBe(0);
    expect(advanced.status).toBe("advanced");
    expect(advanced.bundle).toEqual(
      expect.objectContaining({ previousStage: "S12", completedStage: "S13" }),
    );
    expect(manifest.lifecycle.completedStage).toBe("S13");
    expect(manifest.verificationRecord).toEqual(
      expect.objectContaining({
        path: recordPath,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    );
  });

  it.each([
    ["S10", "S10", "ADVANCE_STAGE_NOT_FORWARD"],
    ["S10", "S9", "ADVANCE_STAGE_NOT_FORWARD"],
    ["S7", "S10", "ADVANCE_STAGE_SKIPPED"],
    ["S12", "S13", "ADVANCE_VERIFICATION_RECORD_REQUIRED"],
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

describe("sah verify CLI", () => {
  it("returns exit 0 for canonical TypeScript authority verification", async () => {
    const execution = await runCli([
      "verify",
      fixtureDirectory,
      typescriptTargetDirectory,
      "--mapping",
      "sah.source-map.json",
    ]);

    expect(execution.code).toBe(0);
    expect(execution.stderr).toBe("");
    expect(execution.stdout).toContain("SAH verification passed");
    expect(execution.stdout).toContain(
      "all writers are in constraint scope: src/equipment-operations/save-equipment.ts (equipment-operations)",
    );
  });

  it("returns exit 0 JSON for a tsconfig path-alias writer", async () => {
    const target = await copyTypeScriptTarget();
    await writeFile(
      join(target, "src", "equipment-operations", "save-equipment.ts"),
      'import { writeEquipmentRecord } from "@equipment/store";\n\nexport function saveEquipment(): void {\n  writeEquipmentRecord();\n}\n',
    );

    const execution = await runCli([
      "verify",
      fixtureDirectory,
      target,
      "--mapping",
      "sah.source-map.json",
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      checks: Array<{ code: string; observed?: string }>;
    };

    expect(execution.code).toBe(0);
    expect(output.status).toBe("passed");
    expect(output.checks).toContainEqual(
      expect.objectContaining({
        code: "CONSTRAINT_PASSED",
        observed:
          "all writers are in constraint scope: src/equipment-operations/save-equipment.ts (equipment-operations)",
      }),
    );
  });

  it("accepts repeatable changed paths and reports affected selection as JSON", async () => {
    const execution = await runCli([
      "verify",
      fixtureDirectory,
      typescriptTargetDirectory,
      "--mapping",
      "sah.source-map.json",
      "--changed",
      "src/equipment-operations/save-equipment.ts",
      "--changed",
      "src/equipment-operations/deleted.ts",
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      selection?: {
        mode: string;
        requestedPaths: string[];
        affectedElementRefs: string[];
      };
    };

    expect(execution.code).toBe(0);
    expect(output.status).toBe("passed");
    expect(output.selection).toEqual(
      expect.objectContaining({
        mode: "affected",
        requestedPaths: [
          "src/equipment-operations/deleted.ts",
          "src/equipment-operations/save-equipment.ts",
        ],
        affectedElementRefs: ["equipment-operations"],
      }),
    );
  });

  it("prints changed-path selection in human output", async () => {
    const execution = await runCli([
      "verify",
      fixtureDirectory,
      typescriptTargetDirectory,
      "--mapping",
      "sah.source-map.json",
      "--changed",
      "src/equipment-operations/save-equipment.ts",
    ]);

    expect(execution.code).toBe(0);
    expect(execution.stdout).toContain("Selection: affected");
    expect(execution.stdout).toContain(
      "Changed: src/equipment-operations/save-equipment.ts",
    );
    expect(execution.stdout).toContain("Elements: equipment-operations");
  });

  it("falls back to full verification and returns exit 1 for an unmapped changed writer", async () => {
    const target = await copyTypeScriptTarget();
    await writeFile(
      join(target, "src", "rogue-writer.ts"),
      'import { writeEquipmentRecord } from "@equipment/store";\nwriteEquipmentRecord();\n',
    );

    const execution = await runCli([
      "verify",
      fixtureDirectory,
      target,
      "--mapping",
      "sah.source-map.json",
      "--changed",
      "src/rogue-writer.ts",
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      selection?: { mode: string; issues: Array<{ code: string }> };
      checks: Array<{ code: string }>;
    };

    expect(execution.code).toBe(1);
    expect(output.status).toBe("violations");
    expect(output.selection).toEqual(
      expect.objectContaining({
        mode: "full-fallback",
        issues: [expect.objectContaining({ code: "CHANGE_PATH_UNMAPPED" })],
      }),
    );
    expect(output.checks).toContainEqual(
      expect.objectContaining({ code: "CONSTRAINT_VIOLATION" }),
    );
  });

  it("returns exit 1 JSON for an out-of-scope TypeScript writer", async () => {
    const target = await copyTypeScriptTarget();
    await writeFile(
      join(target, "src", "rogue-writer.ts"),
      'import { writeEquipmentRecord } from "./equipment-store.js";\nwriteEquipmentRecord();\n',
    );

    const execution = await runCli([
      "verify",
      fixtureDirectory,
      target,
      "--mapping",
      "sah.source-map.json",
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      checks: Array<{ code: string; status: string; observed?: string }>;
    };

    expect(execution.code).toBe(1);
    expect(output.status).toBe("violations");
    expect(output.checks).toContainEqual(
      expect.objectContaining({
        code: "CONSTRAINT_VIOLATION",
        status: "violation",
        observed:
          "writers outside constraint scope: src/rogue-writer.ts (unmapped)",
      }),
    );
  });

  it("returns exit 2 for missing explicit mapping configuration", async () => {
    const execution = await runCli([
      "verify",
      fixtureDirectory,
      typescriptTargetDirectory,
      "--mapping",
      "missing.json",
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      diagnostics: Array<{ code: string }>;
    };

    expect(execution.code).toBe(2);
    expect(output.status).toBe("operational-error");
    expect(output.diagnostics).toContainEqual(
      expect.objectContaining({ code: "SOURCE_MAPPING_UNREADABLE" }),
    );
  });

  it("returns exit 2 when --mapping has no value", async () => {
    const execution = await runCli([
      "verify",
      fixtureDirectory,
      typescriptTargetDirectory,
      "--mapping",
      "--json",
    ]);

    expect(execution.code).toBe(2);
    expect(execution.stdout).toContain("CLI_INVALID_INVOCATION");
    expect(execution.stdout).toContain(
      "--mapping requires one target-relative path.",
    );
  });

  it("returns exit 2 when --changed has no value", async () => {
    const execution = await runCli([
      "verify",
      fixtureDirectory,
      typescriptTargetDirectory,
      "--mapping",
      "sah.source-map.json",
      "--changed",
      "--json",
    ]);

    expect(execution.code).toBe(2);
    expect(execution.stdout).toContain("CLI_INVALID_INVOCATION");
    expect(execution.stdout).toContain(
      "--changed requires one target-relative file path.",
    );
  });

  it("returns exit 2 when --record has no value", async () => {
    const execution = await runCli([
      "verify",
      fixtureDirectory,
      typescriptTargetDirectory,
      "--record",
      "--json",
    ]);

    expect(execution.code).toBe(2);
    expect(execution.stdout).toContain("CLI_INVALID_INVOCATION");
    expect(execution.stdout).toContain(
      "--record requires one bundle-relative JSON path.",
    );
  });

  it("returns exit 2 when changed paths omit explicit mapping", async () => {
    const execution = await runCli([
      "verify",
      fixtureDirectory,
      typescriptTargetDirectory,
      "--changed",
      "src/equipment-operations/save-equipment.ts",
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      diagnostics: Array<{ code: string }>;
    };

    expect(execution.code).toBe(2);
    expect(output.status).toBe("operational-error");
    expect(output.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "VERIFICATION_CHANGE_MAPPING_REQUIRED",
      }),
    );
  });

  it("returns exit 0 with human-readable pass evidence", async () => {
    const bundle = await copyFixture();
    await setFilesystemConstraint(
      bundle,
      "checks/equipment-operations.integration.txt",
    );

    const execution = await runCli([
      "verify",
      bundle,
      verificationTargetDirectory,
    ]);

    expect(execution.code).toBe(0);
    expect(execution.stderr).toBe("");
    expect(execution.stdout).toContain("SAH verification passed");
    expect(execution.stdout).toContain(
      "[PASS] CONSTRAINT_PASSED (deterministic) constraint=equipment-owns-writes",
    );
    expect(execution.stdout).toContain("Invariants: asset-tag-unique");
    expect(execution.stdout).toContain(
      "Summary: 1 passed, 0 violation(s), 0 pending, 0 unsupported",
    );
  });

  it("returns exit 1 with machine-readable violation evidence", async () => {
    const bundle = await copyFixture();
    await setFilesystemConstraint(bundle, "checks/missing.txt");

    const execution = await runCli([
      "verify",
      bundle,
      verificationTargetDirectory,
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      checks: Array<{
        code: string;
        constraintId: string;
        status: string;
        expected?: string;
        observed?: string;
        repair?: string;
      }>;
    };

    expect(execution.code).toBe(1);
    expect(execution.stderr).toBe("");
    expect(output.status).toBe("violations");
    expect(output.checks).toContainEqual(
      expect.objectContaining({
        code: "CONSTRAINT_VIOLATION",
        constraintId: "equipment-owns-writes",
        status: "violation",
        expected: "true",
        observed: "missing path checks/missing.txt",
        repair: expect.any(String),
      }),
    );
  });

  it("returns exit 2 when a declared adapter is unsupported", async () => {
    const execution = await runCli([
      "verify",
      fixtureDirectory,
      verificationTargetDirectory,
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      checks: Array<{ code: string; status: string }>;
    };

    expect(execution.code).toBe(2);
    expect(output.status).toBe("incomplete");
    expect(output.checks).toContainEqual(
      expect.objectContaining({
        code: "CONSTRAINT_ADAPTER_UNSUPPORTED",
        status: "unsupported",
      }),
    );
  });

  it("returns exit 2 for an unavailable target directory", async () => {
    const execution = await runCli([
      "verify",
      fixtureDirectory,
      join(verificationTargetDirectory, "missing"),
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      diagnostics: Array<{ code: string }>;
    };

    expect(execution.code).toBe(2);
    expect(output.status).toBe("operational-error");
    expect(output.diagnostics).toContainEqual(
      expect.objectContaining({ code: "VERIFICATION_TARGET_UNREADABLE" }),
    );
  });
});
