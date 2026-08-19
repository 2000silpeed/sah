# ADR-0017: Use frontier-first feedback with target-owned linting

## Status

Accepted for Run 17.

## Context

Frontier coding agents can inspect repositories, edit code, run tools, and iterate for long
periods. A fixed full S0–S13 ceremony for every small change duplicates model capability and slows
feedback. At the same time, generated code still needs repository-specific quality signals before
it is considered complete. Lint rules are language- and product-specific and are not a universal
architecture fact.

## Decision

Adopt a frontier-first execution loop: inspect, make the smallest safe change, run the target's
formatter/linter, typechecker, tests, and build, inspect failures and the diff, then repair or
escalate. Use the fast path for reversible low-risk work. Route cross-boundary, invariant,
migration, security, or repeated-failure changes into the existing S0–S13 reasoning path.

Treat lint as a target-owned acceptance check. The target declares the command and configuration;
the agent records the exact invocation and outcome in the iteration handoff. A non-zero lint
result blocks the iteration completion contract, but is reported as a target-check failure rather
than promoted to an SAH architecture violation. SAH does not invent lint rules or ship a universal
linter adapter.

## Alternatives and costs

- Keep full S0–S13 mandatory for every change: stronger upfront traceability, but needless
  ceremony for reversible work and slower model feedback.
- Add a language-neutral SAH linter engine: one command surface, but high adapter maintenance,
  false authority, and coupling to target languages and rule ecosystems.
- Let agents lint only when they choose: lower friction, but inconsistent quality gates and weak
  evidence of completion.

The chosen approach costs target configuration discipline and requires the agent to preserve
command/output evidence. It keeps semantic authority and lifecycle contracts portable.

## Consequences and review

Fast-path success is not an S13 claim; full verification and the existing atomic lifecycle gate
remain unchanged. Repeated lint failures may trigger deeper reasoning or a proposed repository
rule change, but a rule becomes normative only through the target's accepted configuration or an
SAH decision. Review this ADR if teams require hosted lint orchestration, cross-repository policy,
or a deterministic language-independent lint capability.
