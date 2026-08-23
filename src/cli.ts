#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  stages,
  type AdvanceResult,
  type SahDiagnostic,
  type Stage,
  type ValidationResult,
  type VerificationCheck,
  type VerificationOptions,
  type VerificationResult,
  type VerificationSelection,
  type ResumeResult,
  type IterationChecksResult,
  type IterationLoopResult,
  type CheckerReviewResult,
  type LineageResult,
  type CurrentArchitectureResult,
  type BenchmarkRunResult,
  type BenchmarkRunMode,
  type BenchmarkFreezeResult,
  type BenchmarkScoreResult,
  type BenchmarkVerdictResult,
  type BenchmarkComparisonResult,
  type BenchmarkTrajectoryAppendOptions,
  type BenchmarkTrajectoryAppendResult,
  type BenchmarkTrajectoryEntryKind,
  type BenchmarkTrajectoryInspectResult,
} from "./contracts.js";
import { result } from "./diagnostics.js";
import {
  advanceBundle,
  validateBundle,
  verifyBundle,
  resumeBundle,
} from "./model-repository.js";
import { resolveArchitectureLineage } from "./architecture-lineage.js";
import { resolveCurrentArchitecture } from "./current-architecture.js";
import {
  evaluateIterationLoop,
  runIterationChecks,
  recordIterationOutcome,
  acceptNextIteration,
  bindIterationContext,
  completeIterationLoop,
} from "./iteration-loop.js";
import { validateCheckerReview } from "./checker-review.js";
import { prepareBenchmarkRun } from "./benchmark-run.js";
import {
  appendBenchmarkTrajectoryEntry,
  freezeBenchmarkCapture,
  inspectBenchmarkTrajectory,
} from "./benchmark-trajectory.js";
import { aggregateBenchmarkJudgeReviews } from "./benchmark-judging.js";
import { assembleBenchmarkVerdict } from "./benchmark-verdict.js";
import { compareBenchmarkVerdicts } from "./benchmark-comparison.js";

const usage = [
  "Usage: sah validate <design-bundle-directory> [--json]",
  "       sah advance <design-bundle-directory> <target-stage> [--verification-record <bundle-relative-record>] [--json]",
  "       sah verify <design-bundle-directory> <target-directory> [--mapping <target-relative-mapping-file>] [--changed <target-relative-file>]... [--check-record <target-relative-iteration-outcome>] [--target-revision <target-revision>] [--record <bundle-relative-record>] [--json]",
  "       sah resume <design-bundle-directory> [--json]",
  "       sah lineage <sah-root> [--json]",
  "       sah current <sah-root> [--json]",
  "       sah benchmark-prepare <benchmark-directory> <run-directory> --run-id <run-id> --comparison-id <comparison-id> --mode <treatment|control> [--json]",
  "       sah benchmark-trajectory <run-directory> (--entry-file <entry-file> | --status) [--json]",
  "       sah benchmark-freeze <run-directory> [--json]",
  "       sah benchmark-judge <judge-record-a> <judge-record-b> [--json]",
  "       sah benchmark-verdict <judge-score.json> --bundle <participant-bundle-directory> [--adjudication <adjudication-file>] [--record <verdict-file>] [--json]",
  "       sah benchmark-compare <treatment-verdict> <control-verdict> [--json]",
  "       sah loop <sah.loop.json> [--json]",
  "       sah loop-bind <sah.loop.json> --target-revision <target-revision> --design-fingerprint <sha256> [--json]",
  "       sah loop-checks <sah.loop.json> --cwd <target-directory> --target-revision <target-revision> --design-fingerprint <sha256> [--json]",
  "       sah loop-record <sah.loop.json> <iteration-outcome.json> [--json]",
  "       sah loop-accept-next <sah.loop.json> --target-revision <target-revision> --design-fingerprint <sha256> [--repair] [--json]",
  "       sah loop-complete <sah.loop.json> <iteration-completion.json> [--json]",
  "       sah checker-review <checker-review.json> [--target-revision <target-revision>] [--design-fingerprint <sha256>] [--json]",
].join("\n");

type ParsedArguments = {
  positional: string[];
  json: boolean;
  sourceMappingPath?: string;
  changedPaths?: string[];
  checkRecordPath?: string;
  recordPath?: string;
  verificationRecordPath?: string;
  cwd?: string;
  targetRevision?: string;
  designFingerprint?: string;
  benchmarkRunId?: string;
  benchmarkComparisonId?: string;
  benchmarkMode?: string;
  benchmarkTrajectoryEntryPath?: string;
  benchmarkTrajectoryStatus?: boolean;
  benchmarkBundleDirectory?: string;
  benchmarkAdjudicationFile?: string;
  repair?: boolean;
  error?: string;
};

function parseArguments(arguments_: string[]): ParsedArguments {
  const positional: string[] = [];
  let json = false;
  let sourceMappingPath: string | undefined;
  let recordPath: string | undefined;
  let checkRecordPath: string | undefined;
  let verificationRecordPath: string | undefined;
  let cwd: string | undefined;
  let targetRevision: string | undefined;
  let designFingerprint: string | undefined;
  let benchmarkRunId: string | undefined;
  let benchmarkComparisonId: string | undefined;
  let benchmarkMode: string | undefined;
  let benchmarkTrajectoryEntryPath: string | undefined;
  let benchmarkTrajectoryStatus = false;
  let benchmarkBundleDirectory: string | undefined;
  let benchmarkAdjudicationFile: string | undefined;
  let repair = false;
  const changedPaths: string[] = [];
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--json") {
      if (json)
        return { positional, json, error: "--json may be supplied only once." };
      json = true;
      continue;
    }
    if (argument === "--repair") {
      if (repair)
        return {
          positional,
          json,
          error: "--repair may be supplied only once.",
        };
      repair = true;
      continue;
    }
    if (
      argument === "--run-id" ||
      argument === "--comparison-id" ||
      argument === "--mode"
    ) {
      const current =
        argument === "--run-id"
          ? benchmarkRunId
          : argument === "--comparison-id"
            ? benchmarkComparisonId
            : benchmarkMode;
      if (current !== undefined) {
        return {
          positional,
          json,
          error: `${argument} may be supplied only once.`,
        };
      }
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return {
          positional,
          json,
          error: `${argument} requires one value.`,
        };
      }
      if (argument === "--run-id") benchmarkRunId = value;
      else if (argument === "--comparison-id") benchmarkComparisonId = value;
      else benchmarkMode = value;
      index += 1;
      continue;
    }
    if (argument === "--entry-file") {
      if (benchmarkTrajectoryEntryPath !== undefined) {
        return {
          positional,
          json,
          error: "--entry-file may be supplied only once.",
        };
      }
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return {
          positional,
          json,
          error: "--entry-file requires one entry file path.",
        };
      }
      benchmarkTrajectoryEntryPath = value;
      index += 1;
      continue;
    }
    if (argument === "--status") {
      if (benchmarkTrajectoryStatus) {
        return {
          positional,
          json,
          error: "--status may be supplied only once.",
        };
      }
      benchmarkTrajectoryStatus = true;
      continue;
    }
    if (argument === "--bundle") {
      if (benchmarkBundleDirectory !== undefined) {
        return {
          positional,
          json,
          error: "--bundle may be supplied only once.",
        };
      }
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return {
          positional,
          json,
          error: "--bundle requires one participant bundle directory.",
        };
      }
      benchmarkBundleDirectory = value;
      index += 1;
      continue;
    }
    if (argument === "--adjudication") {
      if (benchmarkAdjudicationFile !== undefined) {
        return {
          positional,
          json,
          error: "--adjudication may be supplied only once.",
        };
      }
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return {
          positional,
          json,
          error: "--adjudication requires one steward adjudication file.",
        };
      }
      benchmarkAdjudicationFile = value;
      index += 1;
      continue;
    }
    if (argument === "--mapping") {
      if (sourceMappingPath !== undefined) {
        return {
          positional,
          json,
          error: "--mapping may be supplied only once.",
        };
      }
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return {
          positional,
          json,
          error: "--mapping requires one target-relative path.",
        };
      }
      sourceMappingPath = value;
      index += 1;
      continue;
    }
    if (argument === "--changed") {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return {
          positional,
          json,
          error: "--changed requires one target-relative file path.",
        };
      }
      changedPaths.push(value);
      index += 1;
      continue;
    }
    if (argument === "--cwd") {
      if (cwd !== undefined) {
        return { positional, json, error: "--cwd may be supplied only once." };
      }
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return {
          positional,
          json,
          error: "--cwd requires one directory path.",
        };
      }
      cwd = value;
      index += 1;
      continue;
    }
    if (argument === "--check-record") {
      if (checkRecordPath !== undefined) {
        return {
          positional,
          json,
          error: "--check-record may be supplied only once.",
        };
      }
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return {
          positional,
          json,
          error: "--check-record requires one target-relative JSON path.",
        };
      }
      checkRecordPath = value;
      index += 1;
      continue;
    }
    if (
      argument === "--target-revision" ||
      argument === "--design-fingerprint"
    ) {
      const current =
        argument === "--target-revision" ? targetRevision : designFingerprint;
      if (current !== undefined) {
        return {
          positional,
          json,
          error: `${argument} may be supplied only once.`,
        };
      }
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return {
          positional,
          json,
          error: `${argument} requires one value.`,
        };
      }
      if (argument === "--target-revision") targetRevision = value;
      else designFingerprint = value;
      index += 1;
      continue;
    }
    if (argument === "--record" || argument === "--verification-record") {
      const current =
        argument === "--record" ? recordPath : verificationRecordPath;
      if (current !== undefined) {
        return {
          positional,
          json,
          error: `${argument} may be supplied only once.`,
        };
      }
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return {
          positional,
          json,
          error: `${argument} requires one bundle-relative JSON path.`,
        };
      }
      if (argument === "--record") recordPath = value;
      else verificationRecordPath = value;
      index += 1;
      continue;
    }
    if (argument !== undefined) positional.push(argument);
  }
  return {
    positional,
    json,
    ...(sourceMappingPath === undefined ? {} : { sourceMappingPath }),
    ...(changedPaths.length === 0 ? {} : { changedPaths }),
    ...(checkRecordPath === undefined ? {} : { checkRecordPath }),
    ...(recordPath === undefined ? {} : { recordPath }),
    ...(verificationRecordPath === undefined ? {} : { verificationRecordPath }),
    ...(cwd === undefined ? {} : { cwd }),
    ...(targetRevision === undefined ? {} : { targetRevision }),
    ...(designFingerprint === undefined ? {} : { designFingerprint }),
    ...(benchmarkRunId === undefined ? {} : { benchmarkRunId }),
    ...(benchmarkComparisonId === undefined ? {} : { benchmarkComparisonId }),
    ...(benchmarkMode === undefined ? {} : { benchmarkMode }),
    ...(benchmarkTrajectoryEntryPath === undefined
      ? {}
      : { benchmarkTrajectoryEntryPath }),
    ...(benchmarkTrajectoryStatus ? { benchmarkTrajectoryStatus: true } : {}),
    ...(benchmarkBundleDirectory === undefined
      ? {}
      : { benchmarkBundleDirectory }),
    ...(benchmarkAdjudicationFile === undefined
      ? {}
      : { benchmarkAdjudicationFile }),
    ...(repair ? { repair: true } : {}),
  };
}

function invocationError(message: string): ValidationResult {
  const diagnostic: SahDiagnostic = {
    code: "CLI_INVALID_INVOCATION",
    category: "operational",
    capability: "CLI invocation",
    severity: "error",
    message,
    expected: usage,
    repair:
      "Invoke one command with the required arguments and optional --json.",
  };
  return result("operational-error", resolve("."), [diagnostic]);
}

function humanDiagnostic(diagnostic: SahDiagnostic): string {
  const location = [
    diagnostic.artifactPath,
    diagnostic.jsonPointer,
    diagnostic.sourceLocation === undefined
      ? undefined
      : `${diagnostic.sourceLocation.line}:${diagnostic.sourceLocation.column}`,
  ]
    .filter((value): value is string => value !== undefined)
    .join(":");
  const classification = diagnostic.classification ?? diagnostic.category;
  const reference =
    diagnostic.reference === undefined ? "" : ` ref=${diagnostic.reference}`;
  return [
    `[${diagnostic.severity.toUpperCase()}] ${diagnostic.code} (${classification})${
      location === "" ? "" : ` ${location}`
    }${reference}`,
    `  ${diagnostic.message}`,
    ...(diagnostic.expected === undefined
      ? []
      : [`  Expected: ${diagnostic.expected}`]),
    ...(diagnostic.repair === undefined
      ? []
      : [`  Repair: ${diagnostic.repair}`]),
  ].join("\n");
}

export function formatValidationHuman(validation: ValidationResult): string {
  const title =
    validation.status === "passed"
      ? "SAH validation passed"
      : validation.status === "violations"
        ? "SAH validation found violations"
        : "SAH validation could not run";
  const bundle =
    validation.bundle === undefined
      ? []
      : [
          `Bundle: ${validation.bundle.id} (${validation.bundle.completedStage}, ${validation.bundle.profile})`,
        ];
  const diagnostics = validation.diagnostics.map(humanDiagnostic);
  return [
    title,
    ...bundle,
    ...diagnostics,
    `Summary: ${validation.summary.errors} error(s), ${validation.summary.warnings} warning(s)`,
  ].join("\n\n");
}

export function formatAdvanceHuman(advance: AdvanceResult): string {
  const title =
    advance.status === "advanced"
      ? "SAH bundle advanced"
      : advance.status === "blocked"
        ? "SAH bundle advance blocked"
        : "SAH bundle could not advance";
  const bundle =
    advance.bundle === undefined
      ? []
      : [
          `Bundle: ${advance.bundle.id} (${advance.bundle.previousStage} -> ${advance.bundle.targetStage}, ${advance.bundle.profile})`,
          `Completed stage: ${advance.bundle.completedStage}`,
        ];
  return [
    title,
    ...bundle,
    ...advance.diagnostics.map(humanDiagnostic),
    `Summary: ${advance.summary.errors} error(s), ${advance.summary.warnings} warning(s)`,
  ].join("\n\n");
}

function humanCheck(check: VerificationCheck): string {
  return [
    `[${check.status.toUpperCase()}] ${check.code} (${check.classification}) constraint=${check.constraintId}`,
    `  ${check.message}`,
    `  Decision: ${check.decisionRef}`,
    `  Capability: ${check.capability}`,
    `  Scope: ${check.scopeElementRefs.join(", ")}`,
    `  Invariants: ${check.invariantRefs.join(", ")}`,
    `  Slices: ${check.sliceRefs.join(", ")}`,
    ...(check.blockerDecisionRefs === undefined ||
    check.blockerDecisionRefs.length === 0
      ? []
      : [`  Blockers: ${check.blockerDecisionRefs.join(", ")}`]),
    ...(check.observed === undefined ? [] : [`  Observed: ${check.observed}`]),
    ...(check.expected === undefined ? [] : [`  Expected: ${check.expected}`]),
    ...(check.repair === undefined ? [] : [`  Repair: ${check.repair}`]),
  ].join("\n");
}

function humanSelection(selection: VerificationSelection): string {
  return [
    `Selection: ${selection.mode}`,
    `  Changed: ${selection.requestedPaths.join(", ")}`,
    `  Elements: ${selection.affectedElementRefs.join(", ") || "(none)"}`,
    ...selection.issues.map(
      (issue) =>
        `  Fallback: ${issue.code} path=${issue.path}${
          issue.elementRefs === undefined
            ? ""
            : ` elements=${issue.elementRefs.join(",")}`
        }`,
    ),
  ].join("\n");
}

export function formatVerificationHuman(
  verification: VerificationResult,
): string {
  const title =
    verification.status === "passed"
      ? "SAH verification passed"
      : verification.status === "violations"
        ? "SAH verification found violations"
        : verification.status === "incomplete"
          ? "SAH verification is incomplete"
          : "SAH verification could not run";
  const bundle =
    verification.bundle === undefined
      ? []
      : [
          `Bundle: ${verification.bundle.id} (${verification.bundle.completedStage}, ${verification.bundle.profile})`,
        ];
  return [
    title,
    ...bundle,
    `Target: ${verification.targetDirectory}`,
    ...(verification.selection === undefined
      ? []
      : [humanSelection(verification.selection)]),
    ...verification.checks.map(humanCheck),
    ...verification.diagnostics.map(humanDiagnostic),
    `Summary: ${verification.summary.passed} passed, ${verification.summary.violations} violation(s), ${verification.summary.pending} pending, ${verification.summary.unsupported} unsupported, ${verification.summary.errors} error(s), ${verification.summary.warnings} warning(s)`,
  ].join("\n\n");
}

function exitCode(
  outcome:
    | ValidationResult
    | AdvanceResult
    | VerificationResult
    | ResumeResult
    | LineageResult
    | IterationChecksResult
    | IterationLoopResult
    | CheckerReviewResult
    | CurrentArchitectureResult
    | BenchmarkRunResult
    | BenchmarkTrajectoryAppendResult
    | BenchmarkTrajectoryInspectResult
    | BenchmarkFreezeResult
    | BenchmarkScoreResult
    | BenchmarkVerdictResult
    | BenchmarkComparisonResult,
): 0 | 1 | 2 {
  switch (outcome.status) {
    case "passed":
    case "advanced":
    case "ready":
    case "complete":
    case "prepared":
    case "appended":
    case "frozen":
    case "scored":
    case "compared":
    case "ok":
      return 0;
    case "escalate":
      return 1;
    case "failed":
      return 1;
    case "conflicted":
      return 1;
    case "blocked":
      return 1;
    case "violations":
      return 1;
    case "adjudication-required":
      return 1;
    case "incomplete":
    case "operational-error":
      return 2;
  }
}

function formatLoopHuman(loop: IterationLoopResult): string {
  const title =
    loop.status === "ready"
      ? "SAH iteration ready for fast path"
      : loop.status === "escalate"
        ? "SAH iteration requires reasoning path"
        : loop.status === "blocked"
          ? "SAH iteration blocked"
          : loop.status === "complete"
            ? "SAH iteration loop complete"
            : "SAH iteration loop could not run";
  return [
    title,
    ...(loop.loopId === undefined ? [] : [`Loop: ${loop.loopId}`]),
    ...(loop.workContext === undefined
      ? []
      : [
          `Target revision: ${loop.workContext.targetRevision}`,
          `Design fingerprint: ${loop.workContext.designFingerprint}`,
        ]),
    ...(loop.route === undefined ? [] : [`Route: ${loop.route}`]),
    ...(loop.scenarios === undefined
      ? []
      : [
          `Scenarios: ${loop.scenarios
            .map(({ id, expectedOutcome }) => `${id} (${expectedOutcome})`)
            .join(" | ")}`,
        ]),
    `Escalation: ${loop.escalation.triggered ? "yes" : "no"}`,
    ...(loop.escalation.ruleRefs.length === 0
      ? []
      : [`Rules: ${loop.escalation.ruleRefs.join(", ")}`]),
    ...(loop.escalation.reasons.length === 0
      ? []
      : [`Reasons: ${loop.escalation.reasons.join(" | ")}`]),
    ...(loop.currentTask === undefined
      ? []
      : [`Current task: ${loop.currentTask.goal}`]),
    ...(loop.currentTask?.slice === undefined
      ? []
      : [
          `Current slice: ${loop.currentTask.slice.id} scenarios=${loop.currentTask.slice.scenarioRefs.join(",")} acceptance=${loop.currentTask.slice.acceptanceCheckIds.join(",")}`,
        ]),
    ...(loop.nextTask === undefined
      ? []
      : [`Next task: ${loop.nextTask.goal}`]),
    ...(loop.nextTask?.slice === undefined
      ? []
      : [
          `Next slice: ${loop.nextTask.slice.id} scenarios=${loop.nextTask.slice.scenarioRefs.join(",")} acceptance=${loop.nextTask.slice.acceptanceCheckIds.join(",")}`,
        ]),
    ...(loop.learningSourceIterationId === undefined
      ? []
      : [`Learned from: ${loop.learningSourceIterationId}`]),
    ...loop.diagnostics.map(humanDiagnostic),
    `Summary: ${loop.summary.errors} error(s), ${loop.summary.warnings} warning(s)`,
  ].join("\n\n");
}

function formatChecksHuman(checks: IterationChecksResult): string {
  const title =
    checks.status === "passed"
      ? "SAH iteration checks passed"
      : checks.status === "failed"
        ? "SAH iteration checks failed"
        : checks.status === "incomplete"
          ? "SAH iteration checks are incomplete"
          : checks.status === "blocked"
            ? "SAH iteration checks blocked"
            : "SAH iteration checks could not run";
  return [
    title,
    `Loop file: ${checks.loopFile}`,
    ...(checks.outcome === undefined
      ? []
      : [
          `Iteration: ${checks.outcome.iterationId}`,
          `Evidence cwd: ${checks.outcome.evidence.cwd}`,
          `Target revision: ${checks.outcome.evidence.workContext.targetRevision}`,
          `Design fingerprint: ${checks.outcome.evidence.workContext.designFingerprint}`,
          ...(checks.outcome.sliceEvidence === undefined
            ? []
            : [
                `Slice evidence: ${checks.outcome.sliceEvidence
                  .map(
                    ({ scenarioId, evidenceRefs }) =>
                      `${scenarioId}=${evidenceRefs.join(",")}`,
                  )
                  .join(" | ")}`,
              ]),
          ...checks.outcome.checkResults.map(
            (check) =>
              `Check ${check.checkId}: ${check.status} (exit ${String(check.exitCode)})`,
          ),
        ]),
    ...checks.diagnostics.map(humanDiagnostic),
    `Summary: ${checks.summary.errors} error(s), ${checks.summary.warnings} warning(s)`,
  ].join("\n\n");
}

function formatCheckerReviewHuman(review: CheckerReviewResult): string {
  const title =
    review.status === "passed"
      ? "SAH Checker review passed"
      : review.status === "violations"
        ? "SAH Checker review found violations"
        : review.status === "incomplete"
          ? "SAH Checker review is incomplete"
          : "SAH Checker review could not run";
  return [
    title,
    `Review: ${review.reviewPath}`,
    ...(review.reviewId === undefined ? [] : [`Review id: ${review.reviewId}`]),
    ...(review.verdict === undefined ? [] : [`Verdict: ${review.verdict}`]),
    ...review.diagnostics.map(humanDiagnostic),
    `Summary: ${review.summary.errors} error(s), ${review.summary.warnings} warning(s)`,
  ].join("\n\n");
}

function formatResumeHuman(resume: ResumeResult): string {
  return [
    resume.status === "ready"
      ? "SAH session resume ready"
      : "SAH session resume blocked",
    ...(resume.bundle === undefined
      ? []
      : [
          `Bundle: ${resume.bundle.id} (${resume.bundle.completedStage}, ${resume.bundle.profile})`,
        ]),
    ...(resume.bundleFingerprint === undefined
      ? []
      : [`Fingerprint: ${resume.bundleFingerprint}`]),
    ...(resume.nextAction === undefined
      ? []
      : [`Next action: ${resume.nextAction}`]),
    `Ready slices: ${resume.readySliceRefs.join(", ") || "(none)"}`,
    `Blocked slices: ${resume.blockedSliceRefs.join(", ") || "(none)"}`,
    `Dependency order: ${resume.dependencyOrder.join(" -> ") || "(none)"}`,
    ...resume.diagnostics.map(humanDiagnostic),
    `Summary: ${resume.summary.errors} error(s), ${resume.summary.warnings} warning(s)`,
  ].join("\n\n");
}

function formatLineageHuman(lineage: LineageResult): string {
  const title =
    lineage.status === "passed"
      ? "SAH architecture lineage passed"
      : lineage.status === "violations"
        ? "SAH architecture lineage found violations"
        : lineage.status === "incomplete"
          ? "SAH architecture lineage is incomplete"
          : "SAH architecture lineage could not run";
  return [
    title,
    `SAH root: ${lineage.sahRoot}`,
    `Bundles: ${
      lineage.bundles
        .map(
          ({ bundleId, path, fingerprint, completedStage }) =>
            `${bundleId} (${path}, ${completedStage}, ${fingerprint})`,
        )
        .join(" | ") || "(none)"
    }`,
    `Edges: ${
      lineage.edges
        .map(
          ({ fromBundleId, toBundleId }) => `${fromBundleId} -> ${toBundleId}`,
        )
        .join(" | ") || "(none)"
    }`,
    `Heads: ${lineage.heads.join(", ") || "(none)"}`,
    ...lineage.triggerEvents.map(
      ({ id, sourceDecision, resultingDecision }) =>
        `Trigger ${id}: ${sourceDecision} -> ${resultingDecision}`,
    ),
    ...lineage.conflicts.map(
      ({ code, bundleIds, message }) =>
        `Conflict ${code} (${bundleIds.join(", ")}): ${message}`,
    ),
    ...lineage.diagnostics.map(humanDiagnostic),
    `Summary: ${lineage.summary.bundles} bundle(s), ${lineage.summary.edges} edge(s), ${lineage.summary.conflicts} conflict(s), ${lineage.summary.errors} error(s), ${lineage.summary.warnings} warning(s)`,
  ].join("\n\n");
}

function formatCurrentArchitectureHuman(
  current: CurrentArchitectureResult,
): string {
  const title =
    current.status === "ready"
      ? "SAH current architecture ready"
      : current.status === "conflicted"
        ? "SAH current architecture is conflicted"
        : current.status === "incomplete"
          ? "SAH current architecture is incomplete"
          : "SAH current architecture could not run";
  return [
    title,
    `SAH root: ${current.sahRoot}`,
    `Heads: ${
      current.heads
        .map(
          ({ bundleId, path, fingerprint }) =>
            `${bundleId} (${path}, ${fingerprint})`,
        )
        .join(" | ") || "(none)"
    }`,
    `Active decisions: ${
      current.activeDecisions
        .map(
          ({ qualifiedRef, title: decisionTitle }) =>
            `${qualifiedRef}: ${decisionTitle}`,
        )
        .join(" | ") || "(none)"
    }`,
    ...current.supersededDecisions.map(
      ({ qualifiedRef, supersededBy }) =>
        `Superseded: ${qualifiedRef} -> ${supersededBy}`,
    ),
    ...current.openReviewTriggers.map(
      ({ decisionRef, trigger }) => `Open trigger: ${decisionRef}: ${trigger}`,
    ),
    ...current.pendingJudgments.map(
      ({ bundleId, constraintId }) =>
        `Pending judgment: ${bundleId}#${constraintId}`,
    ),
    ...current.conflicts.map(
      ({ code, bundleIds, message }) =>
        `Conflict ${code} (${bundleIds.join(", ")}): ${message}`,
    ),
    ...current.diagnostics.map(humanDiagnostic),
    `Summary: ${current.summary.activeDecisions} active decision(s), ${current.summary.supersededDecisions} superseded, ${current.summary.openReviewTriggers} open trigger(s), ${current.summary.pendingJudgments} pending judgment(s), ${current.summary.conflicts} conflict(s), ${current.summary.errors} error(s), ${current.summary.warnings} warning(s)`,
  ].join("\n\n");
}

function formatBenchmarkRunHuman(runResult: BenchmarkRunResult): string {
  const title =
    runResult.status === "prepared"
      ? "SAH benchmark run prepared"
      : "SAH benchmark run could not be prepared";
  const run = runResult.run;
  return [
    title,
    `Target: ${runResult.runDirectory}`,
    ...(run === undefined
      ? []
      : [
          `Run: ${run.runId} (${run.mode}, comparison ${run.comparisonId})`,
          `Benchmark: ${run.benchmarkId}`,
          `Problem: ${run.input.problemPath} (${run.input.problemDigest})`,
          `Capture: ${run.capture.outputDirectory}/${run.capture.trajectoryPath}`,
        ]),
    ...(runResult.recordPath === undefined
      ? []
      : [`Record: ${runResult.recordPath}`]),
    ...runResult.diagnostics.map(humanDiagnostic),
    `Summary: ${runResult.summary.errors} error(s), ${runResult.summary.warnings} warning(s)`,
  ].join("\n\n");
}

function isStage(value: string | undefined): value is Stage {
  return value !== undefined && (stages as readonly string[]).includes(value);
}

function isBenchmarkMode(value: string | undefined): value is BenchmarkRunMode {
  return value === "treatment" || value === "control";
}

const benchmarkTrajectoryKinds: readonly BenchmarkTrajectoryEntryKind[] = [
  "agent-message",
  "tool-invocation",
  "tool-result",
  "system-event",
];

function isBenchmarkTrajectoryKind(
  value: string,
): value is BenchmarkTrajectoryEntryKind {
  return (benchmarkTrajectoryKinds as readonly string[]).includes(value);
}

function toTrajectoryAppendOptions(
  value: unknown,
): BenchmarkTrajectoryAppendOptions | string {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return "one JSON object";
  const record = value as Record<string, unknown>;
  const allowedKeys = ["seq", "recordedAt", "kind", "payload"];
  const keys = Object.keys(record);
  for (const key of keys) {
    if (!allowedKeys.includes(key)) return `no ${key} property`;
  }
  if (!keys.includes("seq") || typeof record.seq !== "number")
    return "a numeric seq property";
  if (!Number.isInteger(record.seq) || record.seq < 1)
    return "seq to be a positive integer";
  if (!keys.includes("recordedAt") || typeof record.recordedAt !== "string")
    return "a recordedAt date-time string";
  if (
    !keys.includes("kind") ||
    typeof record.kind !== "string" ||
    !isBenchmarkTrajectoryKind(record.kind)
  )
    return `kind to be one of ${benchmarkTrajectoryKinds.join(", ")}`;
  if (
    !keys.includes("payload") ||
    typeof record.payload !== "object" ||
    record.payload === null ||
    Array.isArray(record.payload)
  )
    return "payload to be a non-null object";
  const payload = record.payload as Record<string, unknown>;
  return {
    seq: record.seq,
    recordedAt: record.recordedAt,
    kind: record.kind,
    payload,
  };
}

function formatTrajectoryHuman(
  trajectoryResult:
    BenchmarkTrajectoryAppendResult | BenchmarkTrajectoryInspectResult,
): string {
  const title =
    trajectoryResult.status === "appended"
      ? "SAH benchmark trajectory entry appended"
      : trajectoryResult.status === "ok"
        ? "SAH benchmark trajectory inspected"
        : "SAH benchmark trajectory capture failed";
  const view = trajectoryResult.view;
  const entry =
    trajectoryResult.status === "appended" ? trajectoryResult.entry : undefined;
  return [
    title,
    `Run: ${trajectoryResult.runDirectory}`,
    ...(trajectoryResult.trajectoryPath === undefined
      ? []
      : [`Trajectory: ${trajectoryResult.trajectoryPath}`]),
    ...(entry === undefined
      ? []
      : [`Entry: seq ${String(entry.seq)} (${entry.kind})`]),
    ...(view === undefined
      ? []
      : [
          `Capture: ${String(view.entryCount)} entr${view.entryCount === 1 ? "y" : "ies"}, ${String(view.byteSize)} byte(s)`,
          ...(view.sha256Digest === null
            ? []
            : [`Digest: ${view.sha256Digest}`]),
          ...(view.firstSeq === null || view.lastSeq === null
            ? []
            : [
                `Sequence: ${String(view.firstSeq)}..${String(view.lastSeq)}`,
                `Recorded: ${view.firstRecordedAt ?? "(unknown)"}..${view.lastRecordedAt ?? "(unknown)"}`,
              ]),
        ]),
    ...trajectoryResult.diagnostics.map(humanDiagnostic),
    `Summary: ${trajectoryResult.summary.errors} error(s), ${trajectoryResult.summary.warnings} warning(s)`,
  ].join("\n\n");
}

function formatFreezeHuman(freezeResult: BenchmarkFreezeResult): string {
  const title =
    freezeResult.status === "frozen"
      ? "SAH benchmark capture frozen"
      : "SAH benchmark capture could not be frozen";
  const freeze = freezeResult.freeze;
  return [
    title,
    `Run: ${freezeResult.runDirectory}`,
    ...(freeze === undefined
      ? []
      : [
          `Run id: ${freeze.runId} (${freeze.mode}, comparison ${freeze.comparisonId})`,
          `Benchmark: ${freeze.benchmarkId}`,
          `Capture: ${String(freeze.capture.entryCount)} entr${freeze.capture.entryCount === 1 ? "y" : "ies"}, ${freeze.capture.trajectoryDigest}`,
          `Output files: ${String(freeze.outputFiles.length)}`,
        ]),
    ...(freezeResult.freezePath === undefined
      ? []
      : [`Record: ${freezeResult.freezePath}`]),
    ...freezeResult.diagnostics.map(humanDiagnostic),
    `Summary: ${freezeResult.summary.errors} error(s), ${freezeResult.summary.warnings} warning(s)`,
  ].join("\n\n");
}

function formatJudgeHuman(scoreResult: BenchmarkScoreResult): string {
  const title =
    scoreResult.status === "scored"
      ? "SAH benchmark judges aggregated"
      : scoreResult.status === "adjudication-required"
        ? "SAH benchmark judges disagree; steward adjudication required"
        : scoreResult.status === "violations"
          ? "SAH benchmark judge records rejected"
          : "SAH benchmark judging could not run";
  const score = scoreResult.score;
  return [
    title,
    `Records: ${scoreResult.recordAPath} | ${scoreResult.recordBPath}`,
    ...(score === undefined
      ? []
      : [
          `Run: ${score.runId} (${score.mode}, comparison ${score.comparisonId})`,
          `Judges: ${score.judges.join(" | ")}`,
          ...score.categories.map(
            (category) =>
              `${category.category}: ${String(category.points[0])}/${String(category.points[1])}${
                category.agreed ? ` -> ${String(category.mean)}` : " (disputed)"
              }`,
          ),
          `Disputed: ${score.disputedCategories.join(", ") || "(none)"}`,
          `Fatal indicators: ${score.fatalIndicatorFlagged ? "flagged" : "none"}`,
          `Over-engineering deductions: ${score.overEngineeringDeductions.map(String).join("/")}`,
          `Judge subtotal: ${score.judgeSubtotal === null ? "(pending adjudication)" : String(score.judgeSubtotal)}`,
        ]),
    ...scoreResult.diagnostics.map(humanDiagnostic),
    `Summary: ${scoreResult.summary.errors} error(s), ${scoreResult.summary.warnings} warning(s)`,
  ].join("\n\n");
}

function formatVerdictHuman(result: BenchmarkVerdictResult): string {
  const title =
    result.status === "passed"
      ? "SAH benchmark verdict passed"
      : result.status === "failed"
        ? "SAH benchmark verdict failed"
        : result.status === "violations"
          ? "SAH benchmark verdict inputs rejected"
          : "SAH benchmark verdict could not run";
  const verdict = result.verdict;
  return [
    title,
    `Score: ${result.scorePath}`,
    ...(verdict === undefined
      ? []
      : [
          `Run: ${verdict.runId} (${verdict.mode}, comparison ${verdict.comparisonId})`,
          ...verdict.finals.map(
            (final) =>
              `${final.category}: ${String(final.points)}/${String(final.maxPoints)} (${final.source})`,
          ),
          `Deterministic: integrity ${String(verdict.deterministicPoints.artifactIntegrity.points)}/10, enforcement ${String(verdict.deterministicPoints.enforcementDeterministic.points)}/5 (${String(verdict.deterministicPoints.enforcementDeterministic.declaredConstraints)} constraint(s))`,
          `Over-engineering deduction: -${String(verdict.overEngineeringDeductionMean)}`,
          `Total: ${String(verdict.total)}${
            verdict.fatalIndicatorFlagged ? " (FATAL cap applied)" : ""
          } before cap ${String(verdict.totalBeforeCap)}`,
          `Thresholds: total>=70 ${verdict.thresholds.minimumTotalMet ? "met" : "missed"}, strategy>=12 ${verdict.thresholds.strategyMinimumMet ? "met" : "missed"}, responsibilities>=9 ${verdict.thresholds.responsibilitiesMinimumMet ? "met" : "missed"}, no-fatal ${verdict.thresholds.noFatalIndicator ? "met" : "missed"}`,
        ]),
    ...(result.recordPath === undefined
      ? []
      : [`Record: ${result.recordPath}`]),
    ...result.diagnostics.map(humanDiagnostic),
    `Summary: ${result.summary.errors} error(s), ${result.summary.warnings} warning(s)`,
  ].join("\n\n");
}

function formatCompareHuman(result: BenchmarkComparisonResult): string {
  const title =
    result.status === "compared"
      ? result.comparison?.regressionBeyondTolerance
        ? "SAH benchmark comparison: treatment regressed beyond tolerance"
        : "SAH benchmark comparison complete"
      : result.status === "violations"
        ? "SAH benchmark comparison inputs rejected"
        : "SAH benchmark comparison could not run";
  const comparison = result.comparison;
  return [
    title,
    `Records: ${result.treatmentPath} | ${result.controlPath}`,
    ...(comparison === undefined
      ? []
      : [
          `Run pair: ${comparison.treatmentRunId} vs ${comparison.controlRunId} (${comparison.benchmarkId})`,
          ...comparison.categoryDeltas.map(
            (categoryDelta) =>
              `${categoryDelta.category}: ${categoryDelta.delta >= 0 ? "+" : ""}${String(categoryDelta.delta)}${
                categoryDelta.toleranceBreached ? " (breach)" : ""
              }`,
          ),
          `Total: ${comparison.treatmentTotal} vs ${comparison.controlTotal} (delta ${comparison.totalDelta >= 0 ? "+" : ""}${String(comparison.totalDelta)})`,
          `Outcome: ${comparison.outcome}`,
        ]),
    ...result.diagnostics.map(humanDiagnostic),
    `Summary: ${result.summary.errors} error(s), ${result.summary.warnings} warning(s)`,
  ].join("\n\n");
}

async function runBenchmarkTrajectory(
  positional: string[],
  parsed: ParsedArguments,
): Promise<number> {
  const { json } = parsed;
  const actionCount =
    (parsed.benchmarkTrajectoryEntryPath !== undefined ? 1 : 0) +
    (parsed.benchmarkTrajectoryStatus === true ? 1 : 0);
  if (positional.length !== 2 || actionCount !== 1) {
    const invalid = invocationError(
      "benchmark-trajectory requires exactly one run directory and exactly one of --entry-file or --status.",
    );
    process.stdout.write(
      `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
    );
    return 2;
  }
  const runDirectory = positional[1] ?? "";
  if (parsed.benchmarkTrajectoryStatus === true) {
    const inspected = await inspectBenchmarkTrajectory(runDirectory);
    process.stdout.write(
      `${json ? JSON.stringify(inspected, null, 2) : formatTrajectoryHuman(inspected)}\n`,
    );
    return exitCode(inspected);
  }
  let raw: string;
  try {
    raw = await readFile(parsed.benchmarkTrajectoryEntryPath ?? "", "utf8");
  } catch (error) {
    const invalid = invocationError(
      `--entry-file could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.stdout.write(
      `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
    );
    return 2;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    const invalid = invocationError(
      "--entry-file does not contain valid JSON.",
    );
    process.stdout.write(
      `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
    );
    return 2;
  }
  const options = toTrajectoryAppendOptions(value);
  if (typeof options === "string") {
    const invalid = invocationError(
      `The --entry-file envelope requires ${options}. $schema is stamped automatically.`,
    );
    process.stdout.write(
      `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
    );
    return 2;
  }
  const appended = await appendBenchmarkTrajectoryEntry(runDirectory, options);
  process.stdout.write(
    `${json ? JSON.stringify(appended, null, 2) : formatTrajectoryHuman(appended)}\n`,
  );
  return exitCode(appended);
}

async function main(arguments_: string[]): Promise<number> {
  const parsed = parseArguments(arguments_);
  const { json, positional } = parsed;
  if (parsed.error !== undefined) {
    const invalid = invocationError(parsed.error);
    process.stdout.write(
      `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
    );
    return 2;
  }
  if (
    positional.length === 1 &&
    ["--help", "-h"].includes(positional[0] ?? "")
  ) {
    process.stdout.write(`${usage}\n`);
    return 0;
  }

  const benchmarkOptionUsed =
    parsed.benchmarkRunId !== undefined ||
    parsed.benchmarkComparisonId !== undefined ||
    parsed.benchmarkMode !== undefined;
  if (benchmarkOptionUsed && positional[0] !== "benchmark-prepare") {
    const invalid = invocationError(
      "--run-id, --comparison-id, and --mode are supported only by benchmark-prepare.",
    );
    process.stdout.write(
      `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
    );
    return 2;
  }

  const trajectoryOptionUsed =
    parsed.benchmarkTrajectoryEntryPath !== undefined ||
    parsed.benchmarkTrajectoryStatus === true;
  if (trajectoryOptionUsed && positional[0] !== "benchmark-trajectory") {
    const invalid = invocationError(
      "--entry-file and --status are supported only by benchmark-trajectory.",
    );
    process.stdout.write(
      `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
    );
    return 2;
  }

  const verdictOptionUsed =
    parsed.benchmarkBundleDirectory !== undefined ||
    parsed.benchmarkAdjudicationFile !== undefined;
  if (verdictOptionUsed && positional[0] !== "benchmark-verdict") {
    const invalid = invocationError(
      "--bundle and --adjudication are supported only by benchmark-verdict.",
    );
    process.stdout.write(
      `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
    );
    return 2;
  }

  if (parsed.cwd !== undefined && positional[0] !== "loop-checks") {
    const invalid = invocationError("--cwd is supported only by loop-checks.");
    process.stdout.write(
      `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
    );
    return 2;
  }
  if (parsed.checkRecordPath !== undefined && positional[0] !== "verify") {
    const invalid = invocationError(
      "--check-record is supported only by verify.",
    );
    process.stdout.write(
      `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
    );
    return 2;
  }
  const targetContextCommand = [
    "loop-bind",
    "loop-checks",
    "loop-accept-next",
    "checker-review",
  ].includes(positional[0] ?? "");
  const verifyTargetContext =
    positional[0] === "verify" && parsed.designFingerprint === undefined;
  if (
    (parsed.targetRevision !== undefined ||
      parsed.designFingerprint !== undefined) &&
    !targetContextCommand &&
    !verifyTargetContext
  ) {
    const invalid = invocationError(
      "--target-revision and --design-fingerprint are supported only by loop-bind, loop-checks, loop-accept-next, and checker-review.",
    );
    process.stdout.write(
      `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
    );
    return 2;
  }
  if (parsed.repair === true && positional[0] !== "loop-accept-next") {
    const invalid = invocationError(
      "--repair is supported only by loop-accept-next.",
    );
    process.stdout.write(
      `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
    );
    return 2;
  }

  if (
    positional.length === 3 &&
    positional[0] === "benchmark-prepare" &&
    parsed.benchmarkRunId !== undefined &&
    parsed.benchmarkComparisonId !== undefined &&
    parsed.benchmarkMode !== undefined &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.checkRecordPath === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined &&
    parsed.cwd === undefined &&
    parsed.targetRevision === undefined &&
    parsed.designFingerprint === undefined &&
    parsed.repair !== true
  ) {
    if (!isBenchmarkMode(parsed.benchmarkMode)) {
      const invalid = invocationError(
        `${parsed.benchmarkMode} is not a valid benchmark mode; use treatment or control.`,
      );
      process.stdout.write(
        `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
      );
      return 2;
    }
    const prepared = await prepareBenchmarkRun(
      positional[1] ?? "",
      positional[2] ?? "",
      {
        runId: parsed.benchmarkRunId,
        comparisonId: parsed.benchmarkComparisonId,
        mode: parsed.benchmarkMode,
      },
    );
    process.stdout.write(
      `${json ? JSON.stringify(prepared, null, 2) : formatBenchmarkRunHuman(prepared)}\n`,
    );
    return exitCode(prepared);
  }

  if (positional[0] === "benchmark-trajectory") {
    return runBenchmarkTrajectory(positional, parsed);
  }

  if (
    positional.length === 2 &&
    positional[0] === "benchmark-freeze" &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.checkRecordPath === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined &&
    parsed.cwd === undefined &&
    parsed.targetRevision === undefined &&
    parsed.designFingerprint === undefined &&
    parsed.benchmarkRunId === undefined &&
    parsed.benchmarkComparisonId === undefined &&
    parsed.benchmarkMode === undefined &&
    parsed.benchmarkTrajectoryEntryPath === undefined &&
    parsed.benchmarkTrajectoryStatus !== true &&
    parsed.repair !== true
  ) {
    const frozen = await freezeBenchmarkCapture(positional[1] ?? "");
    process.stdout.write(
      `${json ? JSON.stringify(frozen, null, 2) : formatFreezeHuman(frozen)}\n`,
    );
    return exitCode(frozen);
  }

  if (
    positional.length === 3 &&
    positional[0] === "benchmark-judge" &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.checkRecordPath === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined &&
    parsed.cwd === undefined &&
    parsed.targetRevision === undefined &&
    parsed.designFingerprint === undefined &&
    parsed.benchmarkRunId === undefined &&
    parsed.benchmarkComparisonId === undefined &&
    parsed.benchmarkMode === undefined &&
    parsed.benchmarkTrajectoryEntryPath === undefined &&
    parsed.benchmarkTrajectoryStatus !== true &&
    parsed.repair !== true
  ) {
    const scored = await aggregateBenchmarkJudgeReviews(
      positional[1] ?? "",
      positional[2] ?? "",
    );
    process.stdout.write(
      `${json ? JSON.stringify(scored, null, 2) : formatJudgeHuman(scored)}\n`,
    );
    return exitCode(scored);
  }

  if (
    positional.length === 2 &&
    positional[0] === "benchmark-verdict" &&
    parsed.benchmarkBundleDirectory !== undefined &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.checkRecordPath === undefined &&
    parsed.verificationRecordPath === undefined &&
    parsed.cwd === undefined &&
    parsed.targetRevision === undefined &&
    parsed.designFingerprint === undefined &&
    parsed.benchmarkRunId === undefined &&
    parsed.benchmarkComparisonId === undefined &&
    parsed.benchmarkMode === undefined &&
    parsed.benchmarkTrajectoryEntryPath === undefined &&
    parsed.benchmarkTrajectoryStatus !== true &&
    parsed.repair !== true
  ) {
    const assembled = await assembleBenchmarkVerdict(positional[1] ?? "", {
      bundleDirectory: parsed.benchmarkBundleDirectory,
      ...(parsed.benchmarkAdjudicationFile === undefined
        ? {}
        : { adjudicationFile: parsed.benchmarkAdjudicationFile }),
      ...(parsed.recordPath === undefined
        ? {}
        : { recordFile: parsed.recordPath }),
    });
    process.stdout.write(
      `${json ? JSON.stringify(assembled, null, 2) : formatVerdictHuman(assembled)}\n`,
    );
    return exitCode(assembled);
  }

  if (
    positional.length === 3 &&
    positional[0] === "benchmark-compare" &&
    parsed.benchmarkBundleDirectory === undefined &&
    parsed.benchmarkAdjudicationFile === undefined &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.checkRecordPath === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined &&
    parsed.cwd === undefined &&
    parsed.targetRevision === undefined &&
    parsed.designFingerprint === undefined &&
    parsed.benchmarkRunId === undefined &&
    parsed.benchmarkComparisonId === undefined &&
    parsed.benchmarkMode === undefined &&
    parsed.benchmarkTrajectoryEntryPath === undefined &&
    parsed.benchmarkTrajectoryStatus !== true &&
    parsed.repair !== true
  ) {
    const compared = await compareBenchmarkVerdicts(
      positional[1] ?? "",
      positional[2] ?? "",
    );
    process.stdout.write(
      `${json ? JSON.stringify(compared, null, 2) : formatCompareHuman(compared)}\n`,
    );
    return exitCode(compared);
  }

  if (
    positional.length === 2 &&
    positional[0] === "validate" &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined
  ) {
    const validation = await validateBundle(positional[1] ?? "");
    process.stdout.write(
      `${json ? JSON.stringify(validation, null, 2) : formatValidationHuman(validation)}\n`,
    );
    return exitCode(validation);
  }

  if (
    positional.length === 3 &&
    positional[0] === "advance" &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.recordPath === undefined
  ) {
    if (!isStage(positional[2])) {
      const invalid = invocationError(
        `${String(positional[2])} is not a valid lifecycle target stage.`,
      );
      process.stdout.write(
        `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
      );
      return 2;
    }
    const advance = await advanceBundle(positional[1] ?? "", positional[2], {
      ...(parsed.verificationRecordPath === undefined
        ? {}
        : { verificationRecordPath: parsed.verificationRecordPath }),
    });
    process.stdout.write(
      `${json ? JSON.stringify(advance, null, 2) : formatAdvanceHuman(advance)}\n`,
    );
    return exitCode(advance);
  }

  if (
    positional.length === 3 &&
    positional[0] === "verify" &&
    parsed.verificationRecordPath === undefined
  ) {
    const options: VerificationOptions = {
      ...(parsed.sourceMappingPath === undefined
        ? {}
        : { sourceMappingPath: parsed.sourceMappingPath }),
      ...(parsed.changedPaths === undefined
        ? {}
        : { changedPaths: parsed.changedPaths }),
      ...(parsed.checkRecordPath === undefined
        ? {}
        : { checkRecordPath: parsed.checkRecordPath }),
      ...(parsed.targetRevision === undefined
        ? {}
        : { targetRevision: parsed.targetRevision }),
      ...(parsed.recordPath === undefined
        ? {}
        : { verificationRecordPath: parsed.recordPath }),
    };
    const verification = await verifyBundle(
      positional[1] ?? "",
      positional[2] ?? "",
      options,
    );
    process.stdout.write(
      `${json ? JSON.stringify(verification, null, 2) : formatVerificationHuman(verification)}\n`,
    );
    return exitCode(verification);
  }

  if (
    positional.length === 2 &&
    positional[0] === "resume" &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined
  ) {
    const resume = await resumeBundle(positional[1] ?? "");
    const output = json ? resume : formatResumeHuman(resume);
    process.stdout.write(
      `${typeof output === "string" ? output : JSON.stringify(output, null, 2)}\n`,
    );
    return exitCode(resume);
  }

  if (
    positional.length === 2 &&
    positional[0] === "lineage" &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined &&
    parsed.cwd === undefined &&
    parsed.targetRevision === undefined &&
    parsed.designFingerprint === undefined &&
    parsed.repair !== true
  ) {
    const lineage = await resolveArchitectureLineage(positional[1] ?? "");
    process.stdout.write(
      `${json ? JSON.stringify(lineage, null, 2) : formatLineageHuman(lineage)}\n`,
    );
    return exitCode(lineage);
  }

  if (
    positional.length === 2 &&
    positional[0] === "current" &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined &&
    parsed.cwd === undefined &&
    parsed.targetRevision === undefined &&
    parsed.designFingerprint === undefined &&
    parsed.repair !== true
  ) {
    const current = await resolveCurrentArchitecture(positional[1] ?? "");
    process.stdout.write(
      `${json ? JSON.stringify(current, null, 2) : formatCurrentArchitectureHuman(current)}\n`,
    );
    return exitCode(current);
  }

  if (
    positional.length === 2 &&
    positional[0] === "loop" &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined
  ) {
    const loop = await evaluateIterationLoop(positional[1] ?? "");
    process.stdout.write(
      `${json ? JSON.stringify(loop, null, 2) : formatLoopHuman(loop)}\n`,
    );
    return exitCode(loop);
  }

  if (
    positional.length === 2 &&
    positional[0] === "loop-bind" &&
    parsed.cwd === undefined &&
    parsed.repair !== true &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined
  ) {
    const loop = await bindIterationContext(positional[1] ?? "", {
      targetRevision: parsed.targetRevision ?? "",
      designFingerprint: parsed.designFingerprint ?? "",
    });
    process.stdout.write(
      `${json ? JSON.stringify(loop, null, 2) : formatLoopHuman(loop)}\n`,
    );
    return exitCode(loop);
  }

  if (
    positional.length === 2 &&
    positional[0] === "loop-accept-next" &&
    parsed.cwd === undefined &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined
  ) {
    const loop = await acceptNextIteration(positional[1] ?? "", {
      ...(parsed.repair === true ? { repair: true } : {}),
      context: {
        targetRevision: parsed.targetRevision ?? "",
        designFingerprint: parsed.designFingerprint ?? "",
      },
    });
    process.stdout.write(
      `${json ? JSON.stringify(loop, null, 2) : formatLoopHuman(loop)}\n`,
    );
    return exitCode(loop);
  }

  if (
    positional.length === 3 &&
    positional[0] === "loop-complete" &&
    parsed.cwd === undefined &&
    parsed.repair !== true &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined
  ) {
    const loop = await completeIterationLoop(
      positional[1] ?? "",
      positional[2] ?? "",
    );
    process.stdout.write(
      `${json ? JSON.stringify(loop, null, 2) : formatLoopHuman(loop)}\n`,
    );
    return exitCode(loop);
  }

  if (
    positional.length === 2 &&
    positional[0] === "loop-checks" &&
    parsed.cwd !== undefined &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined
  ) {
    const checks = await runIterationChecks(positional[1] ?? "", parsed.cwd, {
      targetRevision: parsed.targetRevision ?? "",
      designFingerprint: parsed.designFingerprint ?? "",
    });
    const output =
      json && checks.outcome !== undefined ? checks.outcome : checks;
    process.stdout.write(
      `${json ? JSON.stringify(output, null, 2) : formatChecksHuman(checks)}\n`,
    );
    return exitCode(checks);
  }

  if (
    positional.length === 3 &&
    positional[0] === "loop-record" &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined
  ) {
    const loop = await recordIterationOutcome(
      positional[1] ?? "",
      positional[2] ?? "",
    );
    process.stdout.write(
      `${json ? JSON.stringify(loop, null, 2) : formatLoopHuman(loop)}\n`,
    );
    return exitCode(loop);
  }

  if (
    positional.length === 2 &&
    positional[0] === "checker-review" &&
    parsed.cwd === undefined &&
    parsed.repair !== true &&
    parsed.sourceMappingPath === undefined &&
    parsed.changedPaths === undefined &&
    parsed.recordPath === undefined &&
    parsed.verificationRecordPath === undefined
  ) {
    const review = await validateCheckerReview(positional[1] ?? "", {
      ...(parsed.targetRevision === undefined
        ? {}
        : { targetRevision: parsed.targetRevision }),
      ...(parsed.designFingerprint === undefined
        ? {}
        : { designFingerprint: parsed.designFingerprint }),
    });
    process.stdout.write(
      `${json ? JSON.stringify(review, null, 2) : formatCheckerReviewHuman(review)}\n`,
    );
    return exitCode(review);
  }

  const invalid = invocationError(
    "The command and arguments do not match a supported invocation.",
  );
  process.stdout.write(
    `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
  );
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
