# enterprise-integration — scoring

Apply `../../docs/benchmark-strategy.md`.

- **Deterministic, 10 + enforcement 5:** IR/references pass; source, contract, mapping, lineage,
  replay, privacy deadline, and authority constraints trace to decisions; unresolved ownership
  is not silently hardened.
- **LLM judge, Characterization 15:** full credit separates semantic volatility, data movement,
  distributed failure, assurance, and phased organizational change.
- **LLM judge, Strategy 20:** 5 adapters, 4 dataflow/delivery, 4 semantic authority, 4 privacy
  coordination, 3 simple admin. Universal model or source-per-service scores at most 6.
- **LLM judge, Responsibilities/invariants 15:** source fidelity, idempotency/replay, authority,
  invoice preservation, and privacy completion each earn 3.
- **LLM judge, Boundaries 15:** reward capability ownership and translation seams; penalize
  shared DTO leakage and unbounded pairwise mappings.
- **LLM judge, Quality/trade-offs 15:** divide across the six MUST APPEAR groups.
- **LLM judge, enforcement 5:** structural delivery/lineage/deadline checks are hard; semantic
  mapping quality and ownership choices remain judgment.

Over-engineering: −3 per unjustified source-specific service or generic enterprise layer and
−5 for a canonical model that suppresses distinctions, maximum −20. Human steward adjudicates
temporary pairwise slices only with owner, expiry, and migration evidence.
