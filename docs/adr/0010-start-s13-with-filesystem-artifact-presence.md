# ADR-0010: Start S13 with filesystem artifact presence

Status: Accepted · Date: 2026-08-17 · Supersedes: —

## Context

S13 needs its first executable code-fact path, but the current source-graph constraint cannot
run until SAH has an explicit source-to-element mapping contract. Missing facts or adapters
must report `unsupported`, never pass. The first slice must prove adapter dispatch, honest
result aggregation, target containment, and CLI/library boundaries without introducing a
general constraint compiler.

The target checkout is execution context. Persisting its local path in semantic IR would mix
machine state with architecture meaning; silently using the process working directory would
make identical invocations depend on ambient state.

## Options considered

1. Direct local filesystem adapter for one regular-file-presence predicate ← chosen
2. TypeScript source-graph adapter plus source-to-element mapping
3. Caller-supplied fact snapshot without source extraction

For the target root:

1. Explicit library/CLI argument ← chosen
2. Manifest lifecycle/storage field
3. Implicit current working directory

## Decision

Add one adapter capability for an exact observable tuple: `factSource` is `filesystem`,
`predicate` is `regular-file-exists`, `expected` is `true`, and `selector` is a confined
forward-slash relative path. The adapter observes whether the target entry is a regular file.
Missing entries are deterministic false observations. Invalid bindings and unavailable
capabilities are unsupported; unsafe or unreadable execution roots are operational errors.

Expose the target directory as an explicit `verifyBundle` argument and CLI positional. Do not
change the manifest or semantic schemas. Verify constraints assigned by the S12 handoff:
ready-slice deterministic constraints may run; blocked-only or contextual constraints remain
pending. Keep S13 lifecycle advancement unsupported.

Each check is `pass`, `violation`, `pending`, or `unsupported`; the overall result is `passed`,
`violations`, `incomplete`, or `operational-error`. A known violation takes precedence over
incomplete coverage. Operational diagnostics stay separate from constraint checks.

## Trade-offs accepted

- Proves the complete S13 adapter/result path with a fixed, auditable predicate.
- Requires no inferred ownership mapping and no target-language parser.
  − File presence says nothing about content, coverage, or test sufficiency.
  − Callers must supply a target root on every verification run.
  − Most existing constraints remain pending or unsupported until later adapters exist.

Mitigation: result checks expose observed and expected values, unsupported coverage is an
overall incomplete outcome, and docs explicitly prohibit interpreting presence as adequacy.
The adapter seam permits later source-graph implementations without changing public result
semantics.

## Consequences

`sah verify` is continuous verification, not S13 completion. A later ADR must define canonical
source-to-element mappings before a TypeScript/source-graph adapter can enforce boundary or
write-authority constraints. Fact snapshots remain a possible test/import adapter, not a
substitute for actual extraction in this slice.

Containment resolves each observed symlink before accepting a file, but this local read-only
check does not claim an adversarial race-free filesystem snapshot. A stronger threat model
would require descriptor-relative traversal or an isolated immutable checkout.
