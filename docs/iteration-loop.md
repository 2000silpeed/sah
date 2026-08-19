# Iteration loop

The iteration loop sits above one or more SAH design bundles. It does not replace S0–S13. It
routes a bounded task, records target-owned execution evidence, explicitly accepts a proposed next
task (or repairs a blocked one), and can close the local product direction only when every success
criterion points to recorded passing evidence.

## Canonical artifact

Create a schema-valid `.sah/sah.loop.json` containing product direction and success criteria, risk
rules, the current task and checks, an open completion record, and append-only outcomes. The
current loop schema is v0.3.0. Each actionable learning must include a `nextTask.checks` array;
each check has an ID, kind, exact command, expected result, and `required` flag.

An outcome is v0.3.0 evidence. Every declared check carries its exact command, explicit working
directory, timestamps, exit code, and SHA-256 digests for captured stdout/stderr. A coding agent
must not hand-write a successful check claim. The design bundle remains the authority for
architecture decisions, constraints, and S13 evidence.

## Evidence and transitions

Evaluate the current route without changing files:

```text
npm exec -- sah loop .sah/sah.loop.json --json
```

Run the declared target checks in order. The working directory is explicit; SAH does not infer a
project root or inspect Git state. The command emits an outcome template with an empty learning
array for the agent to complete:

```text
npm exec -- sah loop-checks .sah/sah.loop.json --cwd /absolute/project --json > .sah/iteration-001.outcome.json
```

Record the outcome with an atomic append:

```text
npm exec -- sah loop-record .sah/sah.loop.json .sah/iteration-001.outcome.json --json
```

Missing, unknown, duplicate, command-mismatched, incomplete, or failed required evidence blocks a
`succeeded` write. A valid failed or partial outcome is retained and blocks the current iteration.

After a successful outcome, accept the highest-priority latest learning as a new planned
iteration. This is an explicit transition; it never changes product direction implicitly:

```text
npm exec -- sah loop-accept-next .sah/sah.loop.json --json
```

After failed or partial evidence, the current loop is blocked. `--repair` is required and marks
the new iteration with `repeated-failure` so the risk router can escalate it:

```text
npm exec -- sah loop-accept-next .sah/sah.loop.json --repair --json
```

The transition requires a latest learning with at least one unique required check. Invalid states,
missing proposals, and stale concurrent writes are atomic no-ops.

## Product-complete gate

Write a completion request whose criterion IDs exactly match `direction.successCriteria`. Every
criterion must contain one or more evidence references in the form `iterationId:checkId`:

```json
{
  "$schema": "https://sah.dev/schemas/iteration-completion/v0.1.0",
  "completionVersion": "0.1.0",
  "status": "completed",
  "criterionResults": [
    { "criterionId": "success-1", "evidenceRefs": ["iteration-001:lint"] }
  ]
}
```

Close the loop atomically:

```text
npm exec -- sah loop-complete .sah/sah.loop.json .sah/completion.json --json
```

The gate requires a completed current iteration, a succeeded latest outcome, no unresolved latest
`must` learning, and a recorded `passed`/exit-zero check for every referenced item. Unknown,
duplicate, missing, or non-passing references leave the loop unchanged. Completion is a local
deterministic product-direction terminal state; it is not S13, deployment, release approval, or
user acceptance. A new product direction starts a new loop artifact.

Results report `fast`, `reasoning`, `blocked`, or `complete`. Exit code 0 means fast-ready,
advanced, or complete; exit 1 means escalation or a valid transition/completion gate block; exit 2
means malformed or inaccessible artifacts or incomplete/operational check execution. The loop is a
work selector and evidence gate, not a hosted backlog, LLM judge, benchmark, telemetry, or Git
coordination service.
