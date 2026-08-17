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
sah advance <design-bundle-directory> <target-stage> [--json]
sah verify <design-bundle-directory> <target-directory> [--mapping <target-relative-mapping-file>] [--changed <target-relative-file>]... [--json]
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
```

`advance` mutates a successful bundle, so examples deliberately name a disposable copy rather
than the checked-in fixture. `verify` is read-only and requires an explicit target checkout.
Default output is human-readable. `--json` writes exactly one `ValidationResult`,
`AdvanceResult`, or `VerificationResult` and no prose. Validation diagnostics preserve stable
code, category, severity, artifact path, JSON Pointer, reference, message, expected condition,
repair, and owning stage when applicable. Verification checks preserve constraint, decision,
scope elements, invariants, slices, capability, status, expected/observed facts, blockers, and
repair. Malformed JSON also reports a one-based source line and column when the runtime
supplies an error offset.

`--changed` is repeatable and requires `--mapping`. It accepts normalized target-relative file
paths and does not require a path to still exist, so deleted files remain selectable. SAH does
not inspect git state. Unsafe input, an empty library change set, or missing mapping is an
operational failure.

| Exit | Meaning                                                                                                                      |
| ---: | ---------------------------------------------------------------------------------------------------------------------------- |
|    0 | Validation passed, advancement committed, or all selected verification checks passed.                                        |
|    1 | Valid input has validation/gate errors, advancement is blocked, or target facts violate a deterministic constraint.          |
|    2 | Invocation/operation failed, or verification is incomplete because a review, blocker, unsafe binding, or adapter is pending. |

The root [manifest schema](../schemas/design-bundle-manifest.schema.json) defines lifecycle and
artifact descriptors. ADR-0006 explains why this metadata is outside semantic IR. Declared
artifact paths use forward-slash relative paths, and physical targets—including symlinks—must
remain inside the bundle.

The current manifest schema is v0.3.0, Architecture IR is v0.2.0, and the other six semantic
IR schemas are v0.1.0. The manifest migration is a deliberate hard cut: a v0.2 manifest lacks
the canonical Implementation Handoff role and is an operational schema/declaration failure,
not silently rewritten. ADR-0009 owns this migration; ADR-0008 owns the earlier Architecture
candidate migration.

The optional [TypeScript source mapping schema](../schemas/typescript-source-mapping.schema.json)
is v0.2.0 and requires a target-relative `tsconfigPath`. It is explicit target-local adapter
configuration, not an eighth semantic IR or a bundle-manifest artifact. `--mapping` never
discovers a conventional mapping or project filename; both files must be confined regular
files. The v0.1→v0.2 migration is a pre-1.0 hard cut rather than an implicit fallback mode.

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

Advancement is forward-only and exactly one stage. The executable target gates are S5–S12, so
successful transitions currently range from S4→S5 through S11→S12. An exact-next target
without an implemented gate, such as S12→S13, returns `ADVANCE_STAGE_UNSUPPORTED` and exit 2.
Equal/backward, skipped, and invalid targets are also operational failures. A warning alone
does not block; any error-severity proposed-stage diagnostic returns `blocked` and exit 1.

At S9, missing or duplicate candidate/must-scenario coverage and premature decision selection
are errors. A `risk`, `fail`, or `unknown` must result is an assisted warning and can advance;
the result alone cannot prove scenario satisfaction or authorized risk acceptance.

At S12, selected-element, applicable-constraint, decision, blocker, readiness, reference, and
dependency-graph defects are errors. Blocked slices are valid when every blocker is a proposed
decision affecting that slice. The command validates declared checks and plans but does not
execute them.

The Model Repository loads one byte snapshot, evaluates schema, references, and applicable
gates as if `targetStage` were completed, and writes only after that result passes. Success
changes only `sah.bundle.json.lifecycle.completedStage`; semantic IR files are never written.
`validateBundle` remains read-only and has no stage override.

The commit path refuses a symlink manifest, creates an exclusive temporary file in the same
directory, writes complete JSON with a trailing newline, preserves mode, flushes and closes,
then compares current manifest bytes with the loaded snapshot. A mismatch returns
`BUNDLE_CHANGED_DURING_ADVANCE`; otherwise rename is the commit point. Owned temporary files
are removed after pre-commit failure. This prevents partial content and detects ordinary lost
updates, but a writer can still race between the final comparison and rename; there is no
claim of full multi-process serializability or cross-filesystem durability.

## Library

The package exports the framework-neutral function and result types:

```ts
import {
  advanceBundle,
  validateBundle,
  verifyBundle,
  type AdvanceResult,
  type ValidationResult,
  type VerificationOptions,
  type VerificationResult,
} from "software-architect-harness";

const validation: ValidationResult = await validateBundle("design/equipment");
const advancement: AdvanceResult = await advanceBundle(
  "design/equipment",
  "S12",
);
const verification: VerificationResult = await verifyBundle(
  "design/equipment",
  "target/equipment",
  {
    sourceMappingPath: "sah.source-map.json",
    changedPaths: ["src/equipment-operations/save-equipment.ts"],
  } satisfies VerificationOptions,
);
```

Validation `status` is `passed`, `violations`, or `operational-error`. Advancement `status` is
`advanced`, `blocked`, or `operational-error`, and its bundle metadata reports previous,
target, and actually completed stage. `summary` counts errors and warnings. Expected failures
are returned rather than thrown. Verification `status` is `passed`, `violations`,
`incomplete`, or `operational-error`; each check is `pass`, `violation`, `pending`, or
`unsupported`. Its summary counts all four check states plus operational diagnostics. Public
declarations contain no Ajv or filesystem types. Change-scoped results add framework-neutral
`VerificationSelection` metadata; ordinary full verification omits it.

The library applies all gates through `sah.bundle.json.lifecycle.completedStage`; callers
cannot override stage/profile and create a different interpretation of the same checked-in
bundle. `verifyBundle` executes only the two exact capabilities above. The optional
`VerificationOptions` exposes `sourceMappingPath` and readonly `changedPaths`; public
declarations contain no Ajv, TypeScript compiler, filesystem, git, or CLI parser types. It does
not run LLM review, infer ownership without configuration, compile general predicates, or mark
lifecycle S13 complete.
