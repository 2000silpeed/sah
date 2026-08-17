import { afterEach, describe, expect, it } from "vitest";

import type { Stage } from "../src/contracts.js";
import { validateBundle } from "../src/index.js";
import { cleanupFixtures, copyFixture, mutateJson } from "./helpers.js";

afterEach(cleanupFixtures);

type Slice = {
  id: string;
  status: "ready" | "blocked";
  elementRefs: string[];
  constraintRefs: string[];
  decisionRefs: string[];
  blockedByDecisionRefs: string[];
  dependsOnSliceRefs: string[];
  acceptanceChecks: unknown[];
};

type Handoff = {
  architectureRef: string;
  decisionLogRef: string;
  slices: Slice[];
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

async function addProposedDecision(bundle: string): Promise<string> {
  const id = "choose-equipment-export-boundary";
  await mutateJson<{ decisions: Decision[] }>(
    bundle,
    "architecture-decision.json",
    (model) => {
      const source = model.decisions[0];
      if (source === undefined) return;
      const proposed = structuredClone(source);
      proposed.id = id;
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
  return id;
}

function diagnosticCodes(
  validation: Awaited<ReturnType<typeof validateBundle>>,
) {
  return validation.diagnostics.map(({ code }) => code);
}

describe("S12 implementation handoff", () => {
  it("passes the canonical simple-crud handoff at S12", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S12");

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("passed");
    expect(validation.bundle?.completedStage).toBe("S12");
    expect(validation.diagnostics).toEqual([]);
  });

  it("requires the handoff artifact at S12", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S12");
    await mutateJson<{
      artifacts: { implementationHandoff?: unknown };
    }>(bundle, "sah.bundle.json", (manifest) => {
      delete manifest.artifacts.implementationHandoff;
    });

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "STAGE_ARTIFACT_REQUIRED",
        jsonPointer: "/artifacts/implementationHandoff",
        owningStage: "S12",
      }),
    );
  });

  it("retains a precise pointer for an invalid handoff shape", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S12");
    await mutateJson<Handoff>(
      bundle,
      "implementation-handoff.json",
      (handoff) => {
        const slice = handoff.slices[0];
        if (slice !== undefined) slice.acceptanceChecks = [];
      },
    );

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SCHEMA_MINITEMS",
        artifactPath: "implementation-handoff.json",
        jsonPointer: "/slices/0/acceptanceChecks",
      }),
    );
  });

  it("checks both handoff root model references", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S12");
    await mutateJson<Handoff>(
      bundle,
      "implementation-handoff.json",
      (handoff) => {
        handoff.architectureRef = "equipment-register-decisions";
        handoff.decisionLogRef = "equipment-register-architecture";
      },
    );

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("violations");
    expect(validation.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ROOT_MODEL_REFERENCE_MISMATCH",
          jsonPointer: "/architectureRef",
        }),
        expect.objectContaining({
          code: "ROOT_MODEL_REFERENCE_MISMATCH",
          jsonPointer: "/decisionLogRef",
        }),
      ]),
    );
  });

  it.each([
    ["elementRefs", "missing-element"],
    ["constraintRefs", "missing-constraint"],
    ["decisionRefs", "missing-decision"],
    ["blockedByDecisionRefs", "missing-blocker"],
    ["dependsOnSliceRefs", "missing-slice"],
  ] as const)(
    "fails a dangling %s handoff reference",
    async (field, missing) => {
      const bundle = await copyFixture();
      await setStage(bundle, "S12");
      await mutateJson<Handoff>(
        bundle,
        "implementation-handoff.json",
        (handoff) => {
          const slice = handoff.slices[0];
          if (slice !== undefined) slice[field] = [missing];
        },
      );

      const validation = await validateBundle(bundle);

      expect(validation.status).toBe("violations");
      expect(validation.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "REFERENCE_DANGLING",
          jsonPointer: `/slices/0/${field}/0`,
          reference: missing,
        }),
      );
    },
  );

  it("requires every selected element to be covered", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S12");
    await mutateJson<{
      candidates: Array<{ elementRefs: string[] }>;
      elements: Array<{ id: string }>;
    }>(bundle, "architecture.json", (architecture) => {
      const element = architecture.elements[0];
      const candidate = architecture.candidates[0];
      if (element === undefined || candidate === undefined) return;
      architecture.elements.push({
        ...structuredClone(element),
        id: "equipment-export",
      });
      candidate.elementRefs.push("equipment-export");
    });

    const validation = await validateBundle(bundle);

    expect(diagnosticCodes(validation)).toContain(
      "STAGE_S12_SELECTED_ELEMENT_NOT_COVERED",
    );
  });

  it("rejects a slice element outside the selected candidate", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S12");
    await mutateJson<{ elements: Array<{ id: string }> }>(
      bundle,
      "architecture.json",
      (architecture) => {
        const element = architecture.elements[0];
        if (element !== undefined) {
          architecture.elements.push({
            ...structuredClone(element),
            id: "equipment-export",
          });
        }
      },
    );
    await mutateJson<Handoff>(
      bundle,
      "implementation-handoff.json",
      (handoff) => {
        const slice = handoff.slices[0];
        if (slice !== undefined) slice.elementRefs = ["equipment-export"];
      },
    );

    const validation = await validateBundle(bundle);

    expect(diagnosticCodes(validation)).toContain(
      "STAGE_S12_ELEMENT_NOT_SELECTED",
    );
  });

  it("requires every applicable constraint to be assigned", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S12");
    await mutateJson<Handoff>(
      bundle,
      "implementation-handoff.json",
      (handoff) => {
        const slice = handoff.slices[0];
        if (slice !== undefined) slice.constraintRefs = [];
      },
    );

    const validation = await validateBundle(bundle);

    expect(diagnosticCodes(validation)).toContain(
      "STAGE_S12_CONSTRAINT_NOT_COVERED",
    );
  });

  it("rejects a constraint assigned outside its element scope", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S12");
    await mutateJson<{
      candidates: Array<{ elementRefs: string[] }>;
      elements: Array<{ id: string }>;
    }>(bundle, "architecture.json", (architecture) => {
      const element = architecture.elements[0];
      const candidate = architecture.candidates[0];
      if (element === undefined || candidate === undefined) return;
      architecture.elements.push({
        ...structuredClone(element),
        id: "equipment-export",
      });
      candidate.elementRefs.push("equipment-export");
    });
    await mutateJson<Handoff>(
      bundle,
      "implementation-handoff.json",
      (handoff) => {
        const slice = handoff.slices[0];
        if (slice !== undefined) slice.elementRefs = ["equipment-export"];
      },
    );

    const validation = await validateBundle(bundle);

    expect(diagnosticCodes(validation)).toContain(
      "STAGE_S12_CONSTRAINT_SCOPE_MISMATCH",
    );
  });

  it("requires an affecting accepted decision in each slice", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S12");
    await mutateJson<Handoff>(
      bundle,
      "implementation-handoff.json",
      (handoff) => {
        const slice = handoff.slices[0];
        if (slice !== undefined) slice.decisionRefs = [];
      },
    );

    const validation = await validateBundle(bundle);

    expect(diagnosticCodes(validation)).toContain(
      "STAGE_S12_ACCEPTED_DECISION_MISSING",
    );
  });

  it("rejects a non-accepted decision as implemented context", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S12");
    const proposedId = await addProposedDecision(bundle);
    await mutateJson<Handoff>(
      bundle,
      "implementation-handoff.json",
      (handoff) => {
        handoff.slices[0]?.decisionRefs.push(proposedId);
      },
    );

    const validation = await validateBundle(bundle);

    expect(diagnosticCodes(validation)).toContain(
      "STAGE_S12_DECISION_NOT_ACCEPTED",
    );
  });

  it("requires an affecting proposed decision to block the slice", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S12");
    await addProposedDecision(bundle);

    const validation = await validateBundle(bundle);

    expect(diagnosticCodes(validation)).toContain(
      "STAGE_S12_PROPOSED_BLOCKER_MISSING",
    );
    expect(diagnosticCodes(validation)).not.toContain(
      "STAGE_S10_PROPOSED_DECISION_REVIEW",
    );
  });

  it("accepts a blocked slice with complete proposed-decision coverage", async () => {
    const bundle = await copyFixture();
    await setStage(bundle, "S12");
    const proposedId = await addProposedDecision(bundle);
    await mutateJson<Handoff>(
      bundle,
      "implementation-handoff.json",
      (handoff) => {
        const slice = handoff.slices[0];
        if (slice === undefined) return;
        slice.status = "blocked";
        slice.blockedByDecisionRefs = [proposedId];
      },
    );

    const validation = await validateBundle(bundle);

    expect(validation.status).toBe("passed");
    expect(validation.diagnostics).toEqual([]);
  });

  it("rejects ready/blocker and blocked/no-blocker contradictions", async () => {
    const readyBundle = await copyFixture();
    await setStage(readyBundle, "S12");
    await mutateJson<Handoff>(
      readyBundle,
      "implementation-handoff.json",
      (handoff) => {
        handoff.slices[0]?.blockedByDecisionRefs.push(
          "choose-equipment-module",
        );
      },
    );

    const readyValidation = await validateBundle(readyBundle);
    expect(diagnosticCodes(readyValidation)).toEqual(
      expect.arrayContaining([
        "STAGE_S12_BLOCKER_NOT_PROPOSED",
        "STAGE_S12_READY_HAS_BLOCKERS",
      ]),
    );

    const blockedBundle = await copyFixture();
    await setStage(blockedBundle, "S12");
    await mutateJson<Handoff>(
      blockedBundle,
      "implementation-handoff.json",
      (handoff) => {
        const slice = handoff.slices[0];
        if (slice !== undefined) slice.status = "blocked";
      },
    );

    const blockedValidation = await validateBundle(blockedBundle);
    expect(diagnosticCodes(blockedValidation)).toContain(
      "STAGE_S12_BLOCKED_WITHOUT_BLOCKER",
    );
  });

  it("rejects self-dependencies and multi-slice dependency cycles", async () => {
    const selfBundle = await copyFixture();
    await setStage(selfBundle, "S12");
    await mutateJson<Handoff>(
      selfBundle,
      "implementation-handoff.json",
      (handoff) => {
        const slice = handoff.slices[0];
        if (slice !== undefined) slice.dependsOnSliceRefs = [slice.id];
      },
    );
    expect(diagnosticCodes(await validateBundle(selfBundle))).toContain(
      "STAGE_S12_DEPENDENCY_SELF_REFERENCE",
    );

    const cycleBundle = await copyFixture();
    await setStage(cycleBundle, "S12");
    await mutateJson<Handoff>(
      cycleBundle,
      "implementation-handoff.json",
      (handoff) => {
        const first = handoff.slices[0];
        if (first === undefined) return;
        const second = structuredClone(first);
        second.id = "verify-equipment-operations";
        first.dependsOnSliceRefs = [second.id];
        second.dependsOnSliceRefs = [first.id];
        handoff.slices.push(second);
      },
    );

    const cycleValidation = await validateBundle(cycleBundle);
    expect(
      diagnosticCodes(cycleValidation).filter(
        (code) => code === "STAGE_S12_DEPENDENCY_CYCLE",
      ),
    ).toHaveLength(2);
  });
});
