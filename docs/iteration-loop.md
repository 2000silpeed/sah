# Iteration loop

The iteration loop sits above one or more SAH design bundles. It does not replace S0–S13. It
routes a bounded task, records target-owned execution evidence, explicitly accepts a proposed next
task (or repairs a blocked one), and can close the local product direction only when every success
criterion points to recorded passing evidence.

## Canonical artifact

Create a schema-valid `.sah/sah.loop.json` containing product direction and success criteria, risk
rules, the current task and checks, an open completion record, and append-only outcomes. The
current loop schema is v0.4.0. Its required `workContext` binds the target root, a caller-owned
target revision token, the design-bundle path, and the `sha256:` fingerprint emitted by `sah
resume` or verification. Each actionable learning must include a `nextTask.checks` array;
each check has an ID, kind, exact command, expected result, and `required` flag.

For an agile product direction, add optional `direction.scenarios` entries with a stable ID,
plain-language description, and expected user-visible outcome. Select one or more of them in
`currentIteration.taskContract.slice` (or a proposed `nextTask.slice`) and name the exact
`acceptanceCheckIds` that prove the slice. If the product owner cannot state the observable
outcome or the acceptance boundary, the host agent should ask one or two consequential questions;
SAH never invents a product decision from a vague goal.

An outcome is v0.4.0 evidence. Every declared check carries its exact command, explicit working
directory, timestamps, exit code, and SHA-256 digests for captured stdout/stderr. A coding agent
must not hand-write a successful check claim. When a task has a slice, `sah loop-checks` also emits
`sliceEvidence`, linking every selected scenario to its acceptance checks. `loop-record` rejects a
successful slice with missing, unknown, stale, or non-passing scenario evidence. This proves
execution linkage, not human acceptance or semantic sufficiency. The design bundle remains the
authority for architecture decisions, constraints, and S13 evidence.

## Evidence and transitions

Evaluate the current route without changing files:

```text
npm exec -- sah loop .sah/sah.loop.json --json
```

Before the first check, bind the planned iteration to the exact target revision and design
fingerprint. SAH treats both values as opaque caller-supplied tokens; it never discovers Git state
or hashes the source tree:

```text
npm exec -- sah loop-bind .sah/sah.loop.json \
  --target-revision git:abc123 \
  --design-fingerprint sha256:<64-lowercase-hex> --json
```

Run the declared target checks in order. The working directory is explicit and must equal the loop
target root; revision and fingerprint must match the binding. The command emits an outcome template
with an empty learning array for the agent to complete:

```text
npm exec -- sah loop-checks .sah/sah.loop.json --cwd /absolute/project \
  --target-revision git:abc123 \
  --design-fingerprint sha256:<64-lowercase-hex> --json > .sah/iteration-001.outcome.json
```

Record the outcome with an atomic append:

```text
npm exec -- sah loop-record .sah/sah.loop.json .sah/iteration-001.outcome.json --json
```

Missing, unknown, duplicate, command-mismatched, incomplete, or failed required evidence blocks a
`succeeded` write. A valid failed or partial outcome is retained and blocks the current iteration.

After a successful outcome, accept the highest-priority latest learning as a new planned
iteration. This is an explicit transition; it never changes product direction implicitly:

The next transition must state the binding for the new iteration. It may be unchanged or reflect an
authorized target/design change:

```text
npm exec -- sah loop-accept-next .sah/sah.loop.json \
  --target-revision git:def456 \
  --design-fingerprint sha256:<64-lowercase-hex> --json
```

After failed or partial evidence, the current loop is blocked. `--repair` is required and marks
the new iteration with `repeated-failure` so the risk router can escalate it:

```text
npm exec -- sah loop-accept-next .sah/sah.loop.json --repair \
  --target-revision git:def456 \
  --design-fingerprint sha256:<64-lowercase-hex> --json
```

The transition requires a latest learning with at least one unique required check. Invalid states,
missing proposals, and stale concurrent writes are atomic no-ops.

The selected slice is copied into the next planned iteration only when the learning explicitly
contains it. The loop does not create scenarios, reorder them, or silently change product intent.

## Product-complete gate

Write a completion request whose criterion IDs exactly match `direction.successCriteria`. Every
criterion must contain one or more evidence references in the form `iterationId:checkId`:

```json
{
  "$schema": "https://sah.dev/schemas/iteration-completion/v0.2.0",
  "completionVersion": "0.2.0",
  "status": "completed",
  "workContext": {
    "targetRevision": "git:abc123",
    "designFingerprint": "sha256:<64-lowercase-hex>"
  },
  "criterionResults": [
    { "criterionId": "success-1", "evidenceRefs": ["iteration-001:lint"] }
  ]
}
```

Close the loop atomically:

```text
npm exec -- sah loop-complete .sah/sah.loop.json .sah/completion.json --json
```

When `direction.scenarios` is present, also provide exact `scenarioResults` coverage. Each result
uses a scenario ID and references passing evidence emitted by a slice that selected that scenario:

```json
"scenarioResults": [
  { "scenarioId": "create-reservation", "evidenceRefs": ["iteration-001:reservation-e2e"] }
]
```

The gate requires a completed current iteration, a succeeded latest outcome, matching loop,
latest-outcome, and completion-request contexts, no unresolved latest `must` learning, and a
recorded `passed`/exit-zero check for every referenced item. Unknown, duplicate, missing, or
non-passing criterion or scenario references leave the loop unchanged. Completion is a local
deterministic product-direction terminal state; it is not S13, deployment, release approval, or
user acceptance. A new product direction starts a new loop artifact.

Results report `fast`, `reasoning`, `blocked`, or `complete`. Exit code 0 means fast-ready,
advanced, or complete; exit 1 means escalation or a valid transition/completion gate block; exit 2
means malformed or inaccessible artifacts or incomplete/operational check execution. The loop is a
work selector and evidence gate, not a hosted backlog, LLM judge, benchmark, telemetry, or Git
coordination service.

## Optional bounded continuous mode

If the user wants the agent to keep going after each green iteration, opt in explicitly and set a
bound. This is a skill execution policy over the existing commands, not a new CLI writer:

```text
Use $sah in bounded continuous mode for at most 8 iterations. Continue ready slices and checks;
pause at any unresolved decision, risk escalation, failed evidence, or required review.
```

The host agent then repeats the normal inspect → implement → target checks → `loop-checks` →
`loop-record` → `loop-accept-next` sequence. It may accept only the latest learning that already
declares executable checks; it never generates product direction, silently answers a stakeholder,
or treats an empty learning list as completion. The mode stops with a resumable handoff when the
bound is exhausted, the route is `reasoning`/`blocked`, evidence is failed/partial/incomplete/
operational, context is stale, checks are missing, a Checker or user decision is required, or the
S13/full-verification gate remains. Default interactive behavior and every CLI/library exit code
are unchanged. Existing atomic writes mean an interrupted session resumes from the last committed
iteration.
