# ADR-0016: Resume sessions from a canonical bundle projection

## Status

Accepted for Run 16.

## Context

Different LLM services and sessions must continue the same SAH run without copying hidden
conversation state. The bundle, its implementation handoff, and lifecycle metadata are already
the local canonical authority. A second authority would create stale or conflicting progress.

## Decision

Add a read-only `sah resume <bundle> [--json]` projection and public `resumeBundle` function. It
validates the bundle first, emits a schema-tagged result with a bundle fingerprint, lifecycle
stage, deterministic slice order, ready/blocked slice IDs, and one model-neutral next action.
Consumers may save the JSON as a session handoff, but must regenerate it after bundle changes.
SAH does not infer implementation completion from Git or target code, and does not coordinate
concurrent writers.

## Alternatives and costs

- A mutable session database would preserve chat notes and execution progress, but adds authority,
  locking, migration, and hosted-coordination costs outside the local toolkit boundary.
- Provider-specific conversation adapters would retain richer context, but split lifecycle
  authority and make Claude/Codex/other services non-interchangeable.
- Manual prompts require no runtime change, but are easy to omit or contradict the canonical
  bundle and cannot provide a stable fingerprint.

The chosen projection costs one extra validation/read per session and cannot know whether a ready
slice was already implemented. The mitigation is explicit fingerprinting, deterministic output,
and requiring S13 full verification to establish completion.

## Consequences and review

The CLI/library boundary and existing exit meanings remain unchanged: ready is 0, blocked is 1,
and operational error is 2. A future durable multi-writer or hosted coordination requirement is
a review trigger for this ADR and ADR-0001; it must introduce an explicitly owned authority rather
than silently extending this projection.
