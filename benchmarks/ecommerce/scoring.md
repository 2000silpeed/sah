# ecommerce — scoring

Apply `../../docs/benchmark-strategy.md`.

- **Deterministic, 10 + enforcement 5:** validate trace integrity; accepted quote, stock,
  payment, and refund constraints point to owners; search/reporting cannot write checkout facts.
- **LLM judge, Characterization 15:** 6 for local variation, 5 for consistency/scale scenarios,
  4 for preserved policy unknowns.
- **LLM judge, Strategy 20:** 4 points each for proportional catalog, pricing, checkout,
  provider, and read/reporting treatment. Uniform strategy scores at most 6.
- **LLM judge, Responsibilities/invariants 15:** price explanation/quote, stock hold, payment
  idempotency, order transitions, and refund/rounding each earn 3.
- **LLM judge, Boundaries 15:** authority and mixed-edge semantics matter more than number of
  deployables; deduct for shared mutable checkout/search facts.
- **LLM judge, Quality/trade-offs 15:** 3 for each MUST APPEAR group.
- **LLM judge, enforcement 5:** hard checks cover observable authority/dependency/contracts;
  offer-model adequacy remains judgment.

Over-engineering: −4 for each unjustified network service or broker, −2 for imposing rich
domain ceremony on simple catalog/reporting, maximum −20. Human steward accepts alternative
pricing representations when change ownership and explanation remain explicit.
