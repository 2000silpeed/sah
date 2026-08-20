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
export type CheckerReviewVerdict =
  "approve" | "request-changes" | "blocked" | "incomplete";
export type CheckerReviewStatus =
  "passed" | "violations" | "incomplete" | "operational-error";
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

export const checkerReviewSchemaId =
  "https://sah.dev/schemas/checker-review/v0.1.0" as const;

export type CheckerReview = {
  $schema: typeof checkerReviewSchemaId;
  reviewVersion: "0.1.0";
  reviewId: string;
  target: {
    targetRoot: string;
    targetRevision: string;
    designFingerprint: string;
  };
  scope: {
    taskRef: string;
    artifactRefs: string[];
  };
  reviewer: {
    role: "independent-checker";
    id: string;
    independent: true;
    readOnly: true;
    mutatedTarget: false;
    benchmarkExpectationsRead: false;
  };
  checks: Array<{
    id: string;
    classification: ValidationClassification;
    command: string;
    cwd: string;
    status:
      "passed" | "failed" | "incomplete" | "unsupported" | "operational-error";
    exitCode: number | null;
    evidenceRef: string;
    observed?: string;
  }>;
  findings: Array<{
    id: string;
    classification: ValidationClassification;
    severity: "high" | "medium" | "low" | "info";
    status: "open" | "resolved" | "accepted" | "deferred";
    message: string;
    evidenceRefs?: string[];
  }>;
  residualRisks: string[];
  verdict: CheckerReviewVerdict;
  reviewedAt: string;
};

export type CheckerReviewResult = {
  status: CheckerReviewStatus;
  reviewPath: string;
  reviewId?: string;
  verdict?: CheckerReviewVerdict;
  diagnostics: SahDiagnostic[];
  summary: ValidationSummary;
};

export type CheckerReviewValidationOptions = {
  targetRevision?: string;
  designFingerprint?: string;
};

export type IterationTaskContract = {
  goal: string;
  context: string[];
  constraints: string[];
  doneWhen: string[];
  checks?: IterationCheckContract[];
  slice?: IterationSliceContract;
};

export const iterationScenarioSchemaId =
  "https://sah.dev/schemas/iteration-scenario/v0.1.0" as const;

export const iterationSliceSchemaId =
  "https://sah.dev/schemas/iteration-slice/v0.1.0" as const;

export type IterationScenario = {
  id: string;
  description: string;
  expectedOutcome: string;
};

export type IterationSliceContract = {
  id: string;
  scenarioRefs: string[];
  acceptanceCheckIds: string[];
};

export type IterationScenarioEvidence = {
  scenarioId: string;
  evidenceRefs: string[];
};

export type IterationCheckContract = {
  id: string;
  kind: string;
  command: string;
  expected: string;
  required: boolean;
};

export type IterationWorkContext = {
  targetRoot: string;
  targetRevision: string;
  designBundlePath: string;
  designFingerprint: string;
};

export type IterationEvidenceContext = Pick<
  IterationWorkContext,
  "targetRevision" | "designFingerprint"
>;

export type IterationContextOptions = IterationEvidenceContext;

export type IterationCriterionEvidence = {
  criterionId: string;
  evidenceRefs: string[];
};

export type IterationCompletion = {
  completionVersion: "0.2.0";
  status: "open" | "completed";
  workContext: IterationEvidenceContext;
  criterionResults: IterationCriterionEvidence[];
  scenarioResults?: IterationScenarioEvidence[];
  completedAt?: string;
};

export type IterationLoopResult = {
  $schema: "https://sah.dev/schemas/iteration-loop-result/v0.3.0";
  resultVersion: "0.3.0";
  operation: "evaluated" | "recorded" | "advanced" | "completed" | "bound";
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
  scenarios?: IterationScenario[];
  workContext?: IterationWorkContext;
  learningSourceIterationId?: string;
  diagnostics: SahDiagnostic[];
  summary: ValidationSummary;
};

export type IterationOutcome = {
  $schema: "https://sah.dev/schemas/iteration-outcome/v0.4.0";
  outcomeVersion: "0.4.0";
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
    workContext: IterationEvidenceContext;
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
  sliceEvidence?: IterationScenarioEvidence[];
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
  $schema: "https://sah.dev/schemas/iteration-completion/v0.2.0";
  completionVersion: "0.2.0";
  status: "completed";
  workContext: IterationEvidenceContext;
  criterionResults: IterationCriterionEvidence[];
  scenarioResults?: IterationScenarioEvidence[];
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
