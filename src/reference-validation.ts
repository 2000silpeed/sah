import type { SahDiagnostic, Stage } from "./contracts.js";
import type { ArtifactRole, LoadedModels } from "./internal-model.js";

type ArtifactPaths = Partial<Record<ArtifactRole, string>>;

type IdOccurrence = {
  id: string;
  role: ArtifactRole;
  pointer: string;
};

function issue(
  paths: ArtifactPaths,
  role: ArtifactRole,
  pointer: string,
  reference: string,
  message: string,
  expected: string,
  owningStage: Stage,
  code = "REFERENCE_DANGLING",
): SahDiagnostic {
  return {
    code,
    category: "validation",
    capability: "Unique IDs and valid cross-IR references",
    classification: "deterministic",
    severity: "error",
    ...(paths[role] === undefined ? {} : { artifactPath: paths[role] }),
    jsonPointer: pointer,
    reference,
    message,
    expected,
    repair: `Repair the reference or create its target in ${owningStage}.`,
    owningStage,
  };
}

function checkReferences(
  diagnostics: SahDiagnostic[],
  paths: ArtifactPaths,
  role: ArtifactRole,
  pointer: string,
  references: string[],
  targets: ReadonlySet<string>,
  targetName: string,
  owningStage: Stage,
): void {
  references.forEach((reference, index) => {
    if (!targets.has(reference)) {
      diagnostics.push(
        issue(
          paths,
          role,
          `${pointer}/${index}`,
          reference,
          `Reference ${reference} does not resolve to ${targetName}.`,
          `an existing ${targetName} ID`,
          owningStage,
        ),
      );
    }
  });
}

function checkReference(
  diagnostics: SahDiagnostic[],
  paths: ArtifactPaths,
  role: ArtifactRole,
  pointer: string,
  reference: string,
  targets: ReadonlySet<string>,
  targetName: string,
  owningStage: Stage,
): void {
  if (targets.has(reference)) return;
  diagnostics.push(
    issue(
      paths,
      role,
      pointer,
      reference,
      `Reference ${reference} does not resolve to ${targetName}.`,
      `an existing ${targetName} ID`,
      owningStage,
    ),
  );
}

function collectIds(models: LoadedModels): IdOccurrence[] {
  const ids: IdOccurrence[] = [];
  const add = (role: ArtifactRole, id: string, pointer: string): void => {
    ids.push({ id, role, pointer });
  };

  const system = models.systemCharacterization;
  if (system !== undefined) {
    add("systemCharacterization", system.modelId, "/modelId");
    system.evidence.forEach(({ id }, index) =>
      add("systemCharacterization", id, `/evidence/${index}/id`),
    );
    system.unresolvedQuestions.forEach(({ id }, index) =>
      add("systemCharacterization", id, `/unresolvedQuestions/${index}/id`),
    );
    system.subsystems.forEach(({ id }, index) =>
      add("systemCharacterization", id, `/subsystems/${index}/id`),
    );
    system.qualityScenarios.forEach(({ id }, index) =>
      add("systemCharacterization", id, `/qualityScenarios/${index}/id`),
    );
    system.hardConstraints.forEach(({ id }, index) =>
      add("systemCharacterization", id, `/hardConstraints/${index}/id`),
    );
  }

  const strategy = models.designStrategy;
  if (strategy !== undefined) {
    add("designStrategy", strategy.modelId, "/modelId");
    strategy.compositionSeams.forEach(({ id }, index) =>
      add("designStrategy", id, `/compositionSeams/${index}/id`),
    );
  }

  const responsibilities = models.responsibility;
  if (responsibilities !== undefined) {
    add("responsibility", responsibilities.modelId, "/modelId");
    responsibilities.responsibilities.forEach(({ id }, index) =>
      add("responsibility", id, `/responsibilities/${index}/id`),
    );
    responsibilities.unresolvedConflicts.forEach(({ id }, index) =>
      add("responsibility", id, `/unresolvedConflicts/${index}/id`),
    );
  }

  const invariants = models.invariant;
  if (invariants !== undefined) {
    add("invariant", invariants.modelId, "/modelId");
    invariants.invariants.forEach(({ id }, index) =>
      add("invariant", id, `/invariants/${index}/id`),
    );
    invariants.unresolvedConflicts.forEach(({ id }, index) =>
      add("invariant", id, `/unresolvedConflicts/${index}/id`),
    );
  }

  const architecture = models.architecture;
  if (architecture !== undefined) {
    add("architecture", architecture.modelId, "/modelId");
    architecture.candidates.forEach(({ id }, index) =>
      add("architecture", id, `/candidates/${index}/id`),
    );
    architecture.elements.forEach(({ id }, index) =>
      add("architecture", id, `/elements/${index}/id`),
    );
    architecture.boundaries.forEach(({ id }, index) =>
      add("architecture", id, `/boundaries/${index}/id`),
    );
    architecture.relations.forEach(({ id }, index) =>
      add("architecture", id, `/relations/${index}/id`),
    );
    architecture.interfaces.forEach(({ id }, index) =>
      add("architecture", id, `/interfaces/${index}/id`),
    );
    architecture.constraints.forEach(({ id }, index) =>
      add("architecture", id, `/constraints/${index}/id`),
    );
  }

  const decisions = models.architectureDecision;
  if (decisions !== undefined) {
    add("architectureDecision", decisions.logId, "/logId");
    decisions.decisions.forEach((decision, decisionIndex) => {
      add(
        "architectureDecision",
        decision.id,
        `/decisions/${decisionIndex}/id`,
      );
      decision.options.forEach(({ id }, optionIndex) =>
        add(
          "architectureDecision",
          id,
          `/decisions/${decisionIndex}/options/${optionIndex}/id`,
        ),
      );
    });
  }
  return ids;
}

function checkRootReference(
  diagnostics: SahDiagnostic[],
  paths: ArtifactPaths,
  role: ArtifactRole,
  pointer: string,
  actual: string,
  expected: string,
  owningStage: Stage,
): void {
  if (actual === expected) return;
  diagnostics.push(
    issue(
      paths,
      role,
      pointer,
      actual,
      `Root model reference ${actual} does not identify the declared artifact ${expected}.`,
      expected,
      owningStage,
      "ROOT_MODEL_REFERENCE_MISMATCH",
    ),
  );
}

export function validateReferences(
  models: LoadedModels,
  paths: ArtifactPaths,
): SahDiagnostic[] {
  const diagnostics: SahDiagnostic[] = [];
  const system = models.systemCharacterization;
  const strategy = models.designStrategy;
  const responsibilities = models.responsibility;
  const invariants = models.invariant;
  const architecture = models.architecture;
  const decisionLog = models.architectureDecision;

  const occurrences = collectIds(models);
  const firstById = new Map<string, IdOccurrence>();
  for (const occurrence of occurrences) {
    const first = firstById.get(occurrence.id);
    if (first === undefined) {
      firstById.set(occurrence.id, occurrence);
      continue;
    }
    diagnostics.push({
      code: "ID_DUPLICATE",
      category: "validation",
      capability: "Unique IDs and valid cross-IR references",
      classification: "deterministic",
      severity: "error",
      ...(paths[occurrence.role] === undefined
        ? {}
        : { artifactPath: paths[occurrence.role] }),
      jsonPointer: occurrence.pointer,
      reference: occurrence.id,
      message: `ID ${occurrence.id} duplicates ${paths[first.role] ?? first.role}${first.pointer}.`,
      expected: "an ID unique across the design bundle",
      repair:
        "Rename one ID and update every reference to it in its owning stage.",
    });
  }

  const evidenceIds = new Set(system?.evidence.map(({ id }) => id) ?? []);
  const hardConstraintIds = new Set(
    system?.hardConstraints.map(({ id }) => id) ?? [],
  );
  const subsystemIds = new Set(system?.subsystems.map(({ id }) => id) ?? []);
  const scenarioIds = new Set(
    system?.qualityScenarios.map(({ id }) => id) ?? [],
  );
  const responsibilityIds = new Set(
    responsibilities?.responsibilities.map(({ id }) => id) ?? [],
  );
  const invariantIds = new Set(
    invariants?.invariants.map(({ id }) => id) ?? [],
  );
  const elementIds = new Set(architecture?.elements.map(({ id }) => id) ?? []);
  const boundaryIds = new Set(
    architecture?.boundaries.map(({ id }) => id) ?? [],
  );
  const relationIds = new Set(
    architecture?.relations.map(({ id }) => id) ?? [],
  );
  const interfaceIds = new Set(
    architecture?.interfaces.map(({ id }) => id) ?? [],
  );
  const decisionIds = new Set(decisionLog?.decisions.map(({ id }) => id) ?? []);
  const optionIds = new Set(
    decisionLog?.decisions.flatMap(({ options }) =>
      options.map(({ id }) => id),
    ) ?? [],
  );
  const constraintIds = new Set(
    architecture?.constraints.map(({ id }) => id) ?? [],
  );
  const candidateIds = new Set(
    architecture?.candidates.map(({ id }) => id) ?? [],
  );
  const strategyAlternativeIds = new Set(
    strategy?.selections.flatMap(({ alternatives }) =>
      alternatives.map(({ strategy: alternative }) => alternative),
    ) ?? [],
  );

  if (system !== undefined) {
    system.subsystems.forEach((subsystem, subsystemIndex) => {
      checkReferences(
        diagnostics,
        paths,
        "systemCharacterization",
        `/subsystems/${subsystemIndex}/evidenceRefs`,
        subsystem.evidenceRefs,
        evidenceIds,
        "evidence",
        "S1",
      );
      for (const [dimension, rating] of Object.entries(subsystem.dimensions)) {
        checkReferences(
          diagnostics,
          paths,
          "systemCharacterization",
          `/subsystems/${subsystemIndex}/dimensions/${dimension}/evidenceRefs`,
          rating.evidenceRefs,
          evidenceIds,
          "evidence",
          "S1",
        );
      }
    });
    system.qualityScenarios.forEach((scenario, index) =>
      checkReferences(
        diagnostics,
        paths,
        "systemCharacterization",
        `/qualityScenarios/${index}/sourceEvidenceRefs`,
        scenario.sourceEvidenceRefs,
        evidenceIds,
        "evidence",
        "S1",
      ),
    );
    system.hardConstraints.forEach((constraint, index) => {
      checkReferences(
        diagnostics,
        paths,
        "systemCharacterization",
        `/hardConstraints/${index}/evidenceRefs`,
        constraint.evidenceRefs,
        evidenceIds,
        "evidence",
        "S1",
      );
      checkReferences(
        diagnostics,
        paths,
        "systemCharacterization",
        `/hardConstraints/${index}/affectedSubsystemRefs`,
        constraint.affectedSubsystemRefs,
        subsystemIds,
        "subsystem",
        "S1",
      );
    });
  }

  if (strategy !== undefined && system !== undefined) {
    checkRootReference(
      diagnostics,
      paths,
      "designStrategy",
      "/characterizationRef",
      strategy.characterizationRef,
      system.modelId,
      "S2",
    );
    strategy.selections.forEach((selection, index) => {
      checkReference(
        diagnostics,
        paths,
        "designStrategy",
        `/selections/${index}/subsystemRef`,
        selection.subsystemRef,
        subsystemIds,
        "subsystem",
        "S2",
      );
      checkReferences(
        diagnostics,
        paths,
        "designStrategy",
        `/selections/${index}/rationale/evidenceRefs`,
        selection.rationale.evidenceRefs,
        evidenceIds,
        "evidence",
        "S2",
      );
    });
    strategy.compositionSeams.forEach((seam, index) => {
      checkReference(
        diagnostics,
        paths,
        "designStrategy",
        `/compositionSeams/${index}/fromSubsystemRef`,
        seam.fromSubsystemRef,
        subsystemIds,
        "subsystem",
        "S2",
      );
      checkReference(
        diagnostics,
        paths,
        "designStrategy",
        `/compositionSeams/${index}/toSubsystemRef`,
        seam.toSubsystemRef,
        subsystemIds,
        "subsystem",
        "S2",
      );
      checkReferences(
        diagnostics,
        paths,
        "designStrategy",
        `/compositionSeams/${index}/evidenceRefs`,
        seam.evidenceRefs,
        evidenceIds,
        "evidence",
        "S2",
      );
    });
  }

  if (responsibilities !== undefined) {
    if (system !== undefined) {
      checkRootReference(
        diagnostics,
        paths,
        "responsibility",
        "/characterizationRef",
        responsibilities.characterizationRef,
        system.modelId,
        "S3",
      );
    }
    if (strategy !== undefined) {
      checkRootReference(
        diagnostics,
        paths,
        "responsibility",
        "/strategyRef",
        responsibilities.strategyRef,
        strategy.modelId,
        "S3",
      );
    }
    responsibilities.responsibilities.forEach((responsibility, index) => {
      checkReference(
        diagnostics,
        paths,
        "responsibility",
        `/responsibilities/${index}/subsystemRef`,
        responsibility.subsystemRef,
        subsystemIds,
        "subsystem",
        "S3",
      );
      checkReferences(
        diagnostics,
        paths,
        "responsibility",
        `/responsibilities/${index}/evidenceRefs`,
        responsibility.evidenceRefs,
        evidenceIds,
        "evidence",
        "S3",
      );
      checkReferences(
        diagnostics,
        paths,
        "responsibility",
        `/responsibilities/${index}/qualityScenarioRefs`,
        responsibility.qualityScenarioRefs,
        scenarioIds,
        "quality scenario",
        "S3",
      );
      checkReferences(
        diagnostics,
        paths,
        "responsibility",
        `/responsibilities/${index}/collaboratorRefs`,
        responsibility.collaboratorRefs,
        responsibilityIds,
        "responsibility",
        "S5",
      );
    });
    responsibilities.unresolvedConflicts.forEach((conflict, index) =>
      checkReferences(
        diagnostics,
        paths,
        "responsibility",
        `/unresolvedConflicts/${index}/responsibilityRefs`,
        conflict.responsibilityRefs,
        responsibilityIds,
        "responsibility",
        "S5",
      ),
    );
  }

  if (invariants !== undefined) {
    if (system !== undefined) {
      checkRootReference(
        diagnostics,
        paths,
        "invariant",
        "/characterizationRef",
        invariants.characterizationRef,
        system.modelId,
        "S4",
      );
    }
    if (responsibilities !== undefined) {
      checkRootReference(
        diagnostics,
        paths,
        "invariant",
        "/responsibilityRef",
        invariants.responsibilityRef,
        responsibilities.modelId,
        "S4",
      );
    }
    invariants.invariants.forEach((invariant, index) => {
      checkReference(
        diagnostics,
        paths,
        "invariant",
        `/invariants/${index}/subsystemRef`,
        invariant.subsystemRef,
        subsystemIds,
        "subsystem",
        "S4",
      );
      checkReferences(
        diagnostics,
        paths,
        "invariant",
        `/invariants/${index}/evidenceRefs`,
        invariant.evidenceRefs,
        evidenceIds,
        "evidence",
        "S4",
      );
      checkReferences(
        diagnostics,
        paths,
        "invariant",
        `/invariants/${index}/responsibilityRefs`,
        invariant.responsibilityRefs,
        responsibilityIds,
        "responsibility",
        "S4",
      );
      checkReferences(
        diagnostics,
        paths,
        "invariant",
        `/invariants/${index}/qualityScenarioRefs`,
        invariant.qualityScenarioRefs,
        scenarioIds,
        "quality scenario",
        "S4",
      );
      if (invariant.owner !== undefined) {
        checkReference(
          diagnostics,
          paths,
          "invariant",
          `/invariants/${index}/owner/enforcementResponsibilityRef`,
          invariant.owner.enforcementResponsibilityRef,
          responsibilityIds,
          "responsibility",
          "S5",
        );
      }
    });
    invariants.unresolvedConflicts.forEach((conflict, index) =>
      checkReferences(
        diagnostics,
        paths,
        "invariant",
        `/unresolvedConflicts/${index}/invariantRefs`,
        conflict.invariantRefs,
        invariantIds,
        "invariant",
        "S5",
      ),
    );
  }

  if (architecture !== undefined) {
    if (system !== undefined) {
      checkRootReference(
        diagnostics,
        paths,
        "architecture",
        "/systemRef",
        architecture.systemRef,
        system.modelId,
        "S6",
      );
    }
    if (strategy !== undefined) {
      checkRootReference(
        diagnostics,
        paths,
        "architecture",
        "/strategyRef",
        architecture.strategyRef,
        strategy.modelId,
        "S6",
      );
    }
    if (responsibilities !== undefined) {
      checkRootReference(
        diagnostics,
        paths,
        "architecture",
        "/responsibilityModelRef",
        architecture.responsibilityModelRef,
        responsibilities.modelId,
        "S6",
      );
    }
    if (invariants !== undefined) {
      checkRootReference(
        diagnostics,
        paths,
        "architecture",
        "/invariantModelRef",
        architecture.invariantModelRef,
        invariants.modelId,
        "S6",
      );
    }

    architecture.candidates.forEach((candidate, index) => {
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/candidates/${index}/elementRefs`,
        candidate.elementRefs,
        elementIds,
        "architecture element",
        "S8",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/candidates/${index}/boundaryRefs`,
        candidate.boundaryRefs,
        boundaryIds,
        "architecture boundary",
        "S8",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/candidates/${index}/relationRefs`,
        candidate.relationRefs,
        relationIds,
        "architecture relation",
        "S8",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/candidates/${index}/interfaceRefs`,
        candidate.interfaceRefs,
        interfaceIds,
        "architecture interface",
        "S8",
      );
    });

    const justification = architecture.singleCandidateJustification;
    if (justification !== undefined) {
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        "/singleCandidateJustification/evidenceRefs",
        justification.evidenceRefs,
        evidenceIds,
        "evidence",
        "S8",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        "/singleCandidateJustification/strategyAlternativeRefs",
        justification.strategyAlternativeRefs,
        strategyAlternativeIds,
        "S2 strategy alternative",
        "S8",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        "/singleCandidateJustification/hardConstraintRefs",
        justification.hardConstraintRefs,
        hardConstraintIds,
        "hard constraint",
        "S8",
      );
    }

    architecture.elements.forEach((element, index) => {
      checkReference(
        diagnostics,
        paths,
        "architecture",
        `/elements/${index}/subsystemRef`,
        element.subsystemRef,
        subsystemIds,
        "subsystem",
        "S6",
      );
      if (element.parentRef !== undefined) {
        checkReference(
          diagnostics,
          paths,
          "architecture",
          `/elements/${index}/parentRef`,
          element.parentRef,
          elementIds,
          "architecture element",
          "S6",
        );
      }
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/elements/${index}/responsibilityRefs`,
        element.responsibilityRefs,
        responsibilityIds,
        "responsibility",
        "S6",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/elements/${index}/invariantRefs`,
        element.invariantRefs,
        invariantIds,
        "invariant",
        "S6",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/elements/${index}/decisionRefs`,
        element.decisionRefs,
        decisionIds,
        "decision",
        "S10",
      );
    });

    architecture.boundaries.forEach((boundary, index) => {
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/boundaries/${index}/insideElementRefs`,
        boundary.insideElementRefs,
        elementIds,
        "architecture element",
        "S6",
      );
      checkReference(
        diagnostics,
        paths,
        "architecture",
        `/boundaries/${index}/ownerElementRef`,
        boundary.ownerElementRef,
        elementIds,
        "architecture element",
        "S6",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/boundaries/${index}/decisionRefs`,
        boundary.decisionRefs,
        decisionIds,
        "decision",
        "S10",
      );
    });

    architecture.relations.forEach((relation, index) => {
      checkReference(
        diagnostics,
        paths,
        "architecture",
        `/relations/${index}/fromRef`,
        relation.fromRef,
        elementIds,
        "architecture element",
        "S6",
      );
      checkReference(
        diagnostics,
        paths,
        "architecture",
        `/relations/${index}/toRef`,
        relation.toRef,
        elementIds,
        "architecture element",
        "S6",
      );
      if (relation.interfaceRef !== undefined) {
        checkReference(
          diagnostics,
          paths,
          "architecture",
          `/relations/${index}/interfaceRef`,
          relation.interfaceRef,
          interfaceIds,
          "interface",
          "S6",
        );
      }
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/relations/${index}/invariantRefs`,
        relation.invariantRefs,
        invariantIds,
        "invariant",
        "S6",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/relations/${index}/decisionRefs`,
        relation.decisionRefs,
        decisionIds,
        "decision",
        "S10",
      );
    });

    architecture.interfaces.forEach((contract, index) => {
      checkReference(
        diagnostics,
        paths,
        "architecture",
        `/interfaces/${index}/ownerElementRef`,
        contract.ownerElementRef,
        elementIds,
        "architecture element",
        "S6",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/interfaces/${index}/consumerElementRefs`,
        contract.consumerElementRefs,
        elementIds,
        "architecture element",
        "S6",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/interfaces/${index}/decisionRefs`,
        contract.decisionRefs,
        decisionIds,
        "decision",
        "S10",
      );
    });

    architecture.qualityAssessments.forEach((assessment, index) => {
      checkReference(
        diagnostics,
        paths,
        "architecture",
        `/qualityAssessments/${index}/candidateRef`,
        assessment.candidateRef,
        candidateIds,
        "architecture candidate",
        "S9",
      );
      checkReference(
        diagnostics,
        paths,
        "architecture",
        `/qualityAssessments/${index}/scenarioRef`,
        assessment.scenarioRef,
        scenarioIds,
        "quality scenario",
        "S9",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/qualityAssessments/${index}/tradeoffRefs`,
        assessment.tradeoffRefs,
        optionIds,
        "decision option",
        "S9",
      );
    });

    architecture.constraints.forEach((constraint, index) => {
      checkReference(
        diagnostics,
        paths,
        "architecture",
        `/constraints/${index}/decisionRef`,
        constraint.decisionRef,
        decisionIds,
        "decision",
        "S11",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/constraints/${index}/scopeElementRefs`,
        constraint.scopeElementRefs,
        elementIds,
        "architecture element",
        "S11",
      );
      checkReferences(
        diagnostics,
        paths,
        "architecture",
        `/constraints/${index}/invariantRefs`,
        constraint.invariantRefs,
        invariantIds,
        "invariant",
        "S11",
      );
    });
  }

  if (decisionLog !== undefined) {
    decisionLog.decisions.forEach((decision, decisionIndex) => {
      checkReferences(
        diagnostics,
        paths,
        "architectureDecision",
        `/decisions/${decisionIndex}/evidenceRefs`,
        decision.evidenceRefs,
        evidenceIds,
        "evidence",
        "S9",
      );
      checkReferences(
        diagnostics,
        paths,
        "architectureDecision",
        `/decisions/${decisionIndex}/affectedElementRefs`,
        decision.affectedElementRefs,
        elementIds,
        "architecture element",
        "S9",
      );
      checkReferences(
        diagnostics,
        paths,
        "architectureDecision",
        `/decisions/${decisionIndex}/qualityScenarioRefs`,
        decision.qualityScenarioRefs,
        scenarioIds,
        "quality scenario",
        "S9",
      );
      decision.options.forEach((option, optionIndex) =>
        option.scenarioResults.forEach((scenarioResult, resultIndex) =>
          checkReference(
            diagnostics,
            paths,
            "architectureDecision",
            `/decisions/${decisionIndex}/options/${optionIndex}/scenarioResults/${resultIndex}/scenarioRef`,
            scenarioResult.scenarioRef,
            scenarioIds,
            "quality scenario",
            "S9",
          ),
        ),
      );
      if (
        decision.selectedOptionRef !== null &&
        !decision.options.some(({ id }) => id === decision.selectedOptionRef)
      ) {
        diagnostics.push(
          issue(
            paths,
            "architectureDecision",
            `/decisions/${decisionIndex}/selectedOptionRef`,
            decision.selectedOptionRef,
            `Selected option ${decision.selectedOptionRef} does not belong to decision ${decision.id}.`,
            "the ID of an option nested in this decision",
            "S10",
            "REFERENCE_OPTION_NOT_IN_DECISION",
          ),
        );
      }
      checkReferences(
        diagnostics,
        paths,
        "architectureDecision",
        `/decisions/${decisionIndex}/supersedes`,
        decision.supersedes,
        decisionIds,
        "decision",
        "S10",
      );
      checkReferences(
        diagnostics,
        paths,
        "architectureDecision",
        `/decisions/${decisionIndex}/constraintRefs`,
        decision.constraintRefs,
        constraintIds,
        "constraint",
        "S11",
      );
    });
  }

  if (architecture !== undefined && decisionLog !== undefined) {
    const decisionsById = new Map(
      decisionLog.decisions.map((decision) => [decision.id, decision]),
    );
    const constraintsById = new Map(
      architecture.constraints.map((constraint) => [constraint.id, constraint]),
    );
    architecture.constraints.forEach((constraint, constraintIndex) => {
      const decision = decisionsById.get(constraint.decisionRef);
      if (
        decision !== undefined &&
        !decision.constraintRefs.includes(constraint.id)
      ) {
        diagnostics.push(
          issue(
            paths,
            "architecture",
            `/constraints/${constraintIndex}/decisionRef`,
            constraint.decisionRef,
            `Constraint ${constraint.id} points to decision ${decision.id}, but the decision has no backlink.`,
            `decision ${decision.id}.constraintRefs to include ${constraint.id}`,
            "S11",
            "DECISION_CONSTRAINT_BACKLINK_MISSING",
          ),
        );
      }
    });
    decisionLog.decisions.forEach((decision, decisionIndex) => {
      decision.constraintRefs.forEach((constraintRef, constraintIndex) => {
        const constraint = constraintsById.get(constraintRef);
        if (
          constraint !== undefined &&
          constraint.decisionRef !== decision.id
        ) {
          diagnostics.push(
            issue(
              paths,
              "architectureDecision",
              `/decisions/${decisionIndex}/constraintRefs/${constraintIndex}`,
              constraintRef,
              `Decision ${decision.id} links constraint ${constraintRef}, which points to ${constraint.decisionRef}.`,
              `constraint ${constraintRef}.decisionRef to equal ${decision.id}`,
              "S11",
              "DECISION_CONSTRAINT_BACKLINK_MISMATCH",
            ),
          );
        }
      });
    });
  }

  return diagnostics;
}
