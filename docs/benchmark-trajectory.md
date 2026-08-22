# Benchmark Trajectory Capture

This document owns the executable raw-trajectory capture contract for the FP-008
benchmark protocol. [Benchmark run preparation](benchmark-run.md) owns input
isolation and the preparation record; [Benchmark strategy](benchmark-strategy.md)
remains authoritative for scoring, judges, and dataset evolution. This slice
validates and stores entries; it does not produce them.

## Command

From a built SAH checkout:

```text
sah benchmark-trajectory <run-directory> --entry-file <entry-file> [--json]
sah benchmark-trajectory <run-directory> --status [--json]
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

## Scope boundary

SAH provides the durable format and integrity seam for the reasoning trajectory
that the run protocol freezes before scoring. It does not execute a model, invoke
a provider, generate payload content, score outputs, or freeze evaluation inputs;
those remain subsequent slices. Appends assume a single local writer and use no
locking. Caller-supplied timestamps are claims about capture time, not observed
execution times. Hidden expectations never enter the run directory or this
contract.
