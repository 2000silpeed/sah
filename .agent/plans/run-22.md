# Run 22 ExecPlan — 2026-08-20

### Compiled task and boundaries

Goal: promote the independent Checker used by the ARN dogfood run into a reusable SAH
judgment-review method that records revision-bound evidence and prevents an agent from approving
its own work without an independent read-only review.

Context: SAH already separates deterministic, assisted, and judgment capabilities, and Run 21
binds local iteration evidence to caller-supplied target revisions and design fingerprints. The
ARN review proved that a separate subagent can run the declared gates, inspect residual risks, and
record an approval without mutating the target. The current SAH runtime has no portable contract
for that record, so each target would otherwise invent an incompatible Markdown handoff.

Constraints: preserve S0–S13 and S13 lifecycle authority, existing CLI/library boundaries and
exit meanings, explicit non-Git revision ownership, local single-writer operation, and target-
owned checks. Do not invoke an LLM, host coordination service, general evidence database,
benchmark expectations, release automation, or infer repository state. A Checker verdict remains
judgment evidence; schema validation must not turn it into a deterministic architecture pass.

Done when: a schema-validated, revision-bound Checker review record and public read-only
`sah checker-review`/`validateCheckerReview` surface exist; approval is mechanically blocked by
non-passing checks or open high/medium findings; the portable skill, reference docs, ADR, index,
fixture, and focused tests define the independent handoff; schema/trace audit, format, lint,
typecheck, build, full tests, CLI smoke, link/budget review, and `git diff --check` pass; a
meaningful milestone commit is created without pushing.

### Scope

Included: `checker-review` v0.1.0 schema, public review result and validator, read-only CLI
command, valid fixture, independent-review protocol reference, docs/index and portable skill
updates, ADR-0022, focused contract/CLI tests, full verification, and a local milestone commit.

Excluded: invoking or scheduling subagents, hosted/multi-writer coordination, automatic target or
Git revision discovery, lifecycle mutation, S13 completion changes, LLM judge implementation,
benchmark changes, provider adapters, and automatic status edits in a target feature list.

### Authority and accepted design

The target workflow owns the meaning and freshness of `targetRevision`, the SAH bundle owns the
`designFingerprint`, and the independent Checker owns the factual contents of its own review
record. SAH owns only the record shape and deterministic consistency gate. `sah checker-review`
validates the artifact, reports the supplied verdict, and never changes a bundle, loop, or target.

The record requires an explicit scope, revision/fingerprint, read-only independent reviewer,
exact check commands/cwds/statuses, evidence references, residual risks, and a verdict. An
`approve` verdict is reported as `passed` only when every listed check passed and no open
high/medium finding remains. This is a review-contract result, not proof that a judgment proposition
is objectively true; the target owner still decides whether a task requires the gate.

### Milestones

| Phase | Milestone | Status |
| --- | --- | --- |
| 0 | Inspect validation, CLI, skill, and judgment boundaries | complete |
| 1 | Record Run 22 plan and ADR-0022 | complete |
| 2 | Add review schema, public types, validator, and fixture | complete |
| 3 | Add CLI surface and portable independent-review protocol | complete |
| 4 | Focused/full verification, diff review, and milestone commit | complete |

### Decision and discovery log

- 2026-08-20: Use a local JSON record plus read-only validation rather than a service or hidden
  reviewer registry. This keeps evidence portable across sessions and preserves SAH's local
  hybrid topology.
- 2026-08-20: Keep the review gate separate from `loop-record` and `loop-complete`. A task may
  require a Checker through its own done contract, but SAH must not silently change existing loop
  or S13 authority while formalizing a judgment handoff.
- 2026-08-20: A compact review record is sufficient when it carries exact command/cwd/exit
  evidence and a human-readable evidence reference; SAH does not copy command output into a
  second evidence database.
- 2026-08-20: The validator accepts optional caller-supplied expected revision/fingerprint flags
  and rejects mismatches. This preserves Run 21's explicit-context rule without making Checker
  review depend on Git discovery or loop mutation.

### Verification log

- 2026-08-20: Draft 2020-12 schema examples and writer/reader trace audit passed, including the
  new `checker-review` schema.
- 2026-08-20: Focused Checker, CLI, skill-contract, schema, format, lint, typecheck, build, and
  full 256-test suite passed. The production fixture command returned `passed` with exit 0.
- 2026-08-20: `git diff --check` passed. Existing S0–S13, loop, verification, and exit-code tests
  remained green; the new command is read-only and does not alter lifecycle code.
- 2026-08-20: Independent Checker review returned `APPROVE`; no high- or medium-severity finding
  remains. The review was read-only, did not read benchmark expectations, and verified the frozen
  256-test diff plus valid/stale Checker CLI behavior.
- 2026-08-20: The independent Checker review gate milestone was committed locally with message
  `feat: add independent checker review gate`; no SAH remote push was performed.

### Handoff

Run 22 implementation and verification are complete; the local milestone commit records this
handoff. A later session should read this plan,
`docs/adr/0022-independent-checker-review-as-a-judgment-gate.md`, and `docs/checker-review.md`
before changing the review contract.
