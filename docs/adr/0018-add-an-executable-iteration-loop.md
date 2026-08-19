# ADR-0018: Add an executable iteration loop above S0–S13

## Status

Accepted for Run 18.

## Context

Frontier coding agents can execute a tight inspect/change/check/repair loop, but a product still
needs a durable direction, explicit risk escalation, and a way to turn observed outcomes into the
next bounded task. The existing S0–S13 bundle is the authority for one architecture/design change;
it is not a product backlog, a session database, or a repeated iteration controller.

## Decision

Add a separate, schema-validated `sah.loop.json` canonical artifact. It contains product direction
for the loop, explicit risk rules and escalation triggers, one current task contract with declared
checks, and append-only iteration outcomes. `sah loop` validates and deterministically projects the
current route and next task. `sah loop-record` validates an outcome and atomically appends it to the
loop artifact before producing the next projection.

Routes are `fast` for explicitly local/reversible work, `reasoning` when a declared trigger calls
for S0–S13, and `blocked` when a declared blocker or unresolved required outcome prevents safe
progress. The router consumes declared signals; it does not make an unobservable LLM judgment.
Learning proposes the next task contract from the latest outcome, but never mutates product
direction or silently approves a consequential decision.

## Alternatives and costs

- Reuse the design-bundle manifest for loop state: fewer files, but mixes product iteration
  authority with semantic lifecycle metadata and makes S0–S13 harder to reason about.
- Keep iteration state only in chat or Git commits: no schema/runtime work, but sessions and models
  cannot reliably reconstruct the next task or distinguish a stale plan from current evidence.
- Let an LLM choose risk and next tasks without declared rules: flexible, but non-reproducible,
  difficult to audit, and prone to silently bypassing deeper reasoning.

The chosen design costs one additional canonical artifact and explicit risk/outcome authoring. It
keeps the loop local, model-neutral, and reviewable while allowing the model to execute fast-path
work without full ceremony.

## Consequences and review

Existing `validate`, `advance`, `verify`, and `resume` behavior and exit-code meanings are unchanged.
Loop route `fast` exits 0, `reasoning`/`blocked` exits 1, and operational failures exit 2. A future
multi-user coordinator, product analytics store, or autonomous direction change requires revisiting
this ADR rather than adding hidden fields or a second authority.
