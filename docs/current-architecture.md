# Current Architecture Projection

This document owns the Phase 2 read-only projection contract. The canonical sources remain the
independently validated bundle snapshots and [architecture evolution IR](../schemas/architecture-evolution.schema.json).
The machine result is [current-architecture-result.schema.json](../schemas/current-architecture-result.schema.json),
and [ADR-0026](adr/0026-derive-current-architecture-from-lineage-heads.md) records the boundary.

## Command and library

```text
sah current <sah-root> [--json]
resolveCurrentArchitecture(sahRoot)
```

The caller must provide an explicit SAH root. The resolver first runs the read-only lineage
projection, then reads the independently validated snapshots in that explicit lineage. It does
not inspect Git, directory timestamps, model/provider metadata, or hidden reasoning. It does not
write a current file, alter lifecycle metadata, or rewrite a historical bundle.

## Projection rules

- Active decisions come from accepted decisions in each head snapshot.
- A local `supersedes` relation or a validated cross-bundle `supersedes` transition removes the
  source from the head projection and records its exact qualified reference as superseded.
- `extends`, `narrows`, and `coexists` do not remove a source by inference.
- Open triggers are exact review-trigger strings on active decisions that have no fired event for
  the same decision ID and trigger text in the head's reachable lineage.
- Pending judgments list current-head Architecture constraints classified as `judgment`. They are
  context, not a deterministic pass or target-check evidence.
- Multiple heads remain visible. Overlapping active element scopes without an explicit resolving
  relation are conflicts. Dates, file names, and Git order never choose a winner.

Qualified references use `bundleId#decisionId`; head output includes the exact computed design
fingerprint and root-relative path. This keeps the view tied to immutable snapshot identity.

## Status and exit behavior

| Status | Meaning | CLI exit |
| --- | --- | ---: |
| `ready` | lineage resolved and no current projection conflict | 0 |
| `conflicted` | lineage violation or unresolved active-decision conflict | 1 |
| `incomplete` | required lineage history is unavailable | 2 |
| `operational-error` | root, path, or snapshot could not be safely read | 2 |

`ready` means the projection is deterministic, not that judgment constraints or target evidence
have passed. Only the canonical bundle and later S13 evidence can make lifecycle claims.

## Skill entry

For an existing target, the portable skill locates the explicit SAH root and runs `sah current`
before authoring a new design. A ready projection with no applicable open trigger can use the
fast path when the requested change is otherwise reversible and compatible. An applicable trigger
routes to reasoning and a new evolution snapshot. Conflicted, incomplete, or operational results
remain an explicit blocker; the skill never edits the parent bundle or chooses a latest head.
