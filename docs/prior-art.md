# Prior Art and Novelty Verdict

Owner: prior-art comparison and novelty claims. Product choices belong to the reasoning,
validation, and architecture documents that cite this report.

Research date: 2026-08-17. Sources are project or vendor documentation unless explicitly
marked otherwise. A source proves what a project says it does, not that it succeeds in every
codebase.

## Verdict

SAH is not novel as a specification workflow, architecture model, ADR repository, dependency
linter, or agent loop. Its defensible delta is the contract between them: characterize each
subsystem, select a fitting method, reason from responsibilities and invariants before
representation, preserve that reasoning in a method-neutral IR, then compile only eligible
claims into executable constraints. None of the reviewed projects owns that whole decision
chain. This is composition novelty, not a new underlying architecture technique.

The closest overlap is GitHub Spec Kit: both are agent-agnostic, artifact-producing harnesses
that put structured reasoning before implementation. The material delta is that Spec Kit's
documented core moves from specification to plan and tasks; SAH must make architecture-method
selection, ownership, invariant placement, mixed-strategy boundaries, and enforcement first-
class. If Spec Kit adds those contracts, SAH should become an extension rather than a rival.

## 1. Architecture-first and spec-first agent workflows

### GitHub Spec Kit

- **Solves:** an extensible, intent-driven Spec-Driven Development workflow whose default
  artifacts flow Spec → Plan → Tasks → Implement, with optional clarification, checklist,
  analysis, and convergence gates ([overview](https://github.github.io/spec-kit/),
  [agentic SDD reference](https://github.com/github/spec-kit/blob/main/docs/reference/agentic-sdd.md)).
- **Does not solve for SAH:** the published core does not require per-subsystem methodology
  choice, responsibility/invariant ownership, or compilation of design decisions to
  architecture constraints.
- **Steal:** explicit phase commands, durable artifacts, cross-artifact checks, agent-neutral
  adapters, and an implementation convergence step.
- **Refuse:** treating a detailed implementation plan as sufficient evidence that the
  architecture is appropriate. Completeness cannot substitute for strategy fit.

### AGENTS.md conventions and skills

- **Solves:** repository-scoped, hierarchical operating instructions; Codex loads root-to-
  leaf `AGENTS.md` guidance with nearer files taking precedence
  ([OpenAI documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md)).
  Skills package repeatable workflows separately from always-loaded guidance
  ([OpenAI documentation](https://learn.chatgpt.com/docs/build-skills)).
- **Does not solve for SAH:** instruction discovery does not define a design model, test
  architectural truth, or detect that a locally consistent instruction encodes a poor
  methodology choice.
- **Steal:** a terse root policy, progressive workflow loading, and target-agent adapters.
- **Refuse:** placing the complete reasoning corpus in always-loaded instructions; context
  pressure would reward slogans and stale duplication.

## 2. Architecture as code and description languages

### Structurizr DSL and C4

- **Solves:** a versionable software architecture model based on C4, with elements,
  relationships, views, documentation, and ADR integration
  ([DSL](https://docs.structurizr.com/dsl),
  [models-as-code rationale](https://docs.structurizr.com/as-code)).
- **Does not solve for SAH:** C4 describes structural views; it does not decide which design
  method fits, who owns an invariant, or whether a proposed boundary is justified.
- **Steal:** one semantic model feeding multiple views, model/view separation, stable
  identifiers, and export rather than diagram-shaped core data.
- **Refuse:** making C4 hierarchy the universal IR. Pipelines, decision ownership, runtime
  failure semantics, and agent concerns require relations beyond containment.

### LikeC4

- **Solves:** an expressive DSL whose specification, model, and views describe hierarchical
  elements and relations, with sources merged into one model
  ([introduction](https://likec4.dev/dsl/intro/),
  [model](https://likec4.dev/dsl/model/)).
- **Does not solve for SAH:** visualization and structural validation begin after the hard
  design reasoning SAH targets.
- **Steal:** extensible element kinds and distributed authoring over a unified model.
- **Refuse:** user-defined kinds without canonical semantics; validators need portable facts,
  not project-specific labels that merely look structured.

### arc42

- **Solves:** a lean, standardized documentation structure for communicating architecture
  ([documentation](https://arc42.org/documentation/)).
- **Does not solve for SAH:** a template does not produce or validate the reasoning that fills
  it, and coverage of sections does not establish design quality.
- **Steal:** stakeholder/context, quality goals, risks, and decisions as navigable concerns.
- **Refuse:** mirroring the full template in the IR; optional narrative sections become
  ceremony when no reasoning step consumes them.

## 3. Architecture decision records

### MADR, adr-tools, and Log4brains

- **Solves:** MADR supplies a Markdown decision format; adr-tools manages numbered records;
  Log4brains adds CLI authoring and rendered decision-log navigation
  ([MADR](https://adr.github.io/madr/),
  [ADR tooling catalog](https://adr.github.io/adr-tooling/)).
- **Does not solve for SAH:** these tools record decisions but do not require traceability to
  characterization evidence, rejected strategies, IR elements, or executable constraints.
- **Steal:** immutable accepted records, explicit status/supersession, context, alternatives,
  consequences, and human-readable storage beside code.
- **Refuse:** parsing arbitrary prose as if it were a reliable machine contract. SAH keeps a
  small structured decision IR beside readable ADRs.

`adr-tools` and Log4brains behavior beyond the catalog summary was not independently checked
in this run. Any implementation integration must verify their current formats and licenses.

## 4. Fitness functions and dependency validators

### Representative mechanisms

- **ArchUnit** embeds architecture rules in Java tests over imported class metadata
  ([user guide](https://www.archunit.org/userguide/html/000_Index.html)).
- **dependency-cruiser** matches module dependency facts against allowed/forbidden rules and
  can distinguish cycles and dependency types
  ([rule reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)).
- **Import Linter** supplies Python contracts for forbidden imports, independence, and ordered
  layers, including indirect dependency checks
  ([contract types](https://import-linter.readthedocs.io/en/latest/contract_types.html)).
- **ts-arch**, **Deptrac**, and **NetArchTest** are recalled as ecosystem-specific structural
  dependency test tools; their current behavior was not verified in this bounded research
  pass. Do not encode adapters from recall alone.

Collectively these tools solve continuous, CI-friendly checks over facts extractable from
code. They do not determine whether the asserted layering, independence, or naming rule is a
good fit. SAH should steal native-test/CI integration, actionable violation paths, configurable
exceptions with expiry, and language adapters. It should refuse a lowest-common-denominator
rule language and refuse to turn contextual heuristics—such as “this service is too large”—
into unconditional failures.

## 5. Modern agent harness patterns

### Workflows, agents, and evaluator loops

- **Solves:** Anthropic distinguishes predetermined workflows from agent-directed control and
  documents routing, orchestrator-worker, and evaluator-optimizer patterns. It recommends the
  latter when criteria are clear and feedback measurably improves an output
  ([engineering article](https://www.anthropic.com/engineering/building-effective-agents)).
  Its evaluation guidance treats multi-turn trajectories, state changes, and outcome quality
  as separate evidence ([agent evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)).
- **Does not solve for SAH:** generic orchestration patterns do not define architecture
  reasoning gates or decide which conclusions are safe to enforce deterministically.
- **Steal:** use a deterministic workflow for mandatory reasoning stages, bounded agentic
  loops inside judgment-heavy stages, explicit graders, recorded trajectories, and a verifier
  that can return work to the producing step.
- **Refuse:** multi-agent topology as a quality signal. Add workers only for independent work
  or adversarial review; orchestration complexity has cost, latency, and synthesis failure.

OpenAI's documented Codex surfaces—persistent instructions, reusable skills, subagents, and
test/review workflows—are delivery adapters, not SAH's semantic core. SAH must preserve an
agent-independent IR so another coding agent can consume the same decisions.

## Resulting constraints on SAH

1. Treat Markdown as the review surface and JSON IR as the machine contract; neither is
   reconstructed from the other by guesswork.
2. Keep C4-compatible identity and relations, but do not constrain the core model to C4 kinds.
3. Require every accepted decision to name evidence, affected elements, costs, and any
   generated constraints.
4. Compile only observable claims. Route adequacy, boundary wisdom, and strategy fit to
   rubric-based judgment with recorded confidence and counter-evidence.
5. Integrate with host agents through thin adapters; do not make a particular agent,
   language validator, or diagram DSL the source of truth.

## Research limits

This pass was deliberately bounded. It did not run the tools, compare schema formats, inspect
licenses, or measure false positives. Those are implementation-run questions. No reviewed
source demonstrated SAH's complete method-selection-to-enforcement chain, but absence from
this sample is not proof that no such product exists.
