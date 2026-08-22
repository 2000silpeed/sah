# Benchmark Trajectory Capture

This document owns the executable raw-trajectory capture and freeze contracts for
the FP-008 benchmark protocol. [Benchmark run preparation](benchmark-run.md) owns
input isolation and the preparation record; [Benchmark strategy](benchmark-strategy.md)
remains authoritative for scoring, judges, and dataset evolution. These slices
validate and store entries; they do not produce them.

## Command

From a built SAH checkout:

```text
sah benchmark-trajectory <run-directory> --entry-file <entry-file> [--json]
sah benchmark-trajectory <run-directory> --status [--json]
sah benchmark-freeze <run-directory> [--json]
```

Exactly one action is required. `--entry-file` reads one UTF-8 JSON envelope
without `$schema` — SAH stamps the canonical schema ID itself:

```json
{
  "seq": 1,
  "recordedAt": "2026-08-22T10:00:00.000Z",
  "kind": "system-event",
  "payload": { "note": "runner started" }
}
```

## Contract

Each accepted entry becomes exactly one line of `<run-root>/output/trajectory.jsonl`,
the location reserved by the preparation record's `capture` block. Every line must
validate against [the trajectory-entry schema](../schemas/benchmark-trajectory-entry.schema.json):

- a positive integer `seq`, contiguous from 1 with no gaps or repeats;
- a non-decreasing ISO `recordedAt` timestamp within one run;
- one `kind` of `agent-message`, `tool-invocation`, `tool-result`, or
  `system-event`; and
- a non-empty `payload` object whose contents SAH never interprets. Raw
  trajectory content is participant-owned; SAH owns only ordering, timestamps,
  and bytes.

Capture is bound to preparation: the run directory must have a schema-valid
sibling `<run>.benchmark-run.json` record whose `isolatedTarget.root` resolves to
that directory, so entries cannot be captured into unprepared targets.

Successful append and status return exit code `0`; every rejection is an
operational error returning exit code `2`. A failed append leaves the filesystem
untouched: envelope validation, continuity checks, and path-safety checks all run
before any byte is written.

## Read-only inspection

`--status` validates every stored line and reports an honest view without
mutating anything: entry count, byte size, full-file SHA-256 digest, sequence
range, and recorded-time range. A missing trajectory file reports an empty view,
not an error. Any corrupt or schema-invalid line fails operationally with its
line number so evaluators learn the capture is broken instead of receiving a
quietly partial view.

## Freezing a completed capture

`sah benchmark-freeze` pins a completed capture into a fresh sibling
`<run>.benchmark-freeze.json` record validated by
[the freeze schema](../schemas/benchmark-freeze.schema.json). The record copies
the preparation identity (run, comparison, benchmark, mode), stamps `frozenAt`,
and stores the full trajectory digest, byte size, entry count, sequence and time
ranges, plus an inventory of every other regular file under `output/` with its
own byte size and SHA-256 digest. It claims nothing about when or whether a
model executed; it is capture-time evidence only.

Freezing is a boundary, not a bookmark:

- appends are refused once the freeze record exists, so frozen captures are
  immutable by construction rather than by convention;
- an empty capture is refused — a runner that produced nothing must not be
  blessed as a scored attempt;
- freezing is fresh-only; re-freezing after more capture requires a new run
  directory, matching preparation semantics;
- every stored line is validated during freeze, and symlinked or non-regular
  entries anywhere in the output tree fail operationally with their path.

Successful freezes return exit code `0`; every rejection is operational exit
`2`.

## Scope boundary

SAH provides the durable format and integrity seam for the reasoning trajectory
that the run protocol freezes before scoring. It does not execute a model, invoke
a provider, generate payload content, score outputs, or open hidden expectations;
those remain subsequent slices. Appends and freezes assume a single local writer
and use no locking. Caller-supplied timestamps are claims about capture time, not
observed execution times. Hidden expectations never enter the run directory or
these contracts.
