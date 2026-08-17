# ADR-0003: Separate IR by reasoning ownership

Status: Accepted · Date: 2026-08-17 · Supersedes: —

## Context

One mega-schema would let early stages write representation and decisions prematurely. One
file per stage would instead duplicate concepts across fourteen transitions and create
ceremony without distinct consumers.

## Options considered

1. One architecture mega-model
2. One artifact per S0–S13 stage
3. Six IR families by semantic owner and consumer lifecycle ← chosen
4. Adopt a C4 or ADR tool's native model

## Decision

Use Characterization, Strategy, Responsibility, Invariant, Architecture, and Architecture
Decision IRs linked by stable IDs.

## Trade-offs accepted

+ Preserves responsibility-before-representation and keeps rejected choices outside selected
  structure.
− Cross-file references need validation and atomic bundle updates.
− Agents must manage partial state and reserved owner identifiers across stages.

Mitigation: one Model Repository owns reference integrity, staleness propagation, and atomic
updates; semantic gates distinguish partial from selected bundles.

## Consequences

The bootstrap layout adds `docs/harness-architecture.md` to separate SAH's component design
from `docs/architecture-model.md`, which owns target-system IR semantics. No common base or
Methodology IR is added until a real consumer requires it.
