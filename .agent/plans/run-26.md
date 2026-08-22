# Run 26 ExecPlan — Current Architecture Projection and Skill Entry

## Objective

Implement Phase 2 of the approved evolution roadmap: a schema-validated, read-only
`sah current <sah-root> [--json]` projection over explicit lineage heads, plus portable skill
guidance that uses the projection before designing changes in an existing target.

## Authority and constraints

- Repository `AGENTS.md`, the indexed architecture/validation documents, ADR-0025, and the
  canonical schemas/runtime remain authoritative. The attached evolution document is proposal
  input; this plan and ADR-0026 record the accepted Phase 2 boundary.
- Preserve v0.4/v0.5 loading, fingerprints, bundle lifecycle, `sah lineage`, and all existing
  exit meanings. Current state is derived and read-only; no current artifact or silent migration.
- Do not implement Phase 3 target-check adapters, Phase 4 benchmarks/provenance, or Phase 5
  stable trigger IDs/sandbox changes/hosted infrastructure/UI/database behavior.
- Do not commit, push, or create a PR without explicit user authorization.

## Accepted design

Use a small projection module above `resolveArchitectureLineage` and `loadBundleForLineage`.
Accepted decisions in each head are active until an explicit local or cross-bundle `supersedes`
relation removes them. Other transition types preserve source visibility. Exact open triggers,
judgment constraints, heads, conflicts, and qualified decision references are result views, never
semantic authority. Lineage failures and overlapping active scopes remain non-ready.

## Implementation slices

1. Add the current-result schema, public contracts, deterministic result factory, and runtime
   projection; register the schema without changing existing manifest schemas.
2. Add the public library export and read-only CLI command with JSON/human output and exit mapping.
3. Add library/CLI/schema regression and failure-mode tests over the existing v0.4 and bookmark
   lineage fixtures.
4. Update current-state authority docs, ADR/index links, portable skill and references, then run
   the full source-checkout quality suite and self-review the final diff.

## Acceptance checks

- Bookmark lineage reports only the shared-operations decision as active and the direct-CLI
  decision as superseded, with the exact open trigger visible.
- A v0.4 bundle remains current-readable and its fingerprint is unchanged.
- Parallel heads, overlapping scopes, stale/missing lineage, and unsafe input never return ready.
- The CLI is read-only and returns exit 0/1/2 for ready/conflicted/incomplete or operational-error.
- Draft 2020-12 examples/traces, format, lint, typecheck, tests, build, CLI smoke, link/budget
  audit, and `git diff --check` pass.

## Verification log

- `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run build` passed.
- `npm run verify:schemas` passed all 4 schema-contract tests; the full `npm test` suite passed
  280 tests across 14 files.
- Focused current/CLI/schema/skill tests passed 59 tests. Production `sah current` passed for the
  bookmark lineage and v0.4 simple-crud fixtures; failure tests returned conflicted/incomplete
  statuses and exit 1/2 without writing snapshots.
- `git diff --check` passed. The read-only Markdown audit covered 98 files with zero broken local
  links and no governed document over 400 lines; the supplied proposal and preserved provenance
  prompt remain excluded inputs.

## Handoff

Phase 2 is complete. `sah current` is a schema-tagged public read-only projection and the portable
skill now uses it before existing-target design work. Phase 3 remains a separate authority decision
for target-check evidence binding; no implementation infers it from this projection. No commit,
push, or PR was performed.
