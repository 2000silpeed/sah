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

## Scope boundary

Assembly consumes preserved evidence; it does not execute judges, re-open
frozen captures, mutate records, or decide release regressions across runs.
Longitudinal comparison and scope/continuity metrics remain subsequent slices.
