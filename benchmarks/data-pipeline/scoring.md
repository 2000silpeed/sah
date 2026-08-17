# data-pipeline — scoring

Apply the 100-point common rubric in `../../docs/benchmark-strategy.md`.

Domain anchors by scorer:

- **Deterministic, 10 + enforcement 5:** IR/references pass; processing relations and dataset
  ownership exist; constraints trace privacy deletion, lineage, and publication gates to
  decisions without hard-coding unresolved correction policy.
- **LLM judge, Characterization 15:** full credit only when dataflow, integration, scale,
  assurance, and late-data temporality are distinct forces.
- **LLM judge, Strategy 20:** 14 for explicit functional dataflow, 3 for sender adapters, 3 for
  different simple stewardship treatment. Fatal cap if flow/lineage/replay are absent.
- **LLM judge, Responsibilities/invariants 15:** 3 each for acquisition isolation, transform
  contracts, lineage/replay, late/correction identity, and privacy/publication obligations.
- **LLM judge, Boundaries 15:** boundaries follow contracts, failure isolation, and ownership;
  deduct 3 per unjustified service-per-step, to zero.
- **LLM judge, Quality/trade-offs 15:** 3 points for each MUST APPEAR group.
- **LLM judge, enforcement 5:** distinguishes structural lineage/privacy checks from judgment
  about correction and closure policies.

Over-engineering penalty: −3 per service or duplicated batch/stream logic with no quality
argument, maximum −20. Human stewardship adjudicates novel unified data models only when they
preserve sender semantics, replay, and privacy evidence.
