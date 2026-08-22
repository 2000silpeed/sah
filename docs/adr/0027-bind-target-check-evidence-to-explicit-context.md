# ADR-0027: Bind Target-Check Evidence to Explicit Execution Context

- Status: accepted
- Date: 2026-08-22
- Owners: SAH product and architecture authority

## Context

Target tests and smoke checks can pass while the generic verification runtime reports
`incomplete` because it cannot observe target execution. The iteration loop already emits a
schema-valid `iteration-outcome` with the check ID, exact command and cwd, timestamps, exit code,
stdout/stderr digests, target revision, and design fingerprint. Re-running a caller-supplied
command inside `verify` would expand authority and make the verification command an execution
orchestration service.

## Decision

Add the deterministic `target-check-evidence` adapter. `sah verify` accepts
`--check-record <target-relative-json>` and requires `--target-revision` with it; the library
accepts the same explicit options. The adapter reads one confined, non-symlink regular
`iteration-outcome/v0.4.0` file emitted by `sah loop-checks` and never executes its command.

The Architecture observable vocabulary explicitly adds `factSource=iteration-check-record`.
The supported tuple is `predicate=required-check-passed`, `expected=true`, and `selector=<check-id>`.
A pass requires the unique selected result to be `passed` with exit code `0`, the outcome executor
to be `sah-loop-checks`, the outcome target revision and design fingerprint to match the explicit
verification context, and the outcome/check cwd to resolve to the explicit target. Failed checks
are violations; unknown, duplicate, incomplete, stale, or mismatched evidence is unsupported and
therefore incomplete. Malformed, unsafe, missing, or unreadable records are operational errors.

The extension is additive: no existing bundle, manifest, architecture artifact, or lifecycle
stage is rewritten. The adapter checks the schema-valid outcome and its execution envelope; it
does not prove that a test is adequate, non-trivial, or semantically sufficient, and it does not
reconstruct the original loop declaration. `loop-record` remains the separate loop-to-outcome
validation gate, while S11/Checker judgment owns adequacy.

## Alternatives considered

1. Execute arbitrary shell commands from `verify`. Rejected because it broadens a read-only
   verification boundary, duplicates `loop-checks`, and creates command/cwd security concerns.
2. Treat any caller-authored test result as a pass. Rejected because it cannot establish the
   runner, context, command envelope, or exit status and would turn unsupported evidence into a
   false deterministic result.
3. Discover the target revision from Git. Rejected because SAH deliberately treats revision
   tokens as caller-owned context and does not inspect ambient repository state.
4. Add a hosted evidence service. Deferred because local schema-valid outcomes and explicit
   target confinement satisfy the current scale and collaboration boundary.

## Costs and consequences

- Callers must preserve the outcome under the target root and supply the exact target revision;
  the adapter cannot infer either value.
- A full verification record can now contain a deterministic target-check result, but the result
  still does not establish test adequacy or user-level behavior coverage.
- A missing loop declaration cannot be reconstructed from an outcome alone; callers should use
  `loop-record` when they need the loop's declaration and append-only validation.
- The architecture fact-source vocabulary grows and must remain explicitly documented; an
  incompatible observable shape will require a versioned schema/migration rather than a silent
  conversion.

These costs preserve a local read-only verifier, exact context binding, existing adapter behavior,
and the distinction between deterministic execution facts and judgment about test meaning.

## Consequences and review triggers

Existing filesystem and TypeScript adapters, verification result statuses, verification-record
publication, and S13 eligibility remain unchanged. Revisit this decision when a target needs a
different evidence producer, cryptographic command attestation, richer loop declaration binding,
stable check IDs, or a measured need for remote evidence storage.
