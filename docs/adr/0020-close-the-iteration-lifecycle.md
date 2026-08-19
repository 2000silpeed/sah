# ADR-0020: Close the iteration lifecycle with explicit advancement and completion

## Status

Accepted for Run 20.

## Context

Run 19 made iteration success evidence-backed, but `loop-record` still only projected a learning.
The next task had to be copied manually into `currentIteration`, blocked outcomes had no repair
transition, and the loop could not distinguish “iteration finished” from “the product satisfies
all declared success criteria.” Those gaps make cross-session continuation error-prone even when
the check evidence itself is trustworthy.

## Decision

Version the loop and outcome contracts for the lifecycle extension. A learning's `nextTask` must
declare its target-owned checks. Add explicit, atomic `loop-accept-next` and
`loop-accept-next --repair` operations. The normal operation accepts the highest-priority learning
after a completed iteration; repair is the only operation allowed from a blocked iteration and
adds the declared `repeated-failure` risk signal. Each operation creates a fresh planned iteration
with the proposed task and checks; it never mutates product direction or silently chooses a task.

Add a local `loop-complete` operation and completion artifact. It requires the current iteration to
be completed, rejects a latest `must` learning, and resolves every success criterion's
`iterationId:checkId` evidence reference to a recorded passed check with exit code zero. Only then
does it atomically set the loop's terminal completion state. The result has a distinct terminal
status and exit 0; it is not an S13 claim and does not prove deployment or user acceptance.

## Alternatives and costs

- Keep next-task copying in the host agent: avoids runtime changes, but every session can lose
  checks, reuse an ID, or advance a stale proposal without an atomic lifecycle decision.
- Auto-promote the highest learning after `loop-record`: reduces one command, but removes the human
  or authorized owner review point and can turn a speculative learning into product work.
- Treat the last passing iteration as product-complete: minimal state, but it cannot prove all
  direction criteria and conflates local checks with product outcome.
- Add a hosted backlog/coordinator: supports multi-writer history, but introduces deployment,
  identity, consistency, privacy, and operational costs before the local state machine is closed.

The selected option costs two explicit commands, a completion artifact, schema version migrations,
and deterministic reference resolution. It preserves the local single-writer boundary and keeps
external acceptance/release evidence available for a later adapter decision.

## Consequences and review

The loop now has an explicit active/blocked/completed product state and a reviewable transition
history. A task proposal without checks cannot be accepted, and a `must` learning prevents a false
terminal state. This does not solve stale repository revisions, concurrent sessions, deployment,
or user acceptance; review or supersede this ADR before adding those authorities.

Decision authority: the SAH architecture authority accepted this local Run 20 slice. The target
repository remains authoritative for the meaning and commands of each check.
