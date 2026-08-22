# Benchmark Run Preparation

This document owns the executable input-isolation contract for the FP-008 benchmark protocol.
`docs/benchmark-strategy.md` remains authoritative for scoring, judges, coverage, and dataset
evolution. This slice prepares a run; it does not execute a model or score its output.

## Command

From a built SAH checkout:

```text
npm exec -- sah benchmark-prepare <benchmark-directory> <run-directory> \
  --run-id <run-id> \
  --comparison-id <comparison-id> \
  --mode <treatment|control> \
  --json
```

The benchmark directory must contain a direct regular `problem.md`. The command creates a fresh
run directory and copies exactly that file. It writes the evaluator-side record beside the run
directory as `<run-directory-name>.benchmark-run.json`; the record is deliberately outside the
participant input root.

The record is validated by `schemas/benchmark-run.schema.json` and contains:

- explicit `runId`, `comparisonId`, `benchmarkId`, and `treatment|control` mode;
- the SHA-256 digest of the copied problem bytes and an allowlist containing only `problem.md`;
- the normal SAH operating-instruction policy, without a benchmark-specific prompt;
- the isolated target root; and
- reserved relative `output/` and `trajectory.jsonl` paths for a later capture runner.

## Isolation and failure semantics

The preparer reads only `problem.md`. It does not enumerate, parse, or copy expectations, scoring,
model prompts, or prior outputs. A target directory or sibling record that already exists is an
operational error and is never overwritten. The benchmark root and problem file must be directly
addressable local filesystem entries; the target parent is canonicalized with `realpath` so normal
local aliases such as macOS `/tmp` remain usable. Existing target symlinks are still rejected.

Successful preparation returns exit code `0`. Invalid paths, schema-registry failures, mode errors,
and filesystem failures return exit code `2`. A failed preparation cleans up only paths it created
for that attempt. No benchmark fixture or semantic design bundle is mutated.

## Scope boundary

This contract does not claim that a model ran. A later runner may consume the isolated target and
public SAH surfaces, then append raw trajectory, execution, cost, and scoring artifacts through a
separate versioned contract. Hidden expectations remain evaluator inputs after participant outputs
are frozen. Prompt/provider/model provenance, longitudinal handover, scope/continuity metrics, and
judge orchestration are not part of this preparation slice.
