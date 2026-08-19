# Independent Checker review

Independent Checker review is SAH's portable method for obtaining a second, read-only look at a
material implementation slice. It is a judgment gate around evidence, not an LLM judge and not a
replacement for deterministic tests, target linting, or the S0–S13 lifecycle.

## Why use it

The coding agent that changes a target should not be the only agent deciding that the change is
complete. A separate host session or subagent can inspect the same explicit revision, run the
declared checks, look for scope/security/ownership mistakes, and record residual risk. The review
is useful only when its context is unambiguous and the reviewer cannot mutate the target.

Use the method when a Task contract, risk rule, or target owner requires a second pair of eyes—for
example, a security-sensitive boundary, a public API, an unfamiliar repository, or a milestone
handoff. Do not add it to every trivial edit merely for ceremony.

## Roles and authority

- The coding agent owns implementation and target checks.
- The independent Checker owns the factual contents of its review record. It is a separate
  session/subagent, uses a read-only worktree or equivalent discipline, and does not edit, commit,
  or push the target.
- The target owner decides whether the review is required and how to act on judgment findings.
- SAH owns only the JSON shape and mechanical consistency gate. It does not invoke a model,
  discover Git state, or change a bundle, loop, feature list, or S12/S13 stage.

The target workflow supplies an opaque `targetRevision`. SAH supplies or verifies the
`designFingerprint` from the canonical design bundle. Equality proves that the record names the
same context; it does not prove that the caller's revision token is truthful.

## Produce and validate a record

Create a canonical JSON record following
[the `checker-review` schema](../schemas/checker-review.schema.json). It requires:

- a task reference and artifact scope;
- target root, opaque revision, and `sha256:` design fingerprint;
- reviewer role `independent-checker`, independent/read-only flags, no target mutation, and no
  benchmark-expectation access;
- each exact command, working directory, classification, status, exit code, and evidence reference;
- findings with severity and disposition, residual risks, a verdict, and review time.

Validate it from the SAH checkout:

```text
npm exec -- sah checker-review /absolute/path/checker-review.json
npm exec -- sah checker-review /absolute/path/checker-review.json --json
npm exec -- sah checker-review /absolute/path/checker-review.json \
  --target-revision git:abc123 \
  --design-fingerprint sha256:<64-lowercase-hex> --json
```

The command is read-only. It returns:

- `passed` / exit `0` for `approve` only when every listed check has `status=passed` and
  `exitCode=0`, with no open high- or medium-severity finding;
- `violations` / exit `1` for a request to change or a mechanically invalid approval;
- `incomplete` / exit `2` for blocked or incomplete review coverage; and
- `operational-error` / exit `2` when the record cannot be read or the installed schema registry
  cannot run.

These statuses classify the review record. `passed` does not promote an architecture decision or
advance S12/S13 by itself. If a Task requires the review, the host records the validated path in
the Task/iteration evidence and asks the target owner to accept the judgment.

When expected revision and fingerprint are available, pass them explicitly. A context mismatch is
non-passing; SAH does not inspect Git or derive either value.

## Checker procedure

1. Read the target's `AGENTS.md`, current Task contract, active ExecPlan, and the declared scope.
2. Confirm the target revision and design fingerprint before inspecting implementation evidence.
3. Run the exact target formatter, linter, typecheck, test, build, SAH, and CI checks that the Task
   declares. Record command, cwd, status, exit code, and an evidence reference.
4. Inspect changed boundaries, ownership, invariants, security/privacy exposure, and deferred
   integrations. Do not read hidden benchmark expectations.
5. Record high/medium findings as open when they still block the Task; record residual risks even
   for an approval. Do not repair the target during the review.
6. Write the JSON record, validate it with `sah checker-review`, and hand the path and verdict to
   the target owner.

If context is stale, a required check is missing, the reviewer is not independent/read-only, or a
claim cannot be observed, use `incomplete` or `blocked`; never manufacture an approval.

## Relationship to other evidence

Deterministic target and SAH checks remain the first evidence class. The Checker may summarize
assisted findings and make a judgment assessment, but it must label the distinction in each record.
The iteration loop can list a Checker artifact as a required Task check, while `loop-record` and
`loop-complete` retain their existing evidence and revision gates. A full S13 verification record
and atomic S12→S13 advance remain mandatory where applicable.

The ARN dogfood Markdown review is a target-owned human view. New targets should keep the
schema-validated JSON record as canonical and may render Markdown from it for handoff readability.
