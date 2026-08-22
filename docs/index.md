# SAH Documentation Index

Start with the root [English README](../README.md) or
[Korean README](../README.ko.md) for the repository overview and executable quick start, then
read [vision](vision.md), [principles](principles.md), and the
[design reasoning model](design-reasoning-model.md). Terms are canonical in the
[glossary](glossary.md). The root [AGENTS.md](../AGENTS.md) is the permanent operating policy;
[the ExecPlan](../.agent/PLANS.md) records live status, decisions, discoveries, and checks;
[Runs 1–3](../.agent/plans/run-1-3.md), [Runs 4–7](../.agent/plans/run-4-7.md),
[Runs 8–10](../.agent/plans/run-8-10.md), and
[Runs 11–14](../.agent/plans/run-11-14.md) preserve completed execution history; the
[Run 22 plan](../.agent/plans/run-22.md) is the completed independent-Checker handoff; the
[Run 23 plan](../.agent/plans/run-23.md) records the completed scenario-centered vertical-slice
extension; [Run 24 plan](../.agent/plans/run-24.md) records the completed bounded continuous-mode
extension; [Run 25 plan](../.agent/plans/run-25.md) records the approved Cross-Bundle Lineage
MVP; [Run 27 plan](../.agent/plans/run-27.md) records the target-check evidence bridge; [Run 28
plan](../.agent/plans/run-28.md) records the bookmark HTTP smoke fixture; [Run 29 plan](../.agent/plans/run-29.md)
records the sandbox-safe direct CLI path; [Run 30 plan](../.agent/plans/run-30.md)
records the isolated benchmark preparation contract; [Run 31 plan](../.agent/plans/run-31.md)
records the benchmark trajectory capture seam.

## Product and reasoning authority

- [Vision](vision.md) — owns audience, product boundary, success, and non-goals.
- [Principles](principles.md) — owns normative rules, costs, and counter-cases.
- [Prior art](prior-art.md) — owns source-backed overlap and novelty claims.
- [System characterization](system-characterization.md) — owns problem dimensions, evidence,
  provisional decomposition, and quality scenarios.
- [Strategy selection](strategy-selection.md) — owns per-subsystem strategy and mixed-strategy
  seam guidance.
- [Methodology verdicts](methodology.md) — owns keep/adapt/drop decisions for historical methods.
- [Design reasoning model](design-reasoning-model.md) — owns S0–S13 I/O, gates, and loop-backs.
- [Structured architecture model](architecture-model.md) — owns IR families, cross-IR
  semantics, elements/relations, constraints, and C4/ADR relationships.
- [Harness architecture](harness-architecture.md) — owns SAH component boundaries, dependency
  rules, delivery topology, and failures.
- [Validation model](validation-model.md) — owns the D/A/J split, validator catalogue,
  continuous enforcement, and exceptions.
- [Validation CLI and library](validation-cli.md) — owns install, invocation, output, public
  result types, and exit codes for the executable structural slice.
- [Architecture evolution](architecture-evolution.md) — owns immutable cross-bundle lineage,
  evolution IR, resolver boundaries, and non-passing conflict semantics.
- [Current architecture projection](current-architecture.md) — owns the read-only active,
  superseded, trigger, judgment, head, and conflict projection over lineage heads.
- [Target-check evidence bridge](target-check-evidence.md) — owns the read-only iteration-outcome
  adapter, explicit target/revision binding, and deterministic/incomplete boundary.
- [Agent Skill guide](agent-skill.md) — owns Codex/Claude Code installation, invocation,
  progressive questioning, and the natural-language-to-implementation experience.
- [Session resume](session-resume.md) — owns the local, model-neutral cross-session resume view.
- [Frontier-first loop](frontier-first.md) — owns fast-path execution, escalation, and learning
  around strong coding agents.
- [Linting contract](linting.md) — owns target-repository lint evidence and failure semantics.
- [Iteration loop](iteration-loop.md) — owns the canonical fast/reasoning route, explicit
  revision/fingerprint binding, outcome recording, and learning-to-next-task projection above S0–S13.
- [Independent Checker review](checker-review.md) — owns the revision-bound, read-only judgment
  handoff and its mechanical approval gate.
- [Scenario-centered iteration](iteration-loop.md) — owns user-observable scenario contracts,
  vertical-slice acceptance evidence, and cross-session slice continuation above S0–S13.
- [Benchmark strategy](benchmark-strategy.md) — owns run isolation, common scoring, judge
  roles, coverage, and dataset evolution.
- [Benchmark run preparation](benchmark-run.md) — owns the executable FP-008 input-isolation
  contract and evaluator-side preparation record.
- [Benchmark trajectory capture](benchmark-trajectory.md) — owns the preparation-bound raw
  trajectory entry contract, append continuity, freeze pinning, and read-only inspection.
- [Benchmark judging](benchmark-judging.md) — owns the judge-review record contract, the two-judge
  agreement gate, and the evaluator-side independence protocol.
- [Benchmark verdict](benchmark-verdict.md) — owns deterministic category scoring, steward
  adjudication consumption, cap/threshold assembly, and fresh-only verdict records.
- [Dogfood](dogfood.md) — owns the manual walkthroughs, conversational skill forward test, and
  harness repairs they forced.
- [Glossary](glossary.md) — owns canonical English terms, Korean equivalents, definitions,
  and document ownership.
- [Verification](verification.md) — owns the final rubric scores and Definition-of-Done audit.

## Architecture decisions

- [ADR-0001](adr/0001-deliver-sah-as-a-local-hybrid-toolkit.md) — chooses the local hybrid
  skill/CLI/library delivery and defers a service.
- [ADR-0002](adr/0002-make-json-ir-the-canonical-model.md) — makes JSON IR canonical and
  Markdown/diagrams views.
- [ADR-0003](adr/0003-separate-ir-by-reasoning-ownership.md) — establishes semantic-owner IR
  separation and justifies the documentation layout split.
- [ADR-0004](adr/0004-classify-enforcement-by-observability.md) — establishes deterministic,
  assisted, and judgment enforcement.
- [ADR-0005](adr/0005-use-typescript-node-and-ajv-for-the-local-runtime.md) — selects the
  strict local TypeScript/Node/Ajv runtime and protects its adapter boundary.
- [ADR-0006](adr/0006-use-a-schema-validated-bundle-manifest.md) — stores explicit lifecycle
  and artifact locations in a non-semantic, schema-validated bundle manifest.
- [ADR-0007](adr/0007-validate-before-atomic-stage-advance.md) — validates a supported target
  gate before atomically replacing lifecycle metadata.
- [ADR-0008](adr/0008-represent-architecture-candidate-sets.md) — migrates Architecture IR to
  an explicit candidate set with topology and single-candidate evidence.
- [ADR-0009](adr/0009-add-implementation-handoff-ir.md) — adds canonical S12 change slices
  without mixing semantic handoff facts into the bundle manifest or Architecture IR.
- [ADR-0010](adr/0010-start-s13-with-filesystem-artifact-presence.md) — starts continuous S13
  verification with one confined filesystem fact adapter and an explicit target root.
- [ADR-0011](adr/0011-use-explicit-typescript-source-mapping.md) — keeps source ownership in
  explicit target-local adapter configuration and selects bounded TypeScript compiler parsing.
- [ADR-0012](adr/0012-resolve-typescript-symbols-from-explicit-project-config.md) — resolves
  path aliases and static re-exports through an explicit confined TypeScript project.
- [ADR-0013](adr/0013-scope-verification-with-explicit-changed-paths.md) — selects S12
  constraints from explicit changed paths and falls back safely when mapping is incomplete.
- [ADR-0014](adr/0014-pin-full-verification-evidence-for-s13.md) — pins one schema-validated
  full-verification record as the atomic S12→S13 completion evidence.
- [ADR-0027](adr/0027-bind-target-check-evidence-to-explicit-context.md) — reuses exact loop-check
  evidence without executing commands or inferring target context.
- [ADR-0015](adr/0015-orchestrate-the-full-loop-through-a-portable-agent-skill.md) — makes one
  portable Agent Skill the Codex/Claude orchestration surface from natural language through
  implementation and S13 verification.
- [ADR-0016](adr/0016-resume-from-canonical-bundle-projection.md) — adds a regenerable resume
  projection without introducing a second lifecycle authority or coordination service.
- [ADR-0017](adr/0017-frontier-first-feedback-and-target-linting.md) — makes target-owned linting
  a first-class feedback check without adding a universal linter engine.
- [ADR-0018](adr/0018-add-an-executable-iteration-loop.md) — adds a separate canonical loop
  artifact for risk routing, atomic outcomes, and proposed next tasks.
- [ADR-0019](adr/0019-evidence-backed-iteration-completion.md) — requires execution evidence for
  successful iteration recording and adds the explicit local check runner.
- [ADR-0020](adr/0020-close-the-iteration-lifecycle.md) — adds explicit accept/repair transitions
  and a deterministic evidence-backed local product-complete gate.
- [ADR-0021](adr/0021-bind-iterations-to-explicit-revisions.md) — binds iteration evidence to
  explicit target and design-bundle revisions without Git discovery.
- [ADR-0022](adr/0022-independent-checker-review-as-a-judgment-gate.md) — promotes a separate
  read-only Checker review into a portable judgment-gate contract without changing lifecycle authority.
- [ADR-0023](adr/0023-scenario-centered-vertical-slice-loop.md) — adds additive scenario and
  vertical-slice evidence contracts without changing lifecycle or exit-code authority.
- [ADR-0024](adr/0024-bounded-continuous-agent-mode.md) — adds an explicit, bounded continuous
  execution policy to the portable agent skill without changing CLI/lifecycle authority.
- [ADR-0025](adr/0025-preserve-cross-bundle-architecture-lineage.md) — adds optional evolution
  IR and explicit-root lineage without rewriting historical bundles or adding a service.
- [ADR-0026](adr/0026-derive-current-architecture-from-lineage-heads.md) — derives a read-only
  current architecture projection from explicit lineage heads without a second authority.
- [ADR-0028](adr/0028-use-direct-node-for-sandbox-safe-cli.md) — documents the direct Node
  source-checkout path for read-only CLI use when npm side effects are unavailable.
- [ADR-0029](adr/0029-isolate-benchmark-inputs-before-execution.md) — isolates benchmark input
  from hidden expectations before any model execution.
- [ADR-0030](adr/0030-capture-benchmark-trajectory-locally.md) — adds a local, preparation-bound
  raw trajectory capture seam without model invocation, scoring, or semantic payload claims.
- [ADR-0031](adr/0031-freeze-completed-benchmark-captures-before-scoring.md) — pins completed
  captures with an immutable evaluator-side freeze record that blocks later appends.
- [ADR-0032](adr/0032-validate-and-aggregate-benchmark-judges.md) — validates and aggregates
  evaluator-executed judge records deterministically without the runtime invoking models.
- [ADR-0033](adr/0033-assemble-benchmark-verdicts-from-preserved-evidence.md) — assembles verdicts
  from preserved evidence with binary deterministic categories, steward adjudication, and fresh-only records.

## JSON Schema contracts

All schemas use Draft 2020-12, contain examples, and carry field writer/reader annotations.

- [System Characterization](../schemas/system-characterization.schema.json) — evidence,
  dimensions, problem regions, quality scenarios, and hard constraints.
- [Design Strategy](../schemas/design-strategy.schema.json) — per-subsystem choices,
  alternatives, seams, costs, and short-path eligibility.
- [Responsibility](../schemas/responsibility.schema.json) — outcomes, collaboration, change
  reasons, and logical ownership.
- [Invariant](../schemas/invariant.schema.json) — obligations, applicability, consistency,
  failure, detection, recovery, and enforcement ownership.
- [Architecture](../schemas/architecture.schema.json) — candidate sets, elements, boundaries,
  relations, interfaces, assessments, and constraints.
- [Architecture Decision](../schemas/architecture-decision.schema.json) — options, evidence,
  costs, authority, consequences, review triggers, and constraint links.
- [Implementation Handoff](../schemas/implementation-handoff.schema.json) — S12 slices,
  dependencies, accepted decisions, proposed blockers, checks, migration, and rollback.
- [Bundle manifest](../schemas/design-bundle-manifest.schema.json) — non-semantic lifecycle,
  profile, artifact path, and declared schema metadata for loading a design bundle.
- [Evolved bundle manifest](../schemas/design-bundle-manifest-v0.5.0.schema.json) and
  [Architecture Evolution](../schemas/architecture-evolution.schema.json) — explicitly versioned
  optional lineage metadata for evolved snapshots while preserving v0.4.
- [Lineage result](../schemas/lineage-result.schema.json) — validates the derived read-only
  project lineage projection and its deterministic conflict summary.
- [Current architecture result](../schemas/current-architecture-result.schema.json) — validates
  the derived active/superseded decision, trigger, judgment, head, and conflict projection.
- [Benchmark run](../schemas/benchmark-run.schema.json) — validates evaluator-side treatment/control
  preparation metadata without exposing hidden expectations to the participant target.
- [Benchmark trajectory entry](../schemas/benchmark-trajectory-entry.schema.json) — validates one
  raw JSONL trajectory line captured beside a prepared benchmark run.
- [Benchmark freeze](../schemas/benchmark-freeze.schema.json) — validates the evaluator-side pin
  of one run's completed trajectory capture and output inventory.
- [Benchmark judge review](../schemas/benchmark-judge-review.schema.json) and
  [score](../schemas/benchmark-score.schema.json) — validate one independent judge's record over
  a frozen capture and the derived two-judge agreement projection.
- [Benchmark adjudication](../schemas/benchmark-adjudication.schema.json) and
  [verdict](../schemas/benchmark-verdict.schema.json) — validate steward resolutions of disputed
  categories and the assembled total with penalties, caps, and thresholds.
- [TypeScript source mapping](../schemas/typescript-source-mapping.schema.json) — non-semantic,
  target-local project config, exhaustive source roots, Architecture element path prefixes,
  and write-target symbols.
- [Verification record](../schemas/verification-record.schema.json), [result](../schemas/verification-result.schema.json),
  [check](../schemas/verification-check.schema.json), and [diagnostic](../schemas/verification-diagnostic.schema.json)
  — validate the complete runtime evidence envelope used by the S13 completion gate.
- [Resume result](../schemas/resume-result.schema.json) — validates the cross-session handoff
  projection emitted by `sah resume`.
- [Iteration loop](../schemas/iteration-loop.schema.json), [outcome](../schemas/iteration-outcome.schema.json),
  [completion request](../schemas/iteration-completion.schema.json), and
  [result](../schemas/iteration-loop-result.schema.json) — validate loop policy, executable check
  evidence, explicit lifecycle transitions, local completion evidence, and model-neutral
  route/next-task projections.
- [Scenario](../schemas/iteration-scenario.schema.json) and
  [slice](../schemas/iteration-slice.schema.json) — validate the stable user-observable intent
  and acceptance-check references carried by an iteration task.
- [Checker review](../schemas/checker-review.schema.json) — validates a revision-bound independent
  read-only review record without promoting judgment to deterministic architecture validation.
- [Run 23 Checker review](../harness/reviews/R-023-checker-a0db4a8.json) — records the exact
  independent approval for the scenario-centered loop implementation; Markdown is its human view.

## Runtime implementation and executable fixture

- [Portable SAH skill](../skills/sah/SKILL.md), [host metadata](../skills/sah/agents/openai.yaml),
  and its [elicitation](../skills/sah/references/elicitation-and-method-selection.md),
  [artifact lifecycle](../skills/sah/references/artifacts-and-lifecycle.md), and
  [implementation/verification](../skills/sah/references/implementation-and-verification.md), and
  [Checker review](../skills/sah/references/checker-review.md)
  references — form the shared Codex/Claude Code orchestration package.

- [Package manifest](../package.json) and [lockfile](../package-lock.json) — own exact npm
  scripts, binary/export surfaces, supported Node range, and resolved dependency versions.
- [TypeScript configuration](../tsconfig.json) and [production build configuration](../tsconfig.build.json)
  — enforce strict checking and emit the distributable library/CLI.
- [ESLint configuration](../eslint.config.js) — owns typed lint rules for runtime and tests.
- [Public contracts](../src/contracts.ts) and [entry point](../src/index.ts) — define and export
  framework-neutral diagnostics, results, stages, `validateBundle`, `advanceBundle`, `verifyBundle`,
  `runIterationChecks`, `acceptNextIteration`, `completeIterationLoop`, and
  `validateCheckerReview`, and `resolveCurrentArchitecture`.
- [Model Repository](../src/model-repository.ts) — owns manifest/artifact loading, containment,
  validation sequencing, stage transition, verification dispatch, and result separation.
- [Architecture lineage resolver](../src/architecture-lineage.ts) and
  [evolution validation](../src/evolution-validation.ts) — own explicit-root bundle discovery,
  fingerprint-bound cross-bundle checks, graph diagnostics, and derived lineage results.
- [Current architecture projection](../src/current-architecture.ts) and
  [current-state contract](current-architecture.md) — derive head decisions and open triggers
  without mutating canonical bundles or selecting a latest head.
- [Benchmark run preparation](../src/benchmark-run.ts) and
  [benchmark-run contract](benchmark-run.md) — create a fresh participant target containing only
  problem.md and a sibling schema-validated evaluator record.
- [Benchmark trajectory capture](../src/benchmark-trajectory.ts) and
  [trajectory contract](benchmark-trajectory.md) — append schema-valid JSONL entries to the
  reserved capture path, inspect them read-only, and freeze completed captures.
- [Benchmark judge aggregation](../src/benchmark-judging.ts) and
  [judging contract](benchmark-judging.md) — validate independent judge records and project the
  deterministic two-judge agreement view without executing any judgment.
- [Benchmark verdict assembly](../src/benchmark-verdict.ts) and
  [verdict contract](benchmark-verdict.md) — score deterministic categories, consume steward
  adjudications, and assemble capped totals with pass thresholds.
- [Target-check evidence adapter](../src/target-check-evidence-adapter.ts) and
  [target-check contract](target-check-evidence.md) — bind one explicit iteration outcome to
  verification without running the recorded command.
- [Iteration loop runtime](../src/iteration-loop.ts) — validates loop/outcome/completion artifacts,
  binds explicit target/design context, executes declared checks, routes risk, records outcomes
  atomically, accepts/repairs the next task, and enforces the local completion gate.
- [Checker review runtime](../src/checker-review.ts) — validates revision-bound independent review
  records and reports their mechanical gate without mutating lifecycle state.
- [Atomic manifest replacement](../src/atomic-manifest.ts) — owns exclusive temporary writes,
  mode preservation, source conflict detection, cleanup, and the rename commit point.
- [Verification record runtime](../src/verification-record.ts) — owns design fingerprints,
  confined atomic publication, record loading, and deterministic S13 evidence checks.
- [Internal model view](../src/internal-model.ts) — gives strict private shapes to already
  schema-validated artifacts without becoming another serialized contract.
- [Schema validation](../src/schema-validation.ts) — privately adapts Ajv Draft 2020-12 errors
  and audits field traces.
- [Reference validation](../src/reference-validation.ts) — checks unique IDs, typed references,
  root links, option ownership, and decision/constraint backlinks.
- [Stage validation](../src/stage-validation.ts) — applies observable S5–S12 gates from the
  manifest's completed stage.
- [Diagnostic helpers](../src/diagnostics.ts) — deterministically order and summarize public
  results; [CLI adapter](../src/cli.ts) owns presentation and exit mapping.
- [Code-fact adapter seam](../src/code-fact-adapter.ts), [constraint verification](../src/constraint-verification.ts),
  [filesystem presence adapter](../src/filesystem-presence-adapter.ts), and
  [TypeScript source adapter](../src/typescript-source-adapter.ts) — isolate S13 selection and
  changed-path mapping plus confined target-fact capabilities from canonical semantics and CLI
  concerns.
- [Test helpers](../test/helpers.ts), [validation tests](../test/model-repository.test.ts),
- [lineage tests](../test/architecture-lineage.test.ts),
  [S8 tests](../test/s8-stage.test.ts), [S9 tests](../test/s9-stage.test.ts), [S12 tests](../test/s12-stage.test.ts),
  [advance tests](../test/advance-bundle.test.ts), [verification tests](../test/verification.test.ts),
  [TypeScript verification tests](../test/typescript-verification.test.ts),
  [CLI tests](../test/cli.test.ts), [schema contract tests](../test/schema-contracts.test.ts), and
  [skill contract tests](../test/skill-contracts.test.ts), [target-check evidence tests](../test/target-check-evidence.test.ts),
  [bookmark HTTP smoke tests](../test/bookmark-http-smoke.test.ts), [sandbox CLI tests](../test/sandbox-cli.test.ts),
  [benchmark run tests](../test/benchmark-run.test.ts), [benchmark trajectory tests](../test/benchmark-trajectory.test.ts),
and [iteration loop tests](../test/iteration-loop.test.ts)
  — generate isolated mutations and verify validation, atomic transition, fact execution,
  host-workflow packaging, output, and failure families without external network access.
- [Simple-crud manifest](../fixtures/simple-crud/sah.bundle.json), [characterization](../fixtures/simple-crud/system-characterization.json),
  [strategy](../fixtures/simple-crud/design-strategy.json), [responsibilities](../fixtures/simple-crud/responsibility.json),
  [invariants](../fixtures/simple-crud/invariant.json), [architecture](../fixtures/simple-crud/architecture.json),
  [decisions](../fixtures/simple-crud/architecture-decision.json), and [handoff](../fixtures/simple-crud/implementation-handoff.json)
  — form the valid external equipment-register fixture derived from the dogfood walkthrough,
  outside benchmark inputs.
- [Bookmark lineage fixture](../fixtures/bookmark-lineage/direct-cli/sah.bundle.json) and
  [evolved bookmark snapshot](../fixtures/bookmark-lineage/shared-operations/sah.bundle.json) —
  demonstrate direct CLI → second local caller trigger → shared operations decision without
  rewriting the parent snapshot.
- [Bookmark HTTP smoke target](../fixtures/bookmark-lineage/http-smoke-target/server.mjs) and
  [smoke command](../fixtures/bookmark-lineage/http-smoke-target/smoke.mjs) — provide a
  loopback-only bookmark surface for exact iteration-check and S13 regression evidence.
- [Iteration loop fixtures](../fixtures/iteration-loop/sah.loop.json), [outcome](../fixtures/iteration-loop/iteration-001.outcome.json),
  [scenario loop](../fixtures/iteration-loop/scenario-loop.json), and
  [scenario outcome](../fixtures/iteration-loop/scenario-iteration-001.outcome.json) — provide
  backward-compatible fast-path and scenario-centered vertical-slice examples.
- [Checker review fixture](../fixtures/checker-review/approved.json) — provides a minimal valid
  independent-review record for contract and CLI tests.
- [S13 target artifact](../fixtures/s13-target/checks/equipment-operations.integration.txt) —
  gives filesystem-presence tests one inert target-local regular file outside benchmark data.
- [TypeScript target mapping](../fixtures/s13-typescript-target/sah.source-map.json),
  [project configuration](../fixtures/s13-typescript-target/tsconfig.json),
  [write target](../fixtures/s13-typescript-target/src/equipment-store.ts), and
  [authorized caller](../fixtures/s13-typescript-target/src/equipment-operations/save-equipment.ts)
  — exercise project-resolved named-import write authority against the canonical simple-crud
  constraint.

## Benchmark fixtures

Each row links the stakeholder problem, hidden expectations, and benchmark-specific scoring.

| Case                   | Problem                                                    | Expectations                                                         | Scoring                                                    | Why it exists                                                                       |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| simple-crud            | [problem](../benchmarks/simple-crud/problem.md)            | [expectations](../benchmarks/simple-crud/expectations.md)            | [scoring](../benchmarks/simple-crud/scoring.md)            | Detects needless rich modeling and services without losing local assurance.         |
| ecommerce              | [problem](../benchmarks/ecommerce/problem.md)              | [expectations](../benchmarks/ecommerce/expectations.md)              | [scoring](../benchmarks/ecommerce/scoring.md)              | Tests mixed CRUD, rich rules, state, provider, and read/dataflow strategies.        |
| logistics              | [problem](../benchmarks/logistics/problem.md)              | [expectations](../benchmarks/logistics/expectations.md)              | [scoring](../benchmarks/logistics/scoring.md)              | Tests custody, temporal transitions, late events, and carrier translation.          |
| payment                | [problem](../benchmarks/payment/problem.md)                | [expectations](../benchmarks/payment/expectations.md)                | [scoring](../benchmarks/payment/scoring.md)                | Tests critical monetary invariants under remote uncertainty and retries.            |
| realtime               | [problem](../benchmarks/realtime/problem.md)               | [expectations](../benchmarks/realtime/expectations.md)               | [scoring](../benchmarks/realtime/scoring.md)               | Tests concurrency, convergence, latency, offline work, and ephemeral state.         |
| data-pipeline          | [problem](../benchmarks/data-pipeline/problem.md)          | [expectations](../benchmarks/data-pipeline/expectations.md)          | [scoring](../benchmarks/data-pipeline/scoring.md)          | Tests dataflow, lineage, replay, late data, scale, and privacy lifecycle.           |
| ai-agent               | [problem](../benchmarks/ai-agent/problem.md)               | [expectations](../benchmarks/ai-agent/expectations.md)               | [scoring](../benchmarks/ai-agent/scoring.md)               | Tests model uncertainty, tools, permission, memory, evaluation, cost, and fallback. |
| enterprise-integration | [problem](../benchmarks/enterprise-integration/problem.md) | [expectations](../benchmarks/enterprise-integration/expectations.md) | [scoring](../benchmarks/enterprise-integration/scoring.md) | Tests semantic authority, heterogeneous delivery, replay, and phased coexistence.   |

## Provenance

- [Earlier bootstrap prompt](../sah-bootstrap-prompt.md) — preserves the initial formulation
  that preceded the GPT-5 Sol execution prompt; it is non-normative input.
- [Bootstrap prompt](../sah-bootstrap-prompt-gpt5-sol.md) — preserves the scope and acceptance
  criteria of the foundation run; later product decisions supersede it through ADRs.
- [.gitignore](../.gitignore) — excludes macOS Finder metadata and no product artifact.
