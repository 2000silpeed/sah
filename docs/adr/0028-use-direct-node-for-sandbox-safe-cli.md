# ADR-0028: Use Direct Node for Sandbox-Safe Source-Checkout CLI

- Status: accepted
- Date: 2026-08-22
- Owners: SAH product and delivery authority

## Context

The package binary is already emitted as `dist/cli.js` with a Node shebang. `npm exec -- sah` is
convenient, but a restricted source checkout may not allow npm cache, user-config, log, install, or
network side effects even for read-only validation. The local CLI must have a path whose authority
is only the built SAH checkout and its explicit input roots.

## Decision

Document and test `node ./dist/cli.js <command>` as the sandbox-safe source-checkout path after
`npm run build`. Keep the package `bin` entry and `npm exec -- sah` workflow unchanged for normal
development and installed-package ergonomics. Read-only `validate`, `lineage`, and `current`
commands must produce the same result and exit semantics through the direct path without creating
HOME, npm-cache, or npm-config state.

No additional launcher is introduced: another wrapper would add a path and argument-forwarding
surface without protecting a responsibility that the compiled CLI does not already own.

## Alternatives considered

1. Require `npm exec` everywhere. Rejected because package-manager behavior is outside the
   read-only CLI authority and can be unavailable or write-prohibited in a sandbox.
2. Add a shell or JavaScript wrapper. Rejected as duplicate launch logic and another executable
   surface; the emitted CLI already has a stable Node entry point.
3. Copy or install a global binary. Rejected because it breaks source-checkout locality and can
   select a different runtime version than the checked-out schemas.

## Costs and consequences

- Callers must run the build first and use the checkout-relative `dist/cli.js` path.
- Direct invocation does not resolve dependencies or build missing output; operational setup
  remains explicit and observable.
- The package binary and npm workflow remain available, so this is an additive delivery path and
  does not change semantic artifacts, lifecycle gates, result schemas, or exit codes.

Revisit this decision if the emitted CLI requires a runtime loader, the package layout changes, or
a sandbox requires a platform-specific launcher.
