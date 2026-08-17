# ADR-0014: Pin full-verification evidence for S13 completion

Status: Accepted · Date: 2026-08-18 · Extends: ADR-0006, ADR-0007, ADR-0010

## Context

`verifyBundle` can execute S12-assigned constraints but its result is transient, so the
manifest cannot justify `completedStage=S13`. Advancing directly from a caller-supplied result
would allow changed-scoped selection, incomplete coverage, violations, stale design facts, or
an operational failure to be mistaken for completion. The evidence must remain runtime data,
not an eighth semantic IR, while lifecycle authority stays in the bundle manifest.

## Options considered

1. Embed the complete verification result in `sah.bundle.json`
2. Store results in a general local or hosted evidence database
3. Publish one schema-validated bundle-local record and atomically pin its descriptor ← chosen

## Decision

An opt-in verification call writes one complete result to an explicit bundle-relative JSON
path. The record declares whether invocation scope was `full` or `changed`, retains checks,
diagnostics, summaries, bundle/target context, and carries a digest of the exact semantic
design snapshot. Publication is atomic but does not change lifecycle state.

S12→S13 advancement requires an explicit record path. The Model Repository confines and
schema-validates the record, verifies its byte digest and design fingerprint, and evaluates an
exact deterministic gate. Only full-scope `passed` evidence with no selection metadata, no
non-pass check, consistent summaries, and exact coverage of current S12 constraint assignments
is eligible. `affected` and `full-fallback` records are both changed-scoped. A valid stale,
violating, incomplete, or operational-error record blocks the gate; malformed, unsafe,
unreadable, or concurrently changed evidence is an operational failure.

On success, one atomic manifest replacement adds the exact record path, schema ID, and record
byte digest while setting `completedStage` to S13. The record already exists; it has no
lifecycle authority until that commit. The pre-commit comparison covers both initially loaded
manifest and record bytes. `validateBundle` rechecks the pinned record and current design
fingerprint whenever the stored stage is S13.

## Trade-offs accepted

- The manifest remains the single lifecycle authority and records durable evidence provenance.
- Existing adapters, verification status precedence, CLI exit codes, and seven semantic IRs
  stay unchanged.
- Manifest v0.4 is a pre-1.0 hard cut because older manifests cannot declare S13 evidence.
- Opt-in verification is no longer read-only because it publishes a record; ordinary calls
  remain read-only.
- A failed advance can leave an unreferenced record, and successful evidence records consume
  repository space.
- Local schema/digest checks detect drift but do not authenticate authors or freeze target code
  after verification.

Mitigation: use explicit paths, atomic publication, exact byte and design fingerprints, and
rerun full verification after code or design changes. Unreferenced records may be removed
before retry because the manifest has not granted them authority.

## Consequences

The CLI and library gain narrow record-path options rather than a database or orchestration
surface. Exit 0 still means verification passed or advancement committed; valid ineligible
evidence blocks with exit 1, while invocation, containment, schema-loading, and atomic-write
failures use exit 2. Reconsider storage and authentication only when measured multi-writer,
remote-review, signing, retention, or record-volume needs exceed a single local descriptor.
