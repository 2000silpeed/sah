# Run 25 ExecPlan — Cross-Bundle Lineage MVP

## Objective

Align the product thesis with the approved evolution proposal and implement only Phase 0 and
Phase 1: an optional architecture-evolution IR, backward-compatible v0.4/v0.5 bundle loading,
explicit-root lineage resolution, and the read-only `sah lineage` command.

## Authority and constraints

- [AGENTS.md](/Users/sungwoon/ai-projects/sah/AGENTS.md) is operating authority.
- [docs/vision.md](/Users/sungwoon/ai-projects/sah/docs/vision.md),
  [docs/harness-architecture.md](/Users/sungwoon/ai-projects/sah/docs/harness-architecture.md),
  [docs/validation-cli.md](/Users/sungwoon/ai-projects/sah/docs/validation-cli.md), the schema
  files, runtime, tests, and fixtures are repository authority.
- [SAH_FUTURE_PROOF_EVOLUTION_DESIGN.md](/Users/sungwoon/ai-projects/sah/SAH_FUTURE_PROOF_EVOLUTION_DESIGN.md)
  is a proposal input, not a replacement for repository authority.
- Never rewrite or overwrite historical bundles; each bundle remains an independently valid full
  snapshot. Cross-bundle references use exact bundle ID and design fingerprint.
- Unresolved, unsupported, malformed, unsafe, and ambiguous lineage never reports `passed`.
- Do not add `sah current`, target evidence adapters, benchmark automation, stable trigger ID
  migration, hosted infrastructure, UI, database service, or model/provider provenance.
- Do not commit, push, or create a PR.

## Accepted design

Keep the v0.4 manifest schema and fingerprint behavior unchanged. Add a separately identified
v0.5 manifest schema with an optional `architectureEvolution` descriptor. The evolution artifact
owns parent references, change evidence, fired trigger events, reopened stages, and cross-bundle
decision transitions. Exact existing review-trigger text is pinned with a UTF-8 SHA-256 digest;
stable trigger IDs are deferred. Local evolution validation is separate from the project-level
resolver. The resolver walks only the explicit SAH root, rejects root-escaping symlinks and unsafe
paths, orders results deterministically, and does not select among parallel heads automatically.

## Implementation slices

1. Update vision, architecture/CLI authority docs, ADR, glossary/index, and this plan.
2. Add Draft 2020-12 evolution, v0.5 manifest, and lineage-result schemas with complete traces;
   register them and extend internal loading without changing v0.4 behavior.
3. Add local evolution validation, lineage snapshot loading, fingerprint-aware graph resolution,
   diagnostics, and the bookmark direct-CLI → second-caller → shared-operations fixture.
4. Add `sah lineage <sah-root> [--json]`, schema/result formatting, regression/path/failure tests,
   then run the full source-checkout quality and documentation checks.

## Stop conditions

Stop and report if the existing v0.4 fingerprint, fixture validation, stage lifecycle, or CLI
exit contract would need to change; if a lineage decision cannot be made deterministically; or if
the implementation would require any excluded Phase 2+ authority.

## Outcome

Implemented the approved Phase 0 and Phase 1 slice. The v0.4 manifest and fingerprint remain
unchanged; v0.5 optional evolution, confined lineage resolution, `sah lineage`, deterministic
diagnostics, the bookmark fixture, tests, docs, and ADR-0025 are complete. No commit, push, or PR
was made.

## Verification log

- `npm install`, format check, lint, strict typecheck, build, and schema-contract audit pass.
- Full `npm test` passes all 272 tests across 13 files, including v0.4 fingerprint regression,
  bookmark lineage, CLI exit behavior, failure modes, and path safety.
- CLI smoke passes for `validate` human/JSON, bookmark `lineage --json`, and the missing-root
  operational-error/exit-2 contract.
- Post-approval read-only dogfood validates both bookmark bundles independently and the human
  lineage projection: two bundles, one edge, one head, and the expected trigger transition.
- Workspace-wide explicit-root dogfood over `fixtures/` validates three independent snapshots,
  one lineage edge, two independent heads, and zero conflicts; no separate target `.sah` root is
  present in this checkout.
- Markdown local-link audit covers 58 files; governed documents remain within 400 lines; and
  `git diff --check` passes. Commits `461fc51` and its follow-up verification record were made;
  no push or PR was made.
