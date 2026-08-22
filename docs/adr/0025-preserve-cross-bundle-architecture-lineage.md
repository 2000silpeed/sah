# ADR-0025: Preserve Cross-Bundle Architecture Lineage

- Status: accepted
- Date: 2026-08-22
- Owners: SAH product and architecture authority

## Context

SAH already preserves one bundle's reasoning, decisions, implementation handoff, and verification
fingerprint. A later agent can validate that snapshot, but it cannot deterministically establish
which immutable bundle a changed design came from, which review trigger fired, which stages need
reopening, or whether a new decision superseded the old decision. Putting this history into the
current Architecture Decision IR would mix bundle-local decision ownership with project-level
lineage ownership.

## Decision

Add an optional `architecture-evolution` semantic artifact for explicitly evolved v0.5 bundles.
Keep the v0.4 manifest schema and fingerprint behavior unchanged. The artifact pins parent bundle
ID and design fingerprint, exact source decision and review-trigger text digest, current evidence,
reopened stages, and cross-bundle decision transitions.

Expose a read-only `resolveArchitectureLineage(sahRoot)` library operation and
`sah lineage <sah-root> [--json]` CLI adapter. The resolver discovers only below an explicit root,
rejects root-escaping symlinks, checks source and target decisions after fingerprint binding, and
reports cycles, dangling references, stale parents, and parallel heads as non-passing results.
Missing source snapshots are `incomplete`; no path, date, or latest-file rule resolves a conflict.

The evolution artifact is included in v0.5 fingerprints. The result projection is derived and is
not a semantic source of truth. Exact existing review-trigger strings are pinned using a SHA-256
digest of their exact UTF-8 bytes. Stable trigger IDs and migration are deferred.

## Alternatives considered

1. Extend Architecture Decision IR with parent graph and trigger history. Rejected because it gives
   one artifact two authorities and would make cross-bundle history look bundle-local.
2. Put lineage in the manifest. Rejected because the manifest is non-semantic loading metadata
   and because v0.4 strictness must remain intact.
3. Accept one permissive manifest schema for v0.4 and v0.5. Rejected because it weakens version
   boundaries and permits silent schema migration.
4. Resolve parallel heads by timestamp, directory order, or latest file. Rejected because it
   hides an architecture decision and makes results non-reproducible.
5. Store lineage in a hosted graph/database service. Deferred because the current product boundary
   is local-first and the MVP has no scale, team-autonomy, or partial-failure evidence requiring it.

## Costs and consequences

- Versioned manifest schemas duplicate descriptor definitions and require explicit loader dispatch.
- A second canonical artifact adds authoring and validation ceremony for evolved bundles.
- Root discovery and symlink checks add filesystem complexity and make incomplete history visible.
- Fingerprinting evolution metadata means editing a lineage record creates a new snapshot identity.
- Callers must resolve conflicts and create an explicit successor; SAH does not guess intent.

These costs buy immutable history, cross-model/session continuity, deterministic stale detection,
and a reviewable decision trail without adding a service or model-specific authority.

## Consequences and review triggers

The existing v0.4 fixture and lifecycle commands remain compatible. Evolved bundles can be locally
validated without a project root, while `sah lineage` is required to claim resolved history. A
future decision is required before adding stable trigger IDs, hosted storage, or target evidence
joins. The current projection boundary is recorded separately in
[ADR-0026](0026-derive-current-architecture-from-lineage-heads.md). Reopen this ADR if bundle
discovery scale, concurrent authorship, merge frequency, or revision semantics make explicit local
resolution insufficient.
