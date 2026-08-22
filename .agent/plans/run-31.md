# Run 31 ExecPlan — Benchmark Trajectory Capture Contract

## Objective

Implement the second FP-008 slice: capture raw reasoning-trajectory entries for a prepared
benchmark run into the reserved `output/trajectory.jsonl` location, with a versioned entry
schema, preparation-bound append semantics, and honest read-only inspection. The slice records
no model output of its own, invokes no external model or provider, scores nothing, and freezes
no evaluation inputs.

## Authority and constraints

- `AGENTS.md`, `docs/harness-architecture.md`, `docs/benchmark-strategy.md`, and the completed
  input-isolation slice remain authoritative; ADR-0030 records this slice's decision.
- SAH owns envelope integrity only: sequence continuity, timestamps, kind vocabulary, and bytes.
  Payload content stays participant-owned and is never interpreted by the runtime.
- Capture binds to the sibling `benchmark-run` record and its resolved isolated target root;
  entries cannot enter unprepared or mismatched directories.
- Every rejection is pre-write and operational (exit 2); successful append and status exit 0.
  No lifecycle, exit-code, schema, or fixture behavior changes for existing commands.
- Raw trajectory content never includes hidden expectations; the record binding cannot leak
  evaluator inputs into the participant target.

## Accepted design

Add `schemas/benchmark-trajectory-entry.schema.json` v0.1.0 validating one JSONL line
(`$schema`, positive integer `seq`, date-time `recordedAt`, one neutral `kind` from
`agent-message|tool-invocation|tool-result|system-event`, non-empty opaque `payload` object).
`appendBenchmarkTrajectoryEntry` stamps the schema tag, validates before any filesystem
mutation, anchors continuity on the last stored line (first entry must be seq 1, then strictly
contiguous, recordedAt non-decreasing), refuses symlinked output paths, appends a single
fsynced line under a documented single-writer assumption, and reports full-file byte size,
SHA-256 digest, count, sequence range, and time range. `inspectBenchmarkTrajectory` is
read-only, returns an explicit empty view when nothing was captured yet, and reports corrupt
lines with their line numbers instead of a quietly partial view. `sah benchmark-trajectory
<run> (--entry-file <file> | --status)` is the thin CLI adapter.

## Implementation slices

1. Add the entry schema, registry entry, public contracts, exports, and capture library.
2. Add `sah benchmark-trajectory` parsing, guards, formatting, exit mapping, and README rows.
3. Add regression tests for continuity, corruption, binding, path safety, CLI behavior, and
   zero-mutation rejections; add ADR-0030, capture documentation, indexes, glossary, and the
   Run 31 plan.
4. Run the full quality suite, link/line-budget checks, diff self-review, and commit the
   milestone. Do not push or create a PR.

## Acceptance checks

- Appended entries land as one schema-valid JSONL line each at `<run>/output/trajectory.jsonl`
  with contiguous sequences and non-decreasing recordedAt values.
- First-sequence, gap, duplicate, regression, invalid-envelope, missing-record, tampered-record,
  target-mismatch, corrupt-anchor, and unsafe-path rejections are deterministic, code-tagged,
  and leave caller-owned bytes untouched.
- Status never creates paths; an absent trajectory yields an empty view, and any corrupt line
  fails operationally with its line number.
- CLI JSON envelopes mirror library results; exit codes stay 0/2 only.
- Existing schemas, bundle lifecycle, lineage/current projection, validation/verification
  behavior, and benchmark expectations remain unchanged.

## Handoff

FP-008 still lacks an authorized external execution adapter, execution metadata/provenance,
deterministic scope/continuity metrics, judge orchestration, cost/latency provenance, and
trajectory freeze/scoring. Those are subsequent slices; this run establishes the local raw
capture seam without pretending an execution occurred.

## Verification log

- Focused benchmark-trajectory/schema/CLI tests passed: 9 tests in the new file.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`,
  `npm run verify:schemas` (within the suite), `npm test` (19 files, 302 tests),
  `git diff --check`: all pass.
- Production smoke: `sah benchmark-prepare` on `benchmarks/simple-crud` into a disposable
  directory, two `benchmark-trajectory --entry-file` appends, and `--status --json` returned
  status `appended`/`ok` with entry counts, SHA-256 digest, and empty diagnostics.
- Markdown link audit across the repository passes after adding the Run 31 plan link; all
  governed documents remain within the 400-line budget, including both paired READMEs kept at
  exactly 400 lines while restoring the missing Korean `benchmark-prepare` CLI row.
