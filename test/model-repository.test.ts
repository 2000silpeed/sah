import { rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validateBundle } from "../src/index.js";
import {
  cleanupFixtures,
  copyFixture,
  fixtureDirectory,
  mutateJson,
} from "./helpers.js";

afterEach(cleanupFixtures);

describe("validateBundle", () => {
  it("passes the valid simple-crud S11 bundle", async () => {
    const validation = await validateBundle(fixtureDirectory);

    expect(validation.status).toBe("passed");
    expect(validation.bundle).toEqual({
      id: "equipment-register",
      completedStage: "S11",
      profile: "short",
    });
    expect(validation.diagnostics).toEqual([]);
  });

  it("retains artifact and JSON Pointer for schema violations", async () => {
    const bundle = await copyFixture();
    await mutateJson<{ modelId?: string }>(
      bundle,
      "system-characterization.json",
      (model) => {
        delete model.modelId;
      },
    );

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SCHEMA_REQUIRED",
        artifactPath: "system-characterization.json",
        jsonPointer: "/modelId",
        classification: "deterministic",
      }),
    );
  });

  it("treats an unsupported declared schema ID as a manifest failure", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      artifacts: { responsibility: { schemaId: string } };
    }>(bundle, "sah.bundle.json", (manifest) => {
      manifest.artifacts.responsibility.schemaId =
        "https://example.test/schemas/unsupported";
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("operational-error");
    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SCHEMA_CONST",
        category: "operational",
        artifactPath: "sah.bundle.json",
        jsonPointer: "/artifacts/responsibility/schemaId",
      }),
    );
  });

  it("requires a root bundle manifest", async () => {
    const bundle = await copyFixture();
    await rm(join(bundle, "sah.bundle.json"));

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("operational-error");
    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "MANIFEST_NOT_FOUND",
    );
  });

  it("fails a stage-required artifact declaration as a validation violation", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      artifacts: { architectureDecision?: unknown };
    }>(bundle, "sah.bundle.json", (manifest) => {
      delete manifest.artifacts.architectureDecision;
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "STAGE_ARTIFACT_REQUIRED",
        jsonPointer: "/artifacts/architectureDecision",
      }),
    );
  });

  it("reports malformed JSON as an operational failure with source location", async () => {
    const bundle = await copyFixture();
    await writeFile(
      join(bundle, "responsibility.json"),
      '{\n  "schemaVersion": "0.1.0",\n}',
    );

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("operational-error");
    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "JSON_MALFORMED",
        artifactPath: "responsibility.json",
        sourceLocation: expect.objectContaining({
          line: 3,
          column: expect.any(Number),
        }),
      }),
    );
  });

  it("rejects a physical artifact path that escapes through a symlink", async () => {
    const bundle = await copyFixture();
    const outside = join(dirname(bundle), "outside-invariant.json");
    await writeFile(outside, "{}\n");
    await symlink(outside, join(bundle, "linked-invariant.json"));
    await mutateJson<{
      artifacts: { invariant: { path: string } };
    }>(bundle, "sah.bundle.json", (manifest) => {
      manifest.artifacts.invariant.path = "linked-invariant.json";
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("operational-error");
    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "ARTIFACT_PATH_OUTSIDE_BUNDLE",
        jsonPointer: "/artifacts/invariant/path",
      }),
    );
  });

  it("fails a dangling cross-IR reference", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      responsibilities: Array<{ evidenceRefs: string[] }>;
    }>(bundle, "responsibility.json", (model) => {
      const responsibility = model.responsibilities[0];
      if (responsibility !== undefined)
        responsibility.evidenceRefs[0] = "ev-missing";
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "REFERENCE_DANGLING",
        artifactPath: "responsibility.json",
        jsonPointer: "/responsibilities/0/evidenceRefs/0",
        reference: "ev-missing",
      }),
    );
  });

  it("fails missing responsibility ownership after S5", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      responsibilities: Array<{ owner?: unknown }>;
    }>(bundle, "responsibility.json", (model) => {
      const responsibility = model.responsibilities[0];
      if (responsibility !== undefined) delete responsibility.owner;
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S5_RESPONSIBILITY_OWNER_MISSING",
    );
  });

  it("fails missing invariant ownership after S5", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      invariants: Array<{ owner?: unknown }>;
    }>(bundle, "invariant.json", (model) => {
      const invariant = model.invariants[0];
      if (invariant !== undefined) delete invariant.owner;
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S5_INVARIANT_OWNER_MISSING",
    );
  });

  it("accepts explicit unresolved ownership conflict coverage at S5", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      lifecycle: { completedStage: string };
    }>(bundle, "sah.bundle.json", (manifest) => {
      manifest.lifecycle.completedStage = "S5";
    });
    await mutateJson<{
      responsibilities: Array<{ owner?: unknown }>;
      unresolvedConflicts: unknown[];
    }>(bundle, "responsibility.json", (model) => {
      const responsibility = model.responsibilities[0];
      if (responsibility !== undefined) delete responsibility.owner;
      model.unresolvedConflicts.push({
        id: "equipment-owner-conflict",
        responsibilityRefs: ["maintain-equipment-record"],
        description:
          "Operations and audit leads have not assigned write accountability",
        resolutionOwner: "Operations product owner",
      });
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("passed");
  });

  it("fails an unmaterialized logical owner from S6", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      responsibilities: Array<{ owner: { logicalOwnerRef: string } }>;
    }>(bundle, "responsibility.json", (model) => {
      const responsibility = model.responsibilities[0];
      if (responsibility !== undefined) {
        responsibility.owner.logicalOwnerRef = "missing-equipment-owner";
      }
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "STAGE_S6_LOGICAL_OWNER_UNMATERIALIZED",
        reference: "missing-equipment-owner",
      }),
    );
  });

  it("fails undecided representation after S7 but not at S6", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      elements: Array<{ representation: string }>;
    }>(bundle, "architecture.json", (model) => {
      const element = model.elements[0];
      if (element !== undefined) element.representation = "undecided";
    });

    const afterS11 = await validateBundle(bundle);
    expect(afterS11.status).toBe("violations");
    expect(afterS11.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S7_REPRESENTATION_UNDECIDED",
    );

    await mutateJson<{
      lifecycle: { completedStage: string };
    }>(bundle, "sah.bundle.json", (manifest) => {
      manifest.lifecycle.completedStage = "S6";
    });
    const atS6 = await validateBundle(bundle);
    expect(atS6.status).toBe("passed");
  });

  it("fails an accepted decision without a selected option", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      decisions: Array<{ selectedOptionRef: string | null }>;
    }>(bundle, "architecture-decision.json", (model) => {
      const decision = model.decisions[0];
      if (decision !== undefined) decision.selectedOptionRef = null;
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S10_ACCEPTED_OPTION_MISSING",
    );
  });

  it("fails when no architecture candidate is selected after S10", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      candidates: Array<{ status: string }>;
    }>(bundle, "architecture.json", (model) => {
      const candidate = model.candidates[0];
      if (candidate !== undefined) candidate.status = "proposed";
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S10_CANDIDATE_SELECTION_COUNT",
    );
  });

  it("fails a selected option that belongs to another decision", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      decisions: Array<{ selectedOptionRef: string | null }>;
    }>(bundle, "architecture-decision.json", (model) => {
      const decision = model.decisions[0];
      if (decision !== undefined) decision.selectedOptionRef = "foreign-option";
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "REFERENCE_OPTION_NOT_IN_DECISION",
    );
  });

  it("fails a deterministic constraint without an observable contract", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      constraints: Array<{ observable?: unknown }>;
    }>(bundle, "architecture.json", (model) => {
      const constraint = model.constraints[0];
      if (constraint !== undefined) delete constraint.observable;
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S11_DETERMINISTIC_OBSERVABLE_MISSING",
    );
  });

  it("fails a broken decision-to-constraint backlink", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      decisions: Array<{ constraintRefs: string[] }>;
    }>(bundle, "architecture-decision.json", (model) => {
      const decision = model.decisions[0];
      if (decision !== undefined) decision.constraintRefs = [];
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "DECISION_CONSTRAINT_BACKLINK_MISSING",
    );
  });

  it("fails a constraint whose source decision is not accepted", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      decisions: Array<{ status: string; selectedOptionRef: string | null }>;
    }>(bundle, "architecture-decision.json", (model) => {
      const decision = model.decisions[0];
      if (decision !== undefined) {
        decision.status = "proposed";
        decision.selectedOptionRef = null;
      }
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S11_CONSTRAINT_DECISION_NOT_ACCEPTED",
    );
  });

  it("fails a root reference that resolves to the wrong artifact role", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      systemRef: string;
    }>(bundle, "architecture.json", (model) => {
      model.systemRef = "equipment-register-strategy";
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "ROOT_MODEL_REFERENCE_MISMATCH",
        artifactPath: "architecture.json",
        jsonPointer: "/systemRef",
      }),
    );
  });
});
