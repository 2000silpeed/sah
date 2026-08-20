# Run 24 ExecPlan — bounded continuous agent mode

## Compiled task and boundaries

Goal: add an explicit optional continuous mode to the portable SAH skill so a host coding agent
can carry a ready, evidence-backed iteration into the next declared task without stopping at every
phase boundary. Preserve the deterministic CLI/library boundary, local loop writer, risk router,
revision/fingerprint binding, independent Checker gate, and S0–S13/S13 authority.

The mode is an agent execution policy, not a new autonomous product planner. It may automate the
host agent's existing sequence of implementation, target checks, outcome recording, and
`loop-accept-next` when a declared learning is executable. It must stop for unresolved
consequential decisions, reasoning/blocked routes, failed/partial/incomplete/operational
evidence, missing next-task checks, stale context, required Checker judgment, a user-acceptance
boundary, or the explicit iteration bound. It never invents product direction, repairs a blocked
iteration without authority, calls an external model, changes Git state, or silently advances
S13.

Included: the portable skill contract, agent-skill and iteration-loop documentation, a copyable
bounded-mode invocation contract, ADR-0024, Run 24 evidence/tests, and link/line-budget review.
Excluded: a hosted coordinator, background daemon, unbounded `--until-complete` flag, new evidence
database, loop schema migration, CLI exit-code changes, LLM judge/provider calls, benchmark
expectation changes, and target-product code.

## Accepted design

Continuous mode is selected only by an explicit user instruction and requires a positive maximum
iteration count. The host agent keeps the normal SAH order for each iteration: inspect the canonical
task and authority, implement only ready slices, run target checks plus `sah loop-checks`, record
schema-validated evidence, and accept the latest declared executable learning atomically. A clean
iteration with no executable learning is a truthful stop, not an implicit product-complete claim.

The existing CLI remains the deterministic primitive set. The skill documents the mode as an
orchestration policy over those primitives, so interruption leaves the last atomic loop state
resumable by any later session. Default interactive behavior remains unchanged.

## Milestones

| Phase | Milestone | Status |
| --- | --- | --- |
| 0 | Inspect loop, skill, lifecycle, and CLI boundaries | complete |
| 1 | Write Run 24 plan and ADR-0024 | complete |
| 2 | Update portable skill and user-facing loop guidance | complete |
| 3 | Add skill/doc contract tests and line/link checks | complete |
| 4 | Full verification, adversarial stop-condition review, and diff review | complete |
| 5 | Meaningful milestone commit; no push unless separately requested | complete |

## Decision and discovery log

- 2026-08-20: A new deterministic `loop-run` executor was rejected at the boundary: SAH cannot
  create the next product task or supply the host agent's implementation decision. A CLI executor
  would either stop after one check (misleading “continuous” behavior) or add a second authority.
- 2026-08-20: The least elaborate fitting option is a skill-level policy over existing atomic
  commands. It gives the user a real opt-in continuation mode while keeping JSON IR and lifecycle
  authority unchanged.
- 2026-08-20: The iteration bound is mandatory in the contract. “끝까지” means continue until a
  declared safe stop, not an unbounded process; max-bound exhaustion returns a resumable handoff.

## Verification so far

- Skill contract, schema/trace, format, lint, strict typecheck, build, and full test suite pass
  (259 tests); existing CLI route evaluation still exits 0 and an unsupported `--continuous` CLI
  flag still exits 2, proving the deterministic CLI contract was not silently changed.
- Markdown link audit covered 63 files with no missing local links; all governed documents remain
  within their line budgets, and `git diff --check` passes.
- The mode's adversarial stop conditions are stated and asserted in the skill contract: reasoning,
  blocked, failed/partial/incomplete/operational evidence, stale context, missing checks, Checker
  or stakeholder decisions, max bound, user acceptance, and S13.

## Verification contract

Run the skill contract tests, schema/trace audit, format, lint, strict typecheck, build, full test
suite, documentation link/line-budget audit, and `git diff --check`. Add adversarial assertions
that continuous mode preserves default behavior and names every stop condition. Do not read or
modify benchmark expectations. A Checker review is required if the final task contract routes to
independent judgment; otherwise report deterministic documentation/test evidence separately.

## Handoff

After Run 24, a user can explicitly request bounded continuous mode in a new Codex or Claude Code
session. The agent will continue ready work across declared iterations, pause only at an owned
gate, and resume from the canonical loop without relying on conversation memory.
