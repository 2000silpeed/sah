# ADR-0009: Add Implementation Handoff IR

Status: Accepted · Date: 2026-08-17 · Supersedes in part: ADR-0003

## Context

S12 must hand coding agents ordered change slices with affected elements, applicable
constraints, accepted decisions, acceptance checks, migration and rollback needs, and proposed
decisions that block dependent work. The six bootstrap IRs do not serialize slice ownership or
dependency facts, so S10 can only warn that proposed-decision isolation needs review.

The representation must preserve the manifest's non-semantic lifecycle/storage role and must
not let implementation planning rewrite selected Architecture facts.

## Options considered

1. Add a seventh Implementation Handoff IR written at S12 ← chosen
2. Add slice fields to Architecture IR
3. Store slices in the non-semantic bundle manifest
4. Infer conventional handoff filenames and accept a CLI stage flag

## Decision

Add a schema-validated Implementation Handoff IR with its own model identity and explicit
references to Architecture and Architecture Decision roots. It contains change slices whose
dependency references define ordering. Each slice declares selected elements, applicable
constraints, accepted decisions, proposed-decision blockers, acceptance checks, migration,
rollback, and `ready` or `blocked` state.

Declare the artifact path and schema ID in the bundle manifest. Migrate the manifest contract
from v0.2.0 to v0.3.0 as one hard cut; do not support two declaration graphs in parallel.

The S12 gate checks serialized reference, coverage, status, and acyclic-dependency predicates.
It does not judge whether slice boundaries, checks, migration plans, or rollback plans are
wise. S13 consumers may execute checks later, but this slice only validates their presence.

## Trade-offs accepted

- Preserves distinct S12 ownership and gives coding agents one canonical, diffable handoff.
- Makes proposed-decision blocker isolation deterministically observable at S12.
  − Adds a seventh artifact and a coordinated manifest migration.
  − Cross-file updates can temporarily make a bundle invalid until committed together.
  − Explicit dependency graphs require cycle validation and careful diagnostics.

Mitigation: the Model Repository owns schema/reference/stage validation; exact advancement
validates the complete proposed bundle before atomically changing only lifecycle metadata.
Schema examples and the simple-crud fixture provide migration evidence.

## Consequences

ADR-0003's reasoning-ownership principle remains authoritative, but its fixed count of six IRs
is superseded. ADR-0006 still owns non-semantic lifecycle and artifact-location metadata. S10
and S11 may retain proposed decisions; from S12 onward each affected slice must explicitly
block on them. Array order has no semantic meaning; dependencies provide the order.

Adding commands, execution status, source mappings, or generated code requires a demonstrated
S13 consumer and a later decision rather than expanding this handoff speculatively.
