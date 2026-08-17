# ADR-0012: Resolve TypeScript symbols from explicit project config

Status: Accepted · Date: 2026-08-17 · Supersedes: the syntax-resolution portion of ADR-0011

## Context

Run 8 proves direct relative named-import calls, but rejects tsconfig path aliases and static
re-exports because matching text cannot establish symbol identity. Manually reproducing
TypeScript `baseUrl`, `paths`, extension substitution, package mode, and export resolution would
create a partial compiler with new false-pass paths. Ambient `tsconfig.json` discovery would
also make identical mapping input mean different things after an unrelated file appears.

The stronger resolver must not let tsconfig file selection hide a declared source, follow
checkout escapes, or turn all TypeScript constructs into supported coverage.

## Options considered

1. TypeScript Program/TypeChecker from an explicit target-relative config ← chosen
2. Interpret `baseUrl`/`paths` and re-export syntax inside the existing scanner
3. Keep aliases and re-exports unsupported

## Decision

Migrate the non-semantic source-mapping schema to v0.2 and require `tsconfigPath`. Load that
JSONC file only through the existing target confinement boundary; do not discover a conventional
filename. Reject escaping compiler paths operationally. Config inheritance, project references,
compiler plugins, JavaScript, and other unimplemented project forms remain unsupported.

Enumerate every TypeScript file below the mapping's declared roots and pass that complete set as
Program roots regardless of tsconfig `files`, `include`, or `exclude`. Use compiler options only
for parsing, module resolution, and type checking. Resolve the mapped module's direct named
callable export, follow TypeChecker alias identity through `baseUrl`/`paths` and finite static
named or star re-exports, and count only direct identifier calls to that canonical symbol.

All target implementation sources and symbol-chain declarations must remain target-confined and
inside declared roots. Resolution errors, ambiguous/missing symbols, unsafe reads, or compiler
diagnostics that undermine the graph are unsupported rather than pass. Explicit invalid or
unreadable mapping/tsconfig input is operational.

## Trade-offs accepted

- Uses the language's real resolver instead of maintaining an incomplete imitation.
- Keeps source selection explicit and independent of tsconfig glob drift.
- Supports common aliases and barrel exports without changing canonical IR.
  − Makes v0.1 mappings fail until they add `tsconfigPath` and the v0.2 schema ID.
  − Program construction and semantic diagnostics cost more than syntax-only parsing.
  − Conservative config/source restrictions reject valid complex TypeScript projects.

Mitigation: cache one Program inventory per verification, report the exact unsupported
diagnostic/source, retain direct-import regression tests, and expand supported project features
only with false-pass-focused mutations.

## Consequences

ADR-0011 still owns explicit mapping, element prefixes, source-root enumeration, and the exact
constraint predicate. This ADR replaces only its syntax-resolution boundary. Mapping remains
target-local adapter metadata, not an eighth IR or manifest artifact. S13 lifecycle advancement,
general dependency graphs, namespace/default calls, indirect aliases, and dynamic code remain
out of scope.
