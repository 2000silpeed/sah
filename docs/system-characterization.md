# System Characterization

This document owns the dimensions used to describe a target system before methodology
selection. The canonical identifiers below are used in IR; ratings are `low`, `medium`,
`high`, or `unknown`. A rating without evidence is invalid. `Unknown` is a real result that
creates a question or assumption, not a synonym for low.

## Unit of assessment

Start with a provisional system scope and split it into problem regions only when they show
materially different design forces, change together internally, or own distinct outcomes.
These regions are called **subsystems** before any module or service boundary exists. A
subsystem is a reasoning scope, not a deployment decision.

Decomposition is provisional. If later responsibility or invariant analysis shows that one
rule must be owned across two regions, revisit the split. If two regions receive identical
ratings, strategy, ownership, and change drivers, merge them unless a stated team, security,
or lifecycle boundary justifies separation.

## Evidence model

Acceptable evidence includes stakeholder requirements, observed workflows, regulations,
existing-system behavior, measured load or incidents, contractual dependencies, team and
deployment constraints, and explicitly labeled assumptions. Each evidence item records a
source locator, claim, confidence, and which assumption would falsify it.

Examples and architectural intuition may suggest a question but do not count as evidence.
Framework conventions never count as problem evidence.

For an `unknown` rating, the evidence reference identifies the source that was inspected and
the rationale names the absent fact. Do not cite an unrelated positive claim merely to
satisfy the reference shape. Its falsification condition is the missing fact becoming known.

## Dimensions

### `rule_change_complexity`

How numerous, interacting, exception-heavy, and independently changing the business rules
are. Evidence: decision tables, exception cases, rule owners, and change history. High means
behavior cannot be understood as independent field updates; it does not mean “important.”

### `invariant_criticality`

The severity and transactional reach of states that must never be accepted. Evidence:
financial loss, safety impact, legal obligations, reconciliation rules, and atomicity needs.
Rate both severity and span; a severe invariant inside one record differs from one spanning
multiple actors or stores.

### `dataflow_orientation`

Whether value is created primarily by transforming, joining, aggregating, or transporting
data through stages. Evidence: lineage, batch/stream stages, replay needs, and intermediate
datasets. High favors explicit flow; it does not prohibit stateful stages.

### `distribution_consistency`

How much the problem depends on remote boundaries, partial failure, duplicated delivery,
ordering, and stale reads. Evidence: network topology, external SLAs, consistency windows,
delivery guarantees, and partition behavior. High requires naming which facts may diverge
and for how long.

### `concurrency_temporality`

The significance of races, deadlines, ordering, long-running workflows, and state
transitions. Evidence: simultaneous actors, timers, cancellation, retries, and transition
rules. High may call for state machines or actors without implying distribution.

### `autonomy_uncertainty`

The amount of runtime choice delegated to probabilistic or autonomous components and the
cost of a wrong choice. Evidence: model/tool selection, nondeterministic outputs, human
approval points, evaluation data, fallback behavior, token cost, and latency budgets.

### `integration_volatility`

The number, semantic mismatch, ownership, and change rate of external systems. Evidence:
provider contracts, protocol diversity, version history, and substitution requirements.
High favors explicit translation seams; one stable database is not high integration.

### `scale_performance`

The measured or committed throughput, latency, volume, burst, and growth constraints that
can alter structure. Evidence: quality scenarios with quantities. “Must scale” alone rates
unknown, not high.

### `assurance_governance`

Auditability, privacy, security, safety, explainability, and change-control obligations.
Evidence: threat models, retention rules, approval policy, regulatory text, and audit
queries. High affects decision records and enforcement even when domain rules are simple.

### `change_isolation`

Whether capabilities have distinct owners, release cadences, substitution needs, or reasons
to evolve independently. Evidence: team topology, vendor boundaries, release history, and
roadmap divergence. High can justify a module boundary; it does not by itself justify a
network service.

## Quality attribute scenarios

Translate consequential non-functional language into scenarios with: source, stimulus,
environment, affected artifact, expected response, measurable response bound, and priority.
Use `unknown` for a missing measure and create a resolution item. Candidate architectures
are compared against scenarios; generic labels such as “secure” or “fast” do not pass the
characterization gate.

## Characterization procedure

1. Normalize requirement evidence and list unresolved ambiguity.
2. Propose problem regions without assigning implementation forms.
3. Rate every dimension per region with evidence and confidence.
4. Write the quality scenarios capable of changing a design choice.
5. Compare regions and merge or split where the evidence contradicts the provisional map.
6. Record hard constraints separately from preferences.

## Completion gate

Proceed when system scope is explicit; every material requirement maps to a region or a
cross-cutting concern; every dimension has evidence or is `unknown`; consequential unknowns
have an assumption and falsification trigger; and quality scenarios contain measurable
bounds or a named blocker. A desired technology, class, layer, or service presented as a
problem region fails the gate and returns to step 2.

## Downstream consumers

Strategy selection reads dimension ratings and quality scenarios. Responsibility analysis
reads region scope and evidence. Candidate evaluation reads quality scenarios and hard
constraints. Change impact analysis uses evidence and assumption links to reopen the
earliest affected step.
