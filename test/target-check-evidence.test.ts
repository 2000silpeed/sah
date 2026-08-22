import { spawn } from "node:child_process";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { IterationOutcome } from "../src/contracts.js";
import { verifyBundle } from "../src/index.js";
import { loadBundleForLineage } from "../src/model-repository.js";
import {
  cleanupFixtures,
  cliPath,
  copyFixture,
  copyVerificationTarget,
  mutateJson,
} from "./helpers.js";

afterEach(cleanupFixtures);

const targetRevision = "git:target-check-test";
const checkRecordRelativePath = ".sah/target-check.outcome.json";

type Constraint = {
  observable?: {
    factSource: string;
    selector: string;
    predicate: string;
    expected: string;
  };
  enforcement: { adapterCapability: string };
};

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

async function setTargetCheckConstraint(
  bundle: string,
  selector = "bookmark-smoke",
): Promise<void> {
  await mutateJson<{ constraints: Constraint[] }>(
    bundle,
    "architecture.json",
    (architecture) => {
      const constraint = architecture.constraints[0];
      if (constraint === undefined) return;
      constraint.observable = {
        factSource: "iteration-check-record",
        selector,
        predicate: "required-check-passed",
        expected: "true",
      };
      constraint.enforcement.adapterCapability = "target-check-evidence";
    },
  );
}

async function writeOutcome(
  target: string,
  designFingerprint: string,
  input: {
    targetRevision?: string;
    checkId?: string;
    checkStatus?: "passed" | "failed" | "incomplete";
    exitCode?: number | null;
    duplicate?: boolean;
    cwd?: string;
  } = {},
): Promise<void> {
  const checkId = input.checkId ?? "bookmark-smoke";
  const check = {
    checkId,
    status: input.checkStatus ?? "passed",
    command: 'node -e "process.exit(1)"',
    cwd: input.cwd ?? target,
    startedAt: "2026-08-22T00:00:00.000Z",
    finishedAt: "2026-08-22T00:00:01.000Z",
    exitCode: input.exitCode === undefined ? 0 : input.exitCode,
    stdoutDigest:
      "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    stderrDigest:
      "sha256:1111111111111111111111111111111111111111111111111111111111111111",
  };
  const outcome: IterationOutcome = {
    $schema: "https://sah.dev/schemas/iteration-outcome/v0.4.0",
    outcomeVersion: "0.4.0",
    iterationId: "bookmark-iteration-001",
    status: input.checkStatus === "failed" ? "failed" : "succeeded",
    evidence: {
      executor: { name: "sah-loop-checks", version: "0.1.0" },
      cwd: target,
      startedAt: "2026-08-22T00:00:00.000Z",
      finishedAt: "2026-08-22T00:00:01.000Z",
      workContext: {
        targetRevision: input.targetRevision ?? targetRevision,
        designFingerprint,
      },
    },
    checkResults: input.duplicate ? [check, { ...check }] : [check],
    learnings: [],
  };
  const recordPath = join(target, checkRecordRelativePath);
  await mkdir(join(target, ".sah"), { recursive: true });
  await writeFile(recordPath, `${JSON.stringify(outcome, null, 2)}\n`);
}

async function prepareTargetCheck(): Promise<{
  bundle: string;
  target: string;
  fingerprint: string;
}> {
  const bundle = await copyFixture();
  const target = await copyVerificationTarget();
  await setTargetCheckConstraint(bundle);
  const loaded = await loadBundleForLineage(bundle);
  if (!loaded.ok) throw new Error("target-check fixture bundle did not load");
  await writeOutcome(target, loaded.snapshot.fingerprint);
  return { bundle, target, fingerprint: loaded.snapshot.fingerprint };
}

describe("target-check evidence adapter", () => {
  it("passes one exact schema-valid loop check without executing its command", async () => {
    const { bundle, target } = await prepareTargetCheck();

    const verification = await verifyBundle(bundle, target, {
      checkRecordPath: checkRecordRelativePath,
      targetRevision,
    });

    expect(verification.status).toBe("passed");
    expect(verification.checks).toContainEqual(
      expect.objectContaining({
        capability: "target-check-evidence",
        code: "CONSTRAINT_PASSED",
        status: "pass",
        observed: expect.stringContaining("bookmark-smoke passed"),
      }),
    );
    await expect(
      readFile(join(target, ".sah", "should-not-exist")),
    ).rejects.toThrow();
  });

  it("keeps stale revision, fingerprint, or cwd evidence incomplete", async () => {
    const { bundle, target, fingerprint } = await prepareTargetCheck();
    await writeOutcome(target, fingerprint, { targetRevision: "git:stale" });

    const verification = await verifyBundle(bundle, target, {
      checkRecordPath: checkRecordRelativePath,
      targetRevision,
    });

    expect(verification.status).toBe("incomplete");
    expect(verification.checks).toContainEqual(
      expect.objectContaining({
        code: "TARGET_CHECK_CONTEXT_MISMATCH",
        status: "unsupported",
      }),
    );

    await writeOutcome(
      target,
      "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    );
    const staleFingerprint = await verifyBundle(bundle, target, {
      checkRecordPath: checkRecordRelativePath,
      targetRevision,
    });
    expect(staleFingerprint.status).toBe("incomplete");
    expect(staleFingerprint.checks).toContainEqual(
      expect.objectContaining({
        code: "TARGET_CHECK_CONTEXT_MISMATCH",
        status: "unsupported",
      }),
    );

    await writeOutcome(target, fingerprint, { cwd: join(target, "alias") });
    const wrongCwd = await verifyBundle(bundle, target, {
      checkRecordPath: checkRecordRelativePath,
      targetRevision,
    });
    expect(wrongCwd.status).toBe("incomplete");
    expect(wrongCwd.checks).toContainEqual(
      expect.objectContaining({
        code: "TARGET_CHECK_CONTEXT_MISMATCH",
        status: "unsupported",
      }),
    );
  });

  it("reports a failed target check as a violation", async () => {
    const { bundle, target, fingerprint } = await prepareTargetCheck();
    await writeOutcome(target, fingerprint, {
      checkStatus: "failed",
      exitCode: 1,
    });

    const verification = await verifyBundle(bundle, target, {
      checkRecordPath: checkRecordRelativePath,
      targetRevision,
    });

    expect(verification.status).toBe("violations");
    expect(verification.checks).toContainEqual(
      expect.objectContaining({
        code: "CONSTRAINT_VIOLATION",
        status: "violation",
        observed: expect.stringContaining("exit code 1"),
      }),
    );
  });

  it("keeps unknown and duplicate check IDs unsupported", async () => {
    const { bundle, target } = await prepareTargetCheck();
    await setTargetCheckConstraint(bundle, "missing-check");
    const unknownBundle = await loadBundleForLineage(bundle);
    if (!unknownBundle.ok) throw new Error("unknown-check bundle did not load");
    await writeOutcome(target, unknownBundle.snapshot.fingerprint, {
      duplicate: true,
    });

    const verification = await verifyBundle(bundle, target, {
      checkRecordPath: checkRecordRelativePath,
      targetRevision,
    });

    expect(verification.status).toBe("incomplete");
    expect(verification.checks).toContainEqual(
      expect.objectContaining({
        code: "TARGET_CHECK_ID_UNKNOWN",
        status: "unsupported",
      }),
    );

    await setTargetCheckConstraint(bundle);
    const duplicateBundle = await loadBundleForLineage(bundle);
    if (!duplicateBundle.ok)
      throw new Error("duplicate-check bundle did not load");
    await writeOutcome(target, duplicateBundle.snapshot.fingerprint, {
      duplicate: true,
    });
    const duplicate = await verifyBundle(bundle, target, {
      checkRecordPath: checkRecordRelativePath,
      targetRevision,
    });
    expect(duplicate.status).toBe("incomplete");
    expect(duplicate.checks).toContainEqual(
      expect.objectContaining({
        code: "TARGET_CHECK_ID_AMBIGUOUS",
        status: "unsupported",
      }),
    );
  });

  it("rejects unsafe and malformed records operationally", async () => {
    const { bundle, target, fingerprint } = await prepareTargetCheck();
    const unsafe = await verifyBundle(bundle, target, {
      checkRecordPath: "../escape.json",
      targetRevision,
    });
    expect(unsafe.status).toBe("operational-error");
    expect(unsafe.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TARGET_CHECK_RECORD_PATH_UNSAFE" }),
    );

    await writeFile(join(target, ".sah", "malformed.json"), "{\n");
    const malformed = await verifyBundle(bundle, target, {
      checkRecordPath: ".sah/malformed.json",
      targetRevision,
    });
    expect(malformed.status).toBe("operational-error");
    expect(malformed.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TARGET_CHECK_RECORD_MALFORMED" }),
    );

    await symlink(
      join(target, ".sah", "malformed.json"),
      join(target, ".sah", "symlink.json"),
    );
    const symlinked = await verifyBundle(bundle, target, {
      checkRecordPath: ".sah/symlink.json",
      targetRevision,
    });
    expect(symlinked.status).toBe("operational-error");
    expect(symlinked.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TARGET_CHECK_RECORD_UNREADABLE" }),
    );

    await writeOutcome(target, fingerprint);
    const missingRevision = await verifyBundle(bundle, target, {
      checkRecordPath: checkRecordRelativePath,
    });
    expect(missingRevision.status).toBe("operational-error");
    expect(missingRevision.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TARGET_CHECK_REVISION_REQUIRED" }),
    );

    const missingRecord = await verifyBundle(bundle, target, {
      targetRevision,
    });
    expect(missingRecord.status).toBe("operational-error");
    expect(missingRecord.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "VERIFICATION_TARGET_REVISION_WITHOUT_CHECK_RECORD",
      }),
    );
  });

  it("exposes the adapter through the read-only CLI", async () => {
    const { bundle, target } = await prepareTargetCheck();
    const execution = await runCli([
      "verify",
      bundle,
      target,
      "--check-record",
      checkRecordRelativePath,
      "--target-revision",
      targetRevision,
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      checks: Array<{ capability: string; status: string }>;
    };

    expect(execution.code).toBe(0);
    expect(execution.stderr).toBe("");
    expect(output.status).toBe("passed");
    expect(output.checks).toContainEqual(
      expect.objectContaining({
        capability: "target-check-evidence",
        status: "pass",
      }),
    );
  });
});
