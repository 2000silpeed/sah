#!/usr/bin/env node

import { resolve } from "node:path";

import {
  stages,
  type AdvanceResult,
  type SahDiagnostic,
  type Stage,
  type ValidationResult,
} from "./contracts.js";
import { result } from "./diagnostics.js";
import { advanceBundle, validateBundle } from "./model-repository.js";

const usage = [
  "Usage: sah validate <design-bundle-directory> [--json]",
  "       sah advance <design-bundle-directory> <target-stage> [--json]",
].join("\n");

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

function exitCode(outcome: ValidationResult | AdvanceResult): 0 | 1 | 2 {
  switch (outcome.status) {
    case "passed":
    case "advanced":
      return 0;
    case "violations":
    case "blocked":
      return 1;
    case "operational-error":
      return 2;
  }
}

function isStage(value: string | undefined): value is Stage {
  return value !== undefined && (stages as readonly string[]).includes(value);
}

async function main(arguments_: string[]): Promise<number> {
  const json = arguments_.includes("--json");
  const positional = arguments_.filter((argument) => argument !== "--json");
  if (
    positional.length === 1 &&
    ["--help", "-h"].includes(positional[0] ?? "")
  ) {
    process.stdout.write(`${usage}\n`);
    return 0;
  }

  if (positional.length === 2 && positional[0] === "validate") {
    const validation = await validateBundle(positional[1] ?? "");
    process.stdout.write(
      `${json ? JSON.stringify(validation, null, 2) : formatValidationHuman(validation)}\n`,
    );
    return exitCode(validation);
  }

  if (positional.length === 3 && positional[0] === "advance") {
    if (!isStage(positional[2])) {
      const invalid = invocationError(
        `${String(positional[2])} is not a valid lifecycle target stage.`,
      );
      process.stdout.write(
        `${json ? JSON.stringify(invalid, null, 2) : formatValidationHuman(invalid)}\n`,
      );
      return 2;
    }
    const advance = await advanceBundle(positional[1] ?? "", positional[2]);
    process.stdout.write(
      `${json ? JSON.stringify(advance, null, 2) : formatAdvanceHuman(advance)}\n`,
    );
    return exitCode(advance);
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
