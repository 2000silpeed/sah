# SAH ExecPlan

An ExecPlan is a durable handoff: another agent must be able to resume from repository facts
alone. Completed history is preserved in [Runs 1–3](plans/run-1-3.md),
[Runs 4–7](plans/run-4-7.md), and [Runs 8–10](plans/run-8-10.md).

## Planning contract

Every active plan records outcome, included/excluded scope, constraints, milestones, decisions,
discoveries, exact verification, and handoff. Use `pending`, `in_progress`, `blocked`,
`complete`, or `superseded`; normally exactly one milestone is `in_progress`. Update after
progress, failure, discovery, decision, and verification. Preserve history, and supersede when
the outcome changes or more than half of remaining work must be reframed.

## Run 11 ExecPlan — 2026-08-18

### Outcome

A caller can persist a schema-validated verification record. An eligible full record is bound
to the current design snapshot and becomes the sole evidence for an atomic S12→S13 manifest
transition; changed-scoped, incomplete, violating, or operational-error records cannot pass.

### Scope

Included: one bundle-local verification-record schema, opt-in CLI/library record persistence,
design and record fingerprints, one exact manifest evidence descriptor, S13 gate evaluation,
atomic descriptor-plus-stage replacement, focused mutations, authority documentation, full
verification, diff review, and commits. Excluded: hosted coordination, a general evidence
database, LLM or human judge execution, exceptions, new fact adapters, benchmark changes, and
semantic IR changes.

### Constraints

- Runtime evidence stays outside the seven semantic IRs; the manifest names exactly one S13
  completion record without becoming a general evidence catalogue.
- `verifyBundle` retains result/status precedence and gains only opt-in bundle-local record
  publication; ordinary verification remains read-only.
- `advanceBundle` keeps exact-next semantics. S13 requires an explicit record path; earlier
  transitions retain their existing call shape and gate behavior.
- Only `scope=full`, `status=passed`, all-pass checks with complete S12 assignment coverage,
  matching bundle metadata, and a current design fingerprint can satisfy the S13 gate.
- Changed-scoped includes affected and full-fallback selection; neither can satisfy completion.
- Malformed, unreadable, unsafe, or concurrently changed evidence is operational. A valid but
  stale or non-passing record is a deterministic S13 gate error and blocks advancement.
- The manifest pins record path, schema ID, and byte digest in the same atomic replacement as
  `completedStage=S13`; semantic artifacts and target code are never written.
- Preserve CLI exit 0/1/2 meanings, public implementation-type isolation, and local-only
  lifecycle authority. Never push.

### Affected authority and evidence

Authoritative documents: `design-reasoning-model.md`, `validation-cli.md`,
`harness-architecture.md`, `architecture-model.md`, and `validation-model.md`. Runtime owners:
Model Repository, verification adapters, atomic manifest replacement, and thin CLI. The fixture
exercise traces `equipment-owns-writes` through decision `choose-equipment-module` and slice
`implement-equipment-operations`; benchmark inputs and expectations remain untouched.

### Milestones

| Phase | Milestone                                              | Status      | Evidence |
| ----- | ------------------------------------------------------ | ----------- | -------- |
| 0     | Frame evidence ownership and atomic completion contract | complete    | ADR-0014 |
| 1     | Add record and manifest schemas plus persistence      | complete    | schema/trace tests |
| 2     | Implement S13 record gate and atomic advance          | complete    | focused gate tests |
| 3     | Add library/CLI and adversarial mutations             | complete    | 88 focused tests |
| 4     | Update authority documentation and operating commands | complete    | authority docs and CLI usage |
| 5     | Run full verification, diff review, and commits       | in_progress | pending |

### Decision log

- 2026-08-18: Select a dedicated bundle-local record and an exact manifest descriptor over
  embedding results or introducing a general store. See ADR-0014.
- 2026-08-18: Bind eligibility to explicit invocation scope, not selection outcome; a changed
  full-fallback run is still change-scoped evidence.
- 2026-08-18: Pin both the semantic design snapshot and exact record bytes. The manifest commit
  grants lifecycle authority; record publication alone does not.

### Discovery log

- 2026-08-18: Run 10 ended clean at `56c4cab` with 211 tests and intentionally left persisted
  results and S13 advancement unsupported.
- 2026-08-18: Current verification already emits one check per assigned constraint and status
  precedence distinguishes violation, incomplete coverage, and operation failure. The S13 gate
  can validate recorded evidence without rerunning adapters or adding a compiler.
- 2026-08-18: Updating only `completedStage` would leave no durable evidence locator. Adding the
  record descriptor and stage in one manifest replacement preserves manifest authority without
  a multi-file transaction.
- 2026-08-18: A monolithic result schema exceeded the repository line budget. Split the exact
  public envelope into record, result, check, and diagnostic schemas; the record remains the
  sole lifecycle evidence artifact and the split introduces no storage abstraction.
- 2026-08-18: Typed lint rejected both a control-character regex and string spreading in the
  path guard. An indexed UTF-16 code-unit scan now expresses the ASCII control predicate
  without suppressing either rule.

### Verification log

- 2026-08-18: Re-read `AGENTS.md`, `docs/index.md`, the Run 10 handoff, lifecycle/verification
  authorities, schemas, repository/adapter/atomic seams, fixtures, and focused tests. Initial
  status was clean `main` at `56c4cab`.
- 2026-08-18: The first record-schema run exposed one trace omission and two strict-Ajv
  composition errors; all were repaired before runtime work, and 13 schemas/examples now
  compile with complete traces.
- 2026-08-18: After repairing two lint findings, formatting, lint, strict typecheck, and 106/106
  focused schema, manifest-migration, verification, advancement, and CLI tests passed. Mutations
  cover full success, both changed modes, incomplete, violation, operational-error, stale
  design, inconsistent status, byte tampering, and atomic pre-commit evidence conflict.

### Handoff

Run 11 is in progress. Resume at Phase 1 using ADR-0014; do not broaden the record descriptor
into a generic evidence registry or make changed-scoped verification eligible for completion.
