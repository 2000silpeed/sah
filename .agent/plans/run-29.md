# Run 29 ExecPlan — Sandbox-Safe Local CLI Invocation

## Objective

Implement the smallest non-excluded part of FP-011: make a source checkout's built CLI runnable
directly with Node, without `npm exec`, hidden installation, network access, or HOME/npm-cache
writes for read-only commands.

## Authority and constraints

- `AGENTS.md`, `docs/validation-cli.md`, `docs/harness-architecture.md`, package metadata, and
  the Phase 5 FP-011 proposal remain authoritative.
- This slice does not implement benchmark automation, longitudinal evaluation, run provenance,
  stable trigger IDs, hosted infrastructure, or UI.
- The direct path uses the already-built `dist/cli.js`; it does not change semantic IR, bundle
  lifecycle, result status, or exit-code contracts.
- Tests must use disposable HOME/npm-cache paths, invoke only read-only `validate`, `lineage`,
  and `current`, and prove those paths remain absent or byte-for-byte unchanged.

## Accepted design

Keep the package binary and `npm exec` workflow for installed/source-checkout convenience, while
adding a documented direct source-checkout path:

```text
npm run build
node ./dist/cli.js validate fixtures/simple-crud --json
```

No wrapper is needed because the built CLI already has a Node shebang, resolves schemas relative
to its emitted module, and owns all result/exit presentation. An ADR records why this lower-
ceremony path is preferred over invoking npm or adding another launcher.

## Implementation slices

1. Add a direct-Node CLI regression that runs validate/lineage/current under disposable HOME and
   npm-cache variables and asserts no state is created.
2. Document the command in the validation CLI authority and add ADR-0028 plus index links.
3. Update the ExecPlan, run the full quality suite and docs/link audit, self-review the package
   boundary, and commit only explicit files.

## Acceptance checks

- Direct `node ./dist/cli.js` emits the same schema-tagged read-only results and exit semantics as
  the package command for validate, lineage, and current.
- The direct path creates no HOME/npm-cache/config files and does not require npm/network access.
- Existing `npm exec -- sah` behavior, package metadata, schemas, and lifecycle remain unchanged.
- Tests, build, schema checks, docs links, line budgets, and `git diff --check` pass.

## Verification log

- Focused direct-Node sandbox test plus CLI/schema regressions: 53 tests passed.
- `npm test`: 17 test files and 288 tests passed; `npm run verify:schemas`: 4 schema tests passed.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, and
  `git diff --check`: passed.
- Documentation audit: 104 Markdown files, 102 governed files, no broken local links, and no
  governed document over the 400-line budget.

The user requested continuation and the FP-011 slice is now ready for the authorized commit. No
push or PR was requested or performed.

## Handoff

The direct Node source-checkout path is now documented and regression-tested. Benchmark,
longitudinal evaluation, and run-provenance roadmap items remain intentionally untouched.
