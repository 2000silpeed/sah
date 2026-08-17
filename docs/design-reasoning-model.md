# Design Reasoning Model

This document owns the ordered, iterative reasoning contract. The flow has mandatory stages,
but gates can return work to the earliest invalid premise. IR names refer to schemas defined
under `schemas/`; partial IR is permitted during a run, while selected output must satisfy
semantic gates beyond JSON Schema validity.

## Control rules

- Evidence precedes claims; an unsupported consequential claim becomes an assumption with a
  falsification trigger.
- A stage may update only the fields assigned to it in the IR traceability tables.
- A downstream contradiction reopens its causal stage and marks dependent artifacts stale.
- Gates are risk-scaled: the amount of evidence varies, but no mandatory question disappears.
- A human can accept risk or a forced constraint; neither the LLM nor validator invents that
  authority.

## Stages

### S0 — Frame scope and normalize evidence

**Consumes:** stakeholder requirements, repository context, policies, and observed facts.
**Produces:** System Characterization IR identity, scope, evidence, assumptions, and unresolved
questions. **Complete when:** scope and stakeholders are named, requirements have locators,
and ambiguity is visible. **Loop-back:** any later uncited claim or changed requirement
returns here.

### S1 — Characterize and decompose the problem

**Consumes:** S0 output. **Produces:** subsystems, dimension ratings, hard constraints, and
quality scenarios in System Characterization IR. **Complete when:** the gate in
`system-characterization.md` passes. **Loop-back:** indistinguishable regions merge; a region
with conflicting forces splits; missing measurable quality evidence returns to S0.

### S2 — Select design strategies

**Consumes:** complete System Characterization IR. **Produces:** Design Strategy IR with a
dominant and supporting strategy per subsystem, alternatives, disqualifiers, costs, and
representation-free mixed-edge composition seams. **Complete when:** the gate in `strategy-selection.md`
passes. **Loop-back:** an unrated force returns to S1; unsupported complexity is simplified
here; ownership analysis can reopen the selection.

### S3 — Discover responsibilities

**Consumes:** evidence, subsystem scopes, and strategy emphases. **Produces:** unowned
Responsibility IR entries: outcome-oriented statement, kind, inputs/outputs, trigger, evidence,
change reason, and candidate collaborators. **Complete when:** every required outcome and
quality response maps to at least one responsibility, duplicates are resolved, and entries
avoid representation words. **Loop-back:** a responsibility spanning unrelated change reasons
returns to S1 decomposition; missing outcomes return to S0.

### S4 — Discover invariants and failure obligations

**Consumes:** evidence, quality scenarios, strategies, and responsibilities. **Produces:**
unowned Invariant IR entries: precise predicate or obligation, applicability/lifetime, scope,
trigger, consistency, failure impact, detection/recovery, and evidence. **Complete when:** critical state changes
name what must be true before/after and distributed or probabilistic regions name tolerated
failure. **Loop-back:** an invariant based on a new force returns to S1; an unexpressible rule
returns to S0 for evidence.

### S5 — Assign ownership and collaboration

**Consumes:** Responsibility and Invariant IRs plus composition seams. **Produces:** owner
and collaborator references, enforcement responsibility, authority, and unresolved ownership
conflicts in both IRs. **Complete when:** each entry has one accountable logical owner or an
explicit coordination protocol; owners are cohesive by change reason; no critical invariant
depends on accidental multi-owner atomicity. **Loop-back:** cross-owner invariants return to
S1/S2 if the boundary is wrong, or to S4 if consistency semantics were missing.

### S6 — Design boundaries and contracts

**Consumes:** owned responsibilities/invariants, strategies, and composition seams.
**Produces:** a draft Architecture IR with logical elements, boundaries, interfaces,
collaborations, authority, and dependency direction; representation remains undecided.
**Complete when:** every boundary hides a named change or risk, each cross-boundary relation
has semantics and an owner, and critical invariants sit within an enforceable authority or
protocol. **Loop-back:** excessive cross-boundary collaboration returns to S5 or S1; a
technology-shaped boundary returns to S2.

### S7 — Decide representations

**Consumes:** the S6 architecture and its trace links. **Produces:** representation choices
for logical elements—function, immutable data, class, aggregate, module, component, service,
pipeline, state machine, agent, store, queue, or external system—with rationale and decision
references. **Complete when:** every choice traces to owned work or an imposed constraint,
and no more elaborate form survives when a simpler form satisfies the same forces.
**Loop-back:** unclear ownership returns to S5; representation-driven new boundaries return
to S6; hidden methodology assumptions return to S2.

### S8 — Generate architecture candidates

**Consumes:** the represented architecture basis and quality scenarios. **Produces:** at
least two materially different Architecture IR candidates for consequential choices, or one
candidate plus forcing evidence. An eligible short path may instead produce one candidate
when resolved S2 alternatives and proportionality evidence show that another architecture is
ceremony. Each candidate identifies its topology and operational consequences; a
single-candidate set records its justification explicitly. **Complete when:** candidate
count/status and evidence references pass deterministic checks, and review finds candidates
internally coherent and materially different where alternatives exist. **Loop-back:** no
credible alternative outside the short path returns to S6/S7 or records the forcing
constraint.

### S9 — Evaluate quality and trade-offs

**Consumes:** candidates and quality scenarios. **Produces:** exactly one assessment for every
candidate/must-scenario pair and proposed Architecture Decision IR options with no selected
option, plus risks, sensitivity points, costs, and reversal evidence. **Complete when:**
coverage and proposed state pass deterministic checks, every must scenario is met or its risk
is assigned to an authorized human through assisted/judgment review, and trade-offs name what
worsens. **Loop-back:** a failed scenario returns to S8; a scenario that cannot discriminate
returns to S1; a hidden responsibility returns to S3.

### S10 — Select and record architecture

**Consumes:** S9 assessments and human risk decisions. **Produces:** selected Architecture IR
and accepted/rejected Architecture Decision IR records with affected elements and
supersession. **Complete when:** one coherent candidate is selected, every consequential
choice has a record, and rejected options and costs remain visible. An unresolved choice may
remain `proposed` only when its uncertainty is isolated behind an owned boundary and every
dependent implementation slice is blocked. **Loop-back:** unresolved authority over a
non-isolatable choice blocks selection; new evidence reopens the earliest affected stage.

### S11 — Compile executable constraints

**Consumes:** accepted decisions and selected architecture. **Produces:** Constraint entries
in Architecture IR, each classified deterministic, assisted, or judgment; deterministic
entries define observable inputs and violation messages. **Complete when:** every decision is
classified as deterministic, assisted, or judgment with an explicit enforcement binding,
every hard rule traces to a decision, and exceptions have authority and expiry. **Loop-back:** an unobservable “hard” claim returns to S10 for
rewording or is downgraded; a missing code fact becomes adapter backlog, not invented truth.

### S12 — Produce the implementation handoff

**Consumes:** all selected IRs, decisions, and constraints. **Produces:** canonical
Implementation Handoff IR: dependency-ordered change slices, acceptance checks with expected
results, migration/rollback needs, and coding-agent context. **Complete when:** every selected
element and applicable constraint is covered; each slice names accepted decisions affecting
it; every affecting proposed decision blocks that slice; ready/blocked state is consistent;
and slice dependencies are acyclic. Presence, references, coverage, and status are
deterministic. Slice wisdom and plan adequacy remain judgment. **Loop-back:** an unimplementable
boundary returns to S6/S7; no product code begins before this gate for a full-path run.

### S13 — Verify continuously

**Consumes:** code changes, selected IR, constraints, and decision review triggers.
**Produces:** deterministic results, assisted findings, judgment reviews, approved exceptions,
and change-impact events. **Complete when:** applicable deterministic checks pass or have
live exceptions and judgment triggers are dispositioned. **Loop-back:** structural violations
return to implementation; changed forces or repeated heuristic findings reopen S0–S10 at
their source.

The executable subset currently runs target-filesystem presence and one explicitly mapped
TypeScript write-authority capability for constraints assigned by an S12 handoff. The latter
uses an explicit project to resolve named path aliases and static named/star re-exports while
keeping unresolved project/source forms incomplete. Explicit changed paths may select assigned
slice constraints, but mapping gaps expand to full verification and selected adapters retain
complete evidence. Pending contextual reviews and unsupported adapters keep verification
incomplete. The executable completion gate accepts only a schema-validated full-verification
record whose checks all pass, S12 assignment traces are complete, and design fingerprint is
current. Changed-scoped evidence—including full fallback—cannot complete S13. Assisted or
judgment constraints therefore remain blockers until their disposition contract is implemented.

## Short path

S0–S2 may declare a low-risk short path when the change is reversible, local, has no critical
invariant, distribution, probabilistic autonomy, or material quality scenario, and a simple
strategy is adequate. It still records responsibilities, ownership, representation rationale,
and applicable constraints, but these may be compact entries rather than full candidate
analysis. Discovery of a disqualifying force immediately restores the full path.

## Ten-question coverage

| Question                                   | Owning section                                                   |
| ------------------------------------------ | ---------------------------------------------------------------- |
| 1. What problem kind?                      | `system-characterization.md` — Dimensions and procedure          |
| 2. Which parts differ?                     | `system-characterization.md` — Unit of assessment                |
| 3. Which methods fit?                      | `strategy-selection.md` — Strategy catalogue and selection rules |
| 4. What responsibilities?                  | S3                                                               |
| 5. What invariants?                        | S4                                                               |
| 6. Who owns them?                          | S5                                                               |
| 7. Where are boundaries?                   | S6                                                               |
| 8. Which representation?                   | S7                                                               |
| 9. Which architecture meets quality needs? | S8–S10                                                           |
| 10. How is it enforced?                    | S11–S13 and `validation-model.md`                                |

## Model change protocol

Dogfood or production evidence changes this model only through an ADR or an explicit
discovery entry: name the failing stage, reproduce the ambiguity or wrong outcome, change
the earliest responsible contract, and rerun all downstream gates. Benchmark expectations
must never be edited merely to make a model output pass.
