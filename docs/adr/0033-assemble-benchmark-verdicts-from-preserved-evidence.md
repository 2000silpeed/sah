# ADR-0033: Assemble Benchmark Verdicts From Preserved Evidence

- Status: accepted
- Date: 2026-08-22
- Owners: SAH evaluation and delivery authority

## Context

Runs 30–33 produced isolation, capture, freeze, and judged-agreement seams, but
no command turns those artifacts into the published one-hundred-point outcome
with its deterministic categories, over-engineering penalty, FATAL cap, and pass
thresholds. Scoring fifteen points deterministically is exactly what a
validation kernel can own; assembling totals from preserved evidence keeps
judgment execution outside the runtime.

## Decision

Add `sah benchmark-verdict <score> --bundle <dir> [--adjudication] [--record]`
with `benchmark-adjudication` and `benchmark-verdict` v0.1 contracts. The
assembler validates the score projection, requires steward adjudication covering
exactly the disputed categories before proceeding (and rejects adjudications
when nothing is disputed), computes artifact integrity as a binary full-pass of
`validateBundle` plus the enforcement half as at least one declared constraint
with decision references and observable predicates on deterministic rules,
subtracts the mean over-engineering deduction, applies the 49 cap for any FATAL
indicator alongside outright failure, evaluates the published thresholds, and
writes fresh-only records. The runtime recomputes everything from raw inputs; it
never trusts self-computed judge totals.

## Alternatives considered

1. Compute deterministic points inside the aggregation command so one call ends
   in a verdict. Rejected because bundles are often scored after judging and the
   agreement projection should stay reusable without a bundle present.
2. Award partial deterministic credit proportional to diagnostic counts.
   Rejected as invented rubric arithmetic; the strategy text defines full-credit
   evidence, so this slice stays all-or-nothing per category and leaves refinement
   to benchmark-steward rubric evolution.
3. Let stewards edit judge records to resolve disputes. Rejected because mutating
   frozen judgments destroys the audit trail; adjudication is a separate signed-
   style record layered beside them.
4. Auto-record every verdict next to the score file. Rejected because verdict
   persistence is caller policy, matching verify's opt-in --record pattern.

## Costs and consequences

- Binary deterministic categories are coarse; near-miss bundles get zero even
  when one reference is broken, by design until stewards refine anchors.
- Enforcement-half logic reads architecture.json directly after validation;
  schema or reference changes could require touching this reader even though
  validation itself already guarantees shape on passing bundles.
- Verdict records duplicate identity fields from the score projection for
  self-containment, the same trade-off ADR-0031 accepted for freeze records.
- Disputed runs block assembly on humans by construction; nothing silently
  averages through a disagreement.

Revisit this decision if stewards demand graded partial credit, if enforcement
evidence should include S13 verification results rather than declared
constraints alone, if cross-run regression gates need verdict-to-verdict
comparison, or if relocation requires portable identifiers instead of local
paths.
