# ai-agent — scoring

Apply `../../docs/benchmark-strategy.md`.

- **Deterministic, 10 + enforcement 5:** traces pass; tool allow/deny, refund idempotency,
  deletion, latency, cost, and required evaluation artifacts map to decisions; subjective
  response quality is not a hard rule.
- **LLM judge, Characterization 15:** full credit separates probabilistic conversation quality
  from deterministic action/privacy invariants and names provider/tool failure.
- **LLM judge, Strategy 20:** 6 bounded agent loop, 5 deterministic action control, 3 adapters,
  3 memory/privacy, 3 evaluation. Prompt-only output triggers fatal cap.
- **LLM judge, Responsibilities/invariants 15:** permissions, grounded account facts, idempotent
  actions, memory deletion, and escalation/evaluation/fallback each earn 3.
- **LLM judge, Boundaries 15:** model cannot own policy or credentials; tools, memory, and evals
  have clear authority and failure contracts.
- **LLM judge, Quality/trade-offs 15:** divide equally across the six MUST APPEAR groups.
- **LLM judge, enforcement 5:** evaluation adequacy remains judgment; configured permissions,
  budgets, and artifact presence are observable.

Over-engineering: −4 per extra agent/model role without an independently measured need and −3
for duplicated orchestration layers, maximum −20. Human steward adjudicates launch quality and
approval policy because the problem intentionally leaves them unresolved.
