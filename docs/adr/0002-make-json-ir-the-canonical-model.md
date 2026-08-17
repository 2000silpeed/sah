# ADR-0002: Make structured JSON IR the canonical model

Status: Accepted · Date: 2026-08-17 · Supersedes: —

## Context

Humans need readable ADRs and diagrams, while validators need unambiguous facts and stable
references. Parsing free-form Markdown would silently convert prose conventions into an API;
making prose and JSON co-canonical would create conflicts no component could resolve safely.

## Options considered

1. Markdown and diagrams are canonical
2. Markdown and JSON are co-canonical
3. External architecture tool is canonical
4. JSON IR is canonical; Markdown/diagrams are linked views ← chosen

## Decision

Persist canonical design facts in schema-validated JSON IR and treat human documents and
diagrams as views or explicit repository-level decisions.

## Trade-offs accepted

+ Enables deterministic references, change impact, adapters, and validation.
− Direct JSON authoring is less pleasant than prose and requires stable identifiers.
− Schema evolution and view generation become permanent product responsibilities.

Mitigation: agent-guided editing, readable diffs, migration tooling, and proposed-state
imports; never claim lossless round-trip from arbitrary prose.

## Consequences

View adapters may read IR but cannot mutate accepted facts. Production ADR rendering must use
Architecture Decision IR; this repository's hand-authored ADRs are bootstrap records, not a
precedent for parsing prose as truth.
