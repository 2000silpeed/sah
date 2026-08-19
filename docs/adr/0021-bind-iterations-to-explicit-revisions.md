# ADR-0021: Bind iteration evidence to explicit work revisions

## Status

Accepted for Run 21.

## Context

Run 20 prevents malformed or non-passing evidence from closing a loop, but it does not identify
which target revision or design-bundle revision produced that evidence. A later session could
reuse a passing outcome after code or design artifacts changed. The existing verification runtime
already owns a canonical semantic-bundle fingerprint; the loop needs a narrow binding around it,
not a second design authority.

## Decision

Add a required loop `workContext` containing the explicit target root, an opaque caller-supplied
target revision, the design-bundle path, and the canonical `sha256:` design fingerprint. Add
`loop-bind` for a planned/in-progress iteration. Require explicit target revision and design
fingerprint arguments for `loop-checks`; copy them into outcome evidence and require exact equality
when recording. Normal accept-next and repair accept a new explicit binding for the newly planned
iteration. Completion requests carry the same binding, and completion compares loop context,
latest outcome context, and request context before writing terminal state.

SAH does not inspect Git, hash an ambient source tree, or infer a revision. The caller owns the
meaning and freshness of the target revision; `sah resume` or verification output can supply the
design fingerprint. Context mismatches are deterministic transition blocks and atomic no-ops.

## Alternatives and costs

- Infer Git `HEAD`: convenient, but violates SAH's explicit non-Git boundary and breaks on detached,
  generated, or non-Git targets.
- Hash every target file automatically: stronger observation, but adds an implicit source-root
  authority, platform/ignore semantics, cost, and a second interpretation of “revision.”
- Keep only the design fingerprint: protects architecture evidence but misses target-code changes
  between sessions.
- Add hosted revision/coordinator storage: supports multi-writer history, but introduces identity,
  deployment, consistency, privacy, and operational costs outside the local loop.

The selected design costs one binding command, explicit caller plumbing, schema version migrations,
and a small amount of repeated context data. It preserves local single-writer atomicity and keeps
revision semantics with the target workflow.

## Consequences and review

Old outcomes cannot be recorded or completed under a different bound context. A target workflow
must provide its revision token and refresh the binding deliberately when starting a new planned
iteration. The guard proves equality, not that an opaque token is truthful; target tooling remains
responsible for token provenance. Review before adding automatic source hashing, Git integration,
or hosted coordination.

Decision authority: SAH architecture authority for the local loop; target repository tooling for
target-revision meaning and freshness.
