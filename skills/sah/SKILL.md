---
name: sah
description: Use Software Architect Harness to turn a natural-language software request into evidence-backed architecture, implemented code, tests, and honest verification. Trigger for new software, material features, refactors, migrations, integrations, or architecture decisions in Codex or Claude Code when the agent should inspect the repository, progressively question the user, select fitting methods per subsystem, author SAH design artifacts, implement ready slices, and preserve decisions as code changes.
---

# Software Architect Harness

Use the host coding agent as the conversational reasoner and implementer. Use SAH's canonical
JSON bundle and CLI as the durable evidence and deterministic gate. The goal is working software
whose important structural choices remain explainable and checkable—not an architecture report
that stops before code.

## Required references

Read these files from this skill package at the point named below:

- Read [elicitation-and-method-selection.md](references/elicitation-and-method-selection.md)
  before asking design questions or selecting a strategy.
- Read [artifacts-and-lifecycle.md](references/artifacts-and-lifecycle.md) before creating or
  changing a design bundle.
- Read [implementation-and-verification.md](references/implementation-and-verification.md)
  before changing product code or claiming completion.

Do not load unrelated repository documents speculatively. When the SAH source checkout is
available, treat its `AGENTS.md`, schemas, and linked authority documents as canonical over these
condensed operating instructions.

## Outcome contract

Unless the user explicitly narrows the task, continue through this whole loop:

1. inspect the target repository and supplied requirements;
2. ask adaptive questions until consequential uncertainty is resolved or honestly recorded;
3. characterize each problem region and select the least elaborate fitting design strategy;
4. discover responsibilities, invariants, ownership, boundaries, and contracts before choosing
   implementation forms;
5. compare credible architecture candidates and record consequential decisions;
6. produce a dependency-ordered implementation handoff;
7. implement every ready in-scope slice and run its acceptance checks;
8. verify observable architecture constraints and report deterministic, assisted, and judgment
   results separately;
9. advance lifecycle only through supported public gates and only when their evidence qualifies.

Do not stop after producing suggestions or JSON when safe, authorized implementation work remains.
Do not implement a slice whose consequential decision is unresolved.

## Establish the two repositories

Distinguish:

- **target checkout** — the user's software and the place where code and its design bundle live;
- **SAH checkout** — this skill's source repository, containing `package.json`, `schemas/`, and the
  built `sah` CLI.

First obey the target checkout's `AGENTS.md` or equivalent instructions and inspect its Git state.
Resolve the skill directory through any host symlink before inferring paths. When that physical
directory ends in `skills/sah`, the SAH checkout is exactly two parents above it. Confirm the
checkout by reading package name `software-architect-harness` and checking `schemas/`; do not use
`command -v sah` as the installation test because the CLI is intentionally non-global. If the skill
was copied without the runtime, ask for the SAH checkout path before claiming deterministic
validation. Never download software or invoke a paid model without authorization.

Run CLI commands with the SAH checkout as the working directory and pass absolute target/bundle
paths. Install/build the runtime there when needed:

```text
npm install
npm run build
```

## Choose a proportionate route

- **New or materially changed system:** run the full outcome contract. Use the short profile only
  when the recorded evidence meets every short-path condition.
- **Existing SAH bundle:** validate it, read its completed stage and unresolved items, then resume
  at the earliest invalid or incomplete premise.
- **Implementation-only follow-up:** if accepted S12 evidence remains current, implement its ready
  slices and continue at S13. Reopen reasoning if code work exposes a changed force or missing rule.
- **Review-only request:** inspect and report against the relevant evidence; do not mutate code or
  lifecycle unless the user also requests changes.

A stakeholder-imposed technology is a hard constraint, not permission to skip responsibility and
ownership analysis.

## Run progressive elicitation

Inspect before asking. Mine requirements, source, tests, configs, ADRs, issue text, and operational
evidence for answers already present. Then follow the question loop in the elicitation reference.

Ask one or two questions at a time, prioritized by decision impact, uncertainty, and inability to
observe the answer locally. Explain briefly what decision the answer affects. Use each response to
choose the next question; do not dump a generic questionnaire.

Continue asking while a missing answer could change scope, a critical invariant, consistency,
authority, security/privacy, failure recovery, a hard constraint, or an expensive architecture
choice. Stop asking when the next decision has sufficient evidence and proceed automatically.

If the user does not know, preserve an unresolved question with its consequence and resolution
owner. If the user delegates the choice, record an explicit assumption, confidence, and reversal
evidence. Never present an inferred preference as stakeholder evidence. A material unresolved item
blocks only the dependent implementation slice when an owned seam can isolate it; otherwise stop
before implementation and ask for authority.

## Reason before naming implementation forms

Apply this order to every materially different problem region:

1. scope and evidence;
2. characterization and quality scenarios;
3. strategy and simpler alternative;
4. responsibilities and invariants;
5. ownership and collaboration;
6. boundaries and contracts;
7. representation;
8. architecture candidates and measured trade-offs;
9. accepted decisions, observable constraints, and implementation slices;
10. implementation and continuous verification.

Do not begin with layers, services, classes, functions, events, agents, stores, or queues. Choose
them only after the preceding evidence identifies what they protect. Keep decisions proposed until
an authorized person accepts them; the host model has no independent risk authority.

## Maintain evidence while working

Default a new target bundle to `.sah/design/` unless target instructions choose another location.
Preserve user-supplied provenance verbatim. Use stable kebab-case IDs and references rather than
copying claims between artifacts. Treat JSON as canonical; Markdown, diagrams, and conversation
summaries are views.

After each meaningful answer or discovery:

- update the earliest affected artifact;
- identify downstream artifacts that are now stale;
- validate as soon as a complete bundle checkpoint exists;
- summarize what became known, what remains assumed, and what decision comes next.

Follow the lifecycle reference exactly. In particular, never edit an existing manifest's completed
stage to simulate advancement, never skip a stage, and never treat a schema-valid file as proof that
contextual architecture judgment passed.

## Implement and verify

Before code edits, read the implementation reference and require a valid S12 handoff for full-path
work. Implement dependency-ordered ready slices using the target repository's normal workflow.
Keep scope tied to accepted decisions, but allow evidence from implementation to reopen an earlier
stage.

Run target tests and static checks throughout. Use changed-scoped SAH verification only for fast
feedback. Final S13 eligibility requires a new full verification record and an atomic
`S12 -> S13` advance. `incomplete`, `violations`, `operational-error`, changed scope, and
`full-fallback` selected from a changed request never satisfy completion.

When the available adapter cannot observe a claim, report `unsupported`/`incomplete`; do not call
it pass. The software may still be implemented and tested, but S13 remains incomplete until the
declared review or adapter coverage exists.

## Communicate progress and completion

Keep the user in the conversation during long work. At decision points, state the evidence,
assumption, selected option, real costs, and reversal trigger in plain language. At completion,
lead with the working outcome and include:

- implemented behavior and affected boundaries;
- questions answered, assumptions retained, and decisions still proposed;
- target tests and SAH checks actually run;
- deterministic violations, assisted findings, judgment items, and unsupported coverage;
- lifecycle stage reached and why it did or did not qualify;
- commits or external actions performed, without claiming any unrun check.
