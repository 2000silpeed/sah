# Software Architect Harness

## Purpose

SAH is a design reasoning harness for AI coding agents. It turns ambiguous requirements into
an explicit, reviewable architecture basis before implementation and keeps the resulting
constraints visible while code changes. Through a host agent, its product boundary spans the
conversation from requirements and repository evidence through architecture, actual implementation,
and continuous verification.

SAH serves teams that let coding agents make non-trivial structural changes and need the
agent to explain and preserve why boundaries, ownership, and dependency directions exist.
The immediate user is a coding agent; architects, developers, and reviewers are the people
who approve exceptions and judge contextual decisions.

## The outcome

For each materially different subsystem, SAH should leave enough evidence to answer:

1. what kind of problem it is and which quality scenarios matter;
2. which design strategy fits and what acceptable alternatives exist;
3. which responsibilities and invariants exist and who owns them;
4. which collaborations and boundaries follow from that ownership;
5. why each representation and architecture option was selected;
6. which claims can be checked mechanically and which still require judgment; and
7. which ready implementation slices were completed and what evidence verifies the result.

The output is useful when a different agent can make a later change, find the affected
decisions, run the relevant checks, and either preserve the architecture or record a
deliberate exception.

## Success measures

- **Strategy discrimination:** on the benchmark suite, inappropriate uniform strategies and
  unnecessary ceremony score worse than justified mixed strategies.
- **Trace completeness:** every selected representation traces through owned responsibilities
  or invariants to requirement evidence; every executable constraint traces to a decision.
- **Enforcement yield:** deterministic violations identify an observable contradiction and a
  source decision, without presenting taste as fact.
- **Change recovery:** a changed assumption identifies the earliest invalid reasoning step
  and the downstream artifacts that need reconsideration.
- **Ceremony budget:** removing an artifact or field with no reader is a correctness fix, not
  a documentation loss.
- **Agent portability:** the same structured architecture model can drive more than one host
  coding agent and more than one language-specific validator.
- **Conversational completion:** a host agent can elicit missing evidence progressively, preserve
  unresolved authority, and carry ready work into tested code rather than stopping at a report.

Initial target thresholds belong to the benchmark strategy; this document owns the meaning
of success, not benchmark scoring details.

## Non-goals

SAH is not:

- a universal software methodology or a preference for object orientation, DDD, layers, or
  services;
- its own foundation model, hosted chat service, or general code generator; the installed skill
  orchestrates the user's existing coding agent and never expands that host's permissions;
- a replacement for stakeholder authority, product evidence, functional testing, observability,
  or human accountability;
- a diagram editor, source-code reverse-engineering product, or general project-management
  system;
- a promise that architecture can be made deterministic; only observable propositions can
  become hard checks;
- a requirement to fill every artifact for every project. A low-risk CRUD system should
  produce less reasoning material than a payment or distributed system.

## Product boundary and cost

SAH deliberately delays a dependent implementation slice while it resolves expensive-to-change
design questions, then directs the host agent to implement ready slices and verify them. That cost
is justified when structural mistakes would be expensive or repeatedly amplified by agents. The
counter-case is a small, reversible, low-risk change: SAH should permit a short path that records
characterization and why deeper analysis was skipped.

SAH improves decision traceability, not decision infallibility. Humans remain responsible for
accepting business risk and for correcting incomplete or biased evidence.
