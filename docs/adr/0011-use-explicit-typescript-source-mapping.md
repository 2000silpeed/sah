# ADR-0011: Use explicit TypeScript source mapping

Status: Accepted in part · Date: 2026-08-17 · Superseded in part by: ADR-0012

## Context

The accepted simple-crud write-authority constraint cannot execute until target files and call
sites can be related to stable Architecture element IDs. Inferring ownership from directories
would turn filesystem convention into semantics. Storing checkout-specific paths in semantic
IR or the bundle manifest would mix adapter context with design meaning.

The adapter must enumerate enough source to avoid a false pass and parse imports/calls without
pretending a regular expression is a TypeScript graph. It must also stop at one observable
predicate rather than becoming a language-independent constraint compiler.

## Options considered

For mapping ownership:

1. Explicit target-relative, schema-validated adapter configuration ← chosen
2. Conventional mapping filename under the target root
3. Bundle-manifest field or new semantic IR

For source facts:

1. TypeScript compiler parser over declared source roots ← chosen
2. Regular-expression scanning
3. Caller-supplied precomputed graph

## Decision

Add a non-semantic TypeScript source-mapping schema. Callers opt in with a target-relative path
through `VerificationOptions.sourceMappingPath` or CLI `--mapping`; no ambient filename is
loaded. The configuration declares TypeScript source roots, Architecture element path prefixes,
and write targets keyed by the observable selector.

Use the TypeScript compiler API as a production dependency. Enumerate every `.ts`, `.tsx`,
`.mts`, and `.cts` file below each confined source root. The first adapter supports direct
named imports, including import aliases, and direct calls to one exported write symbol. Its
exact predicate is `writers-belong-to-constraint-scope` with expected `true`.

Malformed/schema-invalid configuration, dangling element IDs, unsafe paths, and inaccessible
roots are operational configuration failures. Missing mappings, ambiguous element ownership,
syntax failures, source symlinks, JavaScript in a declared source root, re-exports, dynamic
loading, and indirect alias use are unsupported coverage, never pass. A resolved writer outside
the constraint scope is a violation.

## Trade-offs accepted

- Makes ownership explicit and keeps target-local facts outside canonical architecture.
- Scans declared roots, preventing an incomplete file list from manufacturing success.
- Uses a real parser and preserves named-import aliases.
  − Adds TypeScript compiler weight to the production package.
  − Rejects path aliases, re-exports, namespace/default imports, dynamic loading, and indirect
  function aliasing until a stronger resolver exists.
  − Prefix mapping can require maintenance as files move.

Mitigation: unsupported checks identify the source form and repair path. Mapping references are
checked against validated Architecture elements, and fixture/test mutations protect pass,
violation, incomplete, and operational boundaries.

## Consequences

The mapping schema is a machine contract but not an eighth semantic IR and is never declared in
the design-bundle manifest. Verification results remain runtime evidence and S13 advancement
remains unsupported. ADR-0012 supersedes the syntax-resolution limit with explicit-project
symbol identity while retaining this ADR's mapping ownership, exact predicate, and honest
incomplete boundary.
