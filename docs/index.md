# SAH Documentation Index

Start with [vision](vision.md), [principles](principles.md), and the
[design reasoning model](design-reasoning-model.md). Terms are canonical in the
[glossary](glossary.md). The root [AGENTS.md](../AGENTS.md) is the permanent operating policy;
[the ExecPlan](../.agent/PLANS.md) records live status, decisions, discoveries, and checks.

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
- [Benchmark strategy](benchmark-strategy.md) — owns run isolation, common scoring, judge
  roles, coverage, and dataset evolution.
- [Dogfood](dogfood.md) — owns the two manual walkthroughs and five model repairs they forced.
- [Glossary](glossary.md) — owns canonical English terms, Korean equivalents, definitions,
  and document ownership.
- [Verification](verification.md) — owns the final rubric scores and Definition-of-Done audit.

## Architecture decisions

- [ADR-0001](adr/0001-deliver-sah-as-a-local-hybrid-toolkit.md) — chooses the local hybrid
  skill/CLI/library delivery and defers a service.
- [ADR-0002](adr/0002-make-json-ir-the-canonical-model.md) — makes JSON IR canonical and
  Markdown/diagrams views.
- [ADR-0003](adr/0003-separate-ir-by-reasoning-ownership.md) — chooses six linked IR families
  and justifies the documentation layout split.
- [ADR-0004](adr/0004-classify-enforcement-by-observability.md) — establishes deterministic,
  assisted, and judgment enforcement.

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
- [Architecture](../schemas/architecture.schema.json) — candidates, elements, boundaries,
  relations, interfaces, assessments, and constraints.
- [Architecture Decision](../schemas/architecture-decision.schema.json) — options, evidence,
  costs, authority, consequences, review triggers, and constraint links.

## Benchmark fixtures

Each row links the stakeholder problem, hidden expectations, and benchmark-specific scoring.

| Case | Problem | Expectations | Scoring | Why it exists |
|---|---|---|---|---|
| simple-crud | [problem](../benchmarks/simple-crud/problem.md) | [expectations](../benchmarks/simple-crud/expectations.md) | [scoring](../benchmarks/simple-crud/scoring.md) | Detects needless rich modeling and services without losing local assurance. |
| ecommerce | [problem](../benchmarks/ecommerce/problem.md) | [expectations](../benchmarks/ecommerce/expectations.md) | [scoring](../benchmarks/ecommerce/scoring.md) | Tests mixed CRUD, rich rules, state, provider, and read/dataflow strategies. |
| logistics | [problem](../benchmarks/logistics/problem.md) | [expectations](../benchmarks/logistics/expectations.md) | [scoring](../benchmarks/logistics/scoring.md) | Tests custody, temporal transitions, late events, and carrier translation. |
| payment | [problem](../benchmarks/payment/problem.md) | [expectations](../benchmarks/payment/expectations.md) | [scoring](../benchmarks/payment/scoring.md) | Tests critical monetary invariants under remote uncertainty and retries. |
| realtime | [problem](../benchmarks/realtime/problem.md) | [expectations](../benchmarks/realtime/expectations.md) | [scoring](../benchmarks/realtime/scoring.md) | Tests concurrency, convergence, latency, offline work, and ephemeral state. |
| data-pipeline | [problem](../benchmarks/data-pipeline/problem.md) | [expectations](../benchmarks/data-pipeline/expectations.md) | [scoring](../benchmarks/data-pipeline/scoring.md) | Tests dataflow, lineage, replay, late data, scale, and privacy lifecycle. |
| ai-agent | [problem](../benchmarks/ai-agent/problem.md) | [expectations](../benchmarks/ai-agent/expectations.md) | [scoring](../benchmarks/ai-agent/scoring.md) | Tests model uncertainty, tools, permission, memory, evaluation, cost, and fallback. |
| enterprise-integration | [problem](../benchmarks/enterprise-integration/problem.md) | [expectations](../benchmarks/enterprise-integration/expectations.md) | [scoring](../benchmarks/enterprise-integration/scoring.md) | Tests semantic authority, heterogeneous delivery, replay, and phased coexistence. |

## Provenance

- [Earlier bootstrap prompt](../sah-bootstrap-prompt.md) — preserves the initial formulation
  that preceded the GPT-5 Sol execution prompt; it is non-normative input.
- [Bootstrap prompt](../sah-bootstrap-prompt-gpt5-sol.md) — preserves the scope and acceptance
  criteria of the foundation run; later product decisions supersede it through ADRs.
- [.gitignore](../.gitignore) — excludes macOS Finder metadata and no product artifact.
