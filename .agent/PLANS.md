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
| 3 | Document, verify, and review | complete | `b1afb00`; full loop and diff audit pass |

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
- 2026-08-17: Architecture, reasoning, validation, harness, CLI, dogfood, glossary, index,
  operating guidance, and ADR-0007 now agree on candidate-set semantics and S8 support. Local
  Markdown links, file budgets, formatting, and `git diff --check` passed.
- 2026-08-17: Final loop: `npm install` was current (164 packages, 0 vulnerabilities);
  `format:check`, lint, strict typecheck, 67/67 tests, production build, and the 4/4
  schema/example/trace suite passed. The package binary validated simple-crud in JSON mode.
- 2026-08-17: Production CLI evidence: valid human/JSON and S7→S8 returned exit 0; a missing
  single-candidate justification returned exit 1 with
  `STAGE_S8_SINGLE_CANDIDATE_JUSTIFICATION_MISSING`; unsupported S8→S9 returned exit 2 with
  `ADVANCE_STAGE_UNSUPPORTED`. The blocked manifest remained S7.
- 2026-08-17: Baseline diff audit passed: no benchmark changes, whitespace errors, broken local
  links, over-budget documents, network/model calls, or Ajv/filesystem public declarations.
  Deterministic checks passed; the existing assisted proposed-decision warning is covered by a
  passing test; no candidate-coherence/material-difference judgment or benchmark judge ran.

### Handoff

Run 4 is complete. Next, implement the S9 quality-assessment coverage gate and exact S8→S9
advance while keeping scenario satisfaction and trade-off quality assisted/judgment.

## Run 5 ExecPlan — 2026-08-17

### Outcome

The Model Repository deterministically proves complete, non-duplicated must-scenario coverage
for every architecture candidate at S9, and `sah advance <bundle> S9` commits an exact S8→S9
transition only after that gate passes.

### Scope

Included: S9 assessment coverage/status checks, an assisted non-pass review finding, S9 advance
support, focused library and production CLI tests, authority docs, verification, and commits.
Excluded: schema migration, scenario-satisfaction proof, candidate/trade-off judgment, S10
selection changes, LLMs, fact adapters, renderers, services, and benchmark scoring. Benchmark
inputs and expectations remain untouched.

### Constraints

- Coverage is the Cartesian product of `must` quality scenarios and candidates, exactly once.
- Missing/duplicate pairs and pre-S10 candidate/decision status are deterministic errors.
- A non-pass must assessment is an assisted warning; it does not block advancement by itself.
- Reuse canonical IDs and the current v0.2 Architecture shape; add no parallel representation.
- Success changes only manifest `completedStage`; preserve atomicity and public API boundaries.
- Public types expose no Ajv/fs types; tests use no network/model; never push.

### Milestones

| Phase | Milestone | Status | Evidence |
|---|---|---|---|
| 0 | Frame S9 observable predicate and plan | in_progress | authority/runtime inspection complete |
| 1 | Implement S9 gate, advance, and focused tests | pending | — |
| 2 | Update affected authority documentation | pending | — |
| 3 | Run full verification and adversarial review | pending | — |

### Decision log

- 2026-08-17: Treat duplicate candidate/scenario pairs as violations, not redundant coverage;
  two canonical results for one pair are ambiguous even when their values match.
- 2026-08-17: Warn on `risk`, `fail`, or `unknown` must results as assisted review evidence.
  The enum is observable, but whether the measure is met or risk is acceptable is contextual.
- 2026-08-17: Require S9 decision records to remain `proposed`; S10 owns disposition. Do not
  attempt to validate the contextual quality of options or risk acceptance in this slice.

### Discovery log

- 2026-08-17: Run 4 ended clean at `739cddb` with 67 tests and named S9 coverage as handoff.
- 2026-08-17: Architecture v0.2 already carries assessment `candidateRef` and `result`; System
  Characterization carries scenario `priority`; Decision IR carries `status`. No schema or new
  ADR is needed for the fixed S9 predicates.
- 2026-08-17: The current fixture has one candidate, one must scenario, and one assessment, so
  it already contains the valid Cartesian baseline; advancement fixtures must only restore S9
  statuses to `proposed` before evaluating the target gate.

### Verification log

- 2026-08-17: Re-read `AGENTS.md`, the Run 4 handoff, index, S9 reasoning/validation authority,
  current schemas, fixture, internal model, stage validator, advance implementation, and tests.
- 2026-08-17: Initial `git status --short --branch` reported only `## main`.

### Handoff

Implement the fixed S9 predicate without schema churn, then update docs and run the complete
source/CLI/schema/diff verification loop.
