# ADR-0024: Offer bounded continuous execution as an agent policy

## Status

Accepted for Run 24.

## Context

The local iteration loop is intentionally explicit: the host agent runs target checks, records
evidence, and accepts a declared next task through atomic commands. This protects product direction,
risk escalation, and cross-session resumability, but an agent that pauses after every successful
iteration creates unnecessary conversational friction. The user wants an optional mode that keeps
working until the safe work is exhausted.

SAH itself does not own natural-language task generation, user acceptance, repository revision
discovery, or a hosted backlog. A deterministic command cannot manufacture the next implementation
decision after a check succeeds. The option must therefore change the host-agent execution policy,
not add a second lifecycle writer or silently turn a green check into product completion.

## Decision

Add a documented **bounded continuous mode** to the portable SAH skill. It is activated only by an
explicit user request and a positive `maxIterations` bound. The host agent continues the normal
SAH workflow across ready iterations, using the existing `sah loop-checks`, `sah loop-record`, and
`sah loop-accept-next` commands when the current outcome contains a declared executable learning.
Each canonical write remains atomic and resumable.

The mode pauses and reports a handoff at any of these boundaries: unresolved consequential
question/decision, `reasoning` or `blocked` route, failed/partial/incomplete/operational evidence,
missing or unchecked next-task proposal, stale target/design context, required independent Checker
judgment, explicit max-iteration exhaustion, user acceptance, or S13 lifecycle authority. It does
not auto-repair blocked work, invent scenarios, reprioritize learning, call a model/provider,
discover Git state, complete `loop-complete`, or advance S13 without the existing evidence gate.
Default mode and every CLI/library result and exit code remain unchanged.

## Alternatives and costs

- Add `--continuous` to read-only `sah loop`: smaller syntax, but it would make an evaluator execute
  checks and mutate canonical state, blurring the CLI/library boundary and breaking existing users.
- Add a deterministic `sah loop-run` executor: it cannot create the next task or implementation;
  it either stops after one check or introduces a second task authority. It would also need a new
  result schema and interruption protocol for little user value.
- Add a hosted coordinator or background daemon: it could keep sessions alive, but introduces
  identity, concurrency, deployment, privacy, and failure-recovery authorities outside the local
  harness scope.
- Allow unbounded `--until-complete`: convenient, but permits runaway checks and cannot distinguish
  missing stakeholder decisions from a product-complete direction.

The selected policy costs a small amount of explicit prompt/documentation discipline and a required
iteration bound. It does not remove the manual decision point when the declared work is no longer
safe or executable; that is the intended safety and ownership boundary.

## Consequences and review trigger

An agent can carry a ready vertical slice through multiple declared iterations without asking the
user to say “next” after each green gate. A later session resumes from the same loop artifact and
the last atomic transition. The mode remains honest when it stops: no learning is not a hidden
planner, reasoning is not silently accepted, and S13 remains a separate full-verification gate.

Review this ADR before adding automatic task generation, model/provider execution, multiple loop
writers, background scheduling, unbounded execution, or a CLI command that mutates more than the
existing atomic lifecycle operations.

Decision authority: SAH architecture authority for the local policy; the user for opt-in and its
bound; the target workflow for task meaning, revision provenance, and acceptance commands.
