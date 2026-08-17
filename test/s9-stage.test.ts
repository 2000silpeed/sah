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

type QualityAssessment = {
  candidateRef: string;
  scenarioRef: string;
  result: "pass" | "risk" | "fail" | "unknown";
  evidence: string;
  sensitivityPoints: string[];
  tradeoffRefs: string[];
};

type Architecture = {
  candidates: Candidate[];
  singleCandidateJustification?: unknown;
  qualityAssessments: QualityAssessment[];
};

type QualityScenario = {
  id: string;
  sourceEvidenceRefs: string[];
  stimulus: string;
  environment: string;
  artifact: string;
  response: string;
  measure: string;
  priority: "must" | "should" | "could";
};

type DecisionLog = {
  decisions: Array<{
    id: string;
    status: "proposed" | "accepted" | "rejected" | "superseded";
    selectedOptionRef: string | null;
  }>;
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

async function prepareS9(bundle: string): Promise<void> {
  await setStage(bundle, "S9");
  await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
    model.candidates.forEach((candidate) => {
      candidate.status = "proposed";
    });
  });
  await mutateJson<DecisionLog>(
    bundle,
    "architecture-decision.json",
    (model) => {
      model.decisions.forEach((decision) => {
        decision.status = "proposed";
        decision.selectedOptionRef = null;
      });
    },
  );
}

function secondCandidate(): Candidate {
  return {
    id: "equipment-rich-domain-candidate",
    name: "Rich equipment domain",
    status: "proposed",
    rationale: "Compare richer policy ownership against the modular candidate",
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

describe("S9 quality-assessment validation", () => {
  it("passes complete must-scenario coverage for one proposed candidate", async () => {
    const bundle = await copyFixture();
    await prepareS9(bundle);

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("passed");
    expect(validation.diagnostics).toEqual([]);
  });

  it("passes the complete candidate by must-scenario Cartesian product", async () => {
    const bundle = await copyFixture();
    await prepareS9(bundle);
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      const baseline = model.qualityAssessments[0];
      if (baseline === undefined) return;
      model.candidates.push(secondCandidate());
      model.qualityAssessments.push({
        ...baseline,
        candidateRef: "equipment-rich-domain-candidate",
        result: "pass",
        evidence:
          "The alternative was evaluated against the same atomic edit scenario",
      });
      delete model.singleCandidateJustification;
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("passed");
    expect(validation.diagnostics).toEqual([]);
  });

  it("does not require coverage for a should-priority scenario", async () => {
    const bundle = await copyFixture();
    await prepareS9(bundle);
    await mutateJson<{ qualityScenarios: QualityScenario[] }>(
      bundle,
      "system-characterization.json",
      (model) => {
        const baseline = model.qualityScenarios[0];
        if (baseline === undefined) return;
        model.qualityScenarios.push({
          ...baseline,
          id: "qs-filtered-search",
          priority: "should",
          stimulus: "A coordinator filters equipment by category",
          response: "Matching active equipment is returned",
          measure: "Results arrive within an ordinary interactive response",
        });
      },
    );

    expect((await validateBundle(bundle)).status).toBe("passed");
  });

  it("fails a missing candidate and must-scenario assessment", async () => {
    const bundle = await copyFixture();
    await prepareS9(bundle);
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      model.qualityAssessments = [];
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "STAGE_S9_MUST_ASSESSMENT_MISSING",
        classification: "deterministic",
        artifactPath: "architecture.json",
        jsonPointer: "/qualityAssessments",
        reference: "equipment-modular-candidate:qs-valid-edit",
        owningStage: "S9",
      }),
    );
  });

  it("fails a duplicate candidate and scenario assessment pair", async () => {
    const bundle = await copyFixture();
    await prepareS9(bundle);
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      const baseline = model.qualityAssessments[0];
      if (baseline !== undefined) {
        model.qualityAssessments.push({ ...baseline });
      }
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "STAGE_S9_ASSESSMENT_DUPLICATE",
        classification: "deterministic",
        artifactPath: "architecture.json",
        jsonPointer: "/qualityAssessments/1",
        reference: "equipment-modular-candidate:qs-valid-edit",
        owningStage: "S9",
      }),
    );
  });

  it.each(["risk", "fail", "unknown"] as const)(
    "reports a %s must result as assisted without blocking",
    async (result) => {
      const bundle = await copyFixture();
      await prepareS9(bundle);
      await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
        const assessment = model.qualityAssessments[0];
        if (assessment !== undefined) assessment.result = result;
      });

      const validation = await validateBundle(bundle);

      expect(validation.status).toBe("passed");
      expect(validation.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "STAGE_S9_MUST_SCENARIO_REVIEW",
          classification: "assisted",
          severity: "warning",
          reference: "equipment-modular-candidate:qs-valid-edit",
          owningStage: "S9",
        }),
      );
    },
  );

  it.each(["accepted", "rejected", "superseded"] as const)(
    "fails a %s decision before S10",
    async (status) => {
      const bundle = await copyFixture();
      await prepareS9(bundle);
      await mutateJson<DecisionLog>(
        bundle,
        "architecture-decision.json",
        (model) => {
          const decision = model.decisions[0];
          if (decision !== undefined) decision.status = status;
        },
      );

      const validation = await validateBundle(bundle);

      expect(validation.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "STAGE_S9_DECISION_STATUS_INVALID",
          jsonPointer: "/decisions/0/status",
          reference: "choose-equipment-module",
        }),
      );
    },
  );

  it("fails an option selected before S10", async () => {
    const bundle = await copyFixture();
    await prepareS9(bundle);
    await mutateJson<DecisionLog>(
      bundle,
      "architecture-decision.json",
      (model) => {
        const decision = model.decisions[0];
        if (decision !== undefined) {
          decision.selectedOptionRef = "equipment-module-option";
        }
      },
    );

    const validation = await validateBundle(bundle);

    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "STAGE_S9_OPTION_SELECTED_EARLY",
        jsonPointer: "/decisions/0/selectedOptionRef",
        reference: "equipment-module-option",
      }),
    );
  });

  it("retains the proposed-candidate requirement through S9", async () => {
    const bundle = await copyFixture();
    await prepareS9(bundle);
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      const candidate = model.candidates[0];
      if (candidate !== undefined) candidate.status = "selected";
    });

    const validation = await validateBundle(bundle);

    expect(validation.diagnostics.map(({ code }) => code)).toContain(
      "STAGE_S8_CANDIDATE_STATUS_INVALID",
    );
  });

  it("does not apply S9 coverage at completed stage S8", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S8");
    await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
      model.candidates.forEach((candidate) => {
        candidate.status = "proposed";
      });
      model.qualityAssessments = [];
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("passed");
    expect(validation.diagnostics).toEqual([]);
  });

  it.each([
    ["candidateRef", "candidate-missing"],
    ["scenarioRef", "scenario-missing"],
    ["tradeoffRefs", "option-missing"],
  ] as const)(
    "retains dangling %s diagnostics at S9",
    async (field, reference) => {
      const bundle = await copyFixture();
      await prepareS9(bundle);
      await mutateJson<Architecture>(bundle, "architecture.json", (model) => {
        const assessment = model.qualityAssessments[0];
        if (assessment === undefined) return;
        if (field === "tradeoffRefs") assessment.tradeoffRefs = [reference];
        else assessment[field] = reference;
      });

      const validation = await validateBundle(bundle);

      expect(validation.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "REFERENCE_DANGLING",
          reference,
        }),
      );
    },
  );
});
