# Independent Checker handoff

Use this method when the Task contract or risk router requires a second agent to verify a material
slice. The Checker is a separate host session/subagent with read-only discipline. It runs declared
checks and records judgment findings; it does not edit, commit, push, invoke a model through SAH,
or mutate lifecycle state.

Before dispatch, give the Checker:

1. the target root and exact opaque target revision;
2. the current SAH design-bundle fingerprint and Task scope;
3. the target's AGENTS/ExecPlan and the exact commands allowed for this review; and
4. an explicit instruction not to read benchmark expectations or change files.

The Checker must return a schema-valid `checker-review` JSON record. Each check includes its exact
command, cwd, classification (`deterministic`, `assisted`, or `judgment`), status, exit code, and
evidence reference. The reviewer fields must state `independent-checker`, `independent: true`,
`readOnly: true`, `mutatedTarget: false`, and `benchmarkExpectationsRead: false`.

Validate the returned file with:

```text
npm exec -- sah checker-review /absolute/path/checker-review.json --json
npm exec -- sah checker-review /absolute/path/checker-review.json \
  --target-revision git:abc123 \
  --design-fingerprint sha256:<64-lowercase-hex> --json
```

Only an `approve` with all checks passed at exit code zero and no open high/medium finding is a
passing review record. `request-changes` is a violation; `blocked` and `incomplete` are non-passing
coverage. A passing review is judgment evidence and never advances S0–S13, changes a loop, or
replaces full S13 verification. When the caller knows the expected revision/fingerprint, pass both
flags so stale review evidence is rejected; SAH never discovers Git state.

If the record names a stale revision/fingerprint, omits a required check, or the Checker could not
observe a claim, preserve the non-passing result and ask the target owner to repair the context or
Task contract. Do not downgrade it to a warning just to keep the loop moving.

Read [Independent Checker review](../../../docs/checker-review.md) for the canonical field meanings,
authority boundary, and handoff procedure.
