# Validation CLI and Library

This document owns public usage, result envelopes, transition rules, atomicity, and exit codes
for the executable Model Repository slices. Schema semantics and stage gates remain
authoritative in the linked model documents.

## Install and verify from a source checkout

Node 22 or newer and npm are required. Run these exact commands from the repository root:

```text
npm install
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` builds before running its unit and CLI integration tests. The final standalone
`npm run build` is still required to verify the production output independently.

## CLI

An installed package exposes:

```text
sah validate <design-bundle-directory> [--json]
sah advance <design-bundle-directory> <target-stage> [--verification-record <bundle-relative-record>] [--json]
sah verify <design-bundle-directory> <target-directory> [--mapping <target-relative-mapping-file>] [--changed <target-relative-file>]... [--record <bundle-relative-record>] [--json]
sah loop <sah.loop.json> [--json]
sah loop-bind <sah.loop.json> --target-revision <target-revision> --design-fingerprint <sha256> [--json]
sah loop-checks <sah.loop.json> --cwd <target-directory> --target-revision <target-revision> --design-fingerprint <sha256> [--json]
sah loop-record <sah.loop.json> <iteration-outcome.json> [--json]
sah loop-accept-next <sah.loop.json> --target-revision <target-revision> --design-fingerprint <sha256> [--repair] [--json]
sah loop-complete <sah.loop.json> <iteration-completion.json> [--json]
sah checker-review <checker-review.json> [--target-revision <target-revision>] [--design-fingerprint <sha256>] [--json]
```

From this source checkout, use the package binary without global installation:

```text
npm exec -- sah validate fixtures/simple-crud
npm exec -- sah validate fixtures/simple-crud --json
npm exec -- sah advance /path/to/disposable-bundle S12
npm exec -- sah advance /path/to/disposable-bundle S12 --json
npm exec -- sah verify fixtures/simple-crud fixtures/s13-target
npm exec -- sah verify fixtures/simple-crud fixtures/s13-target --json
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target --mapping sah.source-map.json
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target --mapping sah.source-map.json --json
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target --mapping sah.source-map.json --changed src/equipment-operations/save-equipment.ts --json
npm exec -- sah verify /path/to/disposable-s12-bundle fixtures/s13-typescript-target --mapping sah.source-map.json --record verification-record.json --json
npm exec -- sah advance /path/to/disposable-s12-bundle S13 --verification-record verification-record.json --json
npm exec -- sah loop /path/to/target/.sah/sah.loop.json --json
npm exec -- sah loop-bind /path/to/target/.sah/sah.loop.json --target-revision git:abc123 --design-fingerprint sha256:<64-lowercase-hex> --json
npm exec -- sah loop-checks /path/to/target/.sah/sah.loop.json --cwd /path/to/target --target-revision git:abc123 --design-fingerprint sha256:<64-lowercase-hex> --json
npm exec -- sah loop-record /path/to/target/.sah/sah.loop.json /path/to/target/.sah/outcome.json --json
npm exec -- sah loop-accept-next /path/to/target/.sah/sah.loop.json --target-revision git:def456 --design-fingerprint sha256:<64-lowercase-hex> --json
npm exec -- sah loop-accept-next /path/to/target/.sah/sah.loop.json --repair --target-revision git:def456 --design-fingerprint sha256:<64-lowercase-hex> --json
npm exec -- sah loop-complete /path/to/target/.sah/sah.loop.json /path/to/target/.sah/completion.json --json
npm exec -- sah checker-review /path/to/target/.sah/checker-review.json --json
npm exec -- sah checker-review /path/to/target/.sah/checker-review.json --target-revision git:abc123 --design-fingerprint sha256:<64-lowercase-hex> --json
```

`advance`, `loop-bind`, `loop-record`, `loop-accept-next`, and `loop-complete` mutate their canonical files, so
examples deliberately name a disposable copy or an intended working artifact rather than the
checked-in fixture. `loop-bind` and `loop-accept-next` atomically bind a caller-supplied target
revision and design fingerprint. `loop-checks` is read-only with respect to the loop but executes
the declared target commands in the explicit `--cwd` and emits a schema-valid outcome template.
Context mismatches are deterministic blocked results and do not write files. SAH never infers Git
state or hashes target source trees.
`verify` requires an explicit target checkout and is read-only
unless `--record` requests atomic bundle-local result publication.
`checker-review` is read-only and validates one caller-produced, revision-bound independent
Checker record. It does not run the recorded commands, invoke a reviewer, mutate a loop, or
advance a lifecycle stage. Its `passed` result is limited to a mechanically consistent
`approve` verdict: every listed check must have status `passed` and exit code `0`, and no open
high/medium finding may remain. The verdict is judgment evidence and remains separate from
deterministic architecture validation. When supplied, `--target-revision` and
`--design-fingerprint` are explicit expected context and any mismatch is a non-passing result;
SAH never discovers either value.
Default output is human-readable. `--json` writes exactly one command-specific result (`ValidationResult`,
`AdvanceResult`, `VerificationResult`, `IterationLoopResult`, `CheckerReviewResult`, or a
schema-valid iteration outcome)
and no prose. Validation diagnostics preserve stable
code, category, severity, artifact path, JSON Pointer, reference, message, expected condition,
repair, and owning stage when applicable. Verification checks preserve constraint, decision,
scope elements, invariants, slices, capability, status, expected/observed facts, blockers, and
repair. Malformed JSON also reports a one-based source line and column when the runtime
supplies an error offset.

`--changed` is repeatable and requires `--mapping`. It accepts normalized target-relative file
paths and does not require a path to still exist, so deleted files remain selectable. SAH does
not inspect git state. Unsafe input, an empty library change set, or missing mapping is an
operational failure.

`--record` names a bundle-relative JSON path distinct from the manifest, semantic artifacts,
and any already pinned record. After bundle preparation succeeds, it stores the complete
`VerificationResult`, invocation scope, and design fingerprint even when the result is
violations, incomplete, or operational error; the verification exit code remains governed by
that result. A record publication failure is operational. Publishing a record does not advance
lifecycle. `--verification-record` is valid only for S12→S13 advancement and selects the
previously published evidence.

| Exit | Meaning                                                                                                                      |
| ---: | ---------------------------------------------------------------------------------------------------------------------------- |
|    0 | Validation passed, advancement committed, all selected verification checks passed, or a Checker approval passed its mechanical gate. |
|    1 | Valid input has validation/gate errors, advancement is blocked, target facts violate a deterministic constraint, or a Checker requests changes. |
|    2 | Invocation/operation failed, or verification/review is incomplete because a blocker, unsafe binding, missing evidence, or adapter is pending. |

The loop command maps `fast`/ready, an accepted next iteration, and `complete` to exit 0;
`reasoning`/escalate, blocked transitions, and completion-gate failures to exit 1; and malformed
or inaccessible loop/outcome/completion artifacts to exit 2. `loop-checks` maps all required checks
passing to 0, a completed non-zero check or blocked iteration to 1, and incomplete execution or
operational failure to 2. These additions do not change the existing validation, advancement, or
verification meanings.

The root [manifest schema](../schemas/design-bundle-manifest.schema.json) defines lifecycle and
artifact descriptors. ADR-0006 explains why this metadata is outside semantic IR. Declared
artifact paths use forward-slash relative paths, and physical targets—including symlinks—must
remain inside the bundle.

The current manifest schema is v0.4.0, Architecture IR is v0.2.0, and the other six semantic
IR schemas are v0.1.0. The manifest migration is a deliberate hard cut: v0.3 lacks the exact
S13 verification-record descriptor and is an operational schema/declaration failure, not
silently rewritten. ADR-0014 owns v0.4; ADR-0009 and ADR-0008 own the earlier handoff and
Architecture candidate migrations.

The optional [TypeScript source mapping schema](../schemas/typescript-source-mapping.schema.json)
is v0.2.0 and requires a target-relative `tsconfigPath`. It is explicit target-local adapter
configuration, not an eighth semantic IR or a bundle-manifest artifact. `--mapping` never
discovers a conventional mapping or project filename; both files must be confined regular
files. The v0.1→v0.2 migration is a pre-1.0 hard cut rather than an implicit fallback mode.

The [verification record schema](../schemas/verification-record.schema.json) is v0.1.0 and
references exact [result](../schemas/verification-result.schema.json),
[check](../schemas/verification-check.schema.json), and
[diagnostic](../schemas/verification-diagnostic.schema.json) contracts. These are runtime
evidence schemas, not semantic IR. The manifest pins one record path, schema ID, and SHA-256
digest only when that record authorizes completed S13.

## Continuous verification

`verify` first validates the stored bundle at its declared lifecycle stage. S12 must be
complete because Implementation Handoff supplies constraint-to-slice applicability. A
constraint assigned only to blocked slices is `pending`; assisted and judgment constraints
are also `pending`. A ready deterministic constraint runs only when its declared adapter
capability is available. Missing adapters and unsupported bindings are `unsupported`, never
pass. Any pending or unsupported check makes the overall result `incomplete`; a known
violation takes precedence.

When changed paths are present, the mapping first resolves them to Architecture elements. SAH
selects constraints assigned to S12 slices containing those elements; blocked-only affected
constraints remain pending. Every selected adapter still reads its complete declared evidence
boundary. If any path is outside declared roots, unmapped, or ambiguous, selection becomes
`full-fallback` and all constraints run. The result's optional `selection` reports mode,
requested paths, resolved elements, and stable per-path issues. Because fallback removes the
selection uncertainty by running everything, its final status and exit code come from ordinary
checks rather than from the fallback itself.

Record eligibility uses invocation scope, not executed-check breadth. A run with no
`changedPaths` is `full`. Any run supplied with changed paths is `changed`, including
`full-fallback`, so neither affected nor fallback evidence can complete S13. A full record also
binds exact semantic artifact bytes through a design fingerprint; source mapping and target
paths remain recorded runtime context rather than Architecture meaning.

The first available capability is `filesystem-artifact-presence`, bound only to
`factSource=filesystem`, `predicate=regular-file-exists`, and `expected=true`. Its selector is
a non-empty forward-slash path relative to the explicit target. Missing files and non-file
entries are deterministic violations. Absolute/drive paths, control characters, parent, dot,
empty, and backslash segments, or a symlink that resolves outside the real target root, are
unsafe unsupported bindings.
An absent or unreadable target root and metadata failures are operational errors. File
presence proves only presence—not content, test coverage, or architectural adequacy.

The TypeScript capability is `dependency-and-write analysis`, bound only to
`factSource=source-graph`, `predicate=writers-belong-to-constraint-scope`, and `expected=true`.
The observable selector resolves through the explicit mapping to one directly exported
function or function-valued variable. The adapter enumerates every TypeScript file under all
declared roots and uses those files—not tsconfig selection globs—as TypeScript Program roots.
TypeChecker symbol identity resolves direct relative or configured path-alias named imports,
including import aliases, through finite static named/star re-export chains. Direct calls map
writer paths to Architecture element IDs and compare them with constraint scope. An unmapped
or out-of-scope writer is a violation.

Malformed, schema-invalid, unsafe, dangling, or inaccessible mapping/project configuration is
an operational error. Ambiguous ownership or symbol resolution, missing selector/module/export
coverage, compiler diagnostics, JavaScript, source symlinks, default/namespace imports,
namespace re-exports, dynamic loading/code evaluation, TypeScript import assignments, indirect
function aliasing, config inheritance, project references, compiler plugins, and `rootDirs`
are unsupported and produce `incomplete`, never pass. The adapter reads only target-confined
implementation files plus the TypeScript standard library; target implementation sources
outside declared mapping roots cannot contribute a pass.
Declared compiler paths must be portable target-relative paths and cannot cross symlinks.

The [filesystem target](../fixtures/s13-target/checks/equipment-operations.integration.txt)
supports the first capability. The [TypeScript target mapping](../fixtures/s13-typescript-target/sah.source-map.json)
and [explicit project configuration](../fixtures/s13-typescript-target/tsconfig.json) exercise
the simple-crud write-authority constraint without placing a sample solution under benchmark
data. Omitting `--mapping` from that source-graph example intentionally returns `incomplete`
and exit 2.

## Stage advancement

Advancement is forward-only and exactly one stage. The executable target gates are S5–S13, so
successful transitions currently range from S4→S5 through S12→S13. S13 requires an explicit
bundle-relative verification record; omitting it is operational and exit 2. Equal/backward,
skipped, invalid, and otherwise unsupported targets are also operational failures. A warning
alone does not block; any error-severity proposed-stage diagnostic returns `blocked` and exit 1.

At S9, missing or duplicate candidate/must-scenario coverage and premature decision selection
are errors. A `risk`, `fail`, or `unknown` must result is an assisted warning and can advance;
the result alone cannot prove scenario satisfaction or authorized risk acceptance.

At S12, selected-element, applicable-constraint, decision, blocker, readiness, reference, and
dependency-graph defects are errors. Blocked slices are valid when every blocker is a proposed
decision affecting that slice. The command validates declared checks and plans but does not
execute them.

At S13, the record must be schema-valid, `scope=full`, `status=passed`, free of selection
metadata and non-pass checks, internally summary-consistent, produced from this bundle at S12,
and fingerprinted against the current semantic artifacts. Every constraint assigned by the
current handoff must have exactly one matching deterministic passing check. A valid changed,
stale, violating, incomplete, or operational-error record is a gate defect: advancement is
`blocked` and exit 1. Unsafe, missing, malformed, schema-invalid, digest-mismatched, or
concurrently changed record input is operational and exit 2.

The Model Repository loads one byte snapshot, evaluates schema, references, and applicable
gates as if `targetStage` were completed, and writes only after that result passes. Through S12,
success changes only `sah.bundle.json.lifecycle.completedStage`. S13 additionally writes one
`verificationRecord` descriptor with path, schema ID, and exact byte digest in the same manifest
replacement. Semantic IR files and target code are never written. `validateBundle` remains
read-only and has no stage override; at stored S13 it revalidates the pinned record and design
fingerprint.

The commit path refuses a symlink manifest, creates an exclusive temporary file in the same
directory, writes complete JSON with a trailing newline, preserves mode, flushes and closes,
then compares current manifest bytes with the loaded snapshot. S13 also compares the loaded
record bytes immediately before commit. A mismatch returns `BUNDLE_CHANGED_DURING_ADVANCE` or
`VERIFICATION_RECORD_CHANGED_DURING_ADVANCE`; otherwise rename is the commit point. Owned
temporary files are removed after pre-commit failure. This prevents partial manifest content
and detects ordinary lost updates, but a writer can still race between the final comparisons
and rename; there is no claim of full multi-process serializability, target-code freezing, or
cross-filesystem durability.

## Library

The package exports the framework-neutral function and result types:

```ts
import {
  advanceBundle,
  evaluateIterationLoop,
  bindIterationContext,
  runIterationChecks,
  recordIterationOutcome,
  validateCheckerReview,
  validateBundle,
  verifyBundle,
  type AdvanceOptions,
  type AdvanceResult,
  type ValidationResult,
  type VerificationOptions,
  type VerificationResult,
} from "software-architect-harness";

const validation: ValidationResult = await validateBundle("design/equipment");
const verification: VerificationResult = await verifyBundle(
  "design/equipment",
  "target/equipment",
  {
    sourceMappingPath: "sah.source-map.json",
    verificationRecordPath: "verification-record.json",
  } satisfies VerificationOptions,
);
const advancement: AdvanceResult = await advanceBundle(
  "design/equipment",
  "S13",
  {
    verificationRecordPath: "verification-record.json",
  } satisfies AdvanceOptions,
);
const loop = await evaluateIterationLoop(".sah/sah.loop.json");
const context = {
  targetRevision: "git:abc123",
  designFingerprint: "sha256:<64-lowercase-hex>",
};
await bindIterationContext(".sah/sah.loop.json", context);
const checks = await runIterationChecks(".sah/sah.loop.json", "/absolute/project", context);
const next = await recordIterationOutcome(
  ".sah/sah.loop.json",
  ".sah/iteration-001.outcome.json",
);
const checker = await validateCheckerReview(
  ".sah/checker-review.json",
);
```

Validation `status` is `passed`, `violations`, or `operational-error`. Advancement `status` is
`advanced`, `blocked`, or `operational-error`, and its bundle metadata reports previous,
target, and actually completed stage. `summary` counts errors and warnings. Expected failures
are returned rather than thrown. Verification `status` is `passed`, `violations`,
`incomplete`, or `operational-error`; each check is `pass`, `violation`, `pending`, or
`unsupported`. Its summary counts all four check states plus operational diagnostics. Public
declarations contain no Ajv or filesystem types. Change-scoped results add framework-neutral
`VerificationSelection` metadata; ordinary full verification omits it. `VerificationRecord`
is the schema-matched persisted envelope; callers still receive the ordinary result directly.

`evaluateIterationLoop` reads and validates the separate loop artifact. `recordIterationOutcome`
validates an outcome, rejects duplicate/current-ID mismatches, atomically appends it, and returns
the route plus proposed next task. `bindIterationContext` updates only the explicit revision and
design fingerprint for a planned/in-progress iteration. `runIterationChecks` requires the same
context and a matching target root; outcomes carry that context so stale evidence cannot be
recorded or complete the loop. Loop output is schema-tagged and does not alter design-bundle
lifecycle or S13 evidence.

`validateCheckerReview` reads and validates the independent Checker record without running its
commands or mutating any file. Its `CheckerReviewResult` status is `passed`, `violations`,
`incomplete`, or `operational-error`; it reports the supplied judgment verdict and deterministic
mechanical diagnostics separately.

The library applies all gates through `sah.bundle.json.lifecycle.completedStage`; callers
cannot override stage/profile and create a different interpretation of the same checked-in
bundle. `verifyBundle` executes only the two exact capabilities above. The optional
`VerificationOptions` exposes `sourceMappingPath`, readonly `changedPaths`, and an opt-in
`verificationRecordPath`; `AdvanceOptions` exposes that path only as S13 evidence. Public
declarations contain no Ajv, TypeScript compiler, filesystem, git, or CLI parser types. It does
not run LLM review, infer ownership without configuration, compile general predicates, or
accept non-full evidence as completed S13.
