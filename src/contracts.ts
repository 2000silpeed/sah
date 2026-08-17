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

export type VerificationOptions = {
  sourceMappingPath?: string;
  changedPaths?: readonly string[];
};
