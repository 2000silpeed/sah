# ADR-0030: Capture Benchmark Trajectory Locally

- Status: accepted
- Date: 2026-08-22
- Owners: SAH evaluation and delivery authority

## Context

ADR-0029 isolates benchmark inputs before execution and reserves relative
`output/` and `trajectory.jsonl` locations in the evaluator-side record, but
nothing defines their contents, validates entries, or protects continuity. The
run protocol freezes "the reasoning trajectory" before scoring, so an honest
benchmark needs a durable, schema-valid capture format before any runner,
scorer, or judge exists.

## Decision

Add a versioned `benchmark-trajectory-entry` schema validating one JSONL line
and a local `appendBenchmarkTrajectoryEntry` / `inspectBenchmarkTrajectory`
seam exposed as `sah benchmark-trajectory`. Capture is bound to preparation:
the run directory must carry a schema-valid sibling `benchmark-run` record
whose isolated target root resolves to that directory. The library stamps the
schema tag, enforces contiguous positive sequence numbers, non-decreasing
recorded timestamps, one of four neutral entry kinds, and a non-empty payload
object whose contents SAH never interprets. Appends are single-writer,
append-only writes with no locking; inspection is read-only, reports counts,
bytes, a full-file SHA-256 digest, and line-numbered corruption findings, and
never creates paths. Every rejection is pre-write and operational (exit 2);
nothing here executes a model, generates payload content, scores, or freezes
evaluation inputs.

## Alternatives considered

1. Extend `benchmark-run` to v0.2.0 with trajectory fields instead of a sibling
   entry schema. Rejected because preparation identity and captured content are
   different responsibilities with different writers; folding them together
   would force re-preparation semantics onto append-only evidence.
2. Store the whole trajectory as one JSON array file. Rejected because rewriting
   the file per event multiplies corruption blast radius and prevents streaming
   capture; JSONL keeps each entry independently validatable.
3. Enforce a semantic event taxonomy (roles, tool schemas, message shapes) now.
   Rejected because SAH is methodology- and model-neutral about raw participant
   content; inventing taxonomy without runners or judges would be speculative
   schema ceremony.
4. Build the execution runner/model adapter in this slice so timestamps are
   observed rather than claimed. Rejected because external model invocation is
   explicitly out of scope for this roadmap step; the capture seam must be
   testable locally first.

## Costs and consequences

- Caller-supplied `recordedAt` values are claims about capture time, not
  observed execution times; provenance-grade timing belongs to a later
  execution/provenance contract.
- Single-writer appends use no locking; concurrent writers could interleave or
  break continuity, so callers must serialize capture for one run.
- Append verifies only the final anchor line; mid-stream tampering is detected
  by `--status`, future freeze/scoring slices, not by every append.
- Digest computation reads the whole file, which stays cheap for local runs but
  is not designed for unbounded trajectories.
- Payloads are intentionally opaque, so evaluators cannot rely on SAH to
  interpret trajectory meaning; judges must consume raw content directly.

Revisit this decision if an authorized execution adapter needs richer envelope
fields, if concurrent capture per run becomes real, if trajectories outgrow
whole-file digests, or if scoring requires semantic event structure inside SAH
itself.
