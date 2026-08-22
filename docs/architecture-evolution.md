# Architecture Evolution and Cross-Bundle Lineage

This document owns the Phase 1 Cross-Bundle Lineage contract. The canonical machine contracts
are [architecture-evolution.schema.json](../schemas/architecture-evolution.schema.json), the
explicit v0.5 manifest schema, and [lineage-result.schema.json](../schemas/lineage-result.schema.json).
The attached future-proof design document is proposal input; this document records the accepted
repository boundary.

## Product thesis

SAH is a model-independent architecture memory, decision-lineage, and evidence protocol. A
design bundle is an independently verifiable full snapshot. Evolution creates a new snapshot and
an explicit evolution artifact; it never edits a historical S13 bundle to simulate change.
Lineage preserves reviewable evidence and decisions, not private model reasoning or provider
metadata.

## Canonical evolution artifact

An evolved v0.5 bundle may declare `architecture-evolution.json`. Greenfield v0.4 bundles do not
need it. The artifact owns facts that do not belong in the current bundle's Architecture Decision
IR:

- `parents` pins each source bundle ID, exact computed design fingerprint, and relationship;
- `changeRequest` records the current evidence-backed change summary;
- `triggerEvents` pins a source decision, its exact review-trigger text, and a SHA-256 digest of
  the exact UTF-8 text;
- `reopenedStages` records why a trigger reopens each S0–S13 stage;
- `decisionTransitions` relates a pinned source decision to a current decision and names the
  transition type and scope. Event, reopened-stage, and transition IDs are unique within the
  artifact; the accepted MVP requires a transition ID so duplicate transition findings remain
  deterministic.

The current bundle ID must match the enclosing manifest. Current evidence, trigger references,
transition targets, reopened-stage trigger references, and current scope element references are
validated locally. Parent IDs, parent fingerprints, source decisions, trigger text, and
cross-bundle transitions are validated only when an explicit project root is resolved.

The existing `reviewTriggers` array remains exact text in Phase 1. Stable trigger IDs require a
later explicit Architecture Decision schema and migration; no silent conversion is allowed.

## Manifest compatibility

The v0.4 manifest schema remains strict and unchanged. v0.5 is a separately identified schema
selected by its exact `$schema` and `manifestVersion`. No loader fallback changes a v0.4 manifest
in place, and no existing fixture is rewritten. A v0.4 bundle can be a parent of a v0.5 bundle.

The evolution artifact participates in a v0.5 design fingerprint because changing the canonical
lineage record must make the snapshot stale. The v0.4 fingerprint algorithm remains unchanged.
The derived lineage result is never fingerprinted or reloaded as semantic authority.

## Resolver boundary

`resolveArchitectureLineage(sahRoot)` and `sah lineage <sah-root> [--json]` use only the explicit
root supplied by the caller. Discovery finds bundle manifests below that root, skips `.git` and
`node_modules`, and does not inspect Git state. A symlink that resolves outside the root, an
unreadable directory, and an unsafe root are operational failures.

The resolver computes deterministic bundle ordering, parent-to-child edges, trigger projections,
and heads. It never chooses a latest file or date. Two heads with a common ancestor are a
parallel-head conflict until an explicit successor or coexistence decision resolves them.

## Validation and results

The result is a derived `LineageResult` with `bundles`, `edges`, `triggerEvents`, `heads`,
`conflicts`, diagnostics, and counts. Statuses are:

- `passed`: every discovered bundle is locally valid and every resolved edge is deterministic;
- `violations`: stale fingerprints, source/target decision defects, trigger digest defects,
  cycles, dangling semantic references, duplicate IDs, or parallel-head conflicts exist;
- `incomplete`: a required parent/source bundle is not available under the explicit root;
- `operational-error`: the root, path, manifest, or declared artifact cannot be safely processed.

Only `passed` maps to exit 0. Unresolved or unsupported lineage never becomes a pass. The command
is read-only and does not mutate lifecycle metadata, artifacts, or historical bundles.

## Deliberate exclusions

This contract does not define `sah current`, target-check evidence adapters, benchmark automation,
stable trigger ID migration, hosted coordination, a graph database, UI, or model provenance.
Those choices require later authority and evidence.
