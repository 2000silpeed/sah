# Run 32 ExecPlan — Benchmark Capture Freeze Contract

## Objective

Implement the third FP-008 slice: pin a completed trajectory capture and its
output inventory into a fresh, immutable evaluator-side record so scoring and
comparison slices receive frozen inputs. The slice records capture-time evidence
only; it invokes no model, claims no execution, scores nothing, and never opens
hidden expectations.

## Authority and constraints

- `AGENTS.md`, `docs/harness-architecture.md`, `docs/benchmark-strategy.md`, and
  ADRs 0029–0030 remain authoritative; ADR-0031 records this slice's decision.
- Freeze is an evaluator-side boundary: after freezing, appends fail
  operationally, so immutability holds by construction rather than convention.
- The freeze record copies preparation identity for self-containment but is not
  semantic architecture authority and stays outside the participant target.
- Empty captures are refused; a run that captured nothing cannot be blessed as a
  scored attempt.
- Fresh-only writes match preparation semantics; existing freeze records are
  never overwritten.

## Accepted design

Add `schemas/benchmark-freeze.schema.json` v0.1.0 and
`freezeBenchmarkCapture(runDirectory)`. Freezing resolves the same preparation-
bound context as capture, validates every stored line with the shared entry
validator, refuses empty captures, walks the reserved output directory (skipping
directories, rejecting symlinked or non-regular entries by run-relative path),
inventories every other regular file with byte size and SHA-256 digest excluding
trajectory.jsonl, stamps `frozenAt` plus full-file digest/byte/entry/sequence/
time totals, validates the record before writing, and commits one fsynced sibling
record via exclusive create with rollback on failure.
`sah benchmark-freeze <run-directory> [--json]` is the thin CLI adapter with
exit 0 for `frozen` and exit 2 otherwise.

## Implementation slices

1. Add the freeze schema, registry entry, public contracts, exports, append
   frozen-guard, shared line validation, inventory walk, and freeze library.
2. Add `sah benchmark-freeze` parsing guards, dispatch, human formatting, and
   exit mapping plus README rows.
3. Add regression tests for pinning, empty refusal, fresh-only, post-freeze
   append blocking, binding/corruption inheritance, output-tree safety, and CLI
   behavior; add ADR-0031, documentation, glossary, indexes, and this plan.
4. Run the full quality suite, link/line-budget audits, diff self-review, and
   commit the milestone. Do not push or create a PR.

## Acceptance checks

- A frozen record carries preparation identity, `frozenAt`, full trajectory
  digest/bytes/count/ranges, and a sorted per-file output inventory that excludes
  trajectory.jsonl itself.
- Post-freeze appends are refused (`BENCHMARK_TRAJECTORY_FROZEN`) without
  touching stored bytes; inspection remains allowed.
- Empty captures, second freezes, missing/tampered records, corrupt lines, and
  unsafe output entries are deterministic operational rejections leaving caller
  bytes untouched.
- CLI JSON envelopes mirror library results; exit codes stay 0/2 only.
- Existing schemas, lifecycle, verification behavior, benchmark expectations,
  and both paired README budgets remain unchanged.

## Handoff

With isolation (Run 30), capture (Run 31), and freeze (this run) in place, the
remaining FP-008 seams are the judge-record contract plus skill protocol
(executed by host agents per the Checker-review pattern, no runtime provider
integration), deterministic scope/continuity metrics over frozen captures, and —
behind an explicit authorization decision — the external execution adapter and
cost/latency provenance.

## Verification log

- Focused benchmark-trajectory/freeze/schema/CLI tests passed: 16 tests in the
  file, including 7 new freeze behaviors.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`,
  `npm test` (19 files, 309 tests), standalone `npm run verify:schemas`,
  `npm exec -- sah validate fixtures/simple-crud`, and `git diff --check`: all
  pass.
- Production smoke: prepare → one append → nested `output/artifacts/result.txt`
  → `benchmark-freeze --json` returned status `frozen` with copied identity,
  capture digest/totals, and the inventoried output file; a subsequent append
  exited 2 as required.
- Repository markdown link audit passes; governed documents remain within the
  400-line budget (README.md 399, README.ko.md 400).
