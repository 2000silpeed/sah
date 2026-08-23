# Run 35 ExecPlan — Treatment/Control Verdict Comparison

## Objective

Implement the terminal deterministic step of the FP-008 A/B protocol: compare
one treatment and one control verdict of the same benchmark under the published
five-point release tolerance, preserving raw points and flagging regressions.
Observational scope/continuity discipline metrics stay with judges and stewards;
this slice computes only what frozen verdicts determine.

## Authority and constraints

- `docs/benchmark-strategy.md` remains authoritative; its release-regression
  rule ("no benchmark loses more than 5 total points") governs the total only,
  and ADR-0034 records this slice's decision.
- Comparability is strict: identical `benchmarkId`, `problemDigest`, and
  `comparisonId`; exactly one treatment and one control verdict per comparison.
- Trajectory payloads remain opaque; no payload interpretation, model calls, or
  seeded-baseline lineage assumptions enter this slice.
- Comparison is read-only; nothing is written.

## Accepted design

Add `schemas/benchmark-comparison.schema.json` v0.1.0 and
`compareBenchmarkVerdicts(treatmentFile, controlFile)`. The command validates
both verdict records against the verdict schema, rejects shared modes and
cross-benchmark pairs with binding diagnostics, joins finals by category to
produce per-category deltas (with informational breach flags at category loss
beyond five), computes the total delta, flags regression beyond tolerance, and
derives `treatment-improved`, `within-tolerance`, or `treatment-regressed`.
`sah benchmark-compare <treatment> <control> [--json]` is the thin CLI adapter;
exit codes map compared→0, rejected inputs→1, unreadable→2.

## Implementation slices

1. Add the comparison schema, registry entry, public contracts, exports, and
   the comparison library.
2. Add CLI usage, dispatch, human formatting, exit mapping, README rows,
   verdict-document comparison section, indexes, and ADR-0034.
3. Add regression tests for delta computation, improved/regressed outcomes,
   mode and binding rejections, invalid/unreadable records, and CLI envelopes;
   record plans/run-35.
4. Full quality suite in sequential mode, link/line-budget audits, diff
   self-review, milestone commit without push.

## Acceptance checks

- Agreeing-boundary pairs produce a schema-valid comparison with preserved raw
  deltas, correct outcome classification, and distinct run identities echoed.
- A treatment losing more than five total points is flagged as regressed beyond
  tolerance; gains classify as improved without any gating side effects.
- Same-mode pairs, cross-benchmark pairs, schema-invalid verdicts, and
  unreadable files are deterministic rejections with mapped exit codes.
- Existing commands, schemas, lifecycle, benchmark expectations, and document
  budgets remain unchanged.

## Handoff

The FP-008 executable chain is complete through pair comparison:
prepare → capture → freeze → judge → agree → verdict → compare. What remains is
outside local reach without authorization or new scenarios: the external
execution adapter plus model/cost provenance for real runs, suite-level mean
orchestration across many comparisons, and FP-009 longitudinal seeds enabling
lineage-aware continuity metrics.

## Verification log

- Focused benchmark-comparison tests passed: 5 tests in the new file.
- Full suite sequential rerun: 22 files / 330 tests passing via
  `npx vitest run --no-file-parallelism`; default-parallel runs continued to
  show occasional spawn-timeout flakes on unrelated process-spawning tests that
  pass standalone, consistent with Run 34's recorded load contention.
- `npm run format:check`, `npm run lint`, `npm run typecheck`,
  standalone `npm run verify:schemas`, `npm exec -- sah validate
  fixtures/simple-crud`, and `git diff --check`: all pass.
- Production smoke: two hand-written verdicts compared through the built CLI
  printed per-category deltas, totals with sign, outcome, and exited 0;
  same-mode pairs exited 1.
- Markdown link audit passes; both paired READMEs stay within budget (400/399).
