# Run 28 ExecPlan — Bookmark HTTP Smoke Fixture

## Objective

Implement the next bounded roadmap slice, FP-007: exercise the target-check evidence bridge with
the bookmark evolution design, a local loopback-only HTTP target, an exact `sah loop-checks`
outcome, the production `sah verify` CLI, and the existing S12→S13 evidence gate.

## Authority and constraints

- `AGENTS.md`, the indexed validation/iteration documents, ADR-0025/0026/0027, the bookmark
  lineage fixture, and the Phase 3 target-check contract remain authoritative.
- Existing canonical bookmark bundles are read-only fixture inputs. Tests use disposable copies
  and must not rewrite the direct-CLI or shared-operations history snapshots.
- The fixture binds only to `127.0.0.1`, exposes bookmark data only, and is stopped in test
  cleanup. It is not a hosted service, remote integration, or generic HTTP adapter.
- The test must obtain evidence from the real `runIterationChecks` and validate it through
  `recordIterationOutcome`, then reuse the exact record through production `sah verify --record`
  before attempting S13. No command is executed by the verification adapter.
- Do not implement benchmark automation, model provenance, stable trigger IDs, hosted storage,
  UI, database behavior, or unrelated HTTP capabilities.

## Accepted design

Add a small target-local Node HTTP fixture with one bookmark endpoint and a smoke script that
checks loopback binding and rejects a non-bookmark surface. The end-to-end test copies the shared
bookmark bundle, binds both current S12 constraints to two exact check IDs, runs the checks from
the disposable target root, records the outcome, verifies through the built CLI, and advances the
disposable bundle to S13 only from the pinned full verification record.

## Implementation slices

1. Add the loopback-only bookmark server and two-mode smoke command under the existing bookmark
   fixture.
2. Add test helpers and an end-to-end regression covering server lifecycle, exact check IDs,
   output evidence, CLI verification, record publication, and S13 advancement.
3. Document the fixture as the FP-007 evidence boundary and link all new files from the index.
4. Run focused/full quality, schema, CLI, path-safety regression, docs, and diff checks; commit
   only the explicit FP-007 files.

## Acceptance checks

- The HTTP server announces a loopback address and the smoke checks pass only for the bookmark
  endpoint and its expected JSON surface.
- `sah loop-checks` produces schema-valid exact command/cwd/status/exit/digest evidence, and
  `loop-record` accepts the outcome against the declared check contracts.
- The production `sah verify --check-record ... --target-revision ... --record ...` passes both
  bound constraints without rerunning the recorded commands.
- S13 advances only from the complete, full, current verification record; canonical history
  fixtures remain byte-for-byte unchanged.
- Existing full quality, schema, documentation, link, line-budget, and diff checks pass.

## Verification log

- Focused `bookmark-http-smoke.test.ts`: 1 test passed; the server syntax checks passed.
- `npm test`: 16 test files and 287 tests passed; `npm run verify:schemas`: 4 schema tests passed.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, and
  `git diff --check`: passed.
- Documentation audit: 102 Markdown files, 100 governed files, no broken local links, and no
  governed document over the 400-line budget.

The user-authorized FP-007 commit will contain only the explicit fixture, test, documentation,
helper, and ExecPlan changes. No push or PR was requested or performed.

## Handoff

FP-007 is complete: a disposable shared-operations bundle reaches S13 only through two exact
loopback bookmark checks and a current full verification record. The next roadmap area is the
separate evaluation/provenance work, which remains outside this slice.
