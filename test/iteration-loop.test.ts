import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateIterationLoop,
  recordIterationOutcome,
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
        $schema: "https://sah.dev/schemas/iteration-loop/v0.1.0",
        loopVersion: "0.1.0",
        loopId: "test-loop",
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
        $schema: "https://sah.dev/schemas/iteration-outcome/v0.1.0",
        outcomeVersion: "0.1.0",
        iterationId: "iteration-1",
        status: "succeeded",
        checkResults: [
          { checkId: "lint", status: "passed", observed: "0 findings" },
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
          "https://sah.dev/schemas/iteration-loop-result/v0.1.0",
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
});
