# payment — scoring

Apply `../../docs/benchmark-strategy.md`.

- **Deterministic, 10 + enforcement 5:** valid traces; all five named value invariants have one
  enforceable authority; sensitive logging/access and accounting immutability constraints are
  observable or explicitly unsupported.
- **LLM judge, Characterization 15:** must separate local atomic truth from network uncertainty,
  retry concurrency, reconciliation dataflow, and assurance.
- **LLM judge, Strategy 20:** 6 value authority, 4 lifecycle, 4 adapter/failure, 4 accounting
  and reconciliation, 2 operations. Missing value model triggers fatal cap.
- **LLM judge, Responsibilities/invariants 15:** 3 each for idempotency, capture/refund limits,
  balanced immutable entries, provider outcome recovery, and security/reconciliation.
- **LLM judge, Boundaries 15:** reward one clear value authority and explicit remote seam;
  penalize cross-service invariants without protocol.
- **LLM judge, Quality/trade-offs 15:** 3 for each MUST APPEAR group.
- **LLM judge, enforcement 5:** hard checks cover arithmetic, transitions, access, and traces;
  timeout/customer policy remains judgment until resolved.

Over-engineering: −5 for distributed transaction or service splits that weaken local value
authority without evidence; −2 per generic layer, maximum −20. Human steward approves novel
accounting representations only when every invariant and reversal remains explicit.
