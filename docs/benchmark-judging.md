# Benchmark Judging

This document owns the executable judge-record and aggregation contracts for the
FP-008 benchmark protocol. [Benchmark strategy](benchmark-strategy.md) remains
authoritative for scoring anchors, judge roles, and penalties;
[Benchmark trajectory capture](benchmark-trajectory.md) owns the frozen captures
that judges consume.

## Who executes judgment

SAH never invokes a model or provider. Following the independent-Checker pattern,
a **benchmark judge** is an agent session — typically a fresh host-agent session
or evaluator-owned subagent — that reads exactly four inputs, scores them against
the common rubric, and records the result in a schema-valid review file. The
runtime validates records and aggregates two of them deterministically; it does
not perform or supervise the judgment itself.

Independence is a protocol obligation, not an implementation detail: two judges
spawned from one shared context can contaminate each other, so judges must run in
isolated contexts that receive only problem, output artifacts, expectations, and
rubric — never each other's reasoning, the participant's skill transcript beyond
the captured trajectory, or evaluator bookkeeping.

## Judge record

One judge produces one file validated by
[the judge-review schema](../schemas/benchmark-judge-review.schema.json):

- identity (`judgeId`), preparation identity copied from the frozen capture
  (`runId`, `comparisonId`, `benchmarkId`, `mode`);
- binding digests — `trajectoryDigest` matching the freeze record and
  `problemDigest` of the problem bytes actually reviewed;
- the declared `rubricVersion` and `reviewedAt`;
- exactly six `scores`, one per LLM-judged category, each with points and a
  non-empty explanation; per-category maxima are enforced by the aggregator;
- over-engineering deduction with its justification; and any observed FATAL
  indicators.

Raw explanations and penalty justifications are kept verbatim; nothing here
scores deterministic categories — artifact-integrity and enforcement facts come
from running SAH validation on the output bundle, assembled by a later slice.

## Aggregation gate

```text
sah benchmark-judge <judge-record-a> <judge-record-b> [--json]
```

The command validates both records, requires distinct judge identities and
identical bindings, and emits [the score projection](../schemas/benchmark-score.schema.json):

- per category, both raw points are preserved verbatim; when they differ by at
  most three points the mean stands, otherwise the category is disputed;
- `disputedCategories` lists what needs benchmark-steward adjudication, and
  `judgeSubtotal` stays null until every dispute resolves;
- any reported FATAL indicator sets `fatalIndicatorFlagged` — the eventual
  total-cap rule applies later, without hiding raw points;
- over-engineering deductions are echoed raw with no agreement gate in this
  version.

Exit codes: `scored` exits 0; `adjudication-required` and rejected records exit
1; unreadable files exit 2. Aggregation is a derived view — it writes nothing.

## Scope boundary

This contract binds judges to frozen evidence and makes their disagreement
measurable; it does not open hidden expectations to participants, execute
judges, compute deterministic category scores, apply caps into a total, or
decide pass/regression thresholds. Those remain subsequent slices.
