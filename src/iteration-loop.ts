import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  chmod,
  lstat,
  open,
  readFile,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import type {
  IterationCheckContract,
  IterationCompletion,
  IterationCompletionRequest,
  IterationContextOptions,
  IterationEvidenceContext,
  IterationLoopResult,
  IterationChecksResult,
  IterationOutcome,
  IterationTaskContract,
  IterationWorkContext,
  LoopRoute,
  SahDiagnostic,
} from "./contracts.js";
import { summarize } from "./diagnostics.js";
import { loadSchemaRegistry } from "./schema-validation.js";

const loopSchemaId = "https://sah.dev/schemas/iteration-loop/v0.4.0";
const outcomeSchemaId = "https://sah.dev/schemas/iteration-outcome/v0.4.0";
const completionSchemaId =
  "https://sah.dev/schemas/iteration-completion/v0.2.0";
const iterationRunnerVersion = "0.1.0";

type RiskSignal =
  | "local-reversible"
  | "cross-boundary"
  | "critical-invariant"
  | "data-migration"
  | "security-privacy"
  | "external-consistency"
  | "repeated-failure"
  | "unknown";

type LoopModel = {
  $schema: typeof loopSchemaId;
  loopVersion: "0.4.0";
  loopId: string;
  status: "active" | "blocked" | "completed";
  workContext: IterationWorkContext;
  direction: {
    goal: string;
    successCriteria: Array<{ id: string; description: string }>;
  };
  policy: {
    defaultRoute: LoopRoute;
    rules: Array<{
      id: string;
      signal: RiskSignal;
      route: LoopRoute;
      trigger: string;
    }>;
  };
  currentIteration: {
    id: string;
    goal: string;
    status: "planned" | "in-progress" | "completed" | "blocked";
    riskSignals: RiskSignal[];
    taskContract: IterationTaskContract;
    checks: IterationCheckContract[];
  };
  completion: IterationCompletion;
  outcomes: IterationOutcome[];
};

type LoopCheck = LoopModel["currentIteration"]["checks"][number];

type CapturedCommand = {
  status: "passed" | "failed" | "incomplete";
  exitCode: number | null;
  startedAt: string;
  finishedAt: string;
  stdoutDigest: string;
  stderrDigest: string;
  observed?: string;
};

type LoadedJson<T> = {
  path: string;
  source: Uint8Array;
  mode: number;
  data: T;
};

function diagnostic(input: {
  code: string;
  path: string;
  message: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: "operational",
    capability: "Iteration loop artifact",
    severity: "error",
    artifactPath: input.path,
    message: input.message,
    expected: input.expected,
    repair: input.repair,
  };
}

function hashDigest(hash: ReturnType<typeof createHash>): string {
  return `sha256:${hash.digest("hex")}`;
}

function appendSnippet(current: string, chunk: string): string {
  const limit = 2000;
  if (current.length >= limit) return current;
  return `${current}${chunk}`.slice(0, limit);
}

function runCommand(command: string, cwd: string): Promise<CapturedCommand> {
  const startedAt = new Date().toISOString();
  const stdoutHash = createHash("sha256");
  const stderrHash = createHash("sha256");
  let stdoutSnippet = "";
  let stderrSnippet = "";

  return new Promise((resolveCommand) => {
    let settled = false;
    const finish = (input: {
      exitCode: number | null;
      status: CapturedCommand["status"];
      observed?: string;
    }): void => {
      if (settled) return;
      settled = true;
      resolveCommand({
        status: input.status,
        exitCode: input.exitCode,
        startedAt,
        finishedAt: new Date().toISOString(),
        stdoutDigest: hashDigest(stdoutHash),
        stderrDigest: hashDigest(stderrHash),
        ...(input.observed === undefined ? {} : { observed: input.observed }),
      });
    };

    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stdoutHash.update(text);
      stdoutSnippet = appendSnippet(stdoutSnippet, text);
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stderrHash.update(text);
      stderrSnippet = appendSnippet(stderrSnippet, text);
    });
    child.once("error", (error: Error) => {
      finish({
        exitCode: null,
        status: "incomplete",
        observed: error.message,
      });
    });
    child.once("close", (exitCode, signal) => {
      const observed = [
        stdoutSnippet.length === 0 ? undefined : `stdout: ${stdoutSnippet}`,
        stderrSnippet.length === 0 ? undefined : `stderr: ${stderrSnippet}`,
        signal === null ? undefined : `signal: ${signal}`,
      ]
        .filter((value): value is string => value !== undefined)
        .join("\n");
      finish({
        exitCode,
        status:
          exitCode === null
            ? "incomplete"
            : exitCode === 0
              ? "passed"
              : "failed",
        ...(observed.length === 0 ? {} : { observed }),
      });
    });
  });
}

function checksResult(
  status: IterationChecksResult["status"],
  loopFile: string,
  diagnostics: SahDiagnostic[],
  outcome?: IterationOutcome,
): IterationChecksResult {
  const ordered = [...diagnostics].sort((left, right) =>
    [left.artifactPath ?? "", left.code, left.message]
      .join("\0")
      .localeCompare(
        [right.artifactPath ?? "", right.code, right.message].join("\0"),
      ),
  );
  return {
    status,
    loopFile,
    ...(outcome === undefined ? {} : { outcome }),
    diagnostics: ordered,
    summary: summarize(ordered),
  };
}

function result(
  operation: IterationLoopResult["operation"],
  status: IterationLoopResult["status"],
  loopFile: string,
  diagnostics: SahDiagnostic[],
  fields: Partial<
    Omit<
      IterationLoopResult,
      "operation" | "status" | "loopFile" | "diagnostics" | "summary"
    >
  > = {},
): IterationLoopResult {
  const ordered = [...diagnostics].sort((left, right) =>
    [left.artifactPath ?? "", left.code, left.message]
      .join("\0")
      .localeCompare(
        [right.artifactPath ?? "", right.code, right.message].join("\0"),
      ),
  );
  return {
    $schema: "https://sah.dev/schemas/iteration-loop-result/v0.3.0",
    resultVersion: "0.3.0",
    operation,
    status,
    loopFile,
    ...fields,
    escalation: fields.escalation ?? {
      triggered: false,
      ruleRefs: [],
      reasons: [],
    },
    diagnostics: ordered,
    summary: summarize(ordered),
  };
}

async function readJson<T>(
  file: string,
  schemaId: string,
  artifactName: string,
): Promise<
  | { ok: true; loaded: LoadedJson<T> }
  | { ok: false; diagnostics: SahDiagnostic[] }
> {
  const path = resolve(file);
  try {
    const lexical = await lstat(path);
    if (lexical.isSymbolicLink() || !lexical.isFile())
      throw new Error(`${artifactName} is not a regular local file.`);
    const source = await readFile(path);
    const parsed = JSON.parse(source.toString("utf8")) as unknown;
    const registryResult = await loadSchemaRegistry();
    if (!registryResult.ok)
      return { ok: false, diagnostics: registryResult.diagnostics };
    const diagnostics = registryResult.registry.validate(
      schemaId,
      parsed,
      file,
      "operational",
    );
    if (diagnostics.length > 0) return { ok: false, diagnostics };
    const fileStats = await stat(path);
    return {
      ok: true,
      loaded: {
        path,
        source,
        mode: fileStats.mode,
        data: parsed as T,
      },
    };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        diagnostic({
          code: "ITERATION_ARTIFACT_UNREADABLE",
          path: file,
          message:
            error instanceof Error ? error.message : `Cannot read ${file}.`,
          expected: `a schema-valid ${artifactName}`,
          repair: `Repair ${file} and retry the iteration command.`,
        }),
      ],
    };
  }
}

function routeRank(route: LoopRoute): number {
  return route === "blocked" ? 3 : route === "reasoning" ? 2 : 1;
}

function evidenceContext(loop: LoopModel): IterationEvidenceContext {
  return {
    targetRevision: loop.workContext.targetRevision,
    designFingerprint: loop.workContext.designFingerprint,
  };
}

function contextMatches(
  left: IterationEvidenceContext,
  right: IterationEvidenceContext,
): boolean {
  return (
    left.targetRevision === right.targetRevision &&
    left.designFingerprint === right.designFingerprint
  );
}

function contextInputDiagnostics(
  context: IterationContextOptions | undefined,
  path: string,
): SahDiagnostic[] {
  const diagnostics: SahDiagnostic[] = [];
  if (
    typeof context?.targetRevision !== "string" ||
    context.targetRevision.trim() === ""
  )
    diagnostics.push(
      diagnostic({
        code: "ITERATION_TARGET_REVISION_MISSING",
        path,
        message: "The target revision binding is empty.",
        expected: "a caller-supplied non-empty target revision",
        repair: "Provide the target revision token from the target workflow.",
      }),
    );
  if (
    typeof context?.designFingerprint !== "string" ||
    context.designFingerprint.trim() === ""
  )
    diagnostics.push(
      diagnostic({
        code: "ITERATION_DESIGN_FINGERPRINT_MISSING",
        path,
        message: "The design-bundle fingerprint binding is empty.",
        expected: "a sha256: design-bundle fingerprint",
        repair: "Use the fingerprint emitted by sah resume or verification.",
      }),
    );
  if (
    context !== undefined &&
    (typeof context.designFingerprint !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(context.designFingerprint))
  )
    diagnostics.push(
      diagnostic({
        code: "ITERATION_DESIGN_FINGERPRINT_INVALID",
        path,
        message:
          "The design-bundle fingerprint is not a lowercase SHA-256 digest.",
        expected: "sha256:<64 lowercase hexadecimal characters>",
        repair:
          "Copy the canonical fingerprint from sah resume or verification output.",
      }),
    );
  if (context === undefined)
    diagnostics.push(
      diagnostic({
        code: "ITERATION_CONTEXT_ARGUMENTS_MISSING",
        path,
        message:
          "No explicit target revision and design fingerprint were supplied.",
        expected: "targetRevision and designFingerprint context arguments",
        repair:
          "Supply both values from the target workflow and design bundle.",
      }),
    );
  return diagnostics;
}

function targetRootDiagnostics(
  loop: LoopModel,
  cwd: string,
  path: string,
): SahDiagnostic[] {
  const expected = resolve(loop.workContext.targetRoot);
  const observed = resolve(cwd);
  return expected === observed
    ? []
    : [
        diagnostic({
          code: "ITERATION_TARGET_ROOT_MISMATCH",
          path,
          message: `The check working directory ${observed} does not match the loop target root ${expected}.`,
          expected,
          repair: "Run the check with --cwd equal to the bound target root.",
        }),
      ];
}

function loopContextDiagnostics(
  loop: LoopModel,
  context: IterationContextOptions | undefined,
  path: string,
): SahDiagnostic[] {
  const diagnostics = contextInputDiagnostics(context, path);
  if (context === undefined) return diagnostics;
  if (context.targetRevision !== loop.workContext.targetRevision)
    diagnostics.push(
      diagnostic({
        code: "ITERATION_TARGET_REVISION_MISMATCH",
        path,
        message: "The supplied target revision differs from the loop binding.",
        expected: loop.workContext.targetRevision,
        repair:
          "Rebind the planned iteration explicitly before executing checks, or use the matching revision.",
      }),
    );
  if (context.designFingerprint !== loop.workContext.designFingerprint)
    diagnostics.push(
      diagnostic({
        code: "ITERATION_DESIGN_FINGERPRINT_MISMATCH",
        path,
        message:
          "The supplied design fingerprint differs from the loop binding.",
        expected: loop.workContext.designFingerprint,
        repair:
          "Use the fingerprint bound to this iteration or run loop-bind for a planned iteration.",
      }),
    );
  return diagnostics;
}

type SelectedLearning = {
  learning: IterationOutcome["learnings"][number];
  sourceIterationId?: string;
};

function learningFromLatestOutcome(
  loop: LoopModel,
): SelectedLearning | undefined {
  const latest = loop.outcomes.at(-1);
  if (latest === undefined || latest.learnings.length === 0) return undefined;
  const priority = { must: 3, should: 2, could: 1 } as const;
  const selected = [...latest.learnings].sort(
    (left, right) => priority[right.priority] - priority[left.priority],
  )[0];
  return selected === undefined
    ? undefined
    : { learning: selected, sourceIterationId: latest.iterationId };
}

function evaluateLoadedLoop(
  loop: LoopModel,
  loopFile: string,
  operation: IterationLoopResult["operation"],
): IterationLoopResult {
  if (loop.status === "completed") {
    return result(operation, "complete", loopFile, [], {
      loopId: loop.loopId,
      route: "complete",
      escalation: { triggered: false, ruleRefs: [], reasons: [] },
      currentTask: loop.currentIteration.taskContract,
      workContext: loop.workContext,
    });
  }

  const current = loop.currentIteration;
  const matches = loop.policy.rules.filter((rule) =>
    current.riskSignals.includes(rule.signal),
  );
  let route = loop.policy.defaultRoute;
  if (current.status === "blocked") route = "blocked";
  for (const rule of matches) {
    if (routeRank(rule.route) > routeRank(route)) route = rule.route;
  }

  const escalation = {
    triggered: route !== "fast",
    ruleRefs: matches
      .filter((rule) => routeRank(rule.route) >= routeRank(route))
      .map((rule) => rule.id),
    reasons: matches
      .filter((rule) => routeRank(rule.route) >= routeRank(route))
      .map((rule) => rule.trigger),
  };
  if (current.status === "blocked") {
    escalation.reasons = [
      "The current iteration is explicitly blocked.",
      ...escalation.reasons,
    ];
  }

  const learning =
    current.status === "completed"
      ? learningFromLatestOutcome(loop)
      : undefined;
  const status =
    route === "fast" ? "ready" : route === "reasoning" ? "escalate" : "blocked";
  const extra =
    current.status === "completed" && learning === undefined
      ? [
          diagnostic({
            code: "ITERATION_NEXT_TASK_MISSING",
            path: loopFile,
            message:
              "The completed iteration has no learning proposal for the next task.",
            expected:
              "the latest outcome to contain at least one learning with nextTask",
            repair:
              "Record an outcome with a bounded nextTask before starting another iteration.",
          }),
        ]
      : [];
  return result(
    operation,
    extra.length > 0 ? "blocked" : status,
    loopFile,
    extra,
    {
      loopId: loop.loopId,
      route: extra.length > 0 ? "blocked" : route,
      escalation:
        extra.length > 0
          ? {
              triggered: true,
              ruleRefs: escalation.ruleRefs,
              reasons: [
                ...escalation.reasons,
                ...extra.map(({ message }) => message),
              ],
            }
          : escalation,
      currentTask: current.taskContract,
      workContext: loop.workContext,
      ...(learning === undefined
        ? {}
        : { nextTask: learning.learning.nextTask }),
      ...(learning?.sourceIterationId === undefined
        ? {}
        : { learningSourceIterationId: learning.sourceIterationId }),
    },
  );
}

export async function evaluateIterationLoop(
  loopFile: string,
): Promise<IterationLoopResult> {
  const loaded = await readJson<LoopModel>(
    loopFile,
    loopSchemaId,
    "iteration loop",
  );
  if (!loaded.ok)
    return result(
      "evaluated",
      "operational-error",
      resolve(loopFile),
      loaded.diagnostics,
    );
  return evaluateLoadedLoop(
    loaded.loaded.data,
    loaded.loaded.path,
    "evaluated",
  );
}

export async function runIterationChecks(
  loopFile: string,
  cwd: string,
  context?: IterationContextOptions,
): Promise<IterationChecksResult> {
  const loaded = await readJson<LoopModel>(
    loopFile,
    loopSchemaId,
    "iteration loop",
  );
  const resolvedLoopFile = resolve(loopFile);
  if (!loaded.ok)
    return checksResult(
      "operational-error",
      resolvedLoopFile,
      loaded.diagnostics,
    );

  const loop = loaded.loaded.data;
  if (loop.status === "completed")
    return checksResult("blocked", loaded.loaded.path, [
      diagnostic({
        code: "ITERATION_CHECKS_LOOP_COMPLETED",
        path: loaded.loaded.path,
        message: "The iteration loop is already product-complete.",
        expected: "an active iteration loop",
        repair: "Create a new loop artifact for a new product direction.",
      }),
    ]);
  if (loop.currentIteration.status === "completed")
    return checksResult("blocked", loaded.loaded.path, [
      diagnostic({
        code: "ITERATION_CHECKS_ALREADY_COMPLETED",
        path: loaded.loaded.path,
        message: "The current iteration already has a completed outcome.",
        expected: "a planned or in-progress current iteration",
        repair: "Start a new iteration before running its checks.",
      }),
    ]);
  if (loop.currentIteration.status === "blocked")
    return checksResult("blocked", loaded.loaded.path, [
      diagnostic({
        code: "ITERATION_CHECKS_BLOCKED_ITERATION",
        path: loaded.loaded.path,
        message: "The current iteration is blocked and cannot run checks.",
        expected: "a planned or in-progress current iteration",
        repair: "Resolve the blocker or start a repair iteration first.",
      }),
    ]);
  if (loop.currentIteration.checks.length === 0)
    return checksResult("incomplete", loaded.loaded.path, [
      diagnostic({
        code: "ITERATION_CHECKS_EMPTY",
        path: loaded.loaded.path,
        message: "The current iteration declares no executable checks.",
        expected: "at least one declared check before recording an outcome",
        repair: "Declare target-owned checks in the current iteration.",
      }),
    ]);

  const contextDiagnostics = [
    ...targetRootDiagnostics(loop, cwd, loaded.loaded.path),
    ...loopContextDiagnostics(loop, context, loaded.loaded.path),
  ];
  if (context === undefined || contextDiagnostics.length > 0)
    return checksResult("blocked", loaded.loaded.path, contextDiagnostics);

  const resolvedCwd = resolve(cwd);
  const boundContext = context;
  const startedAt = new Date().toISOString();
  const checkResults: IterationOutcome["checkResults"] = [];
  for (const check of loop.currentIteration.checks) {
    const execution = await runCommand(check.command, resolvedCwd);
    checkResults.push({
      checkId: check.id,
      status: execution.status,
      command: check.command,
      cwd: resolvedCwd,
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt,
      exitCode: execution.exitCode,
      stdoutDigest: execution.stdoutDigest,
      stderrDigest: execution.stderrDigest,
      ...(execution.observed === undefined
        ? {}
        : { observed: execution.observed }),
    });
  }
  const finishedAt = new Date().toISOString();
  const required = new Set(
    loop.currentIteration.checks
      .filter(({ required: isRequired }) => isRequired)
      .map(({ id }) => id),
  );
  const requiredResults = checkResults.filter(({ checkId }) =>
    required.has(checkId),
  );
  const status = requiredResults.some(
    ({ status: check }) => check === "incomplete",
  )
    ? "partial"
    : requiredResults.some(({ status: check }) => check === "failed")
      ? "failed"
      : "succeeded";
  const outcome: IterationOutcome = {
    $schema: "https://sah.dev/schemas/iteration-outcome/v0.4.0",
    outcomeVersion: "0.4.0",
    iterationId: loop.currentIteration.id,
    status,
    evidence: {
      executor: { name: "sah-loop-checks", version: iterationRunnerVersion },
      cwd: resolvedCwd,
      startedAt,
      finishedAt,
      workContext: {
        targetRevision: boundContext.targetRevision,
        designFingerprint: boundContext.designFingerprint,
      },
    },
    checkResults,
    learnings: [],
  };
  const resultStatus: IterationChecksResult["status"] =
    status === "succeeded"
      ? "passed"
      : status === "failed"
        ? "failed"
        : "incomplete";
  return checksResult(resultStatus, loaded.loaded.path, [], outcome);
}

async function replaceLoopAtomically(input: {
  path: string;
  expectedSource: Uint8Array;
  mode: number;
  data: LoopModel;
}): Promise<SahDiagnostic | undefined> {
  const temporaryPath = `${dirname(input.path)}/.${basename(input.path)}.${process.pid}.${randomUUID()}.tmp`;
  let created = false;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporaryPath, "wx", input.mode & 0o7777);
    created = true;
    await handle.writeFile(`${JSON.stringify(input.data, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    const current = await readFile(input.path);
    if (!current.equals(Buffer.from(input.expectedSource)))
      return diagnostic({
        code: "ITERATION_LOOP_CHANGED_DURING_RECORD",
        path: input.path,
        message:
          "The iteration loop changed while the outcome was being recorded.",
        expected:
          "the loop artifact to remain unchanged until atomic replacement",
        repair: "Re-read the loop, inspect the concurrent outcome, and retry.",
      });
    await chmod(temporaryPath, input.mode & 0o7777);
    await rename(temporaryPath, input.path);
    created = false;
    return undefined;
  } catch (error) {
    return diagnostic({
      code: "ITERATION_LOOP_WRITE_FAILED",
      path: input.path,
      message:
        error instanceof Error
          ? error.message
          : "The loop artifact could not be written.",
      expected: "an atomic same-directory loop artifact replacement",
      repair: "Confirm the loop directory is writable and retry.",
    });
  } finally {
    if (handle !== undefined) await handle.close().catch(() => undefined);
    if (created) await unlink(temporaryPath).catch(() => undefined);
  }
}

function validateOutcomeAgainstLoop(
  loop: LoopModel,
  outcome: IterationOutcome,
  outcomeFile: string,
): SahDiagnostic[] {
  const diagnostics: SahDiagnostic[] = [];
  if (!contextMatches(evidenceContext(loop), outcome.evidence.workContext)) {
    diagnostics.push(
      diagnostic({
        code: "ITERATION_OUTCOME_CONTEXT_MISMATCH",
        path: outcomeFile,
        message:
          "Outcome evidence is bound to a different target revision or design fingerprint than the loop.",
        expected: `${loop.workContext.targetRevision} and ${loop.workContext.designFingerprint}`,
        repair:
          "Run checks with the current loop binding, or bind a planned iteration before recording evidence.",
      }),
    );
  }
  if (resolve(outcome.evidence.cwd) !== resolve(loop.workContext.targetRoot)) {
    diagnostics.push(
      diagnostic({
        code: "ITERATION_OUTCOME_TARGET_ROOT_MISMATCH",
        path: outcomeFile,
        message:
          "Outcome evidence was collected outside the target root bound to the loop.",
        expected: resolve(loop.workContext.targetRoot),
        repair:
          "Run checks from the loop target root and record the new outcome.",
      }),
    );
  }
  if (outcome.evidence.executor.name !== "sah-loop-checks") {
    diagnostics.push(
      diagnostic({
        code: "ITERATION_EVIDENCE_EXECUTOR_UNSUPPORTED",
        path: outcomeFile,
        message: `Evidence executor ${outcome.evidence.executor.name} is not supported.`,
        expected: "evidence generated by sah-loop-checks",
        repair:
          "Run the declared checks with sah loop-checks and record its outcome.",
      }),
    );
  }

  const declaredById = new Map<string, LoopCheck>(
    loop.currentIteration.checks.map((check) => [check.id, check]),
  );
  const seen = new Set<string>();
  for (const checkResult of outcome.checkResults) {
    if (seen.has(checkResult.checkId)) {
      diagnostics.push(
        diagnostic({
          code: "ITERATION_CHECK_RESULT_DUPLICATE",
          path: outcomeFile,
          message: `Check ${checkResult.checkId} appears more than once in the outcome.`,
          expected: "one result per declared check",
          repair:
            "Remove duplicate check results before recording the outcome.",
        }),
      );
      continue;
    }
    seen.add(checkResult.checkId);
    const declared = declaredById.get(checkResult.checkId);
    if (declared === undefined) {
      diagnostics.push(
        diagnostic({
          code: "ITERATION_CHECK_RESULT_UNKNOWN",
          path: outcomeFile,
          message: `Outcome contains undeclared check ${checkResult.checkId}.`,
          expected: "only checks declared by the current iteration",
          repair: "Run or remove the undeclared check and retry recording.",
        }),
      );
      continue;
    }
    if (checkResult.command !== declared.command) {
      diagnostics.push(
        diagnostic({
          code: "ITERATION_CHECK_COMMAND_MISMATCH",
          path: outcomeFile,
          message: `Check ${checkResult.checkId} used a command different from the declaration.`,
          expected: declared.command,
          repair: "Run the exact command declared by the current iteration.",
        }),
      );
    }
    if (checkResult.cwd !== outcome.evidence.cwd) {
      diagnostics.push(
        diagnostic({
          code: "ITERATION_CHECK_CWD_MISMATCH",
          path: outcomeFile,
          message: `Check ${checkResult.checkId} was recorded outside the evidence working directory.`,
          expected: outcome.evidence.cwd,
          repair: "Run all declared checks with one explicit --cwd and retry.",
        }),
      );
    }
    if (checkResult.status === "passed" && checkResult.exitCode !== 0) {
      diagnostics.push(
        diagnostic({
          code: "ITERATION_CHECK_STATUS_EXIT_MISMATCH",
          path: outcomeFile,
          message: `Passed check ${checkResult.checkId} does not have exit code 0.`,
          expected: "status passed with exitCode 0",
          repair: "Record the actual command exit code and status.",
        }),
      );
    }
    if (
      checkResult.status === "failed" &&
      (checkResult.exitCode === null || checkResult.exitCode === 0)
    ) {
      diagnostics.push(
        diagnostic({
          code: "ITERATION_CHECK_STATUS_EXIT_MISMATCH",
          path: outcomeFile,
          message: `Failed check ${checkResult.checkId} does not have a non-zero exit code.`,
          expected: "status failed with a non-zero exitCode",
          repair: "Record the actual command exit code and status.",
        }),
      );
    }
    if (checkResult.status === "incomplete" && checkResult.exitCode !== null) {
      diagnostics.push(
        diagnostic({
          code: "ITERATION_CHECK_STATUS_EXIT_MISMATCH",
          path: outcomeFile,
          message: `Incomplete check ${checkResult.checkId} has a concrete exit code.`,
          expected: "status incomplete with exitCode null",
          repair:
            "Use failed for a completed non-zero command or incomplete for an unobserved run.",
        }),
      );
    }
  }

  const missingRequired = loop.currentIteration.checks
    .filter(({ required }) => required)
    .filter(({ id }) => !seen.has(id));
  for (const check of missingRequired) {
    diagnostics.push(
      diagnostic({
        code: "ITERATION_REQUIRED_CHECK_MISSING",
        path: outcomeFile,
        message: `Required check ${check.id} has no recorded result.`,
        expected: "one evidence result for every required check",
        repair: "Run the required check and include its complete evidence.",
      }),
    );
  }

  const requiredResults = loop.currentIteration.checks
    .filter(({ required }) => required)
    .map(({ id }) =>
      outcome.checkResults.find(({ checkId }) => checkId === id),
    );
  const requiredEvidencePassed =
    requiredResults.length > 0 &&
    requiredResults.every(
      (check) => check?.status === "passed" && check.exitCode === 0,
    );
  if (outcome.status === "succeeded" && !requiredEvidencePassed) {
    diagnostics.push(
      diagnostic({
        code: "ITERATION_SUCCESS_EVIDENCE_MISSING",
        path: outcomeFile,
        message:
          "A succeeded outcome is not supported by passing evidence for every required check.",
        expected: "all required checks present, passed, and exitCode 0",
        repair:
          "Run all required checks successfully or record the outcome as partial/failed.",
      }),
    );
  }
  return diagnostics;
}

export async function recordIterationOutcome(
  loopFile: string,
  outcomeFile: string,
): Promise<IterationLoopResult> {
  const loadedLoop = await readJson<LoopModel>(
    loopFile,
    loopSchemaId,
    "iteration loop",
  );
  if (!loadedLoop.ok)
    return result(
      "recorded",
      "operational-error",
      resolve(loopFile),
      loadedLoop.diagnostics,
    );
  const loadedOutcome = await readJson<IterationOutcome>(
    outcomeFile,
    outcomeSchemaId,
    "iteration outcome",
  );
  if (!loadedOutcome.ok)
    return result(
      "recorded",
      "operational-error",
      loadedLoop.loaded.path,
      loadedOutcome.diagnostics,
    );

  const loop = loadedLoop.loaded.data;
  const outcome = loadedOutcome.loaded.data;
  if (loop.status === "completed")
    return result(
      "recorded",
      "blocked",
      loadedLoop.loaded.path,
      [
        diagnostic({
          code: "ITERATION_LOOP_ALREADY_COMPLETED",
          path: loadedLoop.loaded.path,
          message: "A completed iteration loop cannot accept another outcome.",
          expected: "an active or blocked iteration loop",
          repair: "Create a new loop artifact for a new product direction.",
        }),
      ],
      {
        loopId: loop.loopId,
        route: "blocked",
        escalation: {
          triggered: true,
          ruleRefs: [],
          reasons: ["The iteration loop is already product-complete."],
        },
        workContext: loop.workContext,
      },
    );
  const diagnostics: SahDiagnostic[] = [];
  if (outcome.iterationId !== loop.currentIteration.id) {
    diagnostics.push(
      diagnostic({
        code: "ITERATION_OUTCOME_ID_MISMATCH",
        path: outcomeFile,
        message: `Outcome ${outcome.iterationId} does not belong to current iteration ${loop.currentIteration.id}.`,
        expected: loop.currentIteration.id,
        repair:
          "Record an outcome for the current iteration or start a new loop artifact.",
      }),
    );
  }
  if (
    loop.outcomes.some(({ iterationId }) => iterationId === outcome.iterationId)
  ) {
    diagnostics.push(
      diagnostic({
        code: "ITERATION_OUTCOME_DUPLICATE",
        path: outcomeFile,
        message: `Iteration ${outcome.iterationId} already has a recorded outcome.`,
        expected: "one append-only outcome per iteration",
        repair: "Create a new iteration ID instead of overwriting an outcome.",
      }),
    );
  }
  diagnostics.push(...validateOutcomeAgainstLoop(loop, outcome, outcomeFile));
  if (diagnostics.length > 0)
    return result("recorded", "blocked", loadedLoop.loaded.path, diagnostics, {
      loopId: loop.loopId,
      route: "blocked",
      escalation: {
        triggered: true,
        ruleRefs: [],
        reasons: diagnostics.map(({ message }) => message),
      },
      workContext: loop.workContext,
    });

  loop.outcomes.push(outcome);
  loop.status = outcome.status === "succeeded" ? "active" : "blocked";
  loop.currentIteration.status =
    outcome.status === "succeeded" ? "completed" : "blocked";
  const writeDiagnostic = await replaceLoopAtomically({
    path: loadedLoop.loaded.path,
    expectedSource: loadedLoop.loaded.source,
    mode: loadedLoop.loaded.mode,
    data: loop,
  });
  if (writeDiagnostic !== undefined)
    return result("recorded", "operational-error", loadedLoop.loaded.path, [
      writeDiagnostic,
    ]);
  return evaluateLoadedLoop(loop, loadedLoop.loaded.path, "recorded");
}

export async function bindIterationContext(
  loopFile: string,
  context: IterationContextOptions,
): Promise<IterationLoopResult> {
  const loadedLoop = await readJson<LoopModel>(
    loopFile,
    loopSchemaId,
    "iteration loop",
  );
  if (!loadedLoop.ok)
    return result(
      "bound",
      "operational-error",
      resolve(loopFile),
      loadedLoop.diagnostics,
    );

  const loop = loadedLoop.loaded.data;
  if (loop.status === "completed")
    return transitionBlocked("bound", loop, loadedLoop.loaded.path, [
      diagnostic({
        code: "ITERATION_LOOP_ALREADY_COMPLETED",
        path: loadedLoop.loaded.path,
        message: "A completed iteration loop cannot be rebound.",
        expected: "an active planned or in-progress iteration loop",
        repair: "Create a new loop artifact for a new product direction.",
      }),
    ]);
  if (loop.currentIteration.status === "blocked")
    return transitionBlocked("bound", loop, loadedLoop.loaded.path, [
      diagnostic({
        code: "ITERATION_BIND_BLOCKED_ITERATION",
        path: loadedLoop.loaded.path,
        message: "A blocked iteration requires an explicit repair transition.",
        expected: "a planned or in-progress current iteration",
        repair: "Use loop-accept-next --repair with the new context.",
      }),
    ]);

  const diagnostics = contextInputDiagnostics(context, loadedLoop.loaded.path);
  if (diagnostics.length > 0)
    return transitionBlocked(
      "bound",
      loop,
      loadedLoop.loaded.path,
      diagnostics,
    );

  loop.workContext = {
    ...loop.workContext,
    targetRevision: context.targetRevision,
    designFingerprint: context.designFingerprint,
  };
  loop.completion.workContext = evidenceContext(loop);
  const writeDiagnostic = await replaceLoopAtomically({
    path: loadedLoop.loaded.path,
    expectedSource: loadedLoop.loaded.source,
    mode: loadedLoop.loaded.mode,
    data: loop,
  });
  if (writeDiagnostic !== undefined)
    return result("bound", "operational-error", loadedLoop.loaded.path, [
      writeDiagnostic,
    ]);
  return evaluateLoadedLoop(loop, loadedLoop.loaded.path, "bound");
}

function nextTaskDiagnostics(
  task: IterationTaskContract | undefined,
  path: string,
): SahDiagnostic[] {
  if (task?.checks === undefined || task.checks.length === 0)
    return [
      diagnostic({
        code: "ITERATION_NEXT_TASK_CHECKS_MISSING",
        path,
        message:
          "The selected learning proposal declares no executable checks.",
        expected: "nextTask.checks to contain at least one check",
        repair:
          "Record a learning proposal with target-owned checks before advancing.",
      }),
    ];
  const diagnostics: SahDiagnostic[] = [];
  const seen = new Set<string>();
  for (const check of task.checks) {
    if (seen.has(check.id)) {
      diagnostics.push(
        diagnostic({
          code: "ITERATION_NEXT_TASK_CHECK_DUPLICATE",
          path,
          message: `The selected learning proposal repeats check ${check.id}.`,
          expected: "unique check IDs in nextTask.checks",
          repair: "Give each proposed check a unique ID and retry.",
        }),
      );
    }
    seen.add(check.id);
  }
  if (!task.checks.some(({ required }) => required)) {
    diagnostics.push(
      diagnostic({
        code: "ITERATION_NEXT_TASK_REQUIRED_CHECK_MISSING",
        path,
        message: "The selected learning proposal has no required check.",
        expected: "at least one nextTask.checks entry with required true",
        repair: "Mark the check that must pass before recording success.",
      }),
    );
  }
  return diagnostics;
}

function transitionBlocked(
  operation: IterationLoopResult["operation"],
  loop: LoopModel,
  loopFile: string,
  diagnostics: SahDiagnostic[],
): IterationLoopResult {
  return result(operation, "blocked", loopFile, diagnostics, {
    loopId: loop.loopId,
    route: "blocked",
    escalation: {
      triggered: true,
      ruleRefs: [],
      reasons: diagnostics.map(({ message }) => message),
    },
    currentTask: loop.currentIteration.taskContract,
    workContext: loop.workContext,
  });
}

function proposedIterationId(loop: LoopModel): string {
  const existing = new Set([
    loop.currentIteration.id,
    ...loop.outcomes.map(({ iterationId }) => iterationId),
  ]);
  let ordinal = loop.outcomes.length + 1;
  let candidate = `iteration-${String(ordinal).padStart(3, "0")}`;
  while (existing.has(candidate)) {
    ordinal += 1;
    candidate = `iteration-${String(ordinal).padStart(3, "0")}`;
  }
  return candidate;
}

export async function acceptNextIteration(
  loopFile: string,
  options: { repair?: boolean; context?: IterationContextOptions } = {},
): Promise<IterationLoopResult> {
  const loadedLoop = await readJson<LoopModel>(
    loopFile,
    loopSchemaId,
    "iteration loop",
  );
  if (!loadedLoop.ok)
    return result(
      "advanced",
      "operational-error",
      resolve(loopFile),
      loadedLoop.diagnostics,
    );

  const loop = loadedLoop.loaded.data;
  if (loop.status === "completed")
    return transitionBlocked("advanced", loop, loadedLoop.loaded.path, [
      diagnostic({
        code: "ITERATION_LOOP_ALREADY_COMPLETED",
        path: loadedLoop.loaded.path,
        message: "A completed iteration loop cannot start another iteration.",
        expected: "an active or blocked iteration loop",
        repair: "Create a new loop artifact for a new product direction.",
      }),
    ]);

  const contextDiagnostics = contextInputDiagnostics(
    options.context,
    loadedLoop.loaded.path,
  );
  if (options.context === undefined || contextDiagnostics.length > 0)
    return transitionBlocked(
      "advanced",
      loop,
      loadedLoop.loaded.path,
      contextDiagnostics,
    );

  const repair = options.repair === true;
  if (loop.currentIteration.status === "blocked" && !repair)
    return transitionBlocked("advanced", loop, loadedLoop.loaded.path, [
      diagnostic({
        code: "ITERATION_REPAIR_FLAG_REQUIRED",
        path: loadedLoop.loaded.path,
        message: "A blocked iteration requires an explicit repair transition.",
        expected: "loop-accept-next --repair",
        repair: "Inspect the failed evidence and retry with --repair.",
      }),
    ]);
  if (loop.currentIteration.status !== (repair ? "blocked" : "completed"))
    return transitionBlocked("advanced", loop, loadedLoop.loaded.path, [
      diagnostic({
        code: "ITERATION_TRANSITION_INVALID",
        path: loadedLoop.loaded.path,
        message: repair
          ? "Repair can start only from a blocked current iteration."
          : "The next iteration can be accepted only after a completed current iteration.",
        expected: repair
          ? "currentIteration.status blocked"
          : "currentIteration.status completed",
        repair: repair
          ? "Record failed or incomplete evidence, then retry repair."
          : "Run checks and record a successful outcome before accepting the next task.",
      }),
    ]);

  const selected = learningFromLatestOutcome(loop);
  if (selected === undefined)
    return transitionBlocked("advanced", loop, loadedLoop.loaded.path, [
      diagnostic({
        code: "ITERATION_NEXT_TASK_MISSING",
        path: loadedLoop.loaded.path,
        message: "The latest outcome has no learning proposal to accept.",
        expected: "the latest outcome to contain a nextTask learning",
        repair: "Record a bounded learning proposal before advancing.",
      }),
    ]);
  const taskDiagnostics = nextTaskDiagnostics(
    selected.learning.nextTask,
    loadedLoop.loaded.path,
  );
  if (taskDiagnostics.length > 0)
    return transitionBlocked(
      "advanced",
      loop,
      loadedLoop.loaded.path,
      taskDiagnostics,
    );

  const task = selected.learning.nextTask;
  const checks = task.checks?.map((check) => ({ ...check })) ?? [];
  const nextContext = options.context;
  loop.workContext = {
    ...loop.workContext,
    targetRevision: nextContext.targetRevision,
    designFingerprint: nextContext.designFingerprint,
  };
  loop.completion.workContext = evidenceContext(loop);
  loop.currentIteration = {
    id: proposedIterationId(loop),
    goal: task.goal,
    status: "planned",
    riskSignals: repair
      ? Array.from(
          new Set<RiskSignal>([
            "repeated-failure",
            ...loop.currentIteration.riskSignals,
          ]),
        )
      : [...loop.currentIteration.riskSignals],
    taskContract: {
      ...task,
      context: [...task.context],
      constraints: [...task.constraints],
      doneWhen: [...task.doneWhen],
      checks,
    },
    checks,
  };
  loop.status = "active";
  const writeDiagnostic = await replaceLoopAtomically({
    path: loadedLoop.loaded.path,
    expectedSource: loadedLoop.loaded.source,
    mode: loadedLoop.loaded.mode,
    data: loop,
  });
  if (writeDiagnostic !== undefined)
    return result("advanced", "operational-error", loadedLoop.loaded.path, [
      writeDiagnostic,
    ]);
  return evaluateLoadedLoop(loop, loadedLoop.loaded.path, "advanced");
}

function completionDiagnostics(
  loop: LoopModel,
  completion: IterationCompletionRequest,
  completionFile: string,
): SahDiagnostic[] {
  const diagnostics: SahDiagnostic[] = [];
  const declaredIds = new Set(
    loop.direction.successCriteria.map(({ id }) => id),
  );
  const seenCriteria = new Set<string>();
  const seenEvidence = new Set<string>();
  for (const criterion of completion.criterionResults) {
    if (seenCriteria.has(criterion.criterionId)) {
      diagnostics.push(
        diagnostic({
          code: "ITERATION_COMPLETION_CRITERION_DUPLICATE",
          path: completionFile,
          message: `Criterion ${criterion.criterionId} appears more than once.`,
          expected: "one completion result per declared success criterion",
          repair: "Merge the evidence references under one criterion result.",
        }),
      );
    }
    seenCriteria.add(criterion.criterionId);
    if (!declaredIds.has(criterion.criterionId)) {
      diagnostics.push(
        diagnostic({
          code: "ITERATION_COMPLETION_CRITERION_UNKNOWN",
          path: completionFile,
          message: `Completion references unknown criterion ${criterion.criterionId}.`,
          expected: "only IDs from direction.successCriteria",
          repair: "Use a declared success criterion ID and retry.",
        }),
      );
    }
    for (const reference of criterion.evidenceRefs) {
      if (seenEvidence.has(reference)) {
        diagnostics.push(
          diagnostic({
            code: "ITERATION_COMPLETION_EVIDENCE_DUPLICATE",
            path: completionFile,
            message: `Evidence reference ${reference} appears more than once.`,
            expected: "each recorded check evidence reference used once",
            repair: "Remove duplicate evidence references and retry.",
          }),
        );
        continue;
      }
      seenEvidence.add(reference);
      const separator = reference.indexOf(":");
      const iterationId = separator < 1 ? "" : reference.slice(0, separator);
      const checkId = separator < 1 ? "" : reference.slice(separator + 1);
      const outcome = loop.outcomes.find(
        ({ iterationId: candidate }) => candidate === iterationId,
      );
      const check = outcome?.checkResults.find(
        ({ checkId: candidate }) => candidate === checkId,
      );
      if (outcome === undefined || check === undefined) {
        diagnostics.push(
          diagnostic({
            code: "ITERATION_COMPLETION_EVIDENCE_UNKNOWN",
            path: completionFile,
            message: `Completion references unknown evidence ${reference}.`,
            expected: "iterationId:checkId for a recorded check result",
            repair: "Use an evidence reference from loop.outcomes.",
          }),
        );
      } else if (check.status !== "passed" || check.exitCode !== 0) {
        diagnostics.push(
          diagnostic({
            code: "ITERATION_COMPLETION_EVIDENCE_NOT_PASSED",
            path: completionFile,
            message: `Evidence ${reference} did not pass with exit code 0.`,
            expected: "check status passed and exitCode 0",
            repair:
              "Run the check successfully and reference its passing evidence.",
          }),
        );
      }
    }
  }
  for (const criterion of loop.direction.successCriteria) {
    if (!seenCriteria.has(criterion.id))
      diagnostics.push(
        diagnostic({
          code: "ITERATION_COMPLETION_CRITERION_MISSING",
          path: completionFile,
          message: `Completion omits declared criterion ${criterion.id}.`,
          expected: "one criterion result for every success criterion",
          repair: "Add evidence references for the missing criterion.",
        }),
      );
  }
  return diagnostics;
}

export async function completeIterationLoop(
  loopFile: string,
  completionFile: string,
): Promise<IterationLoopResult> {
  const loadedLoop = await readJson<LoopModel>(
    loopFile,
    loopSchemaId,
    "iteration loop",
  );
  if (!loadedLoop.ok)
    return result(
      "completed",
      "operational-error",
      resolve(loopFile),
      loadedLoop.diagnostics,
    );
  const loadedCompletion = await readJson<IterationCompletionRequest>(
    completionFile,
    completionSchemaId,
    "iteration completion request",
  );
  if (!loadedCompletion.ok)
    return result(
      "completed",
      "operational-error",
      loadedLoop.loaded.path,
      loadedCompletion.diagnostics,
    );

  const loop = loadedLoop.loaded.data;
  if (loop.status === "completed")
    return transitionBlocked("completed", loop, loadedLoop.loaded.path, [
      diagnostic({
        code: "ITERATION_LOOP_ALREADY_COMPLETED",
        path: loadedLoop.loaded.path,
        message: "The iteration loop is already product-complete.",
        expected: "an active iteration loop",
        repair: "Create a new loop artifact for a new product direction.",
      }),
    ]);
  if (loop.status === "blocked" || loop.currentIteration.status === "blocked")
    return transitionBlocked("completed", loop, loadedLoop.loaded.path, [
      diagnostic({
        code: "ITERATION_COMPLETION_BLOCKED",
        path: loadedLoop.loaded.path,
        message: "A blocked iteration cannot satisfy the completion gate.",
        expected: "a completed current iteration with passing evidence",
        repair: "Run an explicit repair iteration before completing the loop.",
      }),
    ]);
  if (loop.currentIteration.status !== "completed")
    return transitionBlocked("completed", loop, loadedLoop.loaded.path, [
      diagnostic({
        code: "ITERATION_COMPLETION_CURRENT_NOT_COMPLETED",
        path: loadedLoop.loaded.path,
        message: "The current iteration has not recorded a successful outcome.",
        expected: "currentIteration.status completed",
        repair: "Run checks and record a succeeded outcome first.",
      }),
    ]);
  const latest = loop.outcomes.at(-1);
  if (latest?.status !== "succeeded")
    return transitionBlocked("completed", loop, loadedLoop.loaded.path, [
      diagnostic({
        code: "ITERATION_COMPLETION_SUCCESS_OUTCOME_MISSING",
        path: loadedLoop.loaded.path,
        message: "The latest iteration does not have a succeeded outcome.",
        expected: "the latest outcome status succeeded",
        repair: "Record passing execution evidence before completing the loop.",
      }),
    ]);
  if (latest.learnings.some(({ priority }) => priority === "must"))
    return transitionBlocked("completed", loop, loadedLoop.loaded.path, [
      diagnostic({
        code: "ITERATION_COMPLETION_MUST_LEARNING_OPEN",
        path: loadedLoop.loaded.path,
        message:
          "The latest succeeded iteration still has an unresolved must learning.",
        expected: "no latest learning with priority must",
        repair:
          "Accept and complete the required next task before product completion.",
      }),
    ]);

  const completionContext = loadedCompletion.loaded.data.workContext;
  const currentContext = evidenceContext(loop);
  const contextDiagnostics: SahDiagnostic[] = [];
  if (!contextMatches(currentContext, latest.evidence.workContext))
    contextDiagnostics.push(
      diagnostic({
        code: "ITERATION_LATEST_OUTCOME_CONTEXT_MISMATCH",
        path: loadedLoop.loaded.path,
        message:
          "The latest succeeded outcome is not bound to the loop's current work context.",
        expected: `${currentContext.targetRevision} and ${currentContext.designFingerprint}`,
        repair:
          "Record evidence for the currently bound iteration before completing.",
      }),
    );
  if (!contextMatches(currentContext, completionContext))
    contextDiagnostics.push(
      diagnostic({
        code: "ITERATION_COMPLETION_CONTEXT_MISMATCH",
        path: completionFile,
        message:
          "The completion request is bound to a different target revision or design fingerprint than the loop.",
        expected: `${currentContext.targetRevision} and ${currentContext.designFingerprint}`,
        repair:
          "Regenerate the completion request from the current loop binding.",
      }),
    );
  if (contextDiagnostics.length > 0)
    return transitionBlocked(
      "completed",
      loop,
      loadedLoop.loaded.path,
      contextDiagnostics,
    );

  const diagnostics = completionDiagnostics(
    loop,
    loadedCompletion.loaded.data,
    completionFile,
  );
  if (diagnostics.length > 0)
    return transitionBlocked(
      "completed",
      loop,
      loadedLoop.loaded.path,
      diagnostics,
    );

  loop.status = "completed";
  loop.completion = {
    completionVersion: "0.2.0",
    status: "completed",
    workContext: { ...completionContext },
    criterionResults: loadedCompletion.loaded.data.criterionResults.map(
      ({ criterionId, evidenceRefs }) => ({
        criterionId,
        evidenceRefs: [...evidenceRefs],
      }),
    ),
    completedAt: new Date().toISOString(),
  };
  const writeDiagnostic = await replaceLoopAtomically({
    path: loadedLoop.loaded.path,
    expectedSource: loadedLoop.loaded.source,
    mode: loadedLoop.loaded.mode,
    data: loop,
  });
  if (writeDiagnostic !== undefined)
    return result("completed", "operational-error", loadedLoop.loaded.path, [
      writeDiagnostic,
    ]);
  return evaluateLoadedLoop(loop, loadedLoop.loaded.path, "completed");
}
