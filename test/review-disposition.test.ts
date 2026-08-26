import { spawn } from "node:child_process";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ReviewDisposition } from "../src/contracts.js";
import {
  advanceBundle,
  resumeBundle,
  validateReviewDisposition,
  verifyBundle,
} from "../src/index.js";
import {
  cleanupFixtures,
  cliPath,
  copyFixture,
  copyVerificationTarget,
} from "./helpers.js";

afterEach(cleanupFixtures);

type Constraint = {
  id: string;
  decisionRef: string;
  classification: "deterministic" | "assisted" | "judgment";
  scopeElementRefs: string[];
  invariantRefs: string[];
  enforcement: { adapterCapability: string };
};

type Architecture = { constraints: Constraint[] };
type Handoff = {
  slices: Array<{ id: string; constraintRefs: string[] }>;
};

type ProcessResult = { code: number; stdout: string; stderr: string };

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

async function createDisposition(
  bundle: string,
  target: string,
  disposition: ReviewDisposition["entries"][number]["disposition"] = "accepted",
  options: { targetRevision?: string; expiresAt?: string } = {},
): Promise<string> {
  const architecture = JSON.parse(
    await readFile(join(bundle, "architecture.json"), "utf8"),
  ) as Architecture;
  const handoff = JSON.parse(
    await readFile(join(bundle, "implementation-handoff.json"), "utf8"),
  ) as Handoff;
  const resume = await resumeBundle(bundle);
  const constraint = architecture.constraints[0];
  if (constraint === undefined || resume.bundle === undefined) {
    throw new Error(
      "The fixture does not contain a current constraint and bundle.",
    );
  }
  if (resume.bundleFingerprint === undefined) {
    throw new Error("The fixture did not produce a design fingerprint.");
  }
  const sliceRefs = handoff.slices
    .filter(({ constraintRefs }) => constraintRefs.includes(constraint.id))
    .map(({ id }) => id);
  if (sliceRefs.length === 0)
    throw new Error("The constraint has no handoff slice.");
  if (constraint.classification === "deterministic")
    throw new Error(
      "The disposition fixture must use a contextual constraint.",
    );

  const record: ReviewDisposition = {
    $schema: "https://sah.dev/schemas/review-disposition/v0.1.0",
    dispositionVersion: "0.1.0",
    dispositionId: "fixture-contextual-disposition",
    target: {
      targetRoot: await realpath(target),
      targetRevision: options.targetRevision ?? "git:fixture-revision",
      designFingerprint: resume.bundleFingerprint,
    },
    scope: {
      bundleId: resume.bundle.id,
      completedStage: "S12",
      constraintIds: [constraint.id],
    },
    authority: {
      id: "fixture-authority",
      role: "architecture owner",
      scope: "fixture contextual risk",
    },
    recordedBy: {
      id: "fixture-recorder",
      role: "test harness",
    },
    entries: [
      {
        constraintId: constraint.id,
        decisionRef: constraint.decisionRef,
        classification: constraint.classification,
        capability: constraint.enforcement.adapterCapability,
        scopeElementRefs: constraint.scopeElementRefs,
        invariantRefs: constraint.invariantRefs,
        sliceRefs,
        disposition,
        rationale:
          "The bounded contextual residual risk is explicitly accepted or routed.",
        evidenceRefs: ["artifact://fixture/contextual-review"],
        residualRisks: ["Production integration remains outside this fixture."],
        expiresAt: options.expiresAt ?? "2099-12-31T00:00:00Z",
      },
    ],
    reviewedAt: "2026-08-26T00:00:00Z",
  };
  const path = join(target, "disposition.json");
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
  return path;
}

async function makeContextualFixture(
  classification: "assisted" | "judgment" = "judgment",
): Promise<{ bundle: string; target: string; recordPath: string }> {
  const bundle = await copyFixture();
  const target = await copyVerificationTarget();
  const architecture = JSON.parse(
    await readFile(join(bundle, "architecture.json"), "utf8"),
  ) as Architecture;
  const constraint = architecture.constraints[0];
  if (constraint === undefined) throw new Error("Missing fixture constraint.");
  constraint.classification = classification;
  await writeFile(
    join(bundle, "architecture.json"),
    `${JSON.stringify(architecture, null, 2)}\n`,
  );
  const recordPath = await createDisposition(bundle, target);
  return { bundle, target, recordPath };
}

describe("review disposition contract", () => {
  it("validates a revision-bound contextual record without authenticating the authority", async () => {
    const { bundle, target, recordPath } = await makeContextualFixture();
    const resume = await resumeBundle(bundle);
    if (resume.bundleFingerprint === undefined)
      throw new Error("The fixture did not produce a design fingerprint.");
    const result = await validateReviewDisposition(recordPath, {
      targetRoot: await realpath(target),
      targetRevision: "git:fixture-revision",
      designFingerprint: resume.bundleFingerprint,
      bundleId: "equipment-register",
    });

    expect(result.status).toBe("passed");
    expect(result.dispositionId).toBe("fixture-contextual-disposition");
    expect(result.diagnostics).toEqual([]);
  });

  it("rejects duplicate constraint entries", async () => {
    const { target, recordPath } = await makeContextualFixture();
    const record = JSON.parse(
      await readFile(recordPath, "utf8"),
    ) as ReviewDisposition;
    const entry = record.entries[0];
    if (entry === undefined) throw new Error("Missing disposition entry.");
    record.entries.push({ ...entry });
    await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);

    const result = await validateReviewDisposition(recordPath, {
      targetRoot: await realpath(target),
      targetRevision: "git:fixture-revision",
      designFingerprint: record.target.designFingerprint,
      bundleId: record.scope.bundleId,
    });

    expect(result.status).toBe("violations");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "REVIEW_DISPOSITION_DUPLICATE_CONSTRAINT",
      }),
    );
  });

  it("reports malformed input as an operational error", async () => {
    const { recordPath } = await makeContextualFixture();
    await writeFile(recordPath, "{\n");

    const result = await validateReviewDisposition(recordPath);

    expect(result.status).toBe("operational-error");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "REVIEW_DISPOSITION_MALFORMED" }),
    );
  });

  it.each([
    ["assisted", "assisted"],
    ["judgment", "judgment"],
  ] as const)(
    "turns an accepted %s entry into a retained contextual pass",
    async (classification, expectedClassification) => {
      expect(classification).toBe(expectedClassification);
      const { bundle, target } = await makeContextualFixture(classification);
      const verification = await verifyBundle(bundle, target, {
        dispositionRecordPath: "disposition.json",
        targetRevision: "git:fixture-revision",
      });

      expect(verification.status).toBe("passed");
      expect(verification.checks[0]).toEqual(
        expect.objectContaining({
          code: "CONSTRAINT_DISPOSITION_ACCEPTED",
          classification,
          status: "pass",
          expected: "accepted contextual disposition",
        }),
      );
    },
  );

  it.each([
    ["rejected", "violations", "CONSTRAINT_DISPOSITION_REJECTED"],
    ["deferred", "incomplete", "CONSTRAINT_DISPOSITION_DEFERRED"],
  ] as const)(
    "keeps a %s disposition non-passing",
    async (state, status, code) => {
      const bundle = await copyFixture();
      const target = await copyVerificationTarget();
      const architecture = JSON.parse(
        await readFile(join(bundle, "architecture.json"), "utf8"),
      ) as Architecture;
      const constraint = architecture.constraints[0];
      if (constraint === undefined)
        throw new Error("Missing fixture constraint.");
      constraint.classification = "judgment";
      await writeFile(
        join(bundle, "architecture.json"),
        `${JSON.stringify(architecture, null, 2)}\n`,
      );
      await createDisposition(bundle, target, state);

      const verification = await verifyBundle(bundle, target, {
        dispositionRecordPath: "disposition.json",
        targetRevision: "git:fixture-revision",
      });

      expect(verification.status).toBe(status);
      expect(verification.checks[0]).toEqual(
        expect.objectContaining({
          code,
          status: state === "rejected" ? "violation" : "pending",
        }),
      );
    },
  );

  it("expires an accepted disposition into pending evidence", async () => {
    const { bundle, target } = await makeContextualFixture();
    await createDisposition(bundle, target, "accepted", {
      expiresAt: "2026-01-01T00:00:00Z",
    });

    const verification = await verifyBundle(bundle, target, {
      dispositionRecordPath: "disposition.json",
      targetRevision: "git:fixture-revision",
    });

    expect(verification.status).toBe("incomplete");
    expect(verification.checks[0]).toEqual(
      expect.objectContaining({
        code: "CONSTRAINT_DISPOSITION_EXPIRED",
        status: "pending",
      }),
    );
  });

  it("keeps a stale target revision incomplete", async () => {
    const { bundle, target } = await makeContextualFixture();
    const verification = await verifyBundle(bundle, target, {
      dispositionRecordPath: "disposition.json",
      targetRevision: "git:other-revision",
    });

    expect(verification.status).toBe("incomplete");
    expect(verification.checks[0]).toEqual(
      expect.objectContaining({
        code: "CONSTRAINT_DISPOSITION_CONTEXT_MISMATCH",
        status: "unsupported",
      }),
    );
  });

  it("requires an explicit target revision for disposition consumption", async () => {
    const { bundle, target } = await makeContextualFixture();
    const verification = await verifyBundle(bundle, target, {
      dispositionRecordPath: "disposition.json",
    });

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "VERIFICATION_DISPOSITION_REVISION_REQUIRED",
      }),
    );
  });

  it("allows accepted contextual evidence to complete S13", async () => {
    const { bundle, target } = await makeContextualFixture();
    const verification = await verifyBundle(bundle, target, {
      dispositionRecordPath: "disposition.json",
      targetRevision: "git:fixture-revision",
      verificationRecordPath: "verification-record.json",
    });
    expect(verification.status).toBe("passed");

    const advancement = await advanceBundle(bundle, "S13", {
      verificationRecordPath: "verification-record.json",
    });

    expect(advancement.status).toBe("advanced");
    expect((await resumeBundle(bundle)).bundle?.completedStage).toBe("S13");
  });

  it("exposes standalone CLI validation with expected context", async () => {
    const { bundle, target } = await makeContextualFixture();
    const resume = await resumeBundle(bundle);
    const execution = await runCli([
      "review-disposition",
      join(target, "disposition.json"),
      "--target-revision",
      "git:fixture-revision",
      "--design-fingerprint",
      resume.bundleFingerprint ?? "",
      "--json",
    ]);
    const output = JSON.parse(execution.stdout) as {
      status: string;
      dispositionId: string;
    };

    expect(execution.code).toBe(0);
    expect(output).toEqual(
      expect.objectContaining({
        status: "passed",
        dispositionId: "fixture-contextual-disposition",
      }),
    );
  });
});
