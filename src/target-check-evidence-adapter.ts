import { constants } from "node:fs";
import { access, lstat, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { IterationOutcome, SahDiagnostic } from "./contracts.js";
import type {
  CodeFactAdapter,
  FactAdapterOutcome,
  FactAdapterRequest,
  ObservableContract,
} from "./code-fact-adapter.js";
import type { SchemaRegistry } from "./schema-validation.js";

export const targetCheckEvidenceCapability = "target-check-evidence";
const iterationOutcomeSchemaId =
  "https://sah.dev/schemas/iteration-outcome/v0.4.0";

type AdapterPreparation =
  | { ok: true; adapter: CodeFactAdapter; recordPath: string }
  | { ok: false; diagnostics: SahDiagnostic[]; recordPath: string };

type CheckResult = IterationOutcome["checkResults"][number];

function isWithin(root: string, target: string): boolean {
  const fromRoot = relative(root, target);
  return (
    fromRoot === "" ||
    (fromRoot !== ".." &&
      !fromRoot.startsWith(`..${sep}`) &&
      !isAbsolute(fromRoot))
  );
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f))
      return true;
  }
  return false;
}

function isSafeRelativeJsonPath(value: string): boolean {
  const segments = value.split("/");
  return (
    value.trim() !== "" &&
    value.endsWith(".json") &&
    !isAbsolute(value) &&
    !/^[A-Za-z]:/u.test(value) &&
    !value.includes("\\") &&
    !hasControlCharacter(value) &&
    !segments.some((segment) => ["", ".", ".."].includes(segment))
  );
}

function diagnostic(input: {
  code: string;
  artifactPath: string;
  message: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: "operational",
    capability: "Target-check evidence record",
    classification: "deterministic",
    severity: "error",
    artifactPath: input.artifactPath,
    message: input.message,
    expected: input.expected,
    repair: input.repair,
  };
}

async function confinedRegularFile(
  targetRoot: string,
  relativePath: string,
): Promise<string> {
  let current = targetRoot;
  for (const segment of relativePath.split("/")) {
    const next = resolve(current, segment);
    if (!isWithin(targetRoot, next))
      throw new Error(`${relativePath} resolves outside the target root.`);
    const entry = await lstat(next);
    if (entry.isSymbolicLink())
      throw new Error(`${relativePath} crosses a symbolic link.`);
    current = next;
  }
  const physical = await realpath(current);
  if (!isWithin(targetRoot, physical))
    throw new Error(`${relativePath} resolves outside the target root.`);
  if (!(await stat(physical)).isFile())
    throw new Error(`${relativePath} is not a regular file.`);
  await access(physical, constants.R_OK);
  return physical;
}

async function observedContext(
  outcome: IterationOutcome,
  targetRevision: string,
  designFingerprint: string,
  targetRoot: string,
): Promise<string[]> {
  const issues: string[] = [];
  if (outcome.evidence.workContext.targetRevision !== targetRevision)
    issues.push(
      `target revision ${outcome.evidence.workContext.targetRevision} does not match ${targetRevision}`,
    );
  if (outcome.evidence.workContext.designFingerprint !== designFingerprint)
    issues.push(
      `design fingerprint ${outcome.evidence.workContext.designFingerprint} does not match ${designFingerprint}`,
    );
  let recordedCwd = resolve(outcome.evidence.cwd);
  try {
    recordedCwd = await realpath(recordedCwd);
  } catch {
    // The explicit target root has already been validated; a missing recorded cwd is a mismatch.
  }
  if (recordedCwd !== targetRoot)
    issues.push(
      `evidence cwd ${outcome.evidence.cwd} does not match ${targetRoot}`,
    );
  for (const check of outcome.checkResults) {
    if (check.cwd !== outcome.evidence.cwd)
      issues.push(`check ${check.checkId} cwd differs from evidence cwd`);
  }
  return issues;
}

function unsupported(
  code: string,
  message: string,
  expected: string,
  observed: string,
  repair: string,
): FactAdapterOutcome {
  return {
    kind: "unsupported",
    code,
    message,
    expected,
    observed,
    repair,
  };
}

function unsupportedSelector(
  observable: ObservableContract,
): FactAdapterOutcome | undefined {
  if (
    observable.factSource !== "iteration-check-record" ||
    observable.predicate !== "required-check-passed" ||
    observable.expected !== "true"
  ) {
    return unsupported(
      "TARGET_CHECK_BINDING_UNSUPPORTED",
      `The target-check adapter cannot evaluate ${observable.factSource}/${observable.predicate}/${observable.expected}.`,
      "factSource iteration-check-record, predicate required-check-passed, and expected true",
      `${observable.factSource}/${observable.predicate}/${observable.expected}`,
      "Compile this constraint to the supported target-check tuple in S11 or provide a matching adapter.",
    );
  }
  if (observable.selector.trim() === "") {
    return unsupported(
      "TARGET_CHECK_SELECTOR_UNSUPPORTED",
      "The target-check adapter requires a non-empty declared check ID selector.",
      "a non-empty iteration check ID",
      observable.selector,
      "Set observable.selector to the exact check ID emitted by sah loop-checks.",
    );
  }
  return undefined;
}

class TargetCheckEvidenceAdapter implements CodeFactAdapter {
  readonly capability = targetCheckEvidenceCapability;

  private readonly checksById: Map<string, CheckResult>;
  private readonly duplicateCheckIds: Set<string>;
  private readonly contextIssues: string[];

  constructor(outcome: IterationOutcome, contextIssues: string[]) {
    this.checksById = new Map();
    this.duplicateCheckIds = new Set();
    for (const check of outcome.checkResults) {
      if (this.checksById.has(check.checkId))
        this.duplicateCheckIds.add(check.checkId);
      else this.checksById.set(check.checkId, check);
    }
    this.contextIssues = contextIssues;
  }

  async observe({
    observable,
  }: FactAdapterRequest): Promise<FactAdapterOutcome> {
    await Promise.resolve();
    const unsupportedBinding = unsupportedSelector(observable);
    if (unsupportedBinding !== undefined) return unsupportedBinding;

    if (this.contextIssues.length > 0) {
      return unsupported(
        "TARGET_CHECK_CONTEXT_MISMATCH",
        "The target-check evidence is stale or was collected in a different execution context.",
        "target revision, design fingerprint, and target cwd to match the explicit verification context",
        this.contextIssues.join("; "),
        "Run the declared check again with sah loop-checks for the current target revision, bundle fingerprint, and target root.",
      );
    }

    const checkId = observable.selector;
    if (this.duplicateCheckIds.has(checkId)) {
      return unsupported(
        "TARGET_CHECK_ID_AMBIGUOUS",
        `The target-check evidence contains duplicate results for check ${checkId}.`,
        "one result for the selected check ID",
        checkId,
        "Record one schema-valid result per declared check ID.",
      );
    }
    const check = this.checksById.get(checkId);
    if (check === undefined) {
      return unsupported(
        "TARGET_CHECK_ID_UNKNOWN",
        `The target-check evidence does not contain declared check ${checkId}.`,
        "the selected check ID to exist in checkResults",
        checkId,
        "Run the declared check with sah loop-checks and use its exact check ID.",
      );
    }
    if (check.status === "passed" && check.exitCode === 0) {
      return {
        kind: "observed",
        matches: true,
        observed: `check ${checkId} passed with exit code 0 (${check.command})`,
      };
    }
    if (
      check.status === "failed" &&
      check.exitCode !== null &&
      check.exitCode !== 0
    ) {
      return {
        kind: "observed",
        matches: false,
        observed: `check ${checkId} failed with exit code ${String(check.exitCode)} (${check.command})`,
      };
    }
    if (check.status === "incomplete") {
      return unsupported(
        "TARGET_CHECK_INCOMPLETE",
        `The target check ${checkId} has incomplete execution evidence.`,
        "a completed check with status passed or failed and a concrete exit code",
        `${check.status}/${String(check.exitCode)}`,
        "Run the check again and preserve the complete sah-loop-checks outcome.",
      );
    }
    return unsupported(
      "TARGET_CHECK_STATUS_EXIT_MISMATCH",
      `The target check ${checkId} has inconsistent status and exit-code evidence.`,
      "passed with exit code 0 or failed with a non-zero exit code",
      `${check.status}/${String(check.exitCode)}`,
      "Preserve the exact status and exit code emitted by sah loop-checks.",
    );
  }
}

export async function prepareTargetCheckEvidenceAdapter(input: {
  targetRoot: string;
  checkRecordPath: string;
  targetRevision?: string;
  designFingerprint: string;
  registry: SchemaRegistry;
}): Promise<AdapterPreparation> {
  const recordPath = input.checkRecordPath;
  if (!isSafeRelativeJsonPath(recordPath)) {
    return {
      ok: false,
      recordPath,
      diagnostics: [
        diagnostic({
          code: "TARGET_CHECK_RECORD_PATH_UNSAFE",
          artifactPath: recordPath,
          message: `Check record path ${JSON.stringify(recordPath)} is not a confined target-relative JSON path.`,
          expected:
            "a forward-slash relative JSON path inside the explicit target root",
          repair:
            "Pass a target-relative .json path with no traversal, absolute, control, or backslash segment.",
        }),
      ],
    };
  }
  if (
    input.targetRevision === undefined ||
    input.targetRevision.trim() === ""
  ) {
    return {
      ok: false,
      recordPath,
      diagnostics: [
        diagnostic({
          code: "TARGET_CHECK_REVISION_REQUIRED",
          artifactPath: recordPath,
          message:
            "A target revision is required when target-check evidence is supplied.",
          expected: "an explicit non-empty --target-revision value",
          repair:
            "Bind the check record to the caller-supplied target revision and rerun verification.",
        }),
      ],
    };
  }

  let physicalPath: string;
  let source: string;
  try {
    physicalPath = await confinedRegularFile(input.targetRoot, recordPath);
    source = await readFile(physicalPath, "utf8");
  } catch (error) {
    return {
      ok: false,
      recordPath,
      diagnostics: [
        diagnostic({
          code: "TARGET_CHECK_RECORD_UNREADABLE",
          artifactPath: recordPath,
          message:
            error instanceof Error
              ? error.message
              : `Cannot read target-check evidence ${recordPath}.`,
          expected:
            "a readable non-symlink regular iteration-outcome file inside the target",
          repair:
            "Restore the outcome file or pass a safe target-relative check-record path.",
        }),
      ],
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(source) as unknown;
  } catch (error) {
    return {
      ok: false,
      recordPath,
      diagnostics: [
        diagnostic({
          code: "TARGET_CHECK_RECORD_MALFORMED",
          artifactPath: recordPath,
          message:
            error instanceof Error
              ? error.message
              : `Cannot parse target-check evidence ${recordPath}.`,
          expected: "well-formed iteration-outcome JSON",
          repair:
            "Regenerate the evidence with sah loop-checks instead of hand-writing a pass.",
        }),
      ],
    };
  }

  const schemaDiagnostics = input.registry.validate(
    iterationOutcomeSchemaId,
    data,
    recordPath,
    "operational",
  );
  if (schemaDiagnostics.length > 0)
    return {
      ok: false,
      recordPath,
      diagnostics: schemaDiagnostics.map((item) => ({
        ...item,
        capability: "Target-check evidence record",
        repair:
          "Regenerate the evidence with sah loop-checks so it matches the iteration-outcome schema.",
      })),
    };

  const contextIssues = await observedContext(
    data as IterationOutcome,
    input.targetRevision,
    input.designFingerprint,
    input.targetRoot,
  );
  return {
    ok: true,
    recordPath,
    adapter: new TargetCheckEvidenceAdapter(
      data as IterationOutcome,
      contextIssues,
    ),
  };
}
