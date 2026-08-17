# ADR-0013: Scope verification with explicit changed paths

Status: Accepted · Date: 2026-08-17 · Supersedes: —

## Context

Run 9 verifies every applicable S12 constraint. Coding-agent integration needs a smaller
change-triggered surface, but inferring changes from git would bind the reusable library to one
VCS and process state. A target-local change-set file would add lifecycle and cleanup concerns
for ephemeral invocation input. Changed paths also cannot become an evidence boundary: one
selected write-authority check still needs the complete declared source graph.

An incomplete path mapping must not skip the very constraint that could catch a violation.
Selection behavior and fallback evidence therefore need a public deterministic contract.

## Options considered

1. Repeatable CLI `--changed` plus `VerificationOptions.changedPaths` ← chosen
2. A schema-validated target-local change-set file
3. Ambient git diff/status discovery

## Decision

Accept one or more normalized target-relative changed-file paths explicitly. The CLI may repeat
`--changed`; the library accepts an optional readonly array. Changed paths require the existing
explicit source mapping and never inspect git state or require that a changed/deleted file still
exists.

The source adapter maps each path through its declared source roots and element prefixes. When
all paths resolve uniquely, the Model Repository selects constraints assigned to any S12 slice
whose element set intersects the resolved elements. Normal ready/blocked and deterministic/
contextual rules still apply after selection.

If any path is outside declared roots, unmapped, or maps to multiple elements, verify all
constraints and expose stable per-path selection issues. Unsafe or empty changed-path input and
changed paths without explicit mapping are operational failures. Every selected adapter keeps
its full existing evidence boundary; selection never narrows source enumeration or observable
inspection.

## Trade-offs accepted

- Keeps the library VCS-neutral and the CLI stateless.
- Reuses explicit mapping and canonical S12 ownership instead of inventing dependency meaning.
- Full fallback prevents false passes when mapping coverage is incomplete.
  − Callers must enumerate paths and provide mapping explicitly.
  − A single mapping gap loses incremental performance for that run.
  − Slice membership is coarser than a future proven symbol dependency graph.

Mitigation: expose requested paths, resolved elements, mode, and stable fallback issues in both
result formats. Tests inject unmapped and ambiguous writers to prove fallback still detects
violations or incomplete coverage.

## Consequences

Selection metadata is runtime evidence, not semantic IR, bundle lifecycle, or source-mapping
schema data. Existing verification without changed paths is unchanged. This decision does not
authorize git adapters, transitive impact inference, a general constraint compiler, persisted
results, or S13 lifecycle advancement.
