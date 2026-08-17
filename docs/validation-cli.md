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
```

From this source checkout, use the package binary without global installation:

```text
npm exec -- sah validate fixtures/simple-crud
npm exec -- sah validate fixtures/simple-crud --json
npm exec -- sah advance /path/to/disposable-bundle S11
npm exec -- sah advance /path/to/disposable-bundle S11 --json
```

`advance` mutates a successful bundle, so examples deliberately name a disposable copy rather
than the checked-in fixture. Default output is human-readable. `--json` writes exactly one
`ValidationResult` or `AdvanceResult` and no prose. Both formats preserve stable code,
category, severity, artifact path, JSON Pointer, reference, message, expected condition,
repair, and owning stage when applicable. Malformed JSON also reports a one-based source line
and column when the runtime supplies an error offset.

| Exit | Meaning |
|---:|---|
| 0 | Validation passed, or advancement committed. Assisted warnings may remain. |
| 1 | Valid input has schema/reference/gate errors; advancement is blocked and does not write. |
| 2 | Invocation, transition eligibility, loading, configuration, concurrency, or atomic persistence failed. |

The root [manifest schema](../schemas/design-bundle-manifest.schema.json) defines lifecycle and
artifact descriptors. ADR-0006 explains why this metadata is outside semantic IR. Declared
artifact paths use forward-slash relative paths, and physical targets—including symlinks—must
remain inside the bundle.

The current manifest and Architecture IR schema IDs are v0.2.0; the other five semantic IR
schemas remain v0.1.0. The migration is a deliberate hard cut: a v0.1 manifest or singular
Architecture candidate is an operational schema/declaration failure, not silently rewritten.
ADR-0008 records why a dual representation was rejected.

## Stage advancement

Advancement is forward-only and exactly one stage. The executable target gates are S5, S6,
S7, S8, S9, S10, and S11, so successful transitions can currently be S4→S5, S5→S6, S6→S7,
S7→S8, S8→S9, S9→S10, or S10→S11. An exact-next target without an implemented gate, such as
S11→S12, returns
`ADVANCE_STAGE_UNSUPPORTED` and exit 2. Equal/backward, skipped, and invalid targets are also
operational failures. A warning alone does not block; any error-severity proposed-stage
diagnostic returns `blocked` and exit 1.

At S9, missing or duplicate candidate/must-scenario coverage and premature decision selection
are errors. A `risk`, `fail`, or `unknown` must result is an assisted warning and can advance;
the result alone cannot prove scenario satisfaction or authorized risk acceptance.

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
  type AdvanceResult,
  type ValidationResult,
} from "software-architect-harness";

const validation: ValidationResult = await validateBundle("design/equipment");
const advancement: AdvanceResult = await advanceBundle("design/equipment", "S11");
```

Validation `status` is `passed`, `violations`, or `operational-error`. Advancement `status` is
`advanced`, `blocked`, or `operational-error`, and its bundle metadata reports previous,
target, and actually completed stage. `summary` counts errors and warnings. Expected failures
are returned rather than thrown. Public declarations contain no Ajv or filesystem types.

The library applies all gates through `sah.bundle.json.lifecycle.completedStage`; callers
cannot override stage/profile and create a different interpretation of the same checked-in
bundle. The library validates declarations only—it does not execute code-fact adapters, LLM
review, or compiled target-code constraints.
