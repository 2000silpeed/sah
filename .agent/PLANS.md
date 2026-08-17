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

| Phase | Milestone                                       | Status   | Evidence                                 |
| ----- | ----------------------------------------------- | -------- | ---------------------------------------- |
| 0     | Frame canonical migration and S8 contract       | complete | `3c9ddd7`; ADR-0008                      |
| 1     | Migrate schemas, fixture, types, and references | complete | v0.2 examples/traces pass                |
| 2     | Implement S8/S10 gates and advance support      | complete | 67 library/production CLI tests          |
| 3     | Document, verify, and review                    | complete | `b1afb00`; full loop and diff audit pass |

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

| Phase | Milestone                                     | Status   | Evidence                         |
| ----- | --------------------------------------------- | -------- | -------------------------------- |
| 0     | Frame S9 observable predicate and plan        | complete | `2c69efb`                        |
| 1     | Implement S9 gate, advance, and focused tests | complete | 89 tests pass                    |
| 2     | Update affected authority documentation       | complete | S9/CLI/runtime authority aligned |
| 3     | Run full verification and adversarial review  | complete | full loop and diff audit pass    |

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
- 2026-08-17: `selectedOptionRef` already admits `null` and is written by S10, so S9 can reject
  early option selection without schema churn. Other S10-authored Decision fields are required
  by the current schema and remain outside this slice rather than triggering a redesign.

### Verification log

- 2026-08-17: Re-read `AGENTS.md`, the Run 4 handoff, index, S9 reasoning/validation authority,
  current schemas, fixture, internal model, stage validator, advance implementation, and tests.
- 2026-08-17: Initial `git status --short --branch` reported only `## main`.
- 2026-08-17: After implementation, formatting, lint, strict typecheck, and 89/89 tests passed
  across six files. The 17 S9 tests cover Cartesian/missing/duplicate/priority behavior,
  assisted non-pass review, candidate/decision/option stage state, and dangling references.
- 2026-08-17: Architecture, reasoning, validation, CLI, harness, dogfood, glossary, index,
  ADR-0007, and operating guidance now agree on S9 coverage and S8→S9 support. Local Markdown
  links, file budgets, and `git diff --check` passed.
- 2026-08-17: Final loop: `npm install` was current (164 packages, 0 vulnerabilities);
  `format:check`, lint, strict typecheck, 89/89 tests, production build, and the 4/4
  schema/example/trace suite passed. Human and JSON simple-crud validation returned exit 0.
- 2026-08-17: Production advancement evidence: complete S8→S9 returned exit 0; a `risk` result
  returned exit 0 with `STAGE_S9_MUST_SCENARIO_REVIEW`; missing coverage returned exit 1 with
  `STAGE_S9_MUST_ASSESSMENT_MISSING`, and the manifest SHA-1 stayed identical; unsupported
  S11→S12 returned operational exit 2 with `ADVANCE_STAGE_UNSUPPORTED`.
- 2026-08-17: Baseline `739cddb` diff audit found no benchmark changes, whitespace errors,
  broken links, over-budget docs, network/model calls, public Ajv/fs types, stage-order errors,
  duplicate-pair false passes, CLI leakage, or speculative interfaces. Deterministic checks
  passed; the assisted warning was exercised; no scenario/trade-off judgment or judge ran.

### Handoff

Run 5 is complete. Next, define the canonical S12 implementation-handoff artifact and gate,
recording the consequential IR/manifest choice before enabling exact S11→S12 advancement.

## Run 6 ExecPlan — 2026-08-17

### Outcome

Implementation Handoff IR canonically assigns selected architecture work to executable slices,
the Model Repository deterministically validates S12 readiness and blockers, and
`sah advance <bundle> S12` commits an exact S11→S12 transition only after those rules pass.

### Scope

Included: a seventh semantic IR and schema, manifest v0.3 declaration, fixture migration,
cross-IR and dependency checks, S12 gates, exact advancement, focused library/CLI tests,
authority docs, verification, and commits. Excluded: product-code generation, constraint
execution, source adapters, renderers, LLM reasoning or judging, hosted services, benchmark
scoring, and a general workflow engine. Benchmark inputs and expectations remain untouched.

### Constraints

- Implementation handoff is semantic S12 output, not lifecycle/storage metadata or an
  Architecture field; ADR-0009 owns the representation choice.
- A slice names selected elements, applicable constraints, accepted decisions, proposed
  blockers, explicit dependencies, acceptance checks, migration, rollback, and ready/blocked
  state.
- S12 deterministically checks only serialized identity, status, coverage, references, and
  dependency graph facts; implementation quality and slicing wisdom remain contextual.
- Successful advance changes only manifest `lifecycle.completedStage`; retain Run 3 atomicity.
- Every new property has writer/readers; public types expose no Ajv/fs types; never push.

### Milestones

| Phase | Milestone                                                | Status   | Evidence               |
| ----- | -------------------------------------------------------- | -------- | ---------------------- |
| 0     | Frame canonical S12 representation and predicates        | complete | `e12b046`; ADR-0009    |
| 1     | Add schema, manifest migration, types, and references    | complete | v0.3/v0.1 schemas pass |
| 2     | Implement S12 gates, advance, fixture, and focused tests | complete | 112 tests pass         |
| 3     | Update authority documentation                           | complete | S12 contracts aligned  |
| 4     | Run full verification and adversarial review             | complete | full loop/audit pass   |

### Decision log

- 2026-08-17: Add Implementation Handoff as a seventh semantic IR. Architecture owns selected
  structure, while S12 owns change slicing and coding-agent context; the manifest remains
  non-semantic. See ADR-0009.
- 2026-08-17: Represent order as explicit slice dependencies. Reject self-dependencies and
  cycles; do not infer order from array position or add an orchestration engine.
- 2026-08-17: Treat a constraint as applicable when its scoped elements intersect the selected
  candidate. Require assignment to a slice covering at least one such scoped element.
- 2026-08-17: At S12, replace the earlier assisted proposed-decision isolation warning with
  deterministic blocker coverage because slices make affected elements and blockers observable.

### Discovery log

- 2026-08-17: Run 5 ended clean at `66888bd` with 89 tests and named canonical S12 handoff as
  the next slice.
- 2026-08-17: ADR-0003 deliberately permits another IR when a real consumer appears. S12 has a
  distinct writer, gate, and coding-agent/S13 consumers, while ADR-0006 reserves the manifest
  for lifecycle and storage metadata.
- 2026-08-17: Architecture and Decision IR already serialize selected-element, constraint,
  accepted-decision, and proposed-decision applicability inputs. Only slice ownership,
  dependency, verification, migration, rollback, and blocker assignment are absent.
- 2026-08-17: S10's assisted isolation warning must stop at S11. At S12 the handoff makes
  affected-slice blocker coverage observable, so missing coverage is a deterministic error.
- 2026-08-17: The first full test run had only the two expected obsolete S12-unsupported
  assertions fail; after replacing those contracts and adding focused mutations, 112 tests
  pass across seven files.
- 2026-08-17: Final review found the obsolete S11→S12 unsupported case needed a replacement,
  not only removal. S12→S13 now proves exact-next unsupported behavior in library and CLI tests.

### Verification log

- 2026-08-17: Re-read `AGENTS.md`, Run 5 handoff, index, S12 reasoning authority, IR ownership,
  validation classifications, ADR-0003/0006/0007, schemas, fixture, runtime seams, and tests.
- 2026-08-17: Initial `git status --short --branch` reported only `## main`.
- 2026-08-17: Manifest v0.3, Implementation Handoff v0.1, all embedded examples, and every
  schema property trace pass Draft 2020-12 validation. Format, lint, strict typecheck, and
  112/112 tests pass, including all handoff reference families, S11→S12 atomicity, and the
  unsupported S12→S13 boundary.
- 2026-08-17: Architecture, reasoning, validation, harness, CLI, dogfood, glossary, index,
  ADR-0003/0006/0007/0009, and `AGENTS.md` now agree on the seventh IR, manifest v0.3, S12
  deterministic boundary, exact commands, and S11→S12 support.
- 2026-08-17: Final loop: `npm install` was current (164 packages, 0 vulnerabilities);
  `format:check`, lint, strict typecheck, 112/112 tests, standalone production build, and the
  4/4 schema/example/trace suite passed. All eight Draft 2020-12 schemas are registered.
- 2026-08-17: Production CLI evidence: valid human and JSON validation returned exit 0;
  complete S11→S12 returned exit 0 and stored S12; missing accepted-decision context returned
  exit 1 with `STAGE_S12_ACCEPTED_DECISION_MISSING` and stored S11; malformed JSON returned
  exit 2 with `JSON_MALFORMED` and line/column.
- 2026-08-17: Baseline `66888bd` diff audit passed: `git diff --check`, 27-file local-link and
  line-budget audits, no benchmark changes, no public Ajv/filesystem declarations, no network
  or model calls, and no semantic dependence on CLI formatting. The first link-audit script
  had an async construction error and was corrected; the first temporary CLI harness was
  rejected for shell deletion and rerun with validated Node cleanup.
- 2026-08-17: No benchmark judge exists or ran. Deterministic simple-crud fixture validation
  passed; assisted and judgment benchmark scoring remain outside this slice and were not
  claimed.

### Handoff

Run 6 is complete. Next, implement one narrow S13 source-fact adapter and execute one accepted
deterministic constraint end to end, while reporting missing mappings as `unsupported` rather
than pass.
