# ADR-0026: Derive Current Architecture from Explicit Lineage Heads

- Status: accepted
- Date: 2026-08-22
- Owners: SAH product and architecture authority

## Context

The Cross-Bundle Lineage MVP can resolve immutable snapshots and report heads, but a later
coding-agent session still has to reconstruct which accepted decisions are active, which older
decisions were superseded, and which review triggers remain open. Persisting that reconstruction
would introduce a second current-state authority beside the design bundles.

## Decision

Add a read-only `resolveCurrentArchitecture(sahRoot)` projection and the
`sah current <sah-root> [--json]` CLI adapter. It consumes the explicit-root lineage result and
the independently validated head snapshots. Accepted decisions in each head are projected as
active; explicit local or cross-bundle `supersedes` relations produce qualified superseded
references. `extends`, `narrows`, and `coexists` never cause an implicit latest-wins removal.

The result reports head identity and fingerprint, active and superseded decisions, exact open
review-trigger text, judgment-classified constraints, conflicts, and deterministic diagnostics.
Lineage failures, missing history, overlapping active scopes without an explicit relation, and
multiple superseders remain non-ready. The command never writes a bundle, a current-state file,
or lifecycle metadata.

## Alternatives considered

1. Persist `current-architecture.json` as a canonical snapshot. Rejected because it would become a
   second authority that can go stale or be edited independently of immutable bundles.
2. Select the newest head by date, file order, or Git order. Rejected because it hides an
   unresolved architecture decision and is not reproducible.
3. Project only the physically newest bundle and ignore lineage transitions. Rejected because it
   loses the exact source decision, trigger, and supersession path needed for model handover.
4. Require a hosted graph service before exposing current state. Deferred because the local
   explicit-root resolver already supplies the needed evidence and no scale or collaboration
   force requires a service.

## Costs and consequences

- Every projection rescans and validates the explicit root, so current-state reads pay local
  filesystem and fingerprint cost.
- Head projection must retain explicit transition semantics and surface scope conflicts instead
  of hiding them behind a single aggregate, which adds deterministic result and test surface.
- A missing or stale parent can leave useful partial facts in the result, but status remains
  `incomplete` or `conflicted`; callers must handle non-ready output.
- Judgment constraints are displayed as pending context only; this command does not turn them
  into deterministic approval or target evidence.

These costs buy a regenerable handover view without mutating history or embedding model/provider
details in semantic authority.

## Consequences and review triggers

The v0.4 and v0.5 bundle contracts, fingerprints, lifecycle transitions, and `sah lineage` exit
meanings remain unchanged. The portable skill may use `sah current` before design work on an
existing target, then use `sah resume` for a selected head. A conflicting or incomplete result
routes the task to reasoning or an authority gate; it never selects a head automatically.

Revisit this decision when stable trigger IDs, target-check evidence joins, concurrent authorship,
hosted storage, or measured lineage scale require a stronger identity/indexing contract.
