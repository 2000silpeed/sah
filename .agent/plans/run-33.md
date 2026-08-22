# Run 33 ExecPlan — Benchmark Judge Records and Agreement Gate

## Objective

Implement the fourth FP-008 slice following the independent-Checker pattern:
evaluator-side agent sessions execute judgments as schema-valid records, and SAH
validates two records, enforces identity/binding integrity, and projects the
deterministic three-point agreement view. The runtime never invokes a model.

## Authority and constraints

- `docs/benchmark-strategy.md` remains authoritative for scoring anchors,
  penalties, judge roles, and pass thresholds; ADR-0032 records this decision.
- Judges are host-agent sessions bound to frozen captures via trajectory and
  problem digests; independence obligations are documented for evaluator
  operators, not enforced in code.
- The judging protocol stays out of `skills/sah` so evaluation policy never
  enters the participant-visible skill surface established by input isolation.
- This slice covers LLM-judged categories only; deterministic category scoring,
  caps into totals, and pass/regression thresholds remain subsequent slices.
- Aggregation is a read-only projection; no file is written.

## Accepted design

Add `schemas/benchmark-judge-review.schema.json` v0.1.0 (judge identity, copied
preparation identity, binding digests, rubric version, exactly six category
scores with explanations, over-engineering deduction plus justification, FATAL
indicators) and `schemas/benchmark-score.schema.json` v0.1.0 (raw points kept
verbatim per category, means within tolerance, disputed list, subtotal nulling,
fatal flagging). `aggregateBenchmarkJudgeReviews(a, b)` validates both records
against the registry, rejects shared judge identities, binding mismatches,
duplicate or missing categories, and points above per-category maxima, orders
records by judge id, applies the three-point rule per category, validates the
derived score against its schema, and reports `scored`, `adjudication-required`
(exit 1), `violations`, or `operational-error`. `sah benchmark-judge <a> <b>
[--json]` is the thin CLI adapter.

## Implementation slices

1. Add both schemas, registry entries, public contracts, exports, and the
   aggregation library.
2. Add `sah benchmark-judge` parsing guards, dispatch, human formatting, exit
   mapping, README rows, strategy/index links, glossary entry, and ADR-0032.
3. Add regression tests covering agreement means, dispute routing, binding/
   duplicate/coverage/maxima rejections, fatal flagging, unreadable/invalid
   records, and CLI envelopes with exit codes; record plans/run-33.
4. Full quality suite, link/line-budget audits, diff self-review, milestone
   commit without push.

## Acceptance checks

- Two agreeing records produce a schema-valid score with preserved raw points,
  computed means, distinct sorted judges, and a numeric judge subtotal.
- Any category differing by more than three points routes to steward
  adjudication, lists itself in disputedCategories, and nulls the subtotal while
  keeping raw points visible.
- Shared judge ids, binding mismatches, missing/duplicate categories, and
  above-maximum points are rejected with deterministic codes before aggregation.
- Fatal indicators flag the projection without hiding raw points; deductions are
  echoed raw with no invented agreement gate.
- CLI exits map 0/1/2 exactly as documented; existing commands, schemas,
  lifecycle, and benchmark expectations remain unchanged.

## Handoff

With isolation, capture, freeze, and judged-agreement seams in place, remaining
FP-008 work is the deterministic category scorer over participant bundles, total
assembly with caps and pass thresholds, scope/continuity metrics across frozen
treatment/control pairs, and — behind an explicit authorization decision — the
external execution adapter plus cost/latency provenance.

## Verification log

- Focused benchmark-judging tests passed: 9 tests in the new file.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`
  (20 files, 318 tests), standalone `npm run verify:schemas`,
  `npm exec -- sah validate fixtures/simple-crud`, and `git diff --check`: all
  pass.
- Production smoke: two hand-written agreeing judge records aggregated through
  the built CLI printed per-category means (e.g. boundaries 12/12 -> 12,
  characterization 12/13 -> 12.5) and exited 0.
- Markdown link audit passes; governed documents stay within the 400-line budget
  (both READMEs exactly 400 lines).
