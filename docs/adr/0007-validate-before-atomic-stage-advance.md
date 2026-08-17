# ADR-0007: Validate before atomic stage advancement

Status: Accepted · Date: 2026-08-17 · Supersedes: —

## Context

The manifest makes completed lifecycle explicit, but Run 2 can only read it. Advancement must
not claim a gate before checking it, leave partial JSON after a crash, overwrite an observed
concurrent change, or imply that unimplemented S0–S13 gates passed.

## Options considered

1. Modify the manifest in place, then validate
2. Write first and roll back after failed validation
3. Validate a proposed lifecycle, then replace through a same-directory temporary file ← chosen
4. Add a lock protocol or transactional local/hosted store

## Decision

The Model Repository validates current artifact bytes as if the requested next stage were
completed. It advances only to implemented deterministic targets S5, S6, S7, S10, or S11.
Equal, backward, skipped, and other target stages fail without writing.

After validation, write complete JSON to an exclusively created temporary file in the manifest
directory, preserve mode, flush and close it, compare the manifest with its initially loaded
bytes, and rename the temporary file as the commit point. Refuse manifest symlinks. Remove the
owned temporary file after pre-commit failure.

## Trade-offs accepted

+ No invalid target state or partial JSON becomes the canonical manifest.
+ The source comparison detects ordinary lost-update races without a persistent lock format.
− Atomic rename and file sync depend on local filesystem semantics.
− Formatting the manifest rewrites its bytes on success even though only one value changes.
− A concurrent writer can still race between the final comparison and rename.

Mitigation: keep the comparison immediately before rename, expose the residual race honestly,
and add a lock/store only after measured concurrent writers. Preserve every parsed manifest
value except `completedStage`, plus the original file mode.

## Consequences

`validateBundle` retains manifest-authoritative interpretation and no public stage override.
`advanceBundle` owns the proposed lifecycle and returns blocked versus operational results.
Reconsider when reasoning orchestration needs multi-file atomic updates or concurrent writers
make the remaining race observable.
