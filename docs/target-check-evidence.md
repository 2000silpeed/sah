# Target-Check Evidence Bridge

This document owns the Phase 3 deterministic adapter that reuses a schema-valid
`sah-loop-checks` outcome during bundle verification. The canonical input is
[iteration-outcome.schema.json](../schemas/iteration-outcome.schema.json); the boundary decision
is [ADR-0027](adr/0027-bind-target-check-evidence-to-explicit-context.md).

## Command and library

```text
sah verify <bundle> <target> \
  --check-record <target-relative-iteration-outcome.json> \
  --target-revision <caller-supplied-revision> [--record <bundle-relative-record>] [--json]
```

The library equivalent is:

```ts
verifyBundle(bundleDirectory, targetDirectory, {
  checkRecordPath: ".sah/iteration-001.outcome.json",
  targetRevision: "git:abc123",
});
```

The record path is explicit, target-relative, forward-slash separated, and confined to a
non-symlink regular JSON file below the target root. SAH never discovers a loop file, Git state,
or a current working directory. `verify` reads the record once and does not execute its command.

## Supported observable tuple

```text
factSource: iteration-check-record
predicate: required-check-passed
expected: true
selector: <exact check ID emitted by sah loop-checks>
```

The adapter returns a deterministic pass only when the selected unique result has status `passed`
and exit code `0`, the outcome executor is `sah-loop-checks`, the outcome target revision equals
the explicit `--target-revision`, the design fingerprint equals the currently loaded bundle, and
the outcome/check cwd resolves to the explicit target. Output digests and the other command
envelope fields are schema-validated before the adapter runs.

The adapter can report a failed completed check as a deterministic violation. Unknown or duplicate
check IDs, incomplete execution, stale revision/fingerprint, wrong cwd, and unsupported tuples are
`unsupported`, so the overall verification is `incomplete`, never pass. Malformed, unsafe,
missing, unreadable, or schema-invalid records are operational errors. The adapter does not judge
test adequacy, semantic coverage, or whether a command is malicious/trivial; those remain S11,
Checker, or human judgment concerns. `loop-record` remains the authority for validating an
outcome against the originating loop declaration.

## Relationship to S13

The result remains runtime evidence. Supplying `--record` may publish the complete verification
result, and only an eligible full passed record can later support S12→S13. A target-check pass
does not itself claim that the test is sufficient, that a user scenario succeeded, or that a
judgment constraint passed. Existing filesystem and TypeScript adapter semantics are unchanged.

## Bookmark smoke fixture

[FP-007](../.agent/plans/run-28.md) exercises this boundary with the checked-in
[loopback-only server](../fixtures/bookmark-lineage/http-smoke-target/server.mjs) and
[smoke command](../fixtures/bookmark-lineage/http-smoke-target/smoke.mjs). The regression runs
the real `sah loop-checks` and `loop-record` path, verifies the exact two check IDs through the
production CLI, publishes a full record, and advances a disposable shared-operations bundle to
S13. The canonical direct-CLI and shared-operations snapshots are never modified; the fixture is
not an HTTP adapter or hosted-service contract.
