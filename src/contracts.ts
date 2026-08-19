export const stages = [
  "S0",
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
  "S8",
  "S9",
  "S10",
  "S11",
  "S12",
  "S13",
] as const;

export type Stage = (typeof stages)[number];
export type LifecycleProfile = "full" | "short";
export type ValidationClassification =
  "deterministic" | "assisted" | "judgment";
export type DiagnosticCategory = "validation" | "operational";
export type DiagnosticSeverity = "error" | "warning";
export type ValidationStatus = "passed" | "violations" | "operational-error";
export type AdvanceStatus = "advanced" | "blocked" | "operational-error";
export type VerificationCheckStatus =
  "pass" | "violation" | "pending" | "unsupported";
export type VerificationStatus =
  "passed" | "violations" | "incomplete" | "operational-error";
export type ResumeStatus = "ready" | "blocked" | "operational-error";
export type LoopRoute = "fast" | "reasoning" | "blocked";
export type LoopResultRoute = LoopRoute | "complete";
export type LoopResultStatus =
  "ready" | "escalate" | "blocked" | "complete" | "operational-error";

export type SourceLocation = {
  line: number;
  column: number;
  offset: number;
};

export type SahDiagnostic = {
  code: string;
  category: DiagnosticCategory;
  capability: string;
  severity: DiagnosticSeverity;
  classification?: ValidationClassification;
  artifactPath?: string;
  jsonPointer?: string;
  sourceLocation?: SourceLocation;
  reference?: string;
  message: string;
  expected?: string;
  repair?: string;
  owningStage?: Stage;
};

export type ValidatedBundle = {
  id: string;
  completedStage: Stage;
  profile: LifecycleProfile;
};

export type ValidationSummary = {
  errors: number;
  warnings: number;
};

export type ValidationResult = {
  status: ValidationStatus;
  bundleDirectory: string;
  bundle?: ValidatedBundle;
  diagnostics: SahDiagnostic[];
  summary: ValidationSummary;
};

export type AdvancedBundle = {
  id: string;
  profile: LifecycleProfile;
  previousStage: Stage;
  targetStage: Stage;
  completedStage: Stage;
};

export type AdvanceResult = {
  status: AdvanceStatus;
  bundleDirectory: string;
  bundle?: AdvancedBundle;
  diagnostics: SahDiagnostic[];
  summary: ValidationSummary;
};

export type AdvanceOptions = {
  verificationRecordPath?: string;
};

export type VerificationCheck = {
  code: string;
  constraintId: string;
  decisionRef: string;
  classification: ValidationClassification;
  capability: string;
  scopeElementRefs: string[];
  invariantRefs: string[];
  sliceRefs: string[];
  blockerDecisionRefs?: string[];
  status: VerificationCheckStatus;
  message: string;
  expected?: string;
  observed?: string;
  repair?: string;
};

export type VerificationSummary = ValidationSummary & {
  passed: number;
  violations: number;
  pending: number;
  unsupported: number;
};

export type VerificationSelectionIssueCode =
  | "CHANGE_PATH_OUTSIDE_SOURCE_ROOTS"
  | "CHANGE_PATH_UNMAPPED"
  | "CHANGE_PATH_AMBIGUOUS";

export type VerificationSelectionIssue = {
  code: VerificationSelectionIssueCode;
  path: string;
  elementRefs?: string[];
  message: string;
};

export type VerificationSelection = {
  mode: "affected" | "full-fallback";
  requestedPaths: string[];
  affectedElementRefs: string[];
  issues: VerificationSelectionIssue[];
};

export type VerificationResult = {
  status: VerificationStatus;
  bundleDirectory: string;
  targetDirectory: string;
  bundle?: ValidatedBundle;
  selection?: VerificationSelection;
  checks: VerificationCheck[];
  diagnostics: SahDiagnostic[];
  summary: VerificationSummary;
};

export type ResumeResult = {
  $schema: "https://sah.dev/schemas/resume-result/v0.1.0";
  resumeVersion: "0.1.0";
  status: ResumeStatus;
  bundleDirectory: string;
  bundle?: ValidatedBundle;
  bundleFingerprint?: string;
  nextAction?:
    | "author-design"
    | "implement-ready-slices"
    | "resolve-blockers"
    | "complete";
  readySliceRefs: string[];
  blockedSliceRefs: string[];
  dependencyOrder: string[];
  diagnostics: SahDiagnostic[];
  summary: ValidationSummary;
};

export type IterationTaskContract = {
  goal: string;
  context: string[];
  constraints: string[];
  doneWhen: string[];
  checks?: IterationCheckContract[];
};

export type IterationCheckContract = {
  id: string;
  kind: string;
  command: string;
  expected: string;
  required: boolean;
};

export type IterationCriterionEvidence = {
  criterionId: string;
  evidenceRefs: string[];
};

export type IterationCompletion = {
  completionVersion: "0.1.0";
  status: "open" | "completed";
  criterionResults: IterationCriterionEvidence[];
  completedAt?: string;
};

export type IterationLoopResult = {
  $schema: "https://sah.dev/schemas/iteration-loop-result/v0.2.0";
  resultVersion: "0.2.0";
  operation: "evaluated" | "recorded" | "advanced" | "completed";
  status: LoopResultStatus;
  loopFile: string;
  loopId?: string;
  route?: LoopResultRoute;
  escalation: {
    triggered: boolean;
    ruleRefs: string[];
    reasons: string[];
  };
  currentTask?: IterationTaskContract;
  nextTask?: IterationTaskContract;
  learningSourceIterationId?: string;
  diagnostics: SahDiagnostic[];
  summary: ValidationSummary;
};

export type IterationOutcome = {
  $schema: "https://sah.dev/schemas/iteration-outcome/v0.3.0";
  outcomeVersion: "0.3.0";
  iterationId: string;
  status: "succeeded" | "partial" | "failed";
  evidence: {
    executor: {
      name: string;
      version: string;
    };
    cwd: string;
    startedAt: string;
    finishedAt: string;
  };
  checkResults: Array<{
    checkId: string;
    status: "passed" | "failed" | "incomplete";
    command: string;
    cwd: string;
    startedAt: string;
    finishedAt: string;
    exitCode: number | null;
    stdoutDigest: string;
    stderrDigest: string;
    observed?: string;
  }>;
  learnings: Array<{
    id: string;
    observation: string;
    priority: "must" | "should" | "could";
    nextTask: IterationTaskContract;
  }>;
};

export type IterationChecksResult = {
  status: "passed" | "failed" | "incomplete" | "blocked" | "operational-error";
  loopFile: string;
  outcome?: IterationOutcome;
  diagnostics: SahDiagnostic[];
  summary: ValidationSummary;
};

export type IterationCompletionRequest = {
  $schema: "https://sah.dev/schemas/iteration-completion/v0.1.0";
  completionVersion: "0.1.0";
  status: "completed";
  criterionResults: IterationCriterionEvidence[];
};

export type VerificationOptions = {
  sourceMappingPath?: string;
  changedPaths?: readonly string[];
  verificationRecordPath?: string;
};

export const verificationRecordSchemaId =
  "https://sah.dev/schemas/verification-record/v0.1.0" as const;

export type VerificationRecord = {
  $schema: typeof verificationRecordSchemaId;
  recordVersion: "0.1.0";
  bundleFingerprint: string;
  invocation: {
    scope: "full" | "changed";
    sourceMappingPath?: string;
    changedPaths?: string[];
  };
  result: VerificationResult & { bundle: ValidatedBundle };
};
