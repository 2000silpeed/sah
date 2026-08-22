# Run 30 ExecPlan — Isolated Benchmark Preparation Contract

## Objective

Implement the first executable FP-008 slice: prepare an A/B benchmark run from one explicit
benchmark directory without exposing hidden expectations or scoring to the participant target.
The slice records treatment/control identity, the problem digest, the isolated target, and the
reserved output/trajectory paths. It does not invoke an external model, score a run, or persist
raw trajectory content.

## Authority and constraints

- `AGENTS.md`, `docs/harness-architecture.md`, `docs/benchmark-strategy.md`, and the FP-008
  proposal remain authoritative.
- Benchmark evaluation is an adapter over public SAH surfaces; semantic IR and model-repository
  authority must not depend on benchmark metadata.
- The isolated participant target contains only `problem.md`. Expectations and scoring are never
  read by the preparer and never copied into the target.
- The run record is evaluator-side metadata, not semantic architecture authority. It carries no
  raw prompt, provider, model, or score.
- Preparation is additive and refuses existing target/record paths; it does not overwrite files or
  alter benchmark fixtures.

## Accepted design

Add a versioned `benchmark-run` record and a small `prepareBenchmarkRun` library function. The
function reads only the direct regular `problem.md`, hashes its bytes, creates a fresh target root,
copies that one file, and writes a sibling record with explicit `treatment|control` and comparison
IDs. The record reserves `output/` and `trajectory.jsonl` as relative capture locations for a later
runner. `sah benchmark-prepare` is the thin CLI adapter; it has no model/provider integration.

This keeps the lower-ceremony in-process filesystem boundary: a benchmark runner can later invoke
the public skill/CLI/library using the prepared target, while hidden expectations remain evaluator
inputs for scorers and judges only.

## Implementation slices

1. Add the `benchmark-run` schema, public contracts, registry entry, and isolation library.
2. Add `sah benchmark-prepare`, CLI formatting/exit behavior, and benchmark strategy documentation.
3. Add the next ADR, schema/CLI/path-safety/failure-mode regression tests, and update the active
   ExecPlan and repository indexes.
4. Run the full quality suite, documentation/link/line-budget checks, diff self-review, and commit
   the milestone. Do not push or create a PR.

## Acceptance checks

- A prepared target has exactly one participant input file: `problem.md`.
- `expectations.md`, `scoring.md`, hidden markers, and raw prompts do not appear in the target or
  benchmark-run record.
- Treatment/control records validate against Draft 2020-12 and preserve the problem digest,
  comparison identity, and reserved trajectory/output paths.
- Existing target directories, record files, symlinked roots, and symlinked `problem.md` fail
  operationally without overwriting or partially mutating caller-owned paths. A symlinked target
  parent is canonicalized before writing so normal local aliases remain usable.
- CLI JSON and human output are deterministic apart from the generated preparation timestamp, and
  exit code 0 is reserved for a successfully prepared run.
- Existing schemas, bundle lifecycle, lineage/current projection, validation/verification behavior,
  and benchmark expectations remain unchanged.

## Handoff

FP-008 still needs an authorized external execution adapter, raw trajectory capture, deterministic
scope/continuity metrics, judge orchestration, and cost/latency provenance. Those are subsequent
slices; this run establishes the input-isolation seam without pretending a model run occurred.

## Verification log

- Focused benchmark/schema/CLI tests passed: 57 tests.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`,
  `npm run verify:schemas`, `npm test`, and `git diff --check` passed; the full suite is 18 files
  and 293 tests.
- The prepared target contains only `problem.md`; the sibling record validates against the new
  schema and does not contain hidden expectation/scoring markers.
- Existing target/record paths, symlinked benchmark roots/problem files, canonicalized parent
  aliases, invalid modes, and CLI output/exit behavior are covered by deterministic regression tests.
