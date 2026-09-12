# Run 39 — Remove the remaining Vitest security advisory

## Compiled objective

Upgrade the development test runner to a patched compatible release, preserve all existing
tests and product contracts, and verify that the complete dependency audit is clean. The user
explicitly requested resolving Run 38's remaining Vitest warnings; continue the authorized
commit/push workflow after verification.

## Authority and scope

`package.json`/`package-lock.json` own the toolchain and resolved dependency graph;
`docs/validation-cli.md` and `AGENTS.md` own verification. Run 38 is complete and published as
`4529f6f`. This is maintenance within the existing test-infrastructure boundary; no semantic
IR IDs, S0–S13 gates, product API, fixture, or benchmark expectation changes are needed.
Preserve `SAH_FUTURE_PROOF_EVOLUTION_DESIGN.md` as untracked user work.

## Evidence and decision

The problem is an unsupported development dependency with two audit entries for one advisory,
not missing application behavior. Test infrastructure owns test execution and must retain
the existing 362 test cases, assertions, isolation, and normal exit semantics. Use the existing
runner and package-management boundary with the smallest patched major upgrade.

The [maintainer advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)
identifies Vitest/mocker 4.1.11 as fixed and says 3.x will not receive the patch. Registry
metadata confirms 4.1.11 supports Node 20/22/24+ and the installed Vite 7.3.6; the local runtime
is Node 24.14.1. Select the patched 4.x range (`^4.1.11`). Keeping 3.x cannot remove the finding.
Vitest 5.0 is also patched, but adds a Node 22.12 minimum and changed defaults without being
necessary for this repair. Review the [official migration guide](https://v4.vitest.dev/guide/migration)
against the actual imports, one explicit filesystem mock factory, and CLI test usage.

Costs: the lockfile changes the development dependency graph, and a major runner update can
change mock or test-discovery behavior. Mitigate with unchanged focused mocking/schema tests,
all 362 existing tests, static checks, production build, and a fresh full npm audit. Revisit
the selected major if a later advisory or required runtime support makes 4.x insufficient.
Do not silence the audit, override only the mocker beneath an incompatible runner, weaken
assertions, or run `npm audit fix --force` blindly. No new direct dependency or abstraction.
Five files are expected for packages, plan, and mandatory indexes; the user was informed.

## Milestones

| Step | Status |
| --- | --- |
| Inspect current authority, usage, advisory, and compatibility | complete |
| Upgrade and run focused compatibility checks | complete |
| Run full checks, audit, and review | complete |
| Record the reviewed milestone for authorized commit/push | complete |

## Verification and discoveries

- Baseline: Vitest/mocker 3.2.7, Node 24.14.1, npm 11.11.0, Vite 7.3.6; previous complete
  suite 362/362. No custom Vitest configuration, browser mode, coverage integration, or pool
  configuration is present. Only the schema-cache test uses `vi.hoisted`/`vi.mock`/`vi.fn`.
- Source checkout checks: `npm run format:check`, `npm run lint`, `npm run typecheck`,
  `npm test`, `npm run build`, `npm audit --json`, document links/budgets, and `git diff --check`.
  The unchanged HTTP smoke test requires local loopback capability outside the sandbox.
- Installed Vitest and `@vitest/mocker` 4.1.11 together. The compatible transitive graph now
  resolves Vite 8.3.0, replacing `vite-node` and the old bundler dependencies. All changed
  resolved package versions are development-only; production dependency versions are unchanged.
  Vite's Node requirement remains `^20.19.0 || >=22.12.0`, identical to the previous Vite 7.3.6.
- Focused compatibility: `npm exec -- vitest run test/schema-cache.test.ts
  test/schema-contracts.test.ts` passed both files and all 9 unchanged tests.
- Full verification on 2026-09-12: `npm run format:check`, `npm run lint`,
  `npm run typecheck`, `npm test`, and `npm run build` all passed. Vitest discovered the same
  24 test files and passed all 362 unchanged tests in 25.93 seconds. No configuration changes,
  test exclusions, assertion edits, or new tests were necessary for compatibility.
- Independent `npm audit --json --fetch-retries=0 --fetch-timeout=15000` exited 0 and reported
  an empty vulnerability map: info/low/moderate/high/critical/total all zero. The two moderate
  audit entries are removed. This check includes development dependencies.
- Review confirms five changed files, no production dependency version changes, intact
  document budgets and local links, and a clean `git diff --check`. The user's untracked design
  document retains its original SHA-256
  `8d7f120905f1fffce7e4b1a34129ae048858fb26dc4db1e4924777c822eab57d`.
- The reviewed milestone is ready for the already-authorized commit and push. Repository
  commit/remote refs and the execution report provide publication evidence.

## Completion boundary

Complete only after the patched runner and mocker are resolved, npm audit reports zero known
vulnerabilities, every existing test passes, and the reviewed change is committed and pushed.
The audit is a point-in-time advisory check, not a proof that the software has no vulnerabilities.
This maintenance makes no new architectural S13 or semantic-judgment claim.
