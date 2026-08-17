# logistics — scoring

Apply `../../docs/benchmark-strategy.md`.

- **Deterministic, 10 + enforcement 5:** traces resolve; transition/custody/handling constraints
  have owners; carrier source retention and freshness scenarios link to decisions.
- **LLM judge, Characterization 15:** full credit distinguishes lifecycle time, integration
  volatility, source truth, and two freshness classes.
- **LLM judge, Strategy 20:** 5 lifecycle, 4 routing policy, 5 carrier integration, 4 views and
  alerts, 2 simple administration. CRUD status treatment triggers fatal cap.
- **LLM judge, Responsibilities/invariants 15:** custody, valid transitions, handling
  suitability, dedup/order/correction, and alert/source history each earn 3.
- **LLM judge, Boundaries 15:** reward authority and provider translation; penalize provider
  vocabulary leakage or service-per-carrier reflex.
- **LLM judge, Quality/trade-offs 15:** 3 for each MUST APPEAR group.
- **LLM judge, enforcement 5:** observable transition/import/freshness rules are hard; reroute
  policy quality stays judgment.

Over-engineering: −3 per unjustified carrier/leg service or generic integration layer, maximum
−20. Human steward arbitrates alternative event-order models when correction and custody
semantics are explicit.
