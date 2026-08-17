# Design Strategy Selection

This document owns the mapping from characterization to design strategy. A strategy is a
reasoning emphasis for a subsystem, not a package layout or deployment form. Selection
precedes responsibility and invariant discovery but remains provisional until those analyses
confirm it.

## Strategy catalogue

### `transaction-script-modular`

Organize simple use cases as explicit operations over plain data with direct transaction
boundaries. Candidate when rule change complexity, invariant span, concurrency, and
distribution are low. Cost: behavior can scatter as rules grow. Escalate when exceptions or
cross-operation invariants accumulate.

### `responsibility-centered-domain`

Model behavior around cohesive responsibilities, invariants, policies, and domain language.
DDD aggregates and objects are optional later representations, not part of the strategy.
Candidate when interacting rules and invariant criticality are medium or high. Cost: modeling
and translation ceremony. Reject for independent record maintenance with no rich behavior.

### `functional-dataflow`

Make transformations, data contracts, lineage, immutability, and stage composition primary.
Candidate when dataflow orientation is high or replay and recomputation dominate. Cost:
stateful exceptions and operational control need explicit treatment. Reject when a sequence
diagram of services obscures the actual data lineage.

### `state-machine-concurrent`

Make states, allowed transitions, temporal rules, actor ownership, and race handling primary.
Candidate when concurrency/temporality is high, including local realtime control. Cost:
state-space growth. Reject when operations are independent and synchronous.

### `distributed-event-driven`

Make message semantics, consistency windows, idempotency, ordering, partial failure, and
recovery primary. Candidate when distribution/consistency is high and asynchronous
decoupling has evidence. Cost: operational complexity and weaker immediate consistency.
Reject when a modular in-process call meets the quality scenarios.

### `integration-adapter`

Make canonical semantics, protocol translation, partner isolation, compatibility, and
contract tests primary. Candidate when integration volatility is high. Cost: translation
layers and duplicated models. Reject for a stable internal dependency with no substitution
or semantic mismatch.

### `agentic-tool-loop`

Make model boundaries, tool permissions, context, memory, evaluation, fallbacks, latency,
cost, and human control primary. Candidate when autonomy/uncertainty is material. Cost:
nondeterminism, evaluation infrastructure, and runtime expense. Reject when deterministic
code can satisfy the task reliably.

## Selection rules

1. Select per subsystem, never once for the whole system by default.
2. Rank one dominant strategy and zero or more supporting strategies. Name the dimension and
   evidence that each strategy answers.
3. State at least one simpler alternative and the evidence that makes it insufficient. If no
   evidence rules it out, prefer the simpler alternative.
4. Record disqualifiers and costs, not only benefits.
5. Treat organizational familiarity as a constraint or cost, never as proof of problem fit.
6. Re-evaluate after responsibility and invariant discovery. A strategy is wrong when it
   systematically hides the subsystem's central ownership or failure questions.

No rating mechanically chooses a strategy. Ratings generate candidates; the strategy
decision is contextual LLM judgment reviewed against explicit evidence.

## Mixed-strategy composition

A system strategy is a map, not a winner. For every edge between differently designed
subsystems, record a composition contract with:

- producer and consumer subsystem identifiers;
- interaction mode: call, message, stream, batch transfer, shared artifact, or human handoff;
- semantic contract and authoritative owner of each exchanged fact;
- timing, ordering, consistency, idempotency, and retry semantics where relevant;
- failure containment and fallback;
- translation location and versioning responsibility;
- the quality scenario or invariant that constrains the edge.

The boundary uses the consumer's terms internally and translates at the owning edge. Do not
leak an aggregate, pipeline record, provider DTO, or model prompt across a boundary merely
because both sides can serialize it.

## Common mappings and their escape hatches

| Observed forces | Candidate emphasis | Wrong shortcut | Escape hatch |
|---|---|---|---|
| Independent CRUD, local transaction | transaction-script-modular | full DDD stack | richer model only after interacting rules appear |
| Interacting pricing/eligibility rules | responsibility-centered-domain | anemic CRUD service | decision tables/functions accepted if ownership stays cohesive |
| Lineage, replay, batch/stream stages | functional-dataflow | Service/Repository graph | OO accepted for stage lifecycle, not to hide flow |
| Races and temporal transitions | state-machine-concurrent | boolean status flags | simple lock/transaction accepted if state space stays small |
| Partial failure and stale replicas | distributed-event-driven | synchronous calls everywhere | modular monolith accepted if distribution is not forced |
| Many volatile partners | integration-adapter | one shared canonical DTO everywhere | direct adapter accepted for one stable partner |
| Probabilistic tool use | agentic-tool-loop | prompt-only “architecture” | deterministic workflow accepted when runtime discretion is unnecessary |

These mappings are weighted heuristics. A contradiction backed by quality scenarios and costs
is a valid strategy decision.

## Completion gate and loop-backs

Proceed when every subsystem has a dominant strategy, supporting strategies are justified,
a simpler alternative and costs are recorded, and every mixed edge has a provisional
composition contract. Return to characterization when the justification cites a force that
was not rated. Return to subsystem decomposition when composition contracts are denser than
internal collaboration or no authoritative owner can be named. Return here from ownership
analysis when invariants expose a different dominant force.

## Downstream consumers

Responsibility and invariant analysis use the selected reasoning emphasis. Boundary design
uses composition contracts. Candidate evaluation checks whether representations preserve
the strategy. Benchmark scoring compares a proposed map with acceptable strategies and
penalizes unsupported complexity.
