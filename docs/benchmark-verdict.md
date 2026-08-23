# Benchmark Verdict

This document owns the executable verdict assembly contract for the FP-008
benchmark protocol. [Benchmark strategy](benchmark-strategy.md) remains
authoritative for scoring anchors and thresholds; [Benchmark judging](benchmark-judging.md)
owns judge records and the agreement projection this command consumes.

## Command

From a built SAH checkout:

```text
sah benchmark-verdict <judge-score.json> --bundle <participant-bundle-directory>
  [--adjudication <adjudication-file>] [--record <verdict-file>] [--json]
```

The score file is the schema-valid two-judge projection emitted by
`sah benchmark-judge` (persist it yourself; aggregation writes nothing). The
bundle is the participant's design-bundle directory inside its isolated target.

## Deterministic categories

Fifteen of the one-hundred points are computed, never judged:

- **Artifact integrity (0/10)**: full credit only when `sah validateBundle`
  passes against the bundle at its declared stage. Any violations or
  unscoreable output receives zero while remaining visible in the verdict.
- **Continuous enforcement, deterministic half (0/5)**: full credit only when
  validation passed and the Architecture IR declares at least one constraint,
  each carrying a decision reference, with an observable predicate on every
  deterministic constraint. A bundle that skips continuous enforcement
  entirely earns nothing here.

## Steward adjudication

When the projection marks disputed categories, assembly refuses to run until
`--adjudication` supplies a steward record covering exactly those categories —
no more, no fewer. Adjudicated values replace the missing means, are labeled
`adjudication` in the finals, and carry the steward identity. Supplying an
adjudication when nothing was disputed is a violation, as is any binding
mismatch with the score's frozen run.

## Assembly rules

Finals use agreed means or adjudicated points. The total subtracts the mean of
the two raw over-engineering deductions and adds the fifteen deterministic
points. A flagged FATAL indicator caps the total at 49 **and** fails the run
outright. The published pass rule applies unchanged: total at least 70 after
penalties, no fatal indicator, strategy at least 12/20, responsibilities at
least 9/15.

Exit codes: `passed` exits 0; `failed`, rejected inputs, and required-but-missing
adjudication exit 1 or 2 per their operational family. `--record` writes the
verdict fresh-only with exclusive create; an existing record is never
overwritten.

## Comparing treatment and control

```text
sah benchmark-compare <treatment-verdict> <control-verdict> [--json]
```

The command validates both fresh verdict records, requires one treatment and
one control verdict bound to the same `benchmarkId`, `problemDigest`, and
`comparisonId`, then emits [the comparison projection](../schemas/benchmark-comparison.schema.json):
per-category deltas with raw points preserved, the total delta, and an outcome
of `treatment-improved`, `within-tolerance`, or `treatment-regressed`. The
published release-regression tolerance governs the total only: a treatment that
loses more than five points against its control is flagged as a regression;
per-category breach flags are informational. Comparison is read-only and exits 0
when compared, 1 for rejected inputs, 2 for unreadable files.

Observational discipline metrics from the protocol design — unrequested surface,
trigger recall, supersession correctness — remain judgment observations recorded
in judge explanations and steward reviews; this projection computes only what
the frozen verdicts determine.

Exit codes recap for this document's commands: `benchmark-verdict` exits 0 on a
passed assembly, 1 on a failed verdict or rejected inputs, 2 on unreadable
inputs; `benchmark-compare` follows the same families.

## Scope boundary

Assembly consumes preserved evidence; it does not execute judges, re-open
frozen captures, mutate records, or decide release regressions across runs.
Longitudinal comparison and scope/continuity metrics remain subsequent slices.
