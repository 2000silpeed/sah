# simple-crud — scoring

Apply the 100-point common rubric in `../../docs/benchmark-strategy.md`.

Domain anchors by scorer:

- **Deterministic, 10 + enforcement 5:** all IR/references pass; accepted representation traces
  to local responsibilities; uniqueness/authorization/audit constraints are classified and
  no hard rule asserts an unresolved restore or edit-conflict policy.
- **LLM judge, Characterization 15:** full credit for low structural forces plus medium
  assurance and explicit unknown concurrency; deduct 5 for rating every dimension low.
- **LLM judge, Strategy 20:** full credit for direct modular operations. Score at most 6 and
  apply the fatal cap for unjustified rich-domain infrastructure, broker, or services.
- **LLM judge, Responsibilities/invariants 15:** 3 points each for write ownership, uniqueness,
  authorization/audit, archive/query behavior, and honest unresolved policy.
- **LLM judge, Boundaries 15:** full credit for one cohesive deployable boundary with useful
  internal separation; deduct 3 per unjustified remote or generic layer, to zero.
- **LLM judge, Quality/trade-offs 15:** 5 points for each MUST APPEAR group.
- **LLM judge, enforcement 5:** checks are proportional and heuristics remain non-blocking.

Over-engineering penalty: −5 per unjustified network boundary or broker; −2 per gratuitous
repository/interface/layer family, maximum −20. A human steward adjudicates whether a richer
model is supported by a newly surfaced but text-grounded interpretation.
