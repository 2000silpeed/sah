# ADR-0006: Use a schema-validated bundle manifest

Status: Accepted · Date: 2026-08-17 · Supersedes: —

## Context

Stage gates depend on how far reasoning has completed, while the six semantic IRs deliberately
exclude storage revision and lifecycle metadata. File contents cannot reliably distinguish an
in-progress earlier stage from an invalid later stage, and artifact locations need to remain
portable without becoming semantic facts.

## Options considered

1. Root `sah.bundle.json` with lifecycle and declared artifact descriptors ← chosen
2. Conventional filenames with stage inferred from present fields/files
3. Conventional filenames plus required `--stage`/`--profile` CLI flags

## Decision

Each bundle has a schema-validated, non-semantic `sah.bundle.json`. It records a bundle ID,
`lifecycle.completedStage`, `lifecycle.profile` (`full` or `short`), and descriptors that map
the six IR roles to relative paths and their canonical schema `$id`. The Model Repository
resolves descriptors, confines real paths to the bundle, and selects gates from the manifest.

`completedStage` means that stage's gate is claimed complete; validators apply that gate and
all earlier applicable gates. Storage and lifecycle metadata stay outside semantic IR.

## Trade-offs accepted

+ A checked-in bundle validates identically for CLI and library callers without guessed state.
+ Artifact names and directory layout may evolve without changing canonical IR references.
− Every bundle gains one metadata file that can drift from its artifacts.
− Moving an artifact requires updating a descriptor, and stage advancement becomes explicit.
− The manifest adds a seventh schema that must itself retain compatibility and field traces.

Mitigation: schema-validate before loading, require canonical schema IDs per artifact role,
reject path traversal including symlink escape, and report stage-required missing declarations
separately from unreadable declared files.

## Consequences

Invalid invocation, missing/invalid manifest configuration, path escape, and unreadable or
malformed declared JSON are operational failures. Once inputs load, IR schema, reference, and
stage-gate defects are architecture violations. A future store may create the same manifest
model in memory, but CLI flags cannot silently override repository lifecycle state.
