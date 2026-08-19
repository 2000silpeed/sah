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
  IterationLoopResult,
  IterationChecksResult,
  IterationOutcome,
  IterationTaskContract,
  LoopRoute,
  SahDiagnostic,
} from "./contracts.js";
import { summarize } from "./diagnostics.js";
import { loadSchemaRegistry } from "./schema-validation.js";

const loopSchemaId = "https://sah.dev/schemas/iteration-loop/v0.2.0";
const outcomeSchemaId = "https://sah.dev/schemas/iteration-outcome/v0.2.0";
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
  loopVersion: "0.2.0";
  loopId: string;
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
    checks: Array<{
      id: string;
      kind: string;
      command: string;
      expected: string;
      required: boolean;
    }>;
  };
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
  operation: "evaluated" | "recorded",
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
    $schema: "https://sah.dev/schemas/iteration-loop-result/v0.1.0",
    resultVersion: "0.1.0",
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

function taskFromLatestOutcome(loop: LoopModel): {
  task?: IterationTaskContract;
  sourceIterationId?: string;
} {
  const latest = loop.outcomes.at(-1);
  if (latest === undefined || latest.learnings.length === 0) return {};
  const priority = { must: 3, should: 2, could: 1 } as const;
  const selected = [...latest.learnings].sort(
    (left, right) => priority[right.priority] - priority[left.priority],
  )[0];
  return selected === undefined
    ? {}
    : { task: selected.nextTask, sourceIterationId: latest.iterationId };
}

function evaluateLoadedLoop(
  loop: LoopModel,
  loopFile: string,
  operation: "evaluated" | "recorded",
): IterationLoopResult {
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
    current.status === "completed" ? taskFromLatestOutcome(loop) : {};
  const status =
    route === "fast" ? "ready" : route === "reasoning" ? "escalate" : "blocked";
  const extra =
    current.status === "completed" && learning.task === undefined
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
      ...(learning.task === undefined ? {} : { nextTask: learning.task }),
      ...(learning.sourceIterationId === undefined
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

  const resolvedCwd = resolve(cwd);
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
    $schema: "https://sah.dev/schemas/iteration-outcome/v0.2.0",
    outcomeVersion: "0.2.0",
    iterationId: loop.currentIteration.id,
    status,
    evidence: {
      executor: { name: "sah-loop-checks", version: iterationRunnerVersion },
      cwd: resolvedCwd,
      startedAt,
      finishedAt,
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
    });

  loop.outcomes.push(outcome);
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
