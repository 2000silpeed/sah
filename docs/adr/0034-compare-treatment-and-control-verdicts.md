# ADR-0034: Compare Treatment and Control Verdicts Deterministically

- Status: accepted
- Date: 2026-08-22
- Owners: SAH evaluation and delivery authority

## Context

The A/B protocol's purpose is a same-model treatment/control delta, and its
release rule is explicit: no benchmark may lose more than five total points.
Runs 30–33 produced frozen captures, judged agreements, and verdicts per run,
but nothing compared the pair, so the protocol had no terminal deterministic
step. Meanwhile several design-doc discipline metrics (unrequested surface,
trigger recall, supersession correctness) are observational and cannot be
computed from opaque trajectory payloads or fresh-run bundles without seeded
evolution scenarios.

## Decision

Add `sah benchmark-compare <treatment> <control>` with the `benchmark-comparison`
v0.1 projection. The command validates both verdict records against their
schema, requires exactly one treatment and one control bound to the same
benchmark, problem digest, and comparison identity, preserves every raw final
point, computes per-category deltas plus the total delta, applies the published
five-point tolerance to the total for the regression flag (per-category breach
flags are informational), and derives an improved / within-tolerance / regressed
outcome. Comparison is read-only. Observational continuity metrics stay with
judges and stewards; this command computes only what frozen verdicts determine.

## Alternatives considered

1. Compute scope-discipline and architecture-continuity metrics in the same
   slice by interpreting trajectory payloads. Rejected because payloads are
   participant-owned and opaque by ADR-0030; inventing payload semantics now
   would break the capture neutrality the seam was built on.
2. Seed baseline bundles so lineage-based continuity (active prior decisions,
   supersession correctness) can reuse the evolution resolver. Deferred to the
   longitudinal FP-009 track; fresh A/B runs have no prior bundle to resolve.
3. Let the caller diff two JSON files without a contract. Rejected because the
   five-point rule, binding equality, and mode pairing are exactly the kind of
   deterministic predicates SAH exists to own.
4. Apply the tolerance per category for gating. Rejected: the strategy text
   scopes release regression to total points; per-category breaches are emitted
   as information only.

## Costs and consequences

- Comparability is strict: differing problem digests or benchmark identities
  refuse comparison even when totals look tempting to diff.
- The projection says nothing about why a delta occurred; explanation remains
  judge/steward work over the frozen evidence.
- Suite-level rules ("suite mean does not fall") still need an orchestrating
  layer above single-pair comparisons.
- Per-category breach flags duplicate the tolerance figure at category grain;
  they inform stewards but gate nothing.

Revisit this decision when FP-009 seeds baseline bundles (lineage-aware
continuity metrics become computable), when suite orchestration lands, or if the
steward wants graded per-category tolerances instead of informational flags.
