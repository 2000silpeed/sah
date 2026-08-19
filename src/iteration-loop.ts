import { randomUUID } from "node:crypto";
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
  IterationOutcome,
  IterationTaskContract,
  LoopRoute,
  SahDiagnostic,
} from "./contracts.js";
import { summarize } from "./diagnostics.js";
import { loadSchemaRegistry } from "./schema-validation.js";

const loopSchemaId = "https://sah.dev/schemas/iteration-loop/v0.1.0";
const outcomeSchemaId = "https://sah.dev/schemas/iteration-outcome/v0.1.0";

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
  loopVersion: "0.1.0";
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
    outcome.status === "failed" ? "blocked" : "completed";
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
