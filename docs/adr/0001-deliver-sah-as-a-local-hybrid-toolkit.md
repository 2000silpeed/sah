# ADR-0001: Deliver SAH as a local hybrid toolkit

Status: Accepted · Date: 2026-08-17 · Supersedes: —

## Context

SAH needs an agent-facing reasoning experience and repeatable deterministic validation while
keeping target code and architecture artifacts portable. A prompt alone cannot enforce
constraints; a service introduces operations and data-boundary costs before collaboration
needs are measured.

## Options considered

1. Prompt or skill package only
2. Reusable library only
3. Local CLI only
4. Hosted service
5. Skill package + local CLI backed by a reusable library ← chosen

## Decision

Ship an agent-neutral skill package and local CLI over one semantic library; require no
hosted service in the first delivery.

## Trade-offs accepted

+ Combines guided judgment with reproducible local checks and preserves host-agent choice.
− Three public surfaces create packaging, documentation, and compatibility work.
− Local-first operation makes centralized collaboration and policy rollout less immediate.

Mitigation: version-handshake skill, CLI, library, and schemas; add a service only through the
same public library after measured collaboration demand.

## Consequences

Canonical artifacts remain in the target repository. Host, LLM, validator, and view adapters
cannot enter the semantic core. Run 2 should implement a vertical local slice before any
service or polished multi-host prompt set.
