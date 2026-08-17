# ADR-0004: Classify enforcement by observability

Status: Accepted · Date: 2026-08-17 · Supersedes: —

## Context

Some architecture propositions are completely observable in source graphs or contracts;
others combine observable signals with context, and some are trade-off judgments. Treating
all three as hard rules creates dogma, while treating all as LLM review loses repeatability.

## Options considered

1. Deterministic validators only
2. LLM review only
3. Hard rules plus unclassified warnings
4. Deterministic, assisted, and judgment classifications ← chosen

## Decision

Every enforcement capability and project constraint declares one of three epistemic classes,
with deterministic rules requiring a complete observable contract.

## Trade-offs accepted

+ Hard failures remain reproducible while contextual questions retain evidence and review.
− Users must understand three result types and cannot expect one green architecture check.
− Assisted and judgment checks add model cost, latency, calibration, and human arbitration.

Mitigation: separate statuses, confidence, source facts, and authority; benchmark category
inflation and prefer `unsupported` over an invented pass.

## Consequences

Constraint compilers cannot promote heuristics to errors. Missing fact adapters are coverage
failures. Reclassification requires an ADR or model-change discovery with new observability
evidence.
