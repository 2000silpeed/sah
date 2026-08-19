# Iteration loop

The iteration loop sits above one or more SAH design bundles. It does not replace S0–S13. It
routes a small current task to a fast path or to deeper reasoning, records what happened, and
projects the next bounded task for another session or model.

## Canonical artifact

Create a schema-valid `.sah/sah.loop.json` containing (see the [executable loop fixture](../fixtures/iteration-loop/sah.loop.json)):

- product direction and measurable success criteria;
- explicit risk rules and escalation triggers;
- the current task contract and target-owned checks such as lint;
- append-only iteration outcomes and proposed next tasks.

An outcome is now v0.2.0 evidence: each declared check must carry its exact command, explicit
working directory, timestamps, exit code, and sha256 digests for captured stdout/stderr. A coding
agent must not hand-write a successful check claim.

The loop artifact is separate from `sah.bundle.json`: the loop owns iteration selection, while a
design bundle remains the authority for architecture decisions, constraints, and S13 evidence.

## Commands

Evaluate the current route without changing files:

```text
npm exec -- sah loop .sah/sah.loop.json --json
```

Run the declared target checks in order. The working directory is deliberately explicit; SAH does
not infer a project root or inspect Git state. The command emits a schema-valid outcome template
with an empty `learnings` array, so the agent can add a bounded learning before recording it:

```text
npm exec -- sah loop-checks .sah/sah.loop.json --cwd /absolute/project --json > .sah/iteration-002.outcome.json
```

Record a schema-valid outcome with an atomic append, then print the next projection:

```text
npm exec -- sah loop-record .sah/sah.loop.json .sah/iteration-001.outcome.json --json
```

`loop-record` compares every result with the current declared check. Missing, unknown, duplicate,
command-mismatched, incomplete, or failed required evidence blocks a `succeeded` write. A valid
failed/partial outcome is retained and leaves the iteration blocked; no result is treated as a
product-complete state.

The result reports `fast`, `reasoning`, or `blocked`, matching escalation rules and the current
risk signals. A completed outcome's highest-priority learning becomes `nextTask`; it is a proposal,
not an automatic product-direction change. Exit codes are 0 for fast-ready, 1 for escalation or
blocked, and 2 for operational errors.

Fast-ready does not mean architecture-complete. Material changes still create or reopen the
appropriate S0–S13 bundle and require the existing full S13 evidence gate.
