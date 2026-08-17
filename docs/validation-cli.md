# Validation CLI and Library

This document owns the public usage, result envelope, and exit-code contract for the first
executable Model Repository slice. Schema semantics and stage gates remain authoritative in
the linked model documents.

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
```

From this source checkout, use the package binary without global installation:

```text
npm exec -- sah validate fixtures/simple-crud
npm exec -- sah validate fixtures/simple-crud --json
```

Default output is human-readable. `--json` writes one `ValidationResult` object and no prose.
Both formats preserve stable code, category, severity, artifact path, JSON Pointer, reference,
message, expected condition, repair, and owning stage when applicable. Malformed JSON also
reports a one-based source line and column when the runtime supplies an error offset.

| Exit | Meaning |
|---:|---|
| 0 | Inputs loaded and no error-severity validation issue exists. Assisted warnings may remain. |
| 1 | The bundle loaded as valid input but schema, reference, or applicable stage rules failed. |
| 2 | Invocation, manifest, path confinement, reading, parsing, or installed schema configuration failed. |

The root [manifest schema](../schemas/design-bundle-manifest.schema.json) defines lifecycle and
artifact descriptors. ADR-0006 explains why this metadata is outside semantic IR. Declared
artifact paths use forward-slash relative paths, and physical targets—including symlinks—must
remain inside the bundle.

## Library

The package exports the framework-neutral function and result types:

```ts
import { validateBundle, type ValidationResult } from "software-architect-harness";

const validation: ValidationResult = await validateBundle("design/equipment");
```

`status` is `passed`, `violations`, or `operational-error`; `summary` counts errors and
warnings. Expected operational failures are returned in the same result envelope rather than
thrown. Public declarations contain no Ajv error or validator type.

The library applies all gates through `sah.bundle.json.lifecycle.completedStage`; callers
cannot override stage/profile and create a different interpretation of the same checked-in
bundle. It validates declarations only—Run 2 does not execute code-fact adapters, LLM review,
or compiled target-code constraints.
