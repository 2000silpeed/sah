# ADR-0029: Isolate Benchmark Inputs Before Execution

- Status: accepted
- Date: 2026-08-22
- Owners: SAH evaluation and delivery authority

## Context

The benchmark protocol requires the agent to receive a repository containing the benchmark problem
and normal SAH operating instructions, while expectations and scoring remain hidden until outputs
and trajectory are frozen. The repository currently stores `problem.md`, `expectations.md`, and
`scoring.md` together but has no executable boundary that prevents accidental leakage.

## Decision

Add a small public `prepareBenchmarkRun` library boundary and the thin `sah benchmark-prepare`
adapter. Given one explicit benchmark directory and a fresh run directory, it reads only the direct
regular `problem.md`, copies it into the fresh target, hashes the copied bytes, and writes a
schema-validated evaluator-side `benchmark-run` record beside the target. The record pairs an
explicit treatment or control mode with a comparison ID and reserves relative output and trajectory
paths. It contains no raw prompt, model/provider identity, expectation, scoring, or semantic IR.

The preparer does not invoke a model, inspect hidden expectations, score outputs, discover Git
state, or overwrite existing paths. A later execution/provenance adapter may consume this seam but
must preserve the same isolation and freeze outputs before evaluation. The target parent is
canonicalized before writing so local filesystem aliases do not become an accidental second output
root.

## Alternatives considered

1. Give the runner the complete benchmark directory. Rejected because the colocated expectations
   and scoring files would make leakage an ordinary path-resolution mistake.
2. Let the product runtime parse hidden expectations and filter them. Rejected because evaluation
   would become a production dependency and the agent-facing boundary would remain implicit.
3. Add a hosted benchmark service or database now. Rejected because the missing responsibility is
   local input isolation; a service adds deployment, privacy, and coordination costs before the
   execution contract exists.
4. Put the run record inside the participant target. Rejected because evaluator metadata could
   reveal hidden-file or scoring policy details and would pollute the only-input target.

## Costs and consequences

- The evaluator must manage a sibling record and later capture artifacts; preparation is not a
  one-command model run.
- Run directories and records are intentionally fresh-only, so retries need a new run ID/path and
  leave failed caller-owned paths untouched.
- The record contains a local target path, which is useful for orchestration but not portable across
  machines; a later provenance contract can add relocatable identifiers without changing semantic
  authority.
- The current contract reserves trajectory/output locations but does not define their contents,
  cost accounting, judge protocol, or raw prompt policy beyond omission.

Revisit this decision if an execution adapter needs more than `problem.md` plus normal SAH
instructions, if a platform cannot provide an evaluator-side record, or if a later schema must
support a reproducible relocation manifest.
