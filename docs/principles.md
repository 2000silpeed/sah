# Design Principles

This document owns SAH's normative design principles. Each principle states its cost and the
condition under which it yields. Yielding must be recorded; it is not silent noncompliance.

## P1. Characterize before selecting a method

Assess each subsystem's change complexity, invariants, data flow, distribution, uncertainty,
and risks before naming a design strategy.

Rationale: familiar frameworks otherwise become unstated premises. Cost: early analysis adds
latency. Yields when a reversible, low-risk change uses the short path and records why no
material subsystem distinction exists.

## P2. Responsibilities and invariants precede representation

Discover what must be done and remain true, assign ownership, and model collaboration before
choosing function, data, class, aggregate, module, component, service, pipeline, or agent.

Rationale: representation should follow the forces it must contain. Cost: framework
scaffolding cannot start immediately. Yields for externally imposed representations, but the
constraint is recorded and responsibility placement is still evaluated within it.

## P3. Select and compose methods per subsystem

Choose the least elaborate strategy that satisfies each subsystem's forces and define the
contracts between differently designed regions.

Rationale: one system can contain CRUD, rich domain, pipeline, distributed, and agentic
problems. Cost: mixed strategies increase vocabulary and integration work. Yields when
operational or team constraints make one adequate strategy cheaper; the lost fit is an
explicit trade-off.

## P4. Preserve evidence and uncertainty

Every consequential claim cites requirement evidence or is labeled an assumption with
confidence and a falsification condition.

Rationale: agents otherwise turn plausible completion into false certainty. Cost: evidence
references require upkeep. Yields only for non-consequential narrative; decisions,
boundaries, invariants, and constraints never yield.

## P5. Keep one semantic source, with multiple views

Store canonical facts in structured IR and generate or hand-maintain linked human views
without inferring machine truth from prose.

Rationale: diagrams, ADRs, and validators drift when each owns a copy. Cost: identifiers and
trace links add friction. Yields for transient exploration that is clearly marked and cannot
be mistaken for an accepted model.

## P6. Make the determinism boundary explicit

Classify every check as deterministic, assisted, or LLM judgment and state the observable
facts and failure semantics.

Rationale: a repeatable program cannot decide contextual adequacy merely because a rule can
be encoded. Cost: some review remains probabilistic and expensive. Yields only when a
previously judgmental proposition gains a complete observable specification; record the
reclassification.

## P7. Compile decisions, not generic taste

An executable constraint must trace to an accepted decision, name its scope, and provide an
exception path. Heuristics produce review findings, not unconditional failures.

Rationale: “best practice” detached from context recreates methodology dogma. Cost: projects
cannot enable a large generic ruleset without review. Yields for universal safety or schema
integrity checks whose applicability is part of the SAH contract itself.

## P8. Require alternatives and real costs

Consequential decisions state credible options, why the selected option wins under current
forces, at least one material cost, and what evidence would reverse the choice.

Rationale: an unopposed decision is often a preference disguised as analysis. Cost: option
analysis consumes time. Yields for forced constraints with no feasible alternative, provided
the forcing evidence and resulting risk are explicit.

## P9. Backtrack at the earliest invalid assumption

Gates route failures to the first step capable of repairing the cause, not merely to the
document where the contradiction surfaced.

Rationale: patching downstream artifacts preserves a broken premise. Cost: changes can fan
out across several IRs. Yields during incident containment, when a temporary exception has an
owner and expiry and full backtracking follows after stabilization.

## P10. Penalize unused ceremony

Every step, artifact, relation, and field names a downstream consumer. Delete it when no
consumer exists.

Rationale: unused structure creates false confidence and consistency cost. Cost: future
consumers may require a migration instead of finding speculative fields ready. Yields for a
time-boxed experiment outside canonical IR, with a disposal decision date.

## P11. Prefer stable semantics over tool-shaped schemas

Core IR expresses design facts independently of C4, an ADR renderer, a programming language,
or a host agent. Adapters may be tool-specific.

Rationale: tool-shaped cores foreclose delivery and methodology choices. Cost: adapters must
translate and may lose target-specific features. Yields when a target feature cannot be
represented portably; isolate it as a namespaced extension with a declared consumer.

## P12. Treat evolution as part of the architecture

Every accepted architecture names continuous checks, judgment review triggers, and the
conditions that reopen decisions.

Rationale: agent-modified code erodes static documents quickly. Cost: enforcement and review
have ongoing operational cost. Yields for throwaway prototypes whose disposal boundary and
date are explicit; production-bound work does not yield.
