# Run 23 ExecPlan — 2026-08-20

## Compiled task and boundaries

Goal: make the local SAH iteration loop usable for agile, user-observable vertical slices while
preserving the existing S0–S13 lifecycle, risk routing, explicit revision binding, independent
Checker gate, CLI/library boundary, and exit-code meanings.

The current loop records executable checks and proposed next tasks, but it does not say which user
scenario a check proves. That leaves a cross-session agent with a technically green task and no
canonical answer to “what user-visible increment is next?” This run adds an additive,
schema-validated scenario/slice contract and deterministic evidence gate; it does not make SAH
choose product direction or invoke a model.

Included: reusable scenario and vertical-slice contracts, scenario evidence on outcomes, scenario
completion evidence, result projections for cross-session consumers, runtime consistency checks,
fixtures, focused tests, docs, portable skill guidance, ADR-0023, and full verification.

Excluded: target product code, hosted coordination, concurrent writers, a general evidence
database, Git discovery, release/deploy orchestration, LLM judges or model calls, benchmark
expectations, and changes to S0–S13 or S13 completion authority.

## Constraints and accepted design

- JSON Schema remains canonical. New fields are optional so every existing v0.4 loop, v0.4
  outcome, v0.3 result, and v0.2 completion request remains valid without migration.
- A direction may declare user scenarios (`id`, `description`, `expectedOutcome`). A task may
  select a vertical slice with scenario references and explicit acceptance-check IDs.
- `loop-checks` remains the only supported evidence runner. When a slice is declared it projects
  structured `sliceEvidence` from the declared acceptance checks; `loop-record` accepts a
  succeeded outcome only when every selected scenario has evidence from passing exit-zero checks.
- `loop-complete` requires exact scenario coverage when the direction declares scenarios. Each
  scenario result must reference passing evidence produced by an iteration slice that owns the
  scenario. Existing directions without scenarios retain the old criterion-only gate.
- Next-task projection copies the slice contract but never mutates direction or invents a scenario.
  If the scenario contract is missing or consequentially ambiguous, the skill tells the agent to
  ask the stakeholder; SAH records no inferred product choice.
- Scenario evidence is deterministic evidence linkage, not user acceptance, a judgment verdict,
  or proof that the check's semantics are sufficient. Independent Checker review remains optional
  and separately authoritative when required by a task contract.

## Milestones

| Phase | Milestone | Status |
| --- | --- | --- |
| 0 | Inspect Run 22 loop/schema/skill boundaries | complete |
| 1 | Record Run 23 plan and ADR-0023 | complete |
| 2 | Add scenario/slice schemas, types, examples, and traces | complete |
| 3 | Implement runtime evidence and completion gates | complete |
| 4 | Update CLI projections, skill/docs, and focused tests | complete |
| 5 | Full verification, independent Checker, commit, and push | complete |

## Decision and discovery log

- 2026-08-20: Keep the extension additive instead of replacing loop schema versions. The old
  artifacts remain valid and existing commands keep their current output and exit meanings.
- 2026-08-20: Reuse declared check IDs as the evidence boundary. A second command runner or
  evidence store would duplicate authority and make stale evidence easier to hide.
- 2026-08-20: Keep scenario completion separate from S13. A product-direction loop can be
  locally complete while S13 still requires full verification and lifecycle authority.
- 2026-08-20: Reuse the existing v0.4/v0.3/v0.2 artifact IDs with optional fields. The schema
  registry compiles the two reusable scenario/slice references, while legacy fixtures remain
  unchanged and valid.
- 2026-08-20: The independent review found that delimiter-bearing iteration IDs were accepted by
  the schema but rejected by the runner's first-colon parser. The parser now matches the longest
  known iteration ID before splitting, preserving the existing reference string and ID vocabulary.

## Verification contract

Run schema/trace validation, focused scenario-loop tests, format, lint, strict typecheck, build,
full tests, CLI smoke checks for old and scenario fixtures, documentation link/line-budget review,
`git diff --check`, and an independent read-only Checker review at the exact final revision and
design fingerprint. Do not claim completion for changed, incomplete, violation, or operational
error results. Preserve benchmark files unchanged.

### Verification so far

- Schema examples and writer/reader trace audit pass; old and new loop fixtures validate.
- Focused loop/schema/skill tests pass (22 tests); full repository suite passes (258 tests).
- Format, lint, strict typecheck, build, CLI old/scenario route and generated `sliceEvidence`
  smoke checks pass; full TypeScript verification remains passing and filesystem-only verification
  remains honestly `incomplete` where its adapter is unsupported.
- Markdown links (57 files), document budgets, and `git diff --check` pass. No benchmark file was
  changed.
- 2026-08-20: Independent Checker `R-023-checker-a0db4a8` approved the exact implementation
  revision `a0db4a84a4244589aed07da870e93dc4bcc35215` with fingerprint
  `sha256:cc8663147472dc70644fd5feb6aabac0bfd0cc6dd4403bad7cc4ee419d9fa261`. It re-ran 259
  tests, schema/trace and static gates, disposable CLI adversarial cases, delimiter-bearing IDs,
  stale-context atomicity, and exit 0/1/2 checks without mutating the target or reading benchmarks.
- 2026-08-20: Exact-context `sah checker-review` returned `status=passed`, `verdict=approve`, and
  zero diagnostics. Review artifacts are the canonical JSON plus its Markdown view under
  `harness/reviews/`.

## Handoff

Run 23 is complete. The next agent/session can resume from the schema-valid loop file, its explicit
work context, current slice, and structured scenario evidence without relying on conversation
memory. Future changes must reread this plan and ADR-0023, preserve the additive compatibility
contract, and reopen the earliest invalid premise if scenario evidence semantics change.
