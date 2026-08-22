# Run 34 ExecPlan — Benchmark Verdict Assembly

## Objective

Implement the fifth FP-008 slice: assemble the published one-hundred-point
benchmark outcome from preserved evidence — the two-judge score projection,
optional steward adjudication of disputed categories, and deterministic category
scoring over the participant bundle — applying penalties, the FATAL cap, and the
pass thresholds. The runtime executes no judgment and invokes no model.

## Authority and constraints

- `docs/benchmark-strategy.md` remains authoritative for scoring anchors,
  penalties, and pass thresholds; ADR-0033 records this slice's decision.
- Deterministic categories are all-or-nothing per the strategy's full-credit
  evidence: artifact integrity requires a full `validateBundle` pass (10/0);
  the enforcement half requires validation plus at least one declared constraint
  with decision references and observable predicates on deterministic rules
  (5/0). Unscoreable output scores zero while staying visible.
- Adjudication is mandatory before assembly whenever disputes exist, must cover
  exactly the disputed categories, and is rejected when nothing is disputed;
  judge records are never mutated.
- The runtime recomputes totals from raw inputs; self-computed judge totals are
  never trusted.
- Verdict records are fresh-only via exclusive create, mirroring freeze
  semantics.

## Accepted design

Add `schemas/benchmark-adjudication.schema.json` v0.1.0 (steward identity,
score-binding identity fields, one entry per disputed category with points and
rationale) and `schemas/benchmark-verdict.schema.json` v0.1.0 (finals with
sources, deterministic points, deduction mean, fatal flag, totals before/after
cap, threshold flags, passed|failed status).
`assembleBenchmarkVerdict(scoreFile, {bundleDirectory, adjudicationFile?,
recordFile?})` validates the projection, gates on unresolved disputes, binds
adjudication to the same frozen run, computes deterministic categories via
`validateBundle` plus an architecture-constraint read, assembles finals and
totals, validates the derived verdict against its schema, and optionally records
it atomically. `sah benchmark-verdict <score> --bundle <dir> [--adjudication
<file>] [--record <file>] [--json]` is the thin CLI adapter; exit codes map
passed→0, failed/rejected→1, unreadable inputs→2.

## Implementation slices

1. Add both schemas, registry entries, public contracts, exports, shared
   category maxima export, and the assembly library.
2. Add `--bundle`/`--adjudication` CLI parsing guards, dispatch, formatting,
   README rows, verdict documentation, indexes, glossary entry, and ADR-0033.
3. Add regression tests for passing assembly, fatal cap, adjudication gating and
   resolution, mismatched or over-covering adjudications, threshold failure,
   zero-scoring invalid bundles, and atomic CLI recording; record plans/run-34.
4. Full quality suite, link/line-budget audits, diff self-review, milestone
   commit without push.

## Acceptance checks

- A valid participant bundle plus agreeing judges yields a schema-valid passing
  verdict with computed means, integrity 10/10, enforcement 5/5 with declared
  constraint count, and correct penalty arithmetic.
- A flagged FATAL indicator caps the total at 49 and fails regardless of other
  thresholds; raw points stay visible.
- Disputed projections refuse assembly until steward adjudication covers exactly
  the disputed set; extra entries, wrong bindings, and out-of-range points are
  violations.
- Bundles that fail validation score zero on both deterministic categories with
  reasons visible; threshold misses fail without hiding arithmetic.
- `--record` persists fresh-only; existing records are never overwritten. Exit
  codes map exactly; existing commands, schemas, lifecycle, benchmark
  expectations, and document budgets remain unchanged.

## Handoff

The FP-008 evaluation chain is now executable end-to-end except for real runs:
prepare → capture → freeze → judge records → agreement → verdict. Remaining
seams are scope/continuity metrics across frozen treatment/control pairs and —
behind an explicit authorization decision — the external execution adapter plus
model/cost provenance required to produce actual participant artifacts.

## Verification log

- Focused benchmark-verdict tests passed: 7 tests in the new file.
- `npm test` under default parallelism intermittently timed out at 5s on a
  different process-spawning test each run (iteration-loop, then cli loop-checks)
  while every affected test passed both standalone and in the full sequential
  rerun; the complete suite passes 21 files / 325 tests via
  `npx vitest run --no-file-parallelism`. Recorded as load contention among
  spawn-heavy tests, not a product regression.
- `npm run format:check`, `npm run lint`, `npm run typecheck`,
  standalone `npm run verify:schemas`, `npm exec -- sah validate
  fixtures/simple-crud`, and `git diff --check`: all pass.
- Production smoke: hand-written judge pair → aggregated score →
  `sah benchmark-verdict score.json --bundle <simple-crud copy> --record`
  returned status passed with total 79 (66 judged + 15 deterministic − 2
  deduction), integrity 10/10, enforcement 5/5, exit 0; rerun with --record on
  the existing record exited 2 fresh-only.
- Markdown link audit passes; governed documents stay within budget (README.md
  399, README.ko.md 398 lines after meaning-preserving rewraps).
