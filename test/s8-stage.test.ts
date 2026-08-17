import { afterEach, describe, expect, it } from "vitest";

import type { Stage } from "../src/contracts.js";
import { validateBundle } from "../src/index.js";
import { cleanupFixtures, copyFixture, mutateJson } from "./helpers.js";

type Candidate = {
  id: string;
  name: string;
  status: "proposed" | "selected" | "rejected";
  rationale: string;
  elementRefs: string[];
  boundaryRefs: string[];
  relationRefs: string[];
  interfaceRefs: string[];
  operationalConsequences: string[];
};

type Justification = {
  kind: "short-path" | "forcing-constraint";
  rationale: string;
  evidenceRefs: string[];
  strategyAlternativeRefs: string[];
  hardConstraintRefs: string[];
};

type Architecture = {
  candidates: Candidate[];
  singleCandidateJustification?: Justification;
  qualityAssessments: Array<{ candidateRef: string }>;
};

async function setStage(
  bundle: string,
  completedStage: Stage,
  profile: "full" | "short" = "short",
): Promise<void> {
  await mutateJson<{
    lifecycle: { completedStage: Stage; profile: "full" | "short" };
  }>(bundle, "sah.bundle.json", (manifest) => {
    manifest.lifecycle.completedStage = completedStage;
    manifest.lifecycle.profile = profile;
  });
}

async function proposeCandidates(bundle: string): Promise<void> {
  await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
    model.candidates.forEach((candidate) => {
      candidate.status = "proposed";
    });
  });
}

function secondCandidate(status: Candidate["status"] = "proposed"): Candidate {
  return {
    id: "equipment-rich-domain-candidate",
    name: "Rich equipment domain",
    status,
    rationale: "An alternative ownership representation for comparison",
    elementRefs: ["equipment-operations"],
    boundaryRefs: ["equipment-boundary"],
    relationRefs: [],
    interfaceRefs: [],
    operationalConsequences: [
      "Domain modeling and mapping add authoring and maintenance cost",
    ],
  };
}

afterEach(cleanupFixtures);

describe("S8 candidate-set validation", () => {
  it("rejects a v0.1 bundle manifest through normal operational diagnostics", async () => {
    const bundle = await copyFixture();
    await mutateJson<{
      $schema: string;
      manifestVersion: string;
      artifacts: { architecture: { schemaId: string } };
    }>(bundle, "sah.bundle.json", (manifest) => {
      manifest.$schema =
        "https://sah.dev/schemas/design-bundle-manifest/v0.1.0";
      manifest.manifestVersion = "0.1.0";
      manifest.artifacts.architecture.schemaId =
        "https://sah.dev/schemas/architecture/v0.1.0";
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("operational-error");
    expect(validation.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SCHEMA_CONST",
          artifactPath: "sah.bundle.json",
          jsonPointer: "/manifestVersion",
        }),
      ]),
    );
  });

  it("passes a proposed short-path candidate with traced proportionality evidence", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S8");
    await proposeCandidates(bundle);

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("passed");
    expect(validation.diagnostics).toEqual([]);
  });

  it("passes multiple structurally valid proposed candidates without judging adequacy", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S8", "full");
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      const first = model.candidates[0];
      if (first !== undefined) first.status = "proposed";
      model.candidates.push(secondCandidate());
      delete model.singleCandidateJustification;
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("passed");
    expect(validation.diagnostics).toEqual([]);
  });

  it("passes one candidate forced by a resolved hard constraint", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S8", "full");
    await proposeCandidates(bundle);
    await mutateJson<{
      hardConstraints: Array<{
        id: string;
        statement: string;
        evidenceRefs: string[];
        affectedSubsystemRefs: string[];
      }>;
    }>(bundle, "system-characterization.json", (model) => {
      model.hardConstraints.push({
        id: "equipment-local-only",
        statement: "Equipment data must remain in the local deployment",
        evidenceRefs: ["ev-equipment-maintenance"],
        affectedSubsystemRefs: ["equipment-administration"],
      });
    });
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      model.singleCandidateJustification = {
        kind: "forcing-constraint",
        rationale:
          "The imposed local-only constraint eliminates remote candidates",
        evidenceRefs: ["ev-equipment-maintenance"],
        strategyAlternativeRefs: [],
        hardConstraintRefs: ["equipment-local-only"],
      };
    });

    expect((await validateBundle(bundle)).status).toBe("passed");
  });

  it("fails a single candidate without structured justification", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S8");
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      const candidate = model.candidates[0];
      if (candidate !== undefined) candidate.status = "proposed";
      delete model.singleCandidateJustification;
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S8_SINGLE_CANDIDATE_JUSTIFICATION_MISSING",
    );
  });

  it.each([
    ["manifest profile", "profile"],
    ["S2 eligibility", "strategy"],
  ] as const)(
    "fails short-path justification without %s",
    async (_name, source) => {
      const bundle = await copyFixture();
      await setStage(bundle, "S8", source === "profile" ? "full" : "short");
      await proposeCandidates(bundle);
      if (source === "strategy") {
        await mutateJson<{ shortPath: { eligible: boolean } }>(
          bundle,
          "design-strategy.json",
          (model) => {
            model.shortPath.eligible = false;
          },
        );
      }

      const validation = await validateBundle(bundle);

      expect(validation.status).toBe("violations");
      expect(validation.diagnostics.map(({ code }) => code)).toContain(
        "STAGE_S8_SHORT_PATH_NOT_ELIGIBLE",
      );
    },
  );

  it("fails short-path evidence that does not cover the S2 rationale", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S8");
    await proposeCandidates(bundle);
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      if (model.singleCandidateJustification !== undefined) {
        model.singleCandidateJustification.evidenceRefs = [
          "ev-concurrency-unspecified",
        ];
      }
    });

    const validation = await validateBundle(bundle);

    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S8_SHORT_PATH_EVIDENCE_COVERAGE_MISSING",
    );
  });

  it("fails short-path evidence without an S2 alternative per selection", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S8");
    await proposeCandidates(bundle);
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      if (model.singleCandidateJustification !== undefined) {
        model.singleCandidateJustification.strategyAlternativeRefs = [];
      }
    });

    const validation = await validateBundle(bundle);

    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S8_SHORT_PATH_ALTERNATIVE_COVERAGE_MISSING",
    );
  });

  it("fails forcing justification without a hard constraint", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S8", "full");
    await proposeCandidates(bundle);
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      if (model.singleCandidateJustification !== undefined) {
        model.singleCandidateJustification.kind = "forcing-constraint";
        model.singleCandidateJustification.strategyAlternativeRefs = [];
        model.singleCandidateJustification.hardConstraintRefs = [];
      }
    });

    const validation = await validateBundle(bundle);

    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S8_FORCING_CONSTRAINT_MISSING",
    );
  });

  it.each([
    [
      "evidenceRefs",
      "ev-missing",
      "/singleCandidateJustification/evidenceRefs/0",
    ],
    [
      "strategyAlternativeRefs",
      "missing-strategy",
      "/singleCandidateJustification/strategyAlternativeRefs/0",
    ],
    [
      "hardConstraintRefs",
      "constraint-missing",
      "/singleCandidateJustification/hardConstraintRefs/0",
    ],
  ] as const)(
    "fails a dangling %s reference",
    async (field, reference, pointer) => {
      const bundle = await copyFixture();
      await setStage(bundle, "S8");
      await proposeCandidates(bundle);
      await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
        const justification = model.singleCandidateJustification;
        if (justification === undefined) return;
        justification[field] = [reference];
        if (field === "hardConstraintRefs")
          justification.kind = "forcing-constraint";
      });

      const validation = await validateBundle(bundle);

      expect(validation.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "REFERENCE_DANGLING",
          artifactPath: "architecture.json",
          jsonPointer: pointer,
          reference,
        }),
      );
    },
  );

  it("fails dangling candidate topology and assessment references", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S8");
    await proposeCandidates(bundle);
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      const candidate = model.candidates[0];
      if (candidate !== undefined) candidate.elementRefs[0] = "element-missing";
      const assessment = model.qualityAssessments[0];
      if (assessment !== undefined)
        assessment.candidateRef = "candidate-missing";
    });

    const validation = await validateBundle(bundle);

    expect(validation.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "REFERENCE_DANGLING",
          jsonPointer: "/candidates/0/elementRefs/0",
          reference: "element-missing",
        }),
        expect.objectContaining({
          code: "REFERENCE_DANGLING",
          jsonPointer: "/qualityAssessments/0/candidateRef",
          reference: "candidate-missing",
        }),
      ]),
    );
  });

  it("fails selected or rejected candidate status before S10", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S8");

    const validation = await validateBundle(bundle);

    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S8_CANDIDATE_STATUS_INVALID",
    );
  });

  it("fails multiple selected candidates after S10", async () => {
    const bundle = await copyFixture();
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      model.candidates.push(secondCandidate("selected"));
      delete model.singleCandidateJustification;
    });

    const validation = await validateBundle(bundle);

    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S10_CANDIDATE_SELECTION_COUNT",
    );
  });

  it("fails a non-selected candidate that remains proposed after S10", async () => {
    const bundle = await copyFixture();
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      model.candidates.push(secondCandidate());
      delete model.singleCandidateJustification;
    });

    const validation = await validateBundle(bundle);

    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S10_CANDIDATE_NOT_DISPOSITIONED",
    );
  });
});
