# SAH ExecPlans

This file defines the planning contract for repository work and contains the current
bootstrap plan. An ExecPlan is a durable handoff: a capable agent must be able to resume it
from the repository alone.

## Required plan structure

Every plan records:

1. **Outcome** — the externally observable condition that ends the plan.
2. **Scope** — included work, excluded work, and any explicitly allowed spike.
3. **Constraints** — safety, quality, compatibility, and evidence requirements.
4. **Milestones** — ordered, independently verifiable bodies of work.
5. **Decision log** — consequential choices, alternatives, costs, and ADR links.
6. **Discovery log** — facts learned during execution that change risk or approach.
7. **Verification log** — commands or reviews run, their results, and unresolved failures.
8. **Handoff** — the next concrete action when the plan is not complete.

Plans refer to authoritative documents instead of copying their content.

## Status vocabulary

- `pending`: not started and not currently actionable ahead of earlier milestones.
- `in_progress`: active work; exactly one milestone should normally have this status.
- `blocked`: progress needs one of the three user decisions allowed by the source brief.
- `complete`: acceptance evidence exists and no scoped work remains for the milestone.
- `superseded`: a newer plan or ADR deliberately replaces this work; link the replacement.

Do not use percentages. A milestone remains `in_progress` until its acceptance condition is
met. A failed check is evidence, not completion.

## Update and supersession rules

Update the active plan when work advances, a check fails or passes, a relevant fact is
discovered, or a decision changes downstream work. Append dated entries; preserve earlier
facts even if later corrected. Amend milestone scope when a discovery is compatible with
the outcome and constraints, recording the reason in the discovery log.

Supersede rather than edit history when the outcome changes, an architectural decision
invalidates the milestone sequence, or more than half the remaining work must be reframed.
The replacement plan must name the superseded plan and carry forward unresolved evidence.
Only the user may authorize a scope change that crosses the source brief's ask conditions.

## Bootstrap ExecPlan — 2026-08-17

### Outcome

Leave a validated, navigable intellectual and architectural foundation from which another
agent can implement the Software Architect Harness without needing unstated decisions.

### Scope

Included: vision, principles, prior-art verdicts, methodology selection, reasoning model,
IRs and JSON Schemas, harness architecture, ADRs, benchmark specifications, two dogfood
walkthroughs, and verification evidence.

Excluded: engine, CLI, validator, service, and production-prompt implementation. At most one
non-production spike of 150 lines is allowed if argument cannot settle a schema or
determinism question.

### Constraints

- Repository artifacts are English except Korean glossary equivalents.
- Each document is at most 400 lines; `AGENTS.md` is at most 200 lines.
- Responsibilities and invariants precede representation choices.
- Methods are selected per subsystem; no methodology is the default winner.
- Every artifact and field has a downstream reader.
- Prior-art claims use real URLs or are marked `recalled, unverified`.
- All JSON Schemas target draft 2020-12 and pass a real validator.
- No remote push is permitted in this run.

### Milestones

| Phase | Milestone | Status | Acceptance evidence |
|---|---|---|---|
| 0 | Initialize Git and define ExecPlans | complete | `.git/`; this planning contract |
| 1 | Compare five prior-art categories | complete | `docs/prior-art.md`; 12 distinct cited sources |
| 2 | Define iterative design reasoning | complete | S0–S13 contracts and ten-question map documented |
| 3 | Define traced IRs and schemas | complete | 6 Draft 2020-12 schemas, examples, and trace audit pass |
| 4 | Decide SAH architecture and delivery | complete | component contracts, validator catalogue, ADR-0001–0004 |
| 5 | Specify eight benchmarks | complete | 8 directories × 3 files; distinct coverage vectors |
| 6 | Dogfood two contrasting cases | complete | `docs/dogfood.md`; five model repairs; schemas revalidated |
| 7 | Evaluate and verify the foundation | complete | rubric 5/5/5/4/4; all 11 DoD checks pass |

### Decision log

- 2026-08-17: Preserve the source prompt at repository root as provenance. It is not a
  normative product document; `AGENTS.md` and `docs/index.md` will route future readers.
- 2026-08-17: Use one continuous bootstrap ExecPlan because all phases share a single
  acceptance boundary. Phase commits are recovery points, not separate plans.
- 2026-08-17: Treat SAH's novelty as the traced method-selection-to-enforcement chain, not as
  a new specification workflow, architecture notation, ADR format, validator, or agent loop.
- 2026-08-17: Use mandatory reasoning questions with risk-scaled evidence, not optional
  stages. The short path compresses artifacts but cannot silently omit ownership or risk.
- 2026-08-17: Strategy selection is provisional until responsibility and invariant analysis
  confirm it; representation remains forbidden until ownership and boundary design.
- 2026-08-17: Use six canonical IRs without a common serialized base or methodology IR.
  Stable IDs link artifacts; storage revision metadata remains outside semantic IR.
- 2026-08-17: Make `x-sah-trace.writtenBy/readBy` the authoritative field trace table. A
  generated audit is safer than duplicating every JSON pointer in prose.
- 2026-08-17: Deliver first as an agent-neutral skill plus local CLI over a reusable semantic
  library. Do not require a service until collaboration or centralized policy is measured.
- 2026-08-17: JSON IR is canonical; Markdown ADRs and diagrams are linked views, never a
  second source reconstructed by parsing prose.
- 2026-08-17: Classify enforcement as deterministic, assisted, or judgment according to
  observability. Unsupported fact extraction is coverage failure, never pass.
- 2026-08-17: Score benchmarks on a 100-point common rubric with a fatal-failure cap of 49
  and an explicit over-engineering penalty up to 20 points.
- 2026-08-17: Use two independent LLM judges for contextual categories and human arbitration
  for disagreement/fixture changes; deterministic checks own structural evidence only.
- 2026-08-17: S2 records representation-free composition seams; only S6 may decide owned
  interaction mechanisms, consistency, failure, and translation contracts.
- 2026-08-17: Short-path S8 may keep one architecture candidate when S2 alternatives and
  proportionality evidence show that a second candidate would be ceremony.
- 2026-08-17: Unresolved policy blocks only dependent implementation slices when isolated
  behind an owned seam; non-isolatable authority still blocks architecture selection.
- 2026-08-17: Strategy IDs are registry-extensible and representation supports namespaced
  extensions; the initial closed enums failed methodology-neutrality self-review.

### Discovery log

- 2026-08-17: The directory contained only the source prompt and was not a Git repository,
  matching the brief. No pre-existing user work needs reconciliation.
- 2026-08-17: GitHub Spec Kit is the closest overlap, but its published core does not make
  methodology selection, responsibility/invariant ownership, or constraint compilation a
  first-class contract. Reassess extension-over-product if that changes.
- 2026-08-17: Current behavior of ts-arch, Deptrac, and NetArchTest was not verified within
  the stopped-early research pass; adapters must not be designed from recall.
- 2026-08-17: A subsystem must remain a problem-reasoning scope until S6/S7. Naming it a
  service, module, class, or pipeline during characterization is a gate failure.
- 2026-08-17: Mixed-method design requires composition contracts; otherwise per-subsystem
  method neutrality merely moves incoherence to the boundaries.
- 2026-08-17: JSON Schema proves shape, not cross-file references or stage sufficiency. Full
  verification will need separate reference, semantic-gate, and code-fact validators.
- 2026-08-17: S5 ownership precedes architecture elements, so it reserves logical owner IDs;
  S6 must materialize every reserved owner or the bundle fails reference validation.
- 2026-08-17: Evaluation must drive only public skill/CLI/library surfaces and cannot expose
  benchmark expectations to product components during a run.
- 2026-08-17: Similar distribution ratings are deliberate across logistics, payment,
  realtime, and enterprise integration; their discriminators are custody/time, atomic value,
  convergence/latency, and semantic translation respectively.
- 2026-08-17: Simple CRUD exposed invalid negative evidence and a short-path/candidate-count
  contradiction. Data processing exposed premature composition, temporal invariant, and
  global-readiness defects. Expectations were not weakened.
- 2026-08-17: Time-bounded invariants need structured `applicability`; otherwise source
  immutability and mandated privacy deletion look irreconcilable.
- 2026-08-17: The initial filtered listing missed an earlier untracked bootstrap prompt and
  `.DS_Store`. Phase 7 preserved the prompt as non-normative provenance and ignored, but did
  not delete, Finder metadata. The earlier “only source prompt” observation was incomplete.
- 2026-08-17: Benchmark discriminative power and ceremony score 4 rather than 5 because no
  independent harness runs, judge calibration, or measured artifact burden exists yet.

### Verification log

- 2026-08-17: `git init` succeeded and the initial branch was renamed to `main`.
- 2026-08-17: Prior-art research stopped after more than eight distinct sources covered all
  five required categories; unverified details are labeled rather than inferred.
- 2026-08-17: The reasoning model explicitly maps all ten product questions and gives every
  stage an input, output, completion condition, and causal loop-back.
- 2026-08-17: Initial Python validation failed verbatim with `ModuleNotFoundError: No module
  named 'jsonschema'`; `ajv-cli@5` was also rejected because its help listed support only
  through draft 2019-09.
- 2026-08-17: An isolated `jsonschema` Draft202012Validator check passed all six schemas,
  all embedded examples, and the audit that every property has non-empty writer/readers.
- 2026-08-17: Every v0.1 validator capability has an explicit D/A/J class; an automated table
  check found no missing or invalid classification.
- 2026-08-17: Structural verification found exactly eight benchmark directories and 24 files;
  every case has problem/expectations/scoring, failure and MUST anchors, all scorer roles,
  and no prohibited design-leading terms in stakeholder problem text.
- 2026-08-17: After dogfood repairs, Draft 2020-12 schema checks, embedded examples, field
  trace audit, and whitespace validation passed again for all six schemas.
- 2026-08-17: Final audit passed all six schemas/examples, 253 field traces, 14 stage
  contracts, all methodology verdicts and D/A/J rows, 8×3 benchmark structure, line budgets,
  whitespace, local links, and direct navigation for all 54 repository files.
- 2026-08-17: Self-evaluation scores are methodology neutrality 5, determinism honesty 5,
  traceability 5, benchmark discriminative power 4, and ceremony penalty 4. All 11
  Definition-of-Done items pass with evidence in `docs/verification.md`.

### Handoff

Run 2 should implement one Model Repository/CLI vertical slice that loads a design bundle and
runs schema, reference, stage, and field-trace checks against a simple-crud sample. Keep LLM
reasoning prompts and hosted services out until this contract is executable and measured.

## Run 2 ExecPlan — 2026-08-17

### Outcome

`sah validate <design-bundle-directory>` validates a repository-local design bundle through
the reusable Model Repository and returns deterministic, actionable human or JSON diagnostics
with tested exit codes 0, 1, and 2.

### Scope

Included: a schema-validated non-semantic bundle manifest, loading and path containment,
Draft 2020-12 validation of the six IRs, schema trace audit, cross-IR reference integrity,
the requested S5/S6/S7/S10/S11 gates, a thin CLI, simple-crud fixtures outside benchmarks,
tests, build tooling, and user documentation.

Excluded: reasoning prompts/orchestration, LLM calls, hosted services, view rendering,
code-fact adapters, benchmark judges, constraint compilation/execution, and implementation
handoff modeling. `benchmarks/simple-crud/problem.md` is read-only input; expectations and all
other benchmark files remain untouched. No target-system IR ID is changed by this plan. The
new repository decisions are ADR-0005 and ADR-0006; no compiled project constraint exists yet.

### Constraints

- Preserve Model Repository ownership of loading and semantics; the CLI owns only invocation,
  presentation, and exit-code mapping.
- Keep Ajv, terminal formatting, and filesystem conventions out of public semantic types.
- Apply gates from an explicit completed lifecycle stage and profile, never inferred content.
- Classify only observable predicates as deterministic; proposed-decision isolation remains an
  assisted finding because the six IRs do not encode S12 slices.
- Use npm with the installed Node 24 runtime, work offline after dependency installation, keep
  documents within line budgets, make milestone commits, and never push.

### Milestones

| Phase | Milestone | Status | Acceptance evidence |
|---|---|---|---|
| 0 | Frame run and decide implementation/bundle contracts | complete | this plan; ADR-0005/0006 |
| 1 | Implement Model Repository validation pipeline | complete | strict typed library; focused unit tests |
| 2 | Add CLI, fixtures, and integration tests | complete | human/JSON output and exit 0/1/2 tests |
| 3 | Document, verify, and review the complete slice | complete | required commands pass; clean reviewed diff |

### Decision log

- 2026-08-17: Use strict TypeScript on Node with Ajv Draft 2020-12 and npm. Node 24.14.1 and
  npm 11.11.0 are already available, and this is the least elaborate local stack that gives a
  typed library plus CLI and standards-compliant schema validation. See ADR-0005.
- 2026-08-17: Store non-semantic lifecycle and artifact locations in root `sah.bundle.json`,
  schema-validated separately from the six IRs. `completedStage` defines applicable gates and
  `profile` records full/short path. See ADR-0006.
- 2026-08-17: Treat missing/unreadable/malformed declared inputs, path escape, invalid
  invocation, and invalid manifest configuration as operational failures (exit 2). Validly
  loaded IR shape/reference/stage violations use exit 1; a clean validation uses exit 0.

### Discovery log

- 2026-08-17: The repository contains specifications and six canonical schemas but no package
  manifest, runtime source, or sample design bundle. The worktree is clean at `933f6f4`.
- 2026-08-17: Architecture IR serializes one `candidate` object rather than a candidate array;
  the S10 deterministic predicate is therefore that this single candidate is `selected`.
- 2026-08-17: The six current IRs do not serialize implementation slices or proof that a
  proposed decision is isolated. This slice can emit an assisted S10 finding and repair path,
  but must not invent a deterministic isolation failure.
- 2026-08-17: Ajv strict mode rejected the first manifest role schemas because their local
  `properties` keywords relied on a sibling `$ref` for `type: object`. Adding the explicit type
  kept the same contract and removed validator-specific ambiguity.
- 2026-08-17: Initial formatting and lint attempts stopped because the test glob did not yet
  exist and typed lint rules reached the JavaScript config file. Tests now exist, lint targets
  only source/tests, and deliberate number/pointer interpolation is configured explicitly.
- 2026-08-17: The unchanged user-supplied `sah-bootstrap-prompt-gpt5-sol.md` provenance input
  is 407 lines. It is excluded from the 400-line product-document audit because repository
  policy also requires provenance prompts to remain verbatim; every generated document and
  schema remains within its budget.

### Verification log

- 2026-08-17: Read the root policy, planning mechanism, specified model/architecture/
  validation authority, all six schema contracts, dogfood walkthrough, ADR-0001–0004,
  glossary, index, and only the simple-crud stakeholder problem from its benchmark.
- 2026-08-17: Confirmed `node --version` is `v24.14.1`, `npm --version` is `11.11.0`, and the
  initial worktree has no tracked or untracked changes.
- 2026-08-17: ADR-0005 and ADR-0006 record the runtime and bundle representation choices;
  Phase 0 is complete and Phase 1 has started.
- 2026-08-17: `npm install` completed with 163 packages audited and zero reported vulnerabilities.
- 2026-08-17: After the recorded fixes, `npm run lint`, `npm run typecheck`, and `npm test`
  passed; Vitest reported 3 files and 21 tests passed, including valid bundle and CLI 0/1/2.
- 2026-08-17: `node dist/cli.js validate fixtures/simple-crud` passed with zero diagnostics;
  `npm exec -- sah validate fixtures/simple-crud --json` returned status `passed`.
- 2026-08-17: The first expanded 27-test run failed one candidate-stage test: its generated
  value `candidate` violated the schema before reaching the gate. This exposed the same stale
  enum in the private TypeScript view; both now use schema-authoritative `proposed`.
- 2026-08-17: Final `npm install` exited 0 with 164 packages audited and zero vulnerabilities;
  `npm run format:check`, `npm run lint`, and strict `npm run typecheck` each exited 0.
- 2026-08-17: Final `npm test` exited 0 with 3 files and 27 tests passed. Generated mutations
  cover manifest/artifact loading, malformed JSON location, schema paths, symlink escape,
  dangling/root/option references, S5 ownership, S6 materialization, S7 timing, S10 selection,
  S11 observability/accepted decisions/backlinks, outputs, and CLI exits 0/1/2.
- 2026-08-17: Final `npm run build` exited 0. Human and JSON executions of `npm exec -- sah
  validate fixtures/simple-crud` exited 0 with zero errors and warnings.
- 2026-08-17: `npm run verify:schemas` exited 0 with 4 tests: all seven Draft 2020-12 schemas
  compiled, all embedded examples passed, every serialized property had non-empty writer and
  reader traces, and the generated missing-trace mutation was detected.
- 2026-08-17: Deterministic result: all applicable structural checks passed on simple-crud.
  Assisted result: zero findings on that bundle; proposed decisions would emit a warning.
  Judgment result: not run and unsupported in this slice. This fixture validation is not a
  scored benchmark run, and no hidden expectations were read or modified during implementation.
- 2026-08-17: Final repository audit passed `git diff --check`, all 50 tracked Markdown local
  links, generated document/schema and AGENTS line budgets, benchmark non-modification, and
  public declaration Ajv-leak inspection. The full diff review found correct exit separation,
  guarded unresolved references and stage thresholds, realpath confinement, no CLI/Ajv types
  in semantic contracts, and no speculative implementation interfaces.

### Handoff

The next vertical slice should add an atomic `sah advance <bundle> <stage>` operation that
validates the claimed gate before updating manifest lifecycle, without adding reasoning prompts
or a hosted store.
