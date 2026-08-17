import type {
  LifecycleProfile,
  Stage,
  ValidationClassification,
} from "./contracts.js";

export const artifactRoles = [
  "systemCharacterization",
  "designStrategy",
  "responsibility",
  "invariant",
  "architecture",
  "architectureDecision",
  "implementationHandoff",
] as const;

export type ArtifactRole = (typeof artifactRoles)[number];

export type ArtifactDescriptor = {
  path: string;
  schemaId: string;
};

export type BundleManifest = {
  $schema: string;
  manifestVersion: string;
  bundleId: string;
  lifecycle: {
    completedStage: Stage;
    profile: LifecycleProfile;
  };
  artifacts: Partial<Record<ArtifactRole, ArtifactDescriptor>>;
  verificationRecord?: {
    path: string;
    schemaId: string;
    sha256: string;
  };
};

type Rating = { evidenceRefs: string[] };

export type SystemCharacterization = {
  modelId: string;
  evidence: Array<{ id: string }>;
  unresolvedQuestions: Array<{ id: string }>;
  subsystems: Array<{
    id: string;
    evidenceRefs: string[];
    dimensions: Record<string, Rating>;
  }>;
  qualityScenarios: Array<{
    id: string;
    sourceEvidenceRefs: string[];
    priority: "must" | "should" | "could";
  }>;
  hardConstraints: Array<{
    id: string;
    evidenceRefs: string[];
    affectedSubsystemRefs: string[];
  }>;
};

export type DesignStrategy = {
  modelId: string;
  characterizationRef: string;
  selections: Array<{
    subsystemRef: string;
    rationale: { evidenceRefs: string[] };
    alternatives: Array<{ strategy: string }>;
  }>;
  compositionSeams: Array<{
    id: string;
    fromSubsystemRef: string;
    toSubsystemRef: string;
    evidenceRefs: string[];
  }>;
  shortPath: { eligible: boolean };
};

export type ResponsibilityModel = {
  modelId: string;
  characterizationRef: string;
  strategyRef: string;
  responsibilities: Array<{
    id: string;
    subsystemRef: string;
    evidenceRefs: string[];
    qualityScenarioRefs: string[];
    collaboratorRefs: string[];
    owner?: { logicalOwnerRef: string };
  }>;
  unresolvedConflicts: Array<{ id: string; responsibilityRefs: string[] }>;
};

export type InvariantModel = {
  modelId: string;
  characterizationRef: string;
  responsibilityRef: string;
  invariants: Array<{
    id: string;
    subsystemRef: string;
    evidenceRefs: string[];
    responsibilityRefs: string[];
    qualityScenarioRefs: string[];
    owner?: {
      logicalOwnerRef: string;
      enforcementResponsibilityRef: string;
    };
  }>;
  unresolvedConflicts: Array<{ id: string; invariantRefs: string[] }>;
};

export type ArchitectureModel = {
  modelId: string;
  systemRef: string;
  strategyRef: string;
  responsibilityModelRef: string;
  invariantModelRef: string;
  candidates: Array<{
    id: string;
    status: "proposed" | "selected" | "rejected";
    elementRefs: string[];
    boundaryRefs: string[];
    relationRefs: string[];
    interfaceRefs: string[];
  }>;
  singleCandidateJustification?: {
    kind: "short-path" | "forcing-constraint";
    evidenceRefs: string[];
    strategyAlternativeRefs: string[];
    hardConstraintRefs: string[];
  };
  elements: Array<{
    id: string;
    subsystemRef: string;
    parentRef?: string;
    representation: string;
    responsibilityRefs: string[];
    invariantRefs: string[];
    decisionRefs: string[];
  }>;
  boundaries: Array<{
    id: string;
    insideElementRefs: string[];
    ownerElementRef: string;
    decisionRefs: string[];
  }>;
  relations: Array<{
    id: string;
    fromRef: string;
    toRef: string;
    interfaceRef?: string;
    invariantRefs: string[];
    decisionRefs: string[];
  }>;
  interfaces: Array<{
    id: string;
    ownerElementRef: string;
    consumerElementRefs: string[];
    decisionRefs: string[];
  }>;
  qualityAssessments: Array<{
    candidateRef: string;
    scenarioRef: string;
    result: "pass" | "risk" | "fail" | "unknown";
    tradeoffRefs: string[];
  }>;
  constraints: Array<{
    id: string;
    decisionRef: string;
    statement: string;
    classification: ValidationClassification;
    scopeElementRefs: string[];
    invariantRefs: string[];
    observable?: {
      factSource: string;
      selector: string;
      predicate: string;
      expected: string;
    };
    enforcement: {
      adapterCapability: string;
      timing: string;
      severity: "error" | "warning" | "advisory";
      failureMessage: string;
    };
  }>;
};

export type ArchitectureDecisionModel = {
  logId: string;
  decisions: Array<{
    id: string;
    status: "proposed" | "accepted" | "rejected" | "superseded";
    evidenceRefs: string[];
    affectedElementRefs: string[];
    qualityScenarioRefs: string[];
    options: Array<{
      id: string;
      scenarioResults: Array<{ scenarioRef: string }>;
    }>;
    selectedOptionRef: string | null;
    supersedes: string[];
    constraintRefs: string[];
    authority: { decider: string; scope: string };
  }>;
};

export type ImplementationHandoffModel = {
  modelId: string;
  architectureRef: string;
  decisionLogRef: string;
  slices: Array<{
    id: string;
    outcome: string;
    status: "ready" | "blocked";
    elementRefs: string[];
    constraintRefs: string[];
    decisionRefs: string[];
    blockedByDecisionRefs: string[];
    dependsOnSliceRefs: string[];
    acceptanceChecks: Array<{
      check: string;
      expected: string;
    }>;
    migration: string;
    rollback: string;
  }>;
};

export type LoadedModels = {
  systemCharacterization?: SystemCharacterization;
  designStrategy?: DesignStrategy;
  responsibility?: ResponsibilityModel;
  invariant?: InvariantModel;
  architecture?: ArchitectureModel;
  architectureDecision?: ArchitectureDecisionModel;
  implementationHandoff?: ImplementationHandoffModel;
};

export type LoadedArtifact = {
  role: ArtifactRole;
  path: string;
  schemaId: string;
  data: unknown;
  source: Uint8Array;
};
