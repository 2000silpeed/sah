import {
  chmod,
  lstat,
  readFile,
  readdir,
  rename,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { replaceManifestAtomically } from "../src/atomic-manifest.js";
import type { Stage } from "../src/contracts.js";
import { advanceBundle, validateBundle, verifyBundle } from "../src/index.js";
import {
  cleanupFixtures,
  copyFixture,
  mutateJson,
  typescriptTargetDirectory,
  verificationTargetDirectory,
} from "./helpers.js";

afterEach(cleanupFixtures);

async function setStage(bundle: string, completedStage: Stage): Promise<void> {
  await mutateJson<{ lifecycle: { completedStage: Stage } }>(
    bundle,
    "sah.bundle.json",
    (manifest) => {
      manifest.lifecycle.completedStage = completedStage;
    },
  );
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

describe("advanceBundle", () => {
  it("validates S11 before committing only completedStage", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S10");
    const manifestPath = join(bundle, "sah.bundle.json");
    await chmod(manifestPath, 0o640);
    const beforeManifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      lifecycle: { completedStage: Stage };
    };
    const artifactNames = (await readdir(bundle)).filter(
      (name) => name !== "sah.bundle.json",
    );
    const beforeArtifacts = await Promise.all(
      artifactNames.map(
        async (name) => [name, await readFile(join(bundle, name))] as const,
      ),
    );
    const beforeMode = (await lstat(manifestPath)).mode & 0o7777;

    const advancement = await advanceBundle(bundle, "S11");

    expect(advancement.status).toBe("advanced");
    expect(advancement.bundle).toEqual({
      id: "equipment-register",
      profile: "short",
      previousStage: "S10",
      targetStage: "S11",
      completedStage: "S11",
    });
    expect(advancement.diagnostics).toEqual([]);
    const afterSource = await readFile(manifestPath, "utf8");
    expect(afterSource.endsWith("\n")).toBe(true);
    const afterManifest = JSON.parse(afterSource) as typeof beforeManifest;
    expect(afterManifest).toEqual({
      ...beforeManifest,
      lifecycle: {
        ...beforeManifest.lifecycle,
        completedStage: "S11",
      },
    });
    expect((await lstat(manifestPath)).mode & 0o7777).toBe(beforeMode);
    for (const [name, source] of beforeArtifacts) {
      expect(await readFile(join(bundle, name))).toEqual(source);
    }
    expect(
      (await readdir(bundle)).filter((name) => name.endsWith(".tmp")),
    ).toEqual([]);
    expect((await validateBundle(bundle)).status).toBe("passed");
  });

  it("blocks S10 to S11 when a deterministic constraint lacks observability", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S10");
    await mutateJson<{ constraints: Array<{ observable?: unknown }> }>(
      bundle,
      "architecture.json",
      (model) => {
        delete model.constraints[0]?.observable;
      },
    );
    const manifestPath = join(bundle, "sah.bundle.json");
    const before = await readFile(manifestPath);

    const advancement = await advanceBundle(bundle, "S11");

    expect(advancement.status).toBe("blocked");
    expect(advancement.bundle?.completedStage).toBe("S10");
    expect(advancement.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S11_DETERMINISTIC_OBSERVABLE_MISSING",
    );
    expect(await readFile(manifestPath)).toEqual(before);
  });

  it("blocks S6 to S7 while an architecture representation is undecided", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S6");
    await mutateJson<{ elements: Array<{ representation: string }> }>(
      bundle,
      "architecture.json",
      (model) => {
        const element = model.elements[0];
        if (element !== undefined) element.representation = "undecided";
      },
    );

    const advancement = await advanceBundle(bundle, "S7");

    expect(advancement.status).toBe("blocked");
    expect(advancement.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S7_REPRESENTATION_UNDECIDED",
    );
    const manifest = JSON.parse(
      await readFile(join(bundle, "sah.bundle.json"), "utf8"),
    ) as { lifecycle: { completedStage: Stage } };
    expect(manifest.lifecycle.completedStage).toBe("S6");
  });

  it("advances S7 to S8 after validating proposed candidate evidence", async () => {
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
    const manifestPath = join(bundle, "sah.bundle.json");
    const architecturePath = join(bundle, "architecture.json");
    const before = JSON.parse(await readFile(manifestPath, "utf8")) as {
      lifecycle: { completedStage: Stage };
    };
    const architectureBefore = await readFile(architecturePath);

    const advancement = await advanceBundle(bundle, "S8");

    expect(advancement.status).toBe("advanced");
    expect(advancement.bundle?.completedStage).toBe("S8");
    expect(JSON.parse(await readFile(manifestPath, "utf8"))).toEqual({
      ...before,
      lifecycle: { ...before.lifecycle, completedStage: "S8" },
    });
    expect(await readFile(architecturePath)).toEqual(architectureBefore);
  });

  it("blocks S7 to S8 without single-candidate evidence", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S7");
    await mutateJson<{
      candidates: Array<{ status: string }>;
      singleCandidateJustification?: unknown;
    }>(bundle, "architecture.json", (model) => {
      model.candidates.forEach((candidate) => {
        candidate.status = "proposed";
      });
      delete model.singleCandidateJustification;
    });
    const manifestPath = join(bundle, "sah.bundle.json");
    const before = await readFile(manifestPath);

    const advancement = await advanceBundle(bundle, "S8");

    expect(advancement.status).toBe("blocked");
    expect(advancement.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S8_SINGLE_CANDIDATE_JUSTIFICATION_MISSING",
    );
    expect(await readFile(manifestPath)).toEqual(before);
  });

  it("advances S8 to S9 after validating complete assessment coverage", async () => {
    const bundle = await copyFixture();
    await prepareForS9(bundle);
    const manifestPath = join(bundle, "sah.bundle.json");
    const architecturePath = join(bundle, "architecture.json");
    const decisionPath = join(bundle, "architecture-decision.json");
    const before = JSON.parse(await readFile(manifestPath, "utf8")) as {
      lifecycle: { completedStage: Stage };
    };
    const architectureBefore = await readFile(architecturePath);
    const decisionBefore = await readFile(decisionPath);

    const advancement = await advanceBundle(bundle, "S9");

    expect(advancement.status).toBe("advanced");
    expect(advancement.bundle?.completedStage).toBe("S9");
    expect(JSON.parse(await readFile(manifestPath, "utf8"))).toEqual({
      ...before,
      lifecycle: { ...before.lifecycle, completedStage: "S9" },
    });
    expect(await readFile(architecturePath)).toEqual(architectureBefore);
    expect(await readFile(decisionPath)).toEqual(decisionBefore);
  });

  it("blocks S8 to S9 without must-scenario coverage", async () => {
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

    const advancement = await advanceBundle(bundle, "S9");

    expect(advancement.status).toBe("blocked");
    expect(advancement.bundle?.completedStage).toBe("S8");
    expect(advancement.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S9_MUST_ASSESSMENT_MISSING",
    );
    expect(await readFile(manifestPath)).toEqual(before);
  });

  it("advances S8 to S9 with an assisted non-pass review warning", async () => {
    const bundle = await copyFixture();
    await prepareForS9(bundle);
    await mutateJson<{ qualityAssessments: Array<{ result: string }> }>(
      bundle,
      "architecture.json",
      (model) => {
        const assessment = model.qualityAssessments[0];
        if (assessment !== undefined) assessment.result = "risk";
      },
    );

    const advancement = await advanceBundle(bundle, "S9");

    expect(advancement.status).toBe("advanced");
    expect(advancement.summary).toEqual({ errors: 0, warnings: 1 });
    expect(advancement.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "STAGE_S9_MUST_SCENARIO_REVIEW",
        severity: "warning",
        classification: "assisted",
      }),
    );
  });

  it("allows assisted warnings without treating them as gate failures", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S9");
    await mutateJson<{
      decisions: Array<{ status: string; selectedOptionRef: string | null }>;
    }>(bundle, "architecture-decision.json", (model) => {
      const decision = model.decisions[0];
      if (decision !== undefined) {
        decision.status = "proposed";
        decision.selectedOptionRef = null;
      }
    });

    const advancement = await advanceBundle(bundle, "S10");

    expect(advancement.status).toBe("advanced");
    expect(advancement.summary).toEqual({ errors: 0, warnings: 1 });
    expect(advancement.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "STAGE_S10_PROPOSED_DECISION_REVIEW",
        severity: "warning",
        classification: "assisted",
      }),
    );
  });

  it("advances S11 to S12 after validating the handoff and changes only the manifest", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S11");
    const manifestPath = join(bundle, "sah.bundle.json");
    const handoffPath = join(bundle, "implementation-handoff.json");
    const before = JSON.parse(await readFile(manifestPath, "utf8")) as {
      lifecycle: { completedStage: Stage };
    };
    const handoffBefore = await readFile(handoffPath);

    const advancement = await advanceBundle(bundle, "S12");

    expect(advancement.status).toBe("advanced");
    expect(advancement.bundle?.completedStage).toBe("S12");
    expect(JSON.parse(await readFile(manifestPath, "utf8"))).toEqual({
      ...before,
      lifecycle: { ...before.lifecycle, completedStage: "S12" },
    });
    expect(await readFile(handoffPath)).toEqual(handoffBefore);
  });

  it("blocks S11 to S12 without complete constraint coverage", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S11");
    await mutateJson<{ slices: Array<{ constraintRefs: string[] }> }>(
      bundle,
      "implementation-handoff.json",
      (handoff) => {
        const slice = handoff.slices[0];
        if (slice !== undefined) slice.constraintRefs = [];
      },
    );
    const manifestPath = join(bundle, "sah.bundle.json");
    const before = await readFile(manifestPath);

    const advancement = await advanceBundle(bundle, "S12");

    expect(advancement.status).toBe("blocked");
    expect(advancement.bundle?.completedStage).toBe("S11");
    expect(advancement.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S12_CONSTRAINT_NOT_COVERED",
    );
    expect(await readFile(manifestPath)).toEqual(before);
  });

  it("atomically advances S12 to S13 from a pinned full-verification record", async () => {
    const bundle = await copyFixture();
    const recordPath = "verification-record.json";
    const manifestPath = join(bundle, "sah.bundle.json");
    const architecturePath = join(bundle, "architecture.json");
    const architectureBefore = await readFile(architecturePath);

    const verification = await verifyBundle(bundle, typescriptTargetDirectory, {
      sourceMappingPath: "sah.source-map.json",
      verificationRecordPath: recordPath,
    });
    const recordBefore = await readFile(join(bundle, recordPath));
    const advancement = await advanceBundle(bundle, "S13", {
      verificationRecordPath: recordPath,
    });

    expect(verification.status).toBe("passed");
    expect(advancement.status).toBe("advanced");
    expect(advancement.bundle?.completedStage).toBe("S13");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      lifecycle: { completedStage: Stage };
      verificationRecord: { path: string; schemaId: string; sha256: string };
    };
    expect(manifest.lifecycle.completedStage).toBe("S13");
    expect(manifest.verificationRecord).toEqual({
      path: recordPath,
      schemaId: "https://sah.dev/schemas/verification-record/v0.1.0",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(await readFile(join(bundle, recordPath))).toEqual(recordBefore);
    expect(await readFile(architecturePath)).toEqual(architectureBefore);
    expect((await validateBundle(bundle)).status).toBe("passed");
  });

  it.each([
    ["affected", ["src/equipment-operations/save-equipment.ts"]],
    ["full-fallback", ["src/equipment-store.ts"]],
  ] as const)(
    "blocks S13 for %s changed-scoped verification even when checks pass",
    async (selectionMode, changedPaths) => {
      const bundle = await copyFixture();
      const manifestPath = join(bundle, "sah.bundle.json");
      const before = await readFile(manifestPath);
      const recordPath = `${selectionMode}-record.json`;

      const verification = await verifyBundle(
        bundle,
        typescriptTargetDirectory,
        {
          sourceMappingPath: "sah.source-map.json",
          changedPaths,
          verificationRecordPath: recordPath,
        },
      );
      const advancement = await advanceBundle(bundle, "S13", {
        verificationRecordPath: recordPath,
      });

      expect(verification.status).toBe("passed");
      expect(verification.selection?.mode).toBe(selectionMode);
      expect(advancement.status).toBe("blocked");
      expect(advancement.diagnostics.map(({ code }) => code)).toContain(
        "STAGE_S13_FULL_VERIFICATION_REQUIRED",
      );
      expect(await readFile(manifestPath)).toEqual(before);
    },
  );

  it("blocks S13 for an incomplete full-verification record", async () => {
    const bundle = await copyFixture();
    const manifestPath = join(bundle, "sah.bundle.json");
    const before = await readFile(manifestPath);
    const recordPath = "incomplete-record.json";

    const verification = await verifyBundle(
      bundle,
      verificationTargetDirectory,
      { verificationRecordPath: recordPath },
    );
    const advancement = await advanceBundle(bundle, "S13", {
      verificationRecordPath: recordPath,
    });

    expect(verification.status).toBe("incomplete");
    expect(advancement.status).toBe("blocked");
    expect(advancement.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S13_VERIFICATION_NOT_PASSED",
    );
    expect(await readFile(manifestPath)).toEqual(before);
  });

  it("blocks S13 for a violating full-verification record", async () => {
    const bundle = await copyFixture();
    await setFilesystemConstraint(bundle, "checks/missing.txt");
    const manifestPath = join(bundle, "sah.bundle.json");
    const before = await readFile(manifestPath);
    const recordPath = "violations-record.json";

    const verification = await verifyBundle(
      bundle,
      verificationTargetDirectory,
      { verificationRecordPath: recordPath },
    );
    const advancement = await advanceBundle(bundle, "S13", {
      verificationRecordPath: recordPath,
    });

    expect(verification.status).toBe("violations");
    expect(advancement.status).toBe("blocked");
    expect(advancement.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S13_VERIFICATION_NOT_PASSED",
    );
    expect(await readFile(manifestPath)).toEqual(before);
  });

  it("blocks S13 for a recorded operational-error result", async () => {
    const bundle = await copyFixture();
    const manifestPath = join(bundle, "sah.bundle.json");
    const before = await readFile(manifestPath);
    const recordPath = "operational-record.json";

    const verification = await verifyBundle(
      bundle,
      join(verificationTargetDirectory, "missing"),
      { verificationRecordPath: recordPath },
    );
    const advancement = await advanceBundle(bundle, "S13", {
      verificationRecordPath: recordPath,
    });

    expect(verification.status).toBe("operational-error");
    expect(advancement.status).toBe("blocked");
    expect(advancement.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S13_VERIFICATION_NOT_PASSED",
    );
    expect(await readFile(manifestPath)).toEqual(before);
  });

  it("blocks S13 when the semantic design changed after recording", async () => {
    const bundle = await copyFixture();
    const manifestPath = join(bundle, "sah.bundle.json");
    const recordPath = "stale-record.json";
    const verification = await verifyBundle(bundle, typescriptTargetDirectory, {
      sourceMappingPath: "sah.source-map.json",
      verificationRecordPath: recordPath,
    });
    await mutateJson<{ constraints: Array<{ statement: string }> }>(
      bundle,
      "architecture.json",
      (architecture) => {
        const constraint = architecture.constraints[0];
        if (constraint !== undefined)
          constraint.statement = "Equipment operations retain write authority";
      },
    );
    const before = await readFile(manifestPath);

    const advancement = await advanceBundle(bundle, "S13", {
      verificationRecordPath: recordPath,
    });

    expect(verification.status).toBe("passed");
    expect(advancement.status).toBe("blocked");
    expect(advancement.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S13_VERIFICATION_RECORD_STALE",
    );
    expect(await readFile(manifestPath)).toEqual(before);
  });

  it("blocks a forged passed record that still contains an operational error", async () => {
    const bundle = await copyFixture();
    const recordPath = "inconsistent-record.json";
    await verifyBundle(bundle, typescriptTargetDirectory, {
      sourceMappingPath: "sah.source-map.json",
      verificationRecordPath: recordPath,
    });
    await mutateJson<{
      result: {
        diagnostics: Array<Record<string, unknown>>;
        summary: { errors: number };
      };
    }>(bundle, recordPath, (record) => {
      record.result.diagnostics.push({
        code: "FORGED_OPERATION_FAILURE",
        category: "operational",
        capability: "test mutation",
        severity: "error",
        message: "Injected operation failure",
      });
      record.result.summary.errors = 1;
    });

    const advancement = await advanceBundle(bundle, "S13", {
      verificationRecordPath: recordPath,
    });

    expect(advancement.status).toBe("blocked");
    expect(advancement.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S13_VERIFICATION_STATUS_INCONSISTENT",
    );
  });

  it.each([
    ["S10", "S10", "ADVANCE_STAGE_NOT_FORWARD"],
    ["S10", "S9", "ADVANCE_STAGE_NOT_FORWARD"],
    ["S7", "S10", "ADVANCE_STAGE_SKIPPED"],
    ["S12", "S13", "ADVANCE_VERIFICATION_RECORD_REQUIRED"],
  ] as const)(
    "rejects the %s to %s transition with %s",
    async (current, target, code) => {
      const bundle = await copyFixture();
      await setStage(bundle, current);
      const before = await readFile(join(bundle, "sah.bundle.json"));

      const advancement = await advanceBundle(bundle, target);

      expect(advancement.status).toBe("operational-error");
      expect(
        advancement.diagnostics.map((diagnostic) => diagnostic.code),
      ).toContain(code);
      expect(await readFile(join(bundle, "sah.bundle.json"))).toEqual(before);
    },
  );

  it("rejects a runtime-invalid target stage", async () => {
    const bundle = await copyFixture();

    const advancement = await advanceBundle(bundle, "S99" as Stage);

    expect(advancement.status).toBe("operational-error");
    expect(advancement.diagnostics.map(({ code }) => code)).toContain(
      "ADVANCE_STAGE_INVALID",
    );
  });

  it("refuses to replace a symlinked manifest even when its target is local", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S10");
    const manifestPath = join(bundle, "sah.bundle.json");
    const targetPath = join(bundle, "manifest-target.json");
    await rename(manifestPath, targetPath);
    await symlink("manifest-target.json", manifestPath);
    const before = await readFile(targetPath);

    const advancement = await advanceBundle(bundle, "S11");

    expect(advancement.status).toBe("operational-error");
    expect(advancement.diagnostics.map(({ code }) => code)).toContain(
      "MANIFEST_ADVANCE_UNSAFE",
    );
    expect(await readFile(targetPath)).toEqual(before);
    expect((await lstat(manifestPath)).isSymbolicLink()).toBe(true);
  });

  it("detects a pre-commit source change and removes its temporary file", async () => {
    const bundle = await copyFixture();
    const manifestPath = join(bundle, "sah.bundle.json");
    const staleSource = await readFile(manifestPath);
    await setStage(bundle, "S10");
    const currentSource = await readFile(manifestPath);

    const replacement = await replaceManifestAtomically({
      manifestPath,
      expectedSource: staleSource,
      manifest: { lifecycle: { completedStage: "S11" } },
      mode: (await lstat(manifestPath)).mode,
    });

    expect(replacement).toEqual(
      expect.objectContaining({
        ok: false,
        diagnostic: expect.objectContaining({
          code: "BUNDLE_CHANGED_DURING_ADVANCE",
        }),
      }),
    );
    expect(await readFile(manifestPath)).toEqual(currentSource);
    expect(
      (await readdir(bundle)).filter((name) => name.endsWith(".tmp")),
    ).toEqual([]);
  });

  it("detects changed verification evidence before the manifest commit point", async () => {
    const bundle = await copyFixture();
    const manifestPath = join(bundle, "sah.bundle.json");
    const recordPath = join(bundle, "verification-record.json");
    const manifestBefore = await readFile(manifestPath);
    await writeFile(recordPath, '{"status":"passed"}\n');
    const expectedRecord = await readFile(recordPath);
    await writeFile(recordPath, '{"status":"violations"}\n');

    const replacement = await replaceManifestAtomically({
      manifestPath,
      expectedSource: manifestBefore,
      manifest: { lifecycle: { completedStage: "S13" } },
      mode: (await lstat(manifestPath)).mode,
      expectedCompanions: [
        {
          path: recordPath,
          artifactPath: "verification-record.json",
          source: expectedRecord,
        },
      ],
    });

    expect(replacement).toEqual(
      expect.objectContaining({
        ok: false,
        diagnostic: expect.objectContaining({
          code: "VERIFICATION_RECORD_CHANGED_DURING_ADVANCE",
        }),
      }),
    );
    expect(await readFile(manifestPath)).toEqual(manifestBefore);
    expect(
      (await readdir(bundle)).filter((name) => name.endsWith(".tmp")),
    ).toEqual([]);
  });

  it("rejects a pinned record whose bytes change after S13 advancement", async () => {
    const bundle = await copyFixture();
    const recordPath = "verification-record.json";
    await verifyBundle(bundle, typescriptTargetDirectory, {
      sourceMappingPath: "sah.source-map.json",
      verificationRecordPath: recordPath,
    });
    const advancement = await advanceBundle(bundle, "S13", {
      verificationRecordPath: recordPath,
    });
    await writeFile(join(bundle, recordPath), "{}\n");

    const validation = await validateBundle(bundle);

    expect(advancement.status).toBe("advanced");
    expect(validation.status).toBe("operational-error");
    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "VERIFICATION_RECORD_DIGEST_MISMATCH",
    );
  });

  it("keeps validateBundle read-only and governed by the stored stage", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S6");
    await mutateJson<{ elements: Array<{ representation: string }> }>(
      bundle,
      "architecture.json",
      (model) => {
        const element = model.elements[0];
        if (element !== undefined) element.representation = "undecided";
      },
    );
    const before = await readFile(join(bundle, "sah.bundle.json"));

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("passed");
    expect(validation.bundle?.completedStage).toBe("S6");
    expect(await readFile(join(bundle, "sah.bundle.json"))).toEqual(before);
  });
});
