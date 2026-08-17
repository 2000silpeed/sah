#!/usr/bin/env node

import { resolve } from "node:path";

import type { SahDiagnostic, ValidationResult } from "./contracts.js";
import { result } from "./diagnostics.js";
import { validateBundle } from "./model-repository.js";

const usage = "Usage: sah validate <design-bundle-directory> [--json]";

function invocationError(message: string): ValidationResult {
  const diagnostic: SahDiagnostic = {
    code: "CLI_INVALID_INVOCATION",
    category: "operational",
    capability: "CLI invocation",
    severity: "error",
    message,
    expected: usage,
    repair:
      "Invoke validate with exactly one bundle directory and optional --json.",
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

export function formatHuman(validation: ValidationResult): string {
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

function exitCode(validation: ValidationResult): 0 | 1 | 2 {
  switch (validation.status) {
    case "passed":
      return 0;
    case "violations":
      return 1;
    case "operational-error":
      return 2;
  }
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

  const validation =
    positional.length === 2 && positional[0] === "validate"
      ? await validateBundle(positional[1] ?? "")
      : invocationError(
          "The command requires validate and one design-bundle directory.",
        );
  process.stdout.write(
    `${json ? JSON.stringify(validation, null, 2) : formatHuman(validation)}\n`,
  );
  return exitCode(validation);
}

process.exitCode = await main(process.argv.slice(2));
