import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateIterationLoop,
  runIterationChecks,
  recordIterationOutcome,
  acceptNextIteration,
  completeIterationLoop,
} from "../src/iteration-loop.js";
import { loadSchemaRegistry } from "../src/schema-validation.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createLoop(signal = "local-reversible"): Promise<{
  directory: string;
  loop: string;
  outcome: string;
}> {
  const directory = await mkdtemp(join(tmpdir(), "sah-loop-test-"));
  temporaryDirectories.push(directory);
  const loop = join(directory, "sah.loop.json");
  const outcome = join(directory, "outcome.json");
  await writeFile(
    loop,
    `${JSON.stringify(
      {
        $schema: "https://sah.dev/schemas/iteration-loop/v0.3.0",
        loopVersion: "0.3.0",
        loopId: "test-loop",
        status: "active",
        direction: {
          goal: "Improve the product",
          successCriteria: [
            { id: "criterion-1", description: "A user succeeds" },
          ],
        },
        policy: {
          defaultRoute: "fast",
          rules: [
            {
              id: "critical-rule",
              signal: "critical-invariant",
              route: "reasoning",
              trigger: "Reopen S0-S13",
            },
          ],
        },
        currentIteration: {
          id: "iteration-1",
          goal: "Improve the product",
          status: "planned",
          riskSignals: [signal],
          taskContract: {
            goal: "Improve the product",
            context: ["src"],
            constraints: ["preserve behavior"],
            doneWhen: ["lint passes"],
          },
          checks: [
            {
              id: "lint",
              kind: "lint",
              command: "npm run lint",
              expected: "exit 0",
              required: true,
            },
          ],
        },
        completion: {
          completionVersion: "0.1.0",
          status: "open",
          criterionResults: [],
        },
        outcomes: [],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    outcome,
    `${JSON.stringify(
      {
        $schema: "https://sah.dev/schemas/iteration-outcome/v0.3.0",
        outcomeVersion: "0.3.0",
        iterationId: "iteration-1",
        status: "succeeded",
        evidence: {
          executor: { name: "sah-loop-checks", version: "0.1.0" },
          cwd: "/workspace/product",
          startedAt: "2026-08-19T00:00:00.000Z",
          finishedAt: "2026-08-19T00:00:01.000Z",
        },
        checkResults: [
          {
            checkId: "lint",
            status: "passed",
            command: "npm run lint",
            cwd: "/workspace/product",
            startedAt: "2026-08-19T00:00:00.000Z",
            finishedAt: "2026-08-19T00:00:01.000Z",
            exitCode: 0,
            stdoutDigest:
              "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            stderrDigest:
              "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            observed: "0 findings",
          },
        ],
        learnings: [
          {
            id: "learning-1",
            observation: "The next increment should improve the empty state.",
            priority: "must",
            nextTask: {
              goal: "Improve the empty state",
              context: ["src/empty-state"],
              constraints: ["preserve navigation"],
              doneWhen: ["lint passes", "empty-state test passes"],
              checks: [
                {
                  id: "lint",
                  kind: "lint",
                  command: "npm run lint",
                  expected: "exit 0",
                  required: true,
                },
              ],
            },
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  return { directory, loop, outcome };
}

describe("iteration loop", () => {
  it("routes local reversible work to the fast path", async () => {
    const { loop } = await createLoop();

    const result = await evaluateIterationLoop(loop);

    expect(result.status).toBe("ready");
    expect(result.route).toBe("fast");
    expect(result.escalation.triggered).toBe(false);
    expect(result.currentTask?.goal).toBe("Improve the product");
    const registry = await loadSchemaRegistry();
    expect(registry.ok).toBe(true);
    if (registry.ok)
      expect(
        registry.registry.validate(
          "https://sah.dev/schemas/iteration-loop-result/v0.2.0",
          result,
          "iteration-loop-result",
        ),
      ).toEqual([]);
  });

  it("routes critical invariant work to the reasoning path", async () => {
    const { loop } = await createLoop("critical-invariant");

    const result = await evaluateIterationLoop(loop);

    expect(result.status).toBe("escalate");
    expect(result.route).toBe("reasoning");
    expect(result.escalation.ruleRefs).toEqual(["critical-rule"]);
  });

  it("atomically records an outcome and projects its highest-priority next task", async () => {
    const { loop, outcome } = await createLoop();

    const result = await recordIterationOutcome(loop, outcome);
    const persisted = JSON.parse(await readFile(loop, "utf8")) as {
      currentIteration: { status: string };
      outcomes: unknown[];
    };

    expect(result.operation).toBe("recorded");
    expect(result.status).toBe("ready");
    expect(result.nextTask?.goal).toBe("Improve the empty state");
    expect(result.learningSourceIterationId).toBe("iteration-1");
    expect(persisted.currentIteration.status).toBe("completed");
    expect(persisted.outcomes).toHaveLength(1);
  });

  it("accepts a declared next task as a new planned iteration", async () => {
    const { loop, outcome } = await createLoop();

    await recordIterationOutcome(loop, outcome);
    const result = await acceptNextIteration(loop);
    const persisted = JSON.parse(await readFile(loop, "utf8")) as {
      status: string;
      currentIteration: {
        id: string;
        status: string;
        goal: string;
        checks: Array<{ id: string }>;
      };
    };

    expect(result.operation).toBe("advanced");
    expect(result.status).toBe("ready");
    expect(persisted.status).toBe("active");
    expect(persisted.currentIteration.id).toBe("iteration-002");
    expect(persisted.currentIteration.status).toBe("planned");
    expect(persisted.currentIteration.goal).toBe("Improve the empty state");
    expect(persisted.currentIteration.checks).toHaveLength(1);
  });

  it("requires an explicit repair transition after failed evidence", async () => {
    const { loop, outcome } = await createLoop();
    const failed = JSON.parse(await readFile(outcome, "utf8")) as {
      status: string;
      checkResults: Array<{ status: string; exitCode: number | null }>;
    };
    failed.status = "failed";
    const check = failed.checkResults[0];
    if (check !== undefined) {
      check.status = "failed";
      check.exitCode = 1;
    }
    await writeFile(outcome, `${JSON.stringify(failed, null, 2)}\n`);

    await recordIterationOutcome(loop, outcome);
    const withoutRepair = await acceptNextIteration(loop);
    expect(withoutRepair.status).toBe("blocked");
    expect(withoutRepair.diagnostics.map(({ code }) => code)).toContain(
      "ITERATION_REPAIR_FLAG_REQUIRED",
    );

    const repaired = await acceptNextIteration(loop, { repair: true });
    const persisted = JSON.parse(await readFile(loop, "utf8")) as {
      currentIteration: { status: string; riskSignals: string[] };
    };
    expect(repaired.operation).toBe("advanced");
    expect(persisted.currentIteration.status).toBe("planned");
    expect(persisted.currentIteration.riskSignals).toContain(
      "repeated-failure",
    );
  });

  it("completes only when every success criterion references passed evidence", async () => {
    const { loop, outcome, directory } = await createLoop();
    const succeeded = JSON.parse(await readFile(outcome, "utf8")) as {
      learnings: Array<{ priority: string }>;
    };
    const learning = succeeded.learnings[0];
    if (learning !== undefined) learning.priority = "should";
    await writeFile(outcome, `${JSON.stringify(succeeded, null, 2)}\n`);
    await recordIterationOutcome(loop, outcome);
    const completion = join(directory, "completion.json");
    await writeFile(
      completion,
      `${JSON.stringify(
        {
          $schema: "https://sah.dev/schemas/iteration-completion/v0.1.0",
          completionVersion: "0.1.0",
          status: "completed",
          criterionResults: [
            {
              criterionId: "criterion-1",
              evidenceRefs: ["iteration-1:lint"],
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const result = await completeIterationLoop(loop, completion);
    const persisted = JSON.parse(await readFile(loop, "utf8")) as {
      status: string;
      completion: { status: string; criterionResults: unknown[] };
    };
    expect(result.operation).toBe("completed");
    expect(result.status).toBe("complete");
    expect(result.route).toBe("complete");
    expect(persisted.status).toBe("completed");
    expect(persisted.completion.status).toBe("completed");
    expect(persisted.completion.criterionResults).toHaveLength(1);

    const evaluated = await evaluateIterationLoop(loop);
    expect(evaluated.operation).toBe("evaluated");
    expect(evaluated.status).toBe("complete");
    expect(evaluated.route).toBe("complete");
  });

  it("does not write a completion with unknown evidence", async () => {
    const { loop, outcome, directory } = await createLoop();
    const succeeded = JSON.parse(await readFile(outcome, "utf8")) as {
      learnings: Array<{ priority: string }>;
    };
    const learning = succeeded.learnings[0];
    if (learning !== undefined) learning.priority = "should";
    await writeFile(outcome, `${JSON.stringify(succeeded, null, 2)}\n`);
    await recordIterationOutcome(loop, outcome);
    const completion = join(directory, "invalid-completion.json");
    await writeFile(
      completion,
      `${JSON.stringify(
        {
          $schema: "https://sah.dev/schemas/iteration-completion/v0.1.0",
          completionVersion: "0.1.0",
          status: "completed",
          criterionResults: [
            {
              criterionId: "criterion-1",
              evidenceRefs: ["iteration-1:missing"],
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const result = await completeIterationLoop(loop, completion);
    const persisted = JSON.parse(await readFile(loop, "utf8")) as {
      status: string;
    };
    expect(result.status).toBe("blocked");
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "ITERATION_COMPLETION_EVIDENCE_UNKNOWN",
    );
    expect(persisted.status).toBe("active");
  });

  it("rejects a succeeded outcome when a required check is missing", async () => {
    const { loop, outcome } = await createLoop();
    const invalid = JSON.parse(await readFile(outcome, "utf8")) as {
      checkResults: Array<{ checkId: string }>;
    };
    const first = invalid.checkResults[0];
    if (first !== undefined) first.checkId = "undeclared";
    await writeFile(outcome, `${JSON.stringify(invalid, null, 2)}\n`);

    const result = await recordIterationOutcome(loop, outcome);

    expect(result.status).toBe("blocked");
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "ITERATION_REQUIRED_CHECK_MISSING",
    );
    const persisted = JSON.parse(await readFile(loop, "utf8")) as {
      outcomes: unknown[];
    };
    expect(persisted.outcomes).toHaveLength(0);
  });

  it("runs declared checks and emits execution evidence", async () => {
    const { loop } = await createLoop();

    const result = await runIterationChecks(loop, process.cwd());

    expect(result.status).toBe("passed");
    expect(result.outcome?.evidence.executor.name).toBe("sah-loop-checks");
    expect(result.outcome?.checkResults[0]).toMatchObject({
      checkId: "lint",
      command: "npm run lint",
      cwd: process.cwd(),
      status: "passed",
    });
    expect(result.outcome?.checkResults[0]?.stdoutDigest).toMatch(
      /^sha256:[0-9a-f]{64}$/u,
    );
    const registry = await loadSchemaRegistry();
    expect(registry.ok).toBe(true);
    if (registry.ok && result.outcome !== undefined)
      expect(
        registry.registry.validate(
          "https://sah.dev/schemas/iteration-outcome/v0.3.0",
          result.outcome,
          "iteration-outcome",
        ),
      ).toEqual([]);
  });

  it("retains failed evidence as blocked instead of completing the iteration", async () => {
    const { loop, outcome } = await createLoop();
    const failed = JSON.parse(await readFile(outcome, "utf8")) as {
      status: string;
      checkResults: Array<{ status: string; exitCode: number | null }>;
    };
    failed.status = "failed";
    const check = failed.checkResults[0];
    if (check !== undefined) {
      check.status = "failed";
      check.exitCode = 1;
    }
    await writeFile(outcome, `${JSON.stringify(failed, null, 2)}\n`);

    const result = await recordIterationOutcome(loop, outcome);
    const persisted = JSON.parse(await readFile(loop, "utf8")) as {
      currentIteration: { status: string };
      outcomes: unknown[];
    };

    expect(result.status).toBe("blocked");
    expect(persisted.currentIteration.status).toBe("blocked");
    expect(persisted.outcomes).toHaveLength(1);
  });
});
