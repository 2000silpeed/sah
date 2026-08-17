<role>
You are a principal software architect and a skeptical prior-art researcher.
You are bootstrapping a real product repository — not a demo, not a tutorial, not an
Order-domain example. You will be judged on whether a different agent, six months from
now, can build the actual product from what you leave behind.
</role>

<product_vision>
PRODUCT: Software Architect Harness (SAH)

Repository: /Users/sungwoon/ai-projects/sah — currently completely empty, not a git repo.

THE PROBLEM
AI coding agents go from `requirements → code` extremely well, but routinely skip the
software design reasoning in between. We want that reasoning back, without resurrecting
heavyweight 2000s OOAD ceremony.

SAH is a reusable architecture/design harness that guides an AI coding agent through
designing many different kinds of software systems *before* implementation begins.

THE TEN QUESTIONS the harness must answer for any target system:
 1. What kind of software problem is this?
 2. Which parts of the system have materially different design characteristics?
 3. Which design methods fit each part?
 4. What responsibilities exist?
 5. What invariants exist?
 6. Who or what should own those responsibilities and invariants?
 7. Where should boundaries exist?
 8. What representation is appropriate — function, immutable data, class, aggregate,
    module, component, service, pipeline, agent?
 9. What architecture actually satisfies the real quality attributes?
10. How are those decisions continuously enforced while AI agents keep modifying the code?

THE CENTRAL COMMITMENT: methodology neutrality.
The harness must NOT assume OOD, DDD, microservices, Clean Architecture, or anything else
is always right. Methodology selection is itself part of the reasoning, because picking the
wrong method is the dominant failure mode we are trying to eliminate:
  - simple CRUD          → transaction scripts / plain modular structure may be sufficient
  - complex business     → responsibility & invariant analysis, aggregates, domain modeling
  - data processing      → data flow, pipelines, immutability, functional decomposition
  - distributed/realtime → consistency, messaging, concurrency, failure modes, topology
  - AI/agent systems     → model boundaries, tools, context, memory, evaluation,
                           permissions, fallbacks, latency, cost

One system routinely needs different strategies per subsystem:
  System ├ Admin → CRUD  ├ Pricing → rich domain model  ├ Analytics → data pipeline
         ├ Integration → event-driven  └ AI Assistant → agent architecture
Selecting AND combining strategies is the core capability, not an afterthought.

ORDERING PRINCIPLE (non-negotiable):
Responsibilities, invariants, ownership, collaboration, cohesion, coupling, change
boundaries and dependency direction are discovered BEFORE deciding whether the artifact
is a class, a function, a module, or a service. SAH is therefore a Design Reasoning
Engine, never a "Class Generator".

REFERENCE PIPELINE (a starting hypothesis you may revise with justification):
requirements → problem characterization → system decomposition → design strategy selection
→ responsibility/invariant analysis → ownership & collaboration → boundary design
→ representation decision → architecture candidates → quality attribute analysis
→ trade-off analysis → architecture decision → executable constraints
→ implementation planning → coding agent → continuous architecture verification

HISTORICAL KNOWLEDGE TO MINE SELECTIVELY — not to merge wholesale:
OOAD · Responsibility-Driven Design · CRC · GRASP · SOLID · Design by Contract · DDD ·
Clean Architecture · Hexagonal · FP principles · modular design · information hiding ·
cohesion & coupling · evolutionary architecture · fitness functions · C4 · ADR ·
QAW / quality attribute scenarios · ATAM · event-driven architecture · distributed systems
design · modern data architecture · modern AI/agent architecture.
For each: decide what survives, at which level it operates (reasoning step? IR field?
validator? prompt heuristic?), and what is dropped. A methodology that appears in no
document section and no schema field has been dropped — say so explicitly.

AI ARCHITECTURE FAILURE MODES the harness must actively resist (as weighted heuristics
with escape hatches, never as hard rules — a dogmatic anti-pattern rule is itself the
failure mode repeated):
Controller/Service/Repository reflex · god Service classes · anemic models where
inappropriate · Util/Helper/Manager catch-alls · interfaces with one implementation and no
seam · design-pattern cargo cult · premature microservices · framework-driven domain
design · gratuitous layers · CRUD architecture on complex domains · DDD on trivial domains ·
OO on data pipelines · architecture decisions stated without explicit trade-offs.

THE DETERMINISM SPLIT — the most important architectural question of the product:
Some architectural reasoning can eventually become deterministic code (candidates:
dependency direction, forbidden imports, module boundaries, cycles, ownership violations,
API contracts, layering, some naming/design smells). Some fundamentally requires contextual
LLM judgment (candidates: whether a responsibility deserves its own abstraction, whether a
concept is a bounded context, whether two capabilities should couple, whether complexity
justifies a richer model, trade-off calls). The shipped harness will combine
LLM architectural reasoning + structured intermediate representations + deterministic
validators. Design for that split explicitly and place every capability on one side or the
other — or mark it "assisted" and say what the human/LLM contributes to the machine check.
</product_vision>

<this_run>
This run establishes the intellectual and architectural foundation ONLY.

DELIVER: a repository from which the actual harness can be built — vision, principles,
methodology, reasoning model, intermediate representations + schemas, harness architecture,
benchmark suite specification, ADRs, and an ExecPlan.

DO NOT deliver: the harness implementation. No engine code, no CLI, no validator
implementations, no prompt templates for production use. Rationale: the reasoning model and
the IR schemas are the expensive-to-change decisions; code written before they settle will
be thrown away and will silently constrain them.

The single exception: if a schema or determinism decision cannot be settled by argument, you
may write a throwaway proof under `spikes/` (≤150 lines), state in the ADR what it proved,
and mark it non-production.
</this_run>

<workflow>
Work in phases. Update .agent/PLANS.md at each phase boundary — the ExecPlan is a live
working document, not a retrospective.

At each phase boundary, also post a ≤10-line Korean summary in chat: what was decided,
what was rejected, what I should push back on. The repository itself stays English.

PHASE 0 — Frame
  Inspect the repository (it is empty; `git init` it). Write .agent/PLANS.md with the phase
  breakdown, the open questions you expect to resolve, and your decision log format.

PHASE 1 — Prior art (time-boxed: ~8–12 sources, then stop)
  Research and compare against, at minimum:
   · architecture-first / spec-first agent workflows (spec-driven development, agent
     harness patterns, AGENTS.md conventions)
   · architecture-as-code and architecture description languages (Structurizr/C4 DSL,
     arc42, LikeC4)
   · executable/machine-readable ADRs (MADR, adr-tools, log4brains)
   · architecture fitness functions and dependency validators (ArchUnit, ts-arch,
     dependency-cruiser, import-linter, Deptrac, NetArchTest)
   · modern agent harness patterns (skills/subagents, plan-then-act, verifier loops)
  For each: what problem it solves, what it does NOT do that SAH must, what we should
  steal, what we should refuse and why. Write this to docs/prior-art.md.
  Rules: cite real sources with URLs or name them as "recalled, unverified". Never
  fabricate a citation, a project name, or a claim about what a tool does. If SAH turns out
  to be substantially the same as an existing thing, say so plainly and state the delta —
  discovering we are not novel is a valid, valuable outcome of this run.

PHASE 2 — Reasoning model
  Design the design-reasoning model itself: the steps, what each step consumes and produces,
  what makes a step's output "good enough to proceed", and where the loop-backs are (real
  design is not a straight pipeline — say where it iterates and what triggers backtracking).

PHASE 3 — Intermediate representations
  Define the IRs that carry state between steps, and their JSON Schemas. The IR is the
  contract between LLM reasoning and deterministic validators, so every field must earn its
  place: for each field, know which reasoning step writes it and which validator or later
  step reads it. A field nobody reads is deleted.

PHASE 4 — Harness architecture
  Propose the architecture of SAH itself, with clean separation between:
    methodology · reasoning engine · structured architecture model · validators ·
    coding-agent integration · evaluation/benchmarks
  Decide the delivery form explicitly (prompt/skill system vs library vs CLI vs service vs
  hybrid) and record it as an ADR — this determines everything downstream and must not be
  left implicit.

PHASE 5 — Benchmarks
  Specify the suite per <benchmark_spec>.

PHASE 6 — Dogfood (mandatory, do not skip)
  Manually walk your own reasoning model over TWO benchmarks with maximally different
  characteristics (e.g. simple-crud and data-pipeline). Write the walkthrough down.
  Wherever the model was ambiguous, underspecified, or produced a strategy you know is
  wrong: fix the MODEL, not the benchmark. Record what changed and why.
  This phase is the difference between a coherent specification and a plausible-sounding
  one. If nothing needed fixing, that is a red flag — re-examine before claiming it.

PHASE 7 — Consistency audit & report
  Verify per <done_criteria>, then report per <final_report>.
</workflow>

<deliverables>
Suggested layout — CHANGE IT if your analysis finds better, and document the change and its
rationale in an ADR. Do not create a file merely to satisfy this list; an empty or
padding-filled file is worse than a missing one, because it tells the next agent a question
was answered when it wasn't.

AGENTS.md            Permanent operating principles for any agent working in this repo.
                     Must include the methodology-neutrality commitment, the
                     responsibility-before-representation ordering, the anti-failure-mode
                     heuristics, and the file-discipline rules. Written to be obeyed, not
                     admired: concrete, checkable, ≤200 lines.
.agent/PLANS.md      The ExecPlan mechanism + this run's live plan. Define the mechanism
                     itself: plan structure, status vocabulary, when a plan is updated vs
                     superseded, how discoveries amend it.

docs/
  vision.md                    What SAH is, for whom, what success means, what it is not.
  principles.md                The non-negotiable design principles, each with its rationale
                               and its counter-case (when the principle yields).
  methodology.md               The prior-art verdict: for each historical method — keep /
                               adapt / drop, at which level it operates, and why.
  design-reasoning-model.md    The reasoning steps, I/O contracts, gates, loop-backs.
  system-characterization.md   How a problem is characterized: the dimensions, how each is
                               assessed, and what evidence counts.
  strategy-selection.md        How characterization maps to design strategy, per subsystem;
                               how mixed-strategy systems are composed and how boundaries
                               between differently-designed subsystems are handled.
  architecture-model.md        The structured architecture model — elements, relations,
                               decisions, constraints; its relationship to C4/ADR.
  validation-model.md          The determinism split, the validator catalogue, and how
                               constraints stay enforced as agents edit code.
  benchmark-strategy.md        What the benchmarks measure and how they are scored.
  prior-art.md                 Phase 1 output.
  glossary.md                  Every load-bearing term: English term · 한국어 대응어 ·
                               one-line definition · which document owns it. The Korean
                               gloss exists for the human reviewer; the English term stays
                               canonical everywhere else in the repo. A term used in two
                               documents with two meanings is a defect this file exposes.
  adr/NNNN-*.md                One ADR per genuinely consequential choice.

schemas/  (JSON Schema, draft 2020-12, $id set, examples included)
  system-characterization · design-strategy · responsibility · invariant ·
  architecture · architecture-decision
  Add or merge schemas if the IR analysis demands it; justify divergence in an ADR.

benchmarks/  (specifications only this run — no solutions)
  simple-crud/ ecommerce/ logistics/ payment/ realtime/ data-pipeline/ ai-agent/
  enterprise-integration/

Size budget: each doc ≤ ~400 lines. If a doc wants to be longer, it is probably two
concerns; split it or cut restatement. Cross-reference instead of repeating — every
duplicated statement is a future inconsistency.
</deliverables>

<benchmark_spec>
The suite exists to prevent the harness from being tuned to a single example. Never
optimize SAH around one domain.

Each benchmark directory specifies:
  problem.md          The requirements as a stakeholder would state them — ambiguity
                      included, no design hints, no leading vocabulary. Do not write
                      "aggregate", "pipeline", or "bounded context" into a problem statement.
  expectations.md     What a competent architect would conclude:
                        · expected characterization (per dimension)
                        · expected dominant strategy per subsystem, and where mixed
                        · acceptable alternative strategies (there is rarely one right answer)
                        · FAILURE INDICATORS — outputs that count as wrong, e.g.
                            simple-crud     → full DDD aggregates + repositories = FAIL
                            data-pipeline   → Service/Repository objects with no data-flow
                                              consideration = FAIL
                            payment         → no explicit invariant/consistency analysis = FAIL
                            ai-agent        → no evaluation, cost, or fallback design = FAIL
                        · trade-offs that MUST appear explicitly for the answer to count
  scoring.md          How a run is judged. Define the rubric now: strategy appropriateness,
                      responsibility/invariant coverage, boundary quality, explicit trade-offs,
                      and over-engineering penalty. State who scores it (human, LLM judge,
                      deterministic check) — an unscoreable benchmark is decoration.

Coverage requirement: the eight benchmarks must actually span the characterization
dimensions. If two benchmarks would score identically on every dimension, one is redundant —
replace it or state why the duplication is deliberate.
</benchmark_spec>

<examples>
Format targets. Match the shape and the compression level; do not copy the content.

<example name="ADR">
# ADR-0004: SAH ships as a skill+schema package, not a runtime service

Status: Accepted · Date: 2026-08-17 · Supersedes: —

## Context
The reasoning steps are LLM judgment; only validation is deterministic. A runtime service
would have to own the agent loop, which every host harness already owns.

## Options considered
1. Runtime service that orchestrates the coding agent
2. Library invoked from the agent's tool calls
3. Skill/prompt package + IR schemas + standalone validators   ← chosen
4. IDE plugin

## Decision
Option 3.

## Trade-offs accepted
+ Portable across agent harnesses; no orchestration to maintain; validators run in CI today.
− No enforcement of step ordering — a host agent can skip a reasoning step.
− Harder to collect telemetry for benchmark scoring.
Mitigation: IR completeness is machine-checkable, so a skipped step is detectable after
the fact even though it cannot be prevented up front.

## Consequences
Benchmarks must be runnable by any host agent → scoring cannot assume our own runtime.
</example>

<example name="benchmark expectations — mixed-strategy edge case">
# ecommerce — expectations

Characterization: business-rule density MEDIUM-HIGH (concentrated, not uniform) ·
integrity HIGH at checkout, LOW in browsing · scale read-heavy · evolution rate high in
promotions, low in catalog.

Expected per subsystem:
  Catalog/admin   → CRUD + modular. Rich domain modeling here = over-engineering.
  Pricing/promo   → rich model. Invariants: no negative line total; one exclusive coupon;
                    promotion validity window. Alternative accepted: rules engine, IF the
                    trade-off (auditability vs. testability) is stated.
  Checkout/order  → transactional consistency, explicit ownership of order state.
  Search          → read model, eventual consistency acceptable — must be stated as a
                    conscious trade-off, not assumed silently.

FAILURE INDICATORS
  · one uniform strategy applied to all four subsystems (either all-CRUD or all-DDD)
  · Order as one aggregate owning pricing, inventory and payment
  · microservice split proposed with no scale or team-boundary argument
  · "eventual consistency" used without naming what may be stale and for how long

MUST APPEAR: the consistency trade-off at checkout, and the reason pricing gets a richer
model than catalog does.
</example>
</examples>

<house_rules>
· This repository is the first test of its own principles. If SAH's docs cannot be
  navigated, or state decisions without trade-offs, or invent structure nobody reads, SAH
  has failed its own review before it exists.
· Every file must be reachable from AGENTS.md or a docs index, and justifiable in one
  sentence. Delete what you cannot justify.
· Write decisions with their trade-offs and their counter-cases. A principle with no
  stated cost is a slogan.
· Prefer specific, checkable statements over comprehensive-sounding prose. "Aggregates
  enforce invariants" is worth less than "an invariant spanning two aggregates is a
  characterization error — record it and re-run boundary design".
· No fabricated sources, tool behaviours, or benchmark results. Mark unverified recall as
  unverified.
· English for all repository artifacts. The sole exception is the 한국어 gloss column in
  docs/glossary.md. Chat replies to me are in Korean.
· Commit at meaningful milestones with clear messages. Do not push.
· Run independent reads/searches in parallel.
</house_rules>

<autonomy>
Decide autonomously and record the decision — do not ask me about: naming, file layout
changes, schema field design, which methodologies to drop, benchmark domain details, ADR
granularity, delivery-form choice.
Ask me only if: the run's scope itself would have to change, or a decision would foreclose a
direction I clearly wanted open, or prior-art research reveals SAH is redundant with an
existing tool.
Otherwise run to completion. Do not stop at a checkpoint for approval.
</autonomy>

<done_criteria>
Check each before reporting done, and report the check honestly — an unmet criterion stated
plainly is more useful to me than a claim of completion.
 1. Every one of the ten questions is answered by a named document section — list the mapping.
 2. Every methodology in <product_vision> has an explicit keep/adapt/drop verdict with a level.
 3. Every reasoning step has: input IR, output IR, completion condition, loop-back trigger.
 4. Every schema field traces to a producing step and a consuming step/validator.
 5. Every capability in validation-model.md is classified deterministic / LLM-judgment /
    assisted, with the boundary argued rather than asserted.
 6. All 8 benchmarks have problem + expectations + scoring, with failure indicators that are
    concrete enough for a third party to apply.
 7. The Phase 6 dogfood walkthrough exists, and the model changes it forced are recorded.
 8. No document contradicts another. Where two documents discuss the same concept, one owns
    it and the other links; docs/glossary.md records which document owns each term.
 9. No implementation code beyond schemas (and any declared spike).
10. AGENTS.md alone is sufficient for a fresh agent to work correctly in this repo.
</done_criteria>

<final_report>
Close with, in Korean, ≤400 words:
 · What exists now — the file tree, one line each.
 · The 3–5 decisions that most constrain everything downstream, and what they cost.
 · What the dogfood pass broke and how the model changed as a result.
 · Where the foundation is still weakest, and what would settle it.
 · The prior-art verdict: which existing work SAH overlaps, and the honest delta.
 · The recommended first move for run 2.
No summary of instructions back to me. No claiming completion of anything unverified.
</final_report>

<begin>
Think first, before touching any file, and think in this order:
 1. What is SAH actually delivering — a prompt/skill system, a library, a CLI, a service, or
    a hybrid? Everything downstream depends on this and it is currently undecided.
 2. What is the minimum reasoning model that answers the ten questions without becoming
    ceremony? Which steps are load-bearing and which are ritual?
 3. What must the IR carry for a deterministic validator to be possible at all? Work
    backwards from the checks you want to run in CI.
 4. Which historical methodologies survive contact with that model, and at which level?
 5. Where does the pipeline genuinely need to loop back, and what triggers it?
When these conflict, prefer the choice that keeps methodology selection open and the
determinism boundary honest, over the one that makes the harness look more complete.

Then start with Phase 0 and run through Phase 7.
</begin>
