# realtime — scoring

Apply `../../docs/benchmark-strategy.md`.

- **Deterministic, 10 + enforcement 5:** traces pass; durable/ephemeral paths are distinct;
  convergence, dedup, access, and latency constraints point to decisions and measurable facts.
- **LLM judge, Characterization 15:** full credit emphasizes concurrency, distribution, scale,
  and unknown intent policies rather than ordinary business-rule complexity.
- **LLM judge, Strategy 20:** 10 for justified concurrency/convergence model, 3 presence, 3
  authorization/locks, 4 history/restore. Named transport without semantics scores at most 6.
- **LLM judge, Responsibilities/invariants 15:** 3 each for operation identity/order, conflict
  semantics, reconnect authorization, convergence, and durable/history recovery.
- **LLM judge, Boundaries 15:** durable content, presence, access, and history collaborate with
  explicit timing/failure; deployment count is irrelevant.
- **LLM judge, Quality/trade-offs 15:** 3 for each MUST APPEAR group.
- **LLM judge, enforcement 5:** measurable latency/convergence/access checks are hard; intent
  preservation and conflict-policy fit remain judgment.

Over-engineering: −4 for each remote boundary not tied to isolation/scale/failure and −5 for a
global coordination mechanism that ignores local feedback, maximum −20. Human steward accepts
any concurrency family whose per-operation semantics are explicit.
