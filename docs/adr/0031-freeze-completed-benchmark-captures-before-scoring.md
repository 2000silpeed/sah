# ADR-0031: Freeze Completed Benchmark Captures Before Scoring

- Status: accepted
- Date: 2026-08-22
- Owners: SAH evaluation and delivery authority

## Context

The run protocol freezes the reasoning trajectory before hidden expectations are
opened or any judge sees an output. ADR-0030 made raw trajectory entries
appendable and inspectable, but nothing marks a capture complete, protects it
from later mutation, or inventories the other artifacts a participant left under
the reserved output directory. Judges and comparators therefore had no immutable
input boundary.

## Decision

Add `sah benchmark-freeze` with the versioned sibling record
`<run>.benchmark-freeze.json`. Freezing validates every stored line, refuses
empty captures, inventories all regular files under the reserved output
directory (excluding trajectory.jsonl) with per-file SHA-256 digests, copies the
preparation identity so the artifact is self-contained, stamps `frozenAt`, and
writes fresh-only. The presence of a freeze record makes appends fail
operationally, so immutability is enforced by construction rather than by
convention. SAH never claims an execution occurred; freeze metadata describes
capture state only.

## Alternatives considered

1. Fold capture totals into a benchmark-run v0.2.0 update. Rejected because
   preparation identity and frozen evidence are different responsibilities with
   different writers and lifecycles; mutating the preparation record would blur
   who authored what.
2. Allow idempotent re-freeze overwrites in place. Rejected because silently
   replacing a pinned record reintroduces exactly the mutable-evidence risk the
   boundary exists to remove; fresh-only matches preparation semantics.
3. Pin only trajectory.jsonl and ignore the rest of the output directory.
   Rejected because participant artifacts beside the trajectory are part of what
   judges score; an incomplete inventory would make "frozen" overclaim.
4. Guard frozen captures with a lock file instead of failing appends on the
   freeze record itself. Rejected because a second marker file adds no authority;
   the record's existence is already the single deterministic fact.

## Costs and consequences

- Re-freezing after additional capture requires a new run directory and a new
  identity, so late-arriving entries cannot join a frozen attempt.
- Identity fields duplicate the preparation record by design; divergence is
  impossible at write time because they are copied in one operation, but readers
  must trust the freeze-time copy rather than re-resolving the original.
- Appends and freezes assume a single local writer; concurrent writers can still
  interleave despite the post-freeze guard.
- Empty captures are refused rather than recorded, so a legitimately zero-entry
  run would need explicit contract work before it could be scored.

Revisit this decision if scoring needs per-entry digests inside the pin, if
multi-writer capture becomes real, if legitimately empty runs must be scored, or
if relocation across machines requires portable identifiers instead of local
paths.
