# Methodology Verdicts

This document owns keep/adapt/drop decisions for historical design knowledge. `Keep` means
the concept enters SAH with its original role; `Adapt` means only the named part enters;
`Drop` would mean no normative reasoning step, IR field, validator, or prompt heuristic.
No listed method is adopted wholesale or made mandatory for every subsystem.

| Method | Verdict | Level in SAH | Retained value and refusal |
|---|---|---|---|
| OOAD | Adapt | reasoning S3–S7; prompt heuristic | Retain responsibility, collaboration, and behavior modeling when fit; refuse class-first analysis and universal object representation. |
| Responsibility-Driven Design | Keep | reasoning S3/S5; Responsibility IR | Discover roles and assign cohesive ownership before representation; cost is judgment and vocabulary work on trivial systems. |
| CRC | Adapt | reasoning S3/S5; collaboration relations | Use compact responsibility/collaborator review, without cards, sessions, or an assumption that candidates become classes. |
| GRASP | Adapt | ownership prompt heuristic | Information Expert, Creator, Controller, indirection, and protected variation are competing ownership lenses, never scoring rules. |
| SOLID | Adapt | representation review; assisted validator | Apply locally to chosen OO forms; refuse SOLID as a system decomposition method or automatic demand for interfaces and layers. |
| Design by Contract | Keep | Invariant IR; contract validators | State preconditions, postconditions, invariants, and failure meaning where observable; do not pretend all business adequacy is executable. |
| DDD | Adapt | S1–S7; strategy, invariant, architecture IRs | Use language boundaries, domain policy, and aggregates for complex rule/invariant regions; refuse DDD ceremony for simple CRUD and refuse bounded contexts inferred from nouns. |
| Clean Architecture | Adapt | S6/S11; dependency constraints | Retain deliberate dependency direction toward stable policy when justified; refuse mandatory concentric layers and generic ports for single implementations. |
| Hexagonal Architecture | Adapt | S6; boundary/interface IR; validators | Isolate material external volatility with ports/adapters; refuse one port per dependency and adapters with no substitution, test, or semantic purpose. |
| Functional programming principles | Adapt | functional-dataflow strategy; S7; immutability constraints | Favor pure transformations, immutable values, composition, and explicit effects where flow dominates; refuse purity that obscures stateful domain or integration behavior. |
| Modular design | Keep | S1/S6/S7; Architecture IR | Use cohesive change boundaries, explicit interfaces, and replaceable internals at any deployment scale; a module does not imply a service. |
| Information hiding | Keep | S5/S6; ownership and boundary fields | Place volatile decisions behind the owner that has the reason to change; cost is translation and fewer convenient cross-boundary reads. |
| Cohesion and coupling | Keep | S1/S5/S6/S9; assisted review | Compare change, responsibility, semantic, and operational coupling; refuse raw dependency counts as a full quality judgment. |
| Evolutionary architecture | Keep | S11/S13; decisions and review triggers | Treat architecture as hypotheses maintained by fitness functions and explicit reopening conditions, not a one-time blueprint. |
| Architecture fitness functions | Keep | S11/S13; Constraint IR | Compile observable decision claims into repeatable checks with scope, severity, evidence, exceptions, and expiry. |
| C4 | Adapt | Architecture IR views/export | Reuse stable element identity, containment, and relationship views; refuse C4 kinds as the universal semantic model. |
| ADR | Keep | S9/S10; Architecture Decision IR | Preserve context, alternatives, costs, status, consequences, and supersession; add structured evidence, affected elements, and generated constraints. |
| QAW / quality attribute scenarios | Keep | S1/S9; Characterization IR | Convert quality language to source–stimulus–environment–artifact–response–measure scenarios; skip irrelevant workshop ceremony. |
| ATAM | Adapt | S8–S10; option assessment | Compare candidates through scenario sensitivity, trade-off, risk, and non-risk; refuse the full formal process when risk does not pay for it. |
| Event-driven architecture | Adapt | distributed-event-driven strategy; S6/S7 | Use events when asynchronous decoupling, facts, or failure tolerance justify them; refuse events for local indirection or as a synonym for messaging. |
| Distributed systems design | Keep | characterization; S4/S6/S9 | Require explicit consistency, ordering, idempotency, partial-failure, recovery, and topology reasoning whenever network boundaries matter. |
| Modern data architecture | Adapt | functional-dataflow strategy; pipeline relations | Retain lineage, contracts, replay, batch/stream semantics, data quality, and ownership; refuse vendor reference stacks as architecture reasoning. |
| Modern AI/agent architecture | Keep | agentic-tool-loop strategy; agent fields and evaluations | Require model/tool boundaries, permissions, context, memory, evals, fallbacks, human control, latency, and cost; refuse prompt-only designs and agents where deterministic workflows suffice. |

## Explicitly dropped material

The table adapts several methods by dropping their universal claims: class-first OOAD,
methodology-wide SOLID, mandatory Clean layers, universal ports, full DDD ceremony, full ATAM
ceremony, vendor data stacks, and agent-by-default automation. These dropped parts have no
schema fields or validators. No named historical method is absent from SAH without a verdict.

## Selection policy

The characterization and strategy documents, not this catalogue, decide applicability.
Methods may contribute at four levels only: a reasoning operation, a canonical IR fact, a
deterministic/assisted validator, or a prompt heuristic. A new method is admitted only when
its retained concept has a named consumer and does not smuggle in a representation before
ownership analysis.

## Conflict resolution

When methods disagree, compare which one exposes the dominant forces and quality scenarios
of the subsystem. Preserve different methods across a boundary when their composition
contract is clearer than forcing one vocabulary. Prefer the lower-ceremony option when both
explain and protect the same responsibilities, invariants, and failure modes.
