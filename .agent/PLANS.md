# SAH ExecPlans

An ExecPlan is a durable handoff: another agent must be able to resume from repository facts
alone. Completed history is preserved in [Runs 1–3](plans/run-1-3.md).

## Planning contract

Every active plan records outcome, included/excluded scope, constraints, milestones, decisions,
discoveries, exact verification, and handoff. Use `pending`, `in_progress`, `blocked`,
`complete`, or `superseded`; normally exactly one milestone is `in_progress`. Update after
progress, failure, discovery, decision, and verification. Preserve history, and supersede when
the outcome changes or more than half of remaining work must be reframed.

## Run 4 ExecPlan — 2026-08-17

### Outcome

Architecture IR canonically represents a candidate set, deterministic S8 candidate-count or
single-candidate evidence rules are executable, and `sah advance <bundle> S8` commits an exact
S7→S8 transition only after those rules pass.

### Scope

Included: coordinated Architecture/manifest schema migration, candidate topology and evidence
references, S8 and revised S10 gates, reference checks, S8 advance support, migrated fixture,
tests, docs, verification, and commits. Excluded: S9 quality coverage gate, contextual candidate
coherence/material-difference judgments, reasoning prompts, renderers, code adapters, services,
and benchmark scoring. No benchmark IR, expectations, or stakeholder input changes.

### Constraints

- Repair the singular candidate premise; do not retain parallel legacy/new authority.
- Deterministically check only serialized count, status, evidence, and references.
- One candidate requires short-path or forcing-constraint evidence; two or more satisfy count.
- At S8/S9 all candidates are proposed; from S10 exactly one is selected and others rejected.
- Successful advance changes only manifest `completedStage`; retain Run 3 atomicity behavior.
- Every new property has writer/readers; public types expose no Ajv/fs types; never push.

### Milestones

| Phase | Milestone | Status | Evidence |
|---|---|---|---|
| 0 | Frame canonical migration and S8 contract | complete | `3c9ddd7`; ADR-0008 |
| 1 | Migrate schemas, fixture, types, and references | complete | v0.2 examples/traces pass |
| 2 | Implement S8/S10 gates and advance support | complete | 67 library/production CLI tests |
| 3 | Document, verify, and review | in_progress | authority and final audits pending |

### Decision log

- 2026-08-17: Prefer one clean plural candidate source over a legacy field plus adapter or a
  short-path-only gate. Coordinate Architecture and manifest schema v0.2.0. See ADR-0008.
- 2026-08-17: Candidate coherence, material difference, and proportionality adequacy remain
  judgment. S8 blocks only on fixed structural/evidence predicates.

### Discovery log

- 2026-08-17: Run 3 ended clean at `7c6ee31` with 47 tests and only S5/S6/S7/S10/S11 advance
  targets. Its handoff named S8.
- 2026-08-17: Architecture v0.1 serializes one candidate and global topology, while S8 authority
  requires multiple candidates or structured single-candidate evidence. A gate alone would make
  normal full-path S8 impossible and cannot trace the dogfood short-path claim.
- 2026-08-17: S9 quality assessments lack candidate identity; add the reference now so candidate
  ownership is unambiguous, but defer S9 coverage enforcement to the next slice.
- 2026-08-17: The first strict typecheck rejected three optional diagnostic references under
  `exactOptionalPropertyTypes`; conditional fields now retain the public omission contract.

### Verification log

- 2026-08-17: Re-read `AGENTS.md`, the completed plan, docs index, S8/S10 authority, dogfood R2,
  current schemas, fixture, types, reference/stage validators, advance tests, and git history.
- 2026-08-17: Initial `git status --short --branch` reported only `## main`.
- 2026-08-17: Architecture/manifest v0.2 examples and trace audit passed. Format, lint, strict
  typecheck, and 67 tests passed across five files, including S8 success/block/reference/status
  families, v0.1 rejection, S10 disposition, and production CLI S7→S8.

### Handoff

Update architecture, validation, CLI, glossary, index, and operating docs, then run the full
production verification and adversarial diff audit.
