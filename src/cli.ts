#!/usr/bin/env node

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
  type IterationLoopResult,
} from "./contracts.js";
import { result } from "./diagnostics.js";
import {
  advanceBundle,
  validateBundle,
  verifyBundle,
  resumeBundle,
} from "./model-repository.js";
import {
  evaluateIterationLoop,
  recordIterationOutcome,
} from "./iteration-loop.js";

const usage = [
  "Usage: sah validate <design-bundle-directory> [--json]",
  "       sah advance <design-bundle-directory> <target-stage> [--verification-record <bundle-relative-record>] [--json]",
  "       sah verify <design-bundle-directory> <target-directory> [--mapping <target-relative-mapping-file>] [--changed <target-relative-file>]... [--record <bundle-relative-record>] [--json]",
  "       sah resume <design-bundle-directory> [--json]",
  "       sah loop <sah.loop.json> [--json]",
  "       sah loop-record <sah.loop.json> <iteration-outcome.json> [--json]",
].join("\n");

type ParsedArguments = {
  positional: string[];
  json: boolean;
  sourceMappingPath?: string;
  changedPaths?: string[];
  recordPath?: string;
  verificationRecordPath?: string;
  error?: string;
};

function parseArguments(arguments_: string[]): ParsedArguments {
  const positional: string[] = [];
  let json = false;
  let sourceMappingPath: string | undefined;
  let recordPath: string | undefined;
  let verificationRecordPath: string | undefined;
  const changedPaths: string[] = [];
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--json") {
      if (json)
        return { positional, json, error: "--json may be supplied only once." };
      json = true;
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
    ...(recordPath === undefined ? {} : { recordPath }),
    ...(verificationRecordPath === undefined ? {} : { verificationRecordPath }),
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
    | IterationLoopResult,
): 0 | 1 | 2 {
  switch (outcome.status) {
    case "passed":
    case "advanced":
    case "ready":
      return 0;
    case "escalate":
      return 1;
    case "violations":
    case "blocked":
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
          : "SAH iteration loop could not run";
  return [
    title,
    ...(loop.loopId === undefined ? [] : [`Loop: ${loop.loopId}`]),
    ...(loop.route === undefined ? [] : [`Route: ${loop.route}`]),
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
    ...(loop.nextTask === undefined
      ? []
      : [`Next task: ${loop.nextTask.goal}`]),
    ...(loop.learningSourceIterationId === undefined
      ? []
      : [`Learned from: ${loop.learningSourceIterationId}`]),
    ...loop.diagnostics.map(humanDiagnostic),
    `Summary: ${loop.summary.errors} error(s), ${loop.summary.warnings} warning(s)`,
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

function isStage(value: string | undefined): value is Stage {
  return value !== undefined && (stages as readonly string[]).includes(value);
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

  const invalid = invocationError(
    "The command and arguments do not match a supported invocation.",
  );
  process.stdout.write(
    `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
  );
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
