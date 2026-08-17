import { readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type {
  Stage,
  ValidationClassification,
  VerificationRecord,
} from "../src/contracts.js";
import { verifyBundle } from "../src/index.js";
import {
  cleanupFixtures,
  copyFixture,
  copyVerificationTarget,
  fixtureDirectory,
  mutateJson,
  verificationTargetDirectory,
} from "./helpers.js";

afterEach(cleanupFixtures);

type Constraint = {
  classification: ValidationClassification;
  observable?: {
    factSource: string;
    selector: string;
    predicate: string;
    expected: string;
  };
  enforcement: {
    adapterCapability: string;
    failureMessage: string;
  };
};

type Decision = {
  id: string;
  title: string;
  status: string;
  affectedElementRefs: string[];
  options: Array<{ id: string }>;
  selectedOptionRef: string | null;
  constraintRefs: string[];
};

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
  await mutateJson<{ constraints: Constraint[] }>(
    bundle,
    "architecture.json",
    (architecture) => {
      const constraint = architecture.constraints[0];
      if (constraint === undefined) return;
      constraint.observable = {
        factSource: "filesystem",
        selector,
        predicate: "regular-file-exists",
        expected: "true",
      };
      constraint.enforcement.adapterCapability = "filesystem-artifact-presence";
    },
  );
}

async function blockCanonicalSlice(bundle: string): Promise<void> {
  const blockerId = "choose-equipment-export-boundary";
  await mutateJson<{ decisions: Decision[] }>(
    bundle,
    "architecture-decision.json",
    (model) => {
      const source = model.decisions[0];
      if (source === undefined) return;
      const proposed = structuredClone(source);
      proposed.id = blockerId;
      proposed.title = "Choose an export boundary";
      proposed.status = "proposed";
      proposed.selectedOptionRef = null;
      proposed.constraintRefs = [];
      proposed.options.forEach((option, index) => {
        option.id = `export-boundary-option-${String(index + 1)}`;
      });
      model.decisions.push(proposed);
    },
  );
  await mutateJson<{
    slices: Array<{
      status: string;
      blockedByDecisionRefs: string[];
    }>;
  }>(bundle, "implementation-handoff.json", (handoff) => {
    const slice = handoff.slices[0];
    if (slice === undefined) return;
    slice.status = "blocked";
    slice.blockedByDecisionRefs = [blockerId];
  });
}

describe("verifyBundle", () => {
  it("reports an unavailable declared adapter as unsupported, never pass", async () => {
    const verification = await verifyBundle(
      fixtureDirectory,
      verificationTargetDirectory,
    );

    expect(verification.status).toBe("incomplete");
    expect(verification.checks).toContainEqual(
      expect.objectContaining({
        code: "CONSTRAINT_ADAPTER_UNSUPPORTED",
        constraintId: "equipment-owns-writes",
        status: "unsupported",
      }),
    );
    expect(verification.summary).toEqual(
      expect.objectContaining({ passed: 0, unsupported: 1 }),
    );
  });

  it("passes the supported regular-file presence capability", async () => {
    const bundle = await copyFixture();
    await setFilesystemConstraint(
      bundle,
      "checks/equipment-operations.integration.txt",
    );

    const verification = await verifyBundle(
      bundle,
      verificationTargetDirectory,
    );

    expect(verification.status).toBe("passed");
    expect(verification.checks).toEqual([
      expect.objectContaining({
        code: "CONSTRAINT_PASSED",
        status: "pass",
        invariantRefs: ["asset-tag-unique"],
        expected: "true",
        observed:
          "regular file exists at checks/equipment-operations.integration.txt",
      }),
    ]);
    expect(verification.summary.passed).toBe(1);
  });

  it("persists the complete full-verification result as a schema-valid record", async () => {
    const bundle = await copyFixture();
    const recordPath = "verification-record.json";
    const manifestPath = join(bundle, "sah.bundle.json");
    const manifestBefore = await readFile(manifestPath);
    await setFilesystemConstraint(
      bundle,
      "checks/equipment-operations.integration.txt",
    );

    const verification = await verifyBundle(
      bundle,
      verificationTargetDirectory,
      { verificationRecordPath: recordPath },
    );
    const record = JSON.parse(
      await readFile(join(bundle, recordPath), "utf8"),
    ) as VerificationRecord;

    expect(verification.status).toBe("passed");
    expect(record).toEqual({
      $schema: "https://sah.dev/schemas/verification-record/v0.1.0",
      recordVersion: "0.1.0",
      bundleFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      invocation: { scope: "full" },
      result: verification,
    });
    expect(await readFile(manifestPath)).toEqual(manifestBefore);
  });

  it("refuses to overwrite an authoritative bundle artifact with a record", async () => {
    const bundle = await copyFixture();
    await setFilesystemConstraint(
      bundle,
      "checks/equipment-operations.integration.txt",
    );
    const architectureBefore = await readFile(
      join(bundle, "architecture.json"),
    );

    const verification = await verifyBundle(
      bundle,
      verificationTargetDirectory,
      { verificationRecordPath: "architecture.json" },
    );

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({ code: "VERIFICATION_RECORD_PATH_CONFLICT" }),
    );
    expect(await readFile(join(bundle, "architecture.json"))).toEqual(
      architectureBefore,
    );
  });

  it("returns a violation when the expected regular file is missing", async () => {
    const bundle = await copyFixture();
    await setFilesystemConstraint(bundle, "checks/missing.txt");

    const verification = await verifyBundle(
      bundle,
      verificationTargetDirectory,
    );

    expect(verification.status).toBe("violations");
    expect(verification.checks).toContainEqual(
      expect.objectContaining({
        code: "CONSTRAINT_VIOLATION",
        status: "violation",
        observed: "missing path checks/missing.txt",
      }),
    );
  });

  it("keeps a known violation primary when another adapter is unsupported", async () => {
    const bundle = await copyFixture();
    await setFilesystemConstraint(bundle, "checks/missing.txt");
    const secondConstraintId = "equipment-write-path-documented";
    await mutateJson<{ constraints: Array<Constraint & { id: string }> }>(
      bundle,
      "architecture.json",
      (architecture) => {
        const source = architecture.constraints[0];
        if (source === undefined) return;
        const second = structuredClone(source);
        second.id = secondConstraintId;
        second.observable = {
          factSource: "source-graph",
          selector: "writes to equipment records",
          predicate: "origin is equipment-operations",
          expected: "true",
        };
        second.enforcement.adapterCapability = "dependency-and-write analysis";
        architecture.constraints.push(second);
      },
    );
    await mutateJson<{ decisions: Decision[] }>(
      bundle,
      "architecture-decision.json",
      (model) => {
        model.decisions[0]?.constraintRefs.push(secondConstraintId);
      },
    );
    await mutateJson<{ slices: Array<{ constraintRefs: string[] }> }>(
      bundle,
      "implementation-handoff.json",
      (handoff) => {
        handoff.slices[0]?.constraintRefs.push(secondConstraintId);
      },
    );

    const verification = await verifyBundle(
      bundle,
      verificationTargetDirectory,
    );

    expect(verification.status).toBe("violations");
    expect(verification.summary).toEqual(
      expect.objectContaining({ violations: 1, unsupported: 1 }),
    );
  });

  it("does not count a directory as a regular file", async () => {
    const bundle = await copyFixture();
    await setFilesystemConstraint(bundle, "checks");

    const verification = await verifyBundle(
      bundle,
      verificationTargetDirectory,
    );

    expect(verification.status).toBe("violations");
    expect(verification.checks[0]).toEqual(
      expect.objectContaining({
        status: "violation",
        observed: "path is not a regular file at checks",
      }),
    );
  });

  it.each(["assisted", "judgment"] as const)(
    "keeps a %s constraint pending instead of executing it",
    async (classification) => {
      const bundle = await copyFixture();
      await mutateJson<{ constraints: Constraint[] }>(
        bundle,
        "architecture.json",
        (architecture) => {
          const constraint = architecture.constraints[0];
          if (constraint !== undefined)
            constraint.classification = classification;
        },
      );

      const verification = await verifyBundle(
        bundle,
        verificationTargetDirectory,
      );

      expect(verification.status).toBe("incomplete");
      expect(verification.checks[0]).toEqual(
        expect.objectContaining({
          code: "CONSTRAINT_REVIEW_PENDING",
          classification,
          status: "pending",
        }),
      );
    },
  );

  it("keeps a constraint pending when all assigned slices are blocked", async () => {
    const bundle = await copyFixture();
    await blockCanonicalSlice(bundle);

    const verification = await verifyBundle(
      bundle,
      verificationTargetDirectory,
    );

    expect(verification.status).toBe("incomplete");
    expect(verification.checks[0]).toEqual(
      expect.objectContaining({
        code: "CONSTRAINT_SLICE_BLOCKED",
        blockerDecisionRefs: ["choose-equipment-export-boundary"],
        status: "pending",
      }),
    );
  });

  it.each([
    "../outside.txt",
    "checks\\file.txt",
    "/tmp/outside.txt",
    "C:/outside.txt",
    "checks/invalid\0name.txt",
  ])(
    "rejects unsafe selector %s without reading outside the target",
    async (selector) => {
      const bundle = await copyFixture();
      await setFilesystemConstraint(bundle, selector);

      const verification = await verifyBundle(
        bundle,
        verificationTargetDirectory,
      );

      expect(verification.status).toBe("incomplete");
      expect(verification.checks[0]).toEqual(
        expect.objectContaining({
          code: "CONSTRAINT_BINDING_UNSAFE",
          status: "unsupported",
        }),
      );
    },
  );

  it.each([
    ["manifest", "regular-file-exists", "true"],
    ["filesystem", "contains-text", "true"],
    ["filesystem", "regular-file-exists", "false"],
  ])(
    "keeps unsupported observable tuple %s/%s/%s incomplete",
    async (factSource, predicate, expected) => {
      const bundle = await copyFixture();
      await setFilesystemConstraint(
        bundle,
        "checks/equipment-operations.integration.txt",
      );
      await mutateJson<{ constraints: Constraint[] }>(
        bundle,
        "architecture.json",
        (architecture) => {
          const observable = architecture.constraints[0]?.observable;
          if (observable === undefined) return;
          observable.factSource = factSource;
          observable.predicate = predicate;
          observable.expected = expected;
        },
      );

      const verification = await verifyBundle(
        bundle,
        verificationTargetDirectory,
      );

      expect(verification.status).toBe("incomplete");
      expect(verification.checks[0]).toEqual(
        expect.objectContaining({
          code: "CONSTRAINT_BINDING_UNSUPPORTED",
          status: "unsupported",
        }),
      );
    },
  );

  it("rejects a physical symlink escape from the verification target", async () => {
    const bundle = await copyFixture();
    const target = await copyVerificationTarget();
    await symlink(fixtureDirectory, join(target, "escape"));
    await setFilesystemConstraint(bundle, "escape/sah.bundle.json");

    const verification = await verifyBundle(bundle, target);

    expect(verification.status).toBe("incomplete");
    expect(verification.checks[0]).toEqual(
      expect.objectContaining({
        code: "CONSTRAINT_BINDING_UNSAFE",
        status: "unsupported",
      }),
    );
  });

  it("allows a confined filename that merely begins with two dots", async () => {
    const bundle = await copyFixture();
    const target = await copyVerificationTarget();
    await writeFile(join(target, "..allowed.txt"), "present\n");
    await setFilesystemConstraint(bundle, "..allowed.txt");

    const verification = await verifyBundle(bundle, target);

    expect(verification.status).toBe("passed");
    expect(verification.checks[0]).toEqual(
      expect.objectContaining({ status: "pass" }),
    );
  });

  it("returns operational error before S12 handoff completion", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S11");

    const verification = await verifyBundle(
      bundle,
      verificationTargetDirectory,
    );

    expect(verification.status).toBe("operational-error");
    expect(verification.checks).toEqual([]);
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({ code: "VERIFICATION_STAGE_NOT_READY" }),
    );
  });

  it("returns operational error for an unreadable target root", async () => {
    const target = join(verificationTargetDirectory, "missing");

    const verification = await verifyBundle(fixtureDirectory, target);

    expect(verification.status).toBe("operational-error");
    expect(verification.checks).toEqual([]);
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({ code: "VERIFICATION_TARGET_UNREADABLE" }),
    );
  });

  it("does not infer the current directory from an empty target", async () => {
    const verification = await verifyBundle(fixtureDirectory, "");

    expect(verification.status).toBe("operational-error");
    expect(verification.targetDirectory).toBe("");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "VERIFICATION_TARGET_UNREADABLE",
        message: "The verification target directory is empty.",
      }),
    );
  });

  it("preserves bundle validation violations without executing checks", async () => {
    const bundle = await copyFixture();
    await mutateJson<{ responsibilities: Array<{ evidenceRefs: string[] }> }>(
      bundle,
      "responsibility.json",
      (model) => {
        const responsibility = model.responsibilities[0];
        if (responsibility !== undefined)
          responsibility.evidenceRefs[0] = "missing-evidence";
      },
    );

    const verification = await verifyBundle(
      bundle,
      verificationTargetDirectory,
    );

    expect(verification.status).toBe("violations");
    expect(verification.checks).toEqual([]);
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({ code: "REFERENCE_DANGLING" }),
    );
  });
});
