# Run 38 — Lower context cost and consistent continuation

## Compiled objective

Refactor SAH's existing local toolkit to reduce redundant agent context and validation work
while preserving complete evidence, public JSON contracts, and deterministic continuation.
Deliver working code, focused regression tests, measured before/after observations, full local
checks, and a reviewed commit. The user's September 12 request authorizes reversible refactoring.

## Authority, scope, and stage

`docs/harness-architecture.md`, `docs/validation-cli.md`, `docs/session-resume.md`, the skill,
and accepted ADR-0001/0005/0016/0017 own the affected boundaries. Run 37 is complete. This is
maintenance of those accepted responsibilities, with no target `.sah` bundle or S13 claim.
No semantic IR IDs, accepted decisions, benchmark expectations, or lifecycle gates are changed.
Preserve the untracked `SAH_FUTURE_PROOF_EVOLUTION_DESIGN.md` byte for byte; do not stage it.
No new dependencies, remote services, paid models, push, or implicit authority expansion.
The installed audit permits narrowly scoped compatible transitive security patches; no major upgrade.

## Characterization and design

| Problem region and evidence | Strategy, owner, invariant, and seam |
| --- | --- |
| Agent entry repeats implementation and lifecycle instructions; the plan entry is 400 lines of completed history | Progressive retrieval in the existing skill/index. The skill selects the route; linked references retain full gates. Canonical authority and source provenance remain available. |
| Every bundle read recompiles all installed schemas; `current` must independently revalidate snapshots | Reuse deterministic compiled predicates only for identical, freshly read schema content. Schema adapter owns the cache. Bundle reads, failures, fingerprints, and diagnostics remain fresh. |
| Resume drops non-blocking diagnostics and uses storage order as dependency order | Pure projection from validated handoff facts in the Model Repository. Preserve warnings and emit a stable topological order; reject invalid bundles before projection. |
| Lineage diagnostics sort a directed cycle into a disconnected path; current projection rebuilds an unchanged set for each pair | Preserve directed order when canonicalizing cycles; compute the resolved-pair union once. Projection adapters retain their existing ownership and result contracts. |
| CLI repeats serialization and pretty-prints every machine result | One private serializer with opt-in `--json=compact`; presentation owns whitespace only. Preserve every field, diagnostic, Unicode string, record, and exit status. |

Keep the modular local toolkit. Additional agents, services, a context database, automatic
semantic summarization, or a new architecture IR would add authority and maintenance costs
without solving these observations. Manual reminders alone cannot enforce output equivalence,
cache freshness, or dependency correctness. Costs of the selected approach: a bounded cache
retains compiled validators in memory; schema bytes must still be read; progressive retrieval
requires occasional extra file reads; compact JSON is less convenient for human inspection.
Revisit the cache if retained memory or fresh-read cost outweighs compilation savings, and
revisit the entry budget if a real task loses a necessary gate.

## Measurable quality scenarios

- Repeated and concurrent validation against identical schema bytes reuses compiled predicates;
  changed, unreadable, or invalid installed schemas never reuse a stale passing result.
- Parsed compact output equals ordinary JSON, including non-passing evidence and exit codes.
- Every resume dependency precedes its dependent, stable input yields stable output, and assisted
  warnings match validation. Unknown or invalid evidence remains non-passing.
- The skill entry and active-plan index shrink without deleting authoritative history or gates.
  Measure bytes and lines; do not equate byte savings with measured model-token or quality gains.
- Full tests include benchmark isolation and scoring contracts with unchanged expectations.

## Milestones

| Step | Status |
| --- | --- |
| Inspect authority, current research, baseline, and independent runtime audit | complete |
| Refactor schema reuse, resume/projection diagnostics, and CLI serialization | complete |
| Route skill context progressively and preserve plan history | complete |
| Run focused regressions, full checks, output comparison, and review | complete |
| Record measured evidence and review the milestone | complete |

## Sources checked September 12, 2026

- [Anthropic context engineering, September 2025](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents):
  informs selective retrieval and preserving useful evidence with a smaller context surface.
- [Thoughtworks enterprise architecture playbook, 2025](https://www.thoughtworks.com/content/dam/thoughtworks/documents/report/thoughtworks-enterprise-architecture-playbook.pdf):
  informs testable architecture hypotheses and a bounded set of quality checks.

These sources guide the implementation choice; they do not prove SAH output quality or prescribe
a universally superior architecture style. Local contracts and measured regressions remain the
acceptance evidence.

## Discovery and verification log

- Baseline: skill 13,736 bytes/236 lines; plan index 23,671 bytes/400 lines. Three same-process
  observations: validate 116/80/59 ms; resume 64/58/59 ms; current 242/215/222 ms. Small local
  observations are not a general latency benchmark. The reproducible comparison is recorded below.
- Independent read-only audit confirms repeated schema compilation; retain `current`'s second
  load because its fingerprint comparison detects changes. Its 17 focused baseline tests pass.
- Directed-cycle diagnostic order and invariant set construction are additional concrete projection
  defects from the independent audit; repair within the same owners without changing contracts.
- First focused run: 90/91 pass. The loop-checks CLI test ran the repository linter and failed
  on three redundant tuple guards in the new cache test. Repair the test guards without changing
  product checks or their expectations; rerun the affected check before final verification.
- Projection regression pass: 14/14 tests. The follow-up lint run found a redundant undefined
  fallback in cycle rotation; use a linear smallest-node rotation to preserve directed order
  and avoid allocating every candidate rotation.
- `npm install` completed; `npm audit --json` reported existing `fast-uri`/`js-yaml` high
  advisories and Vitest/mocker moderate advisories. Apply only compatible transitive patches
  to the two high findings; preserve the test-runner major version and document residual scope.
- The first update stalled; retrying with bounded fetch settings exposed sandbox DNS failure
  (`ENOTFOUND registry.npmjs.org`). The scoped elevated retry succeeded: `fast-uri` 3.1.5 →
  3.1.7 and `js-yaml` 4.3.1 → 4.3.2; only the lockfile changed, with no new dependency.
  Two moderate audit entries remain for Vitest/mocker under one
  [advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9).
  Its suggested repair changes the test-runner major version and is outside this refactor.
- After fixes, lint and the two previously affected focused cases pass. Final format, lint,
  and strict typecheck pass. Independent read-only review found no actionable regressions;
  this is contextual review, separate from executable evidence.
- First full suite: 361/362 passed; the HTTP fixture could not start. An isolated loopback
  bind reproduces `EPERM listen ... 127.0.0.1`, identifying sandbox capability failure. Rerun
  the unchanged full suite with the required local-network permission; do not skip the test.
- Final elevated `npm test`: 24 files and 362/362 tests pass, including the HTTP-to-S13
  smoke path, all schema examples/traces, benchmark contracts, and every new regression.
  The final independent `npm run build` also passes. `npm run format:check`, `npm run lint`,
  and `npm run typecheck` all pass; no checks or benchmark expectations were weakened.
- Documentation audit: 127 governed Markdown files, no broken local links or unbalanced fences.
  The unchanged 407-line bootstrap provenance prompt remains the existing line-budget exception;
  all changed documents meet their budgets. Runs 15–20 are preserved exactly apart from the
  necessary relocated link. User-owned future-design bytes and original fixture results match
  their baseline snapshots. `git diff --check` passes.
- Broader file count is necessary for runtime, regression coverage, skill routing, authoritative
  usage, index, and history preservation. The user was informed before implementation.

## Handoff and stop conditions

Continue safe in-scope work through verification. Reopen the affected premise if a change would
drop evidence, trust stale schemas, select a lineage head implicitly, change lifecycle authority,
or require a new dependency. Report operational failures accurately and preserve user work.

## Reproduce context and runtime observations

Baseline checkout: `9b342c4a76191514d22b49d85d3a2cd30bf94b41`. Run the following at each
checkout after `npm run build`, on the same machine with no concurrent test run. The first
validation includes cold compilation; later calls measure reuse in one process. These are
three local observations, not a statistical performance guarantee or a model benchmark.

```sh
node --input-type=module <<'JS'
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { validateBundle, resumeBundle, resolveCurrentArchitecture } from './dist/index.js';
for (const path of ['AGENTS.md', 'skills/sah/SKILL.md', '.agent/PLANS.md']) {
  const raw = await readFile(path);
  console.log({ path, bytes: raw.length, lines: raw.toString().trimEnd().split('\n').length });
}
for (const [name, action] of [
  ['validate', () => validateBundle('fixtures/simple-crud')],
  ['resume', () => resumeBundle('fixtures/simple-crud')],
  ['current', () => resolveCurrentArchitecture('fixtures/bookmark-lineage')],
]) {
  const milliseconds = [];
  let result;
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    result = await action();
    milliseconds.push(Math.round(performance.now() - start));
  }
  console.log({ name, milliseconds, status: result.status,
    prettyBytes: Buffer.byteLength(JSON.stringify(result, null, 2) + '\n'),
    compactBytes: Buffer.byteLength(JSON.stringify(result) + '\n') });
}
JS
```

CLI tests compare parsed full results and exact serialization for successful, unsupported,
malformed-invocation, missing-input, and Unicode-path cases. The original fixture JSON outputs
also compare equal to the baseline snapshot. Byte/line reductions are deterministic measurements;
actual model-token cost and generated-code quality require a controlled future agent A/B run.
No hosted model evaluation was run, and no benchmark expectation was modified.

## Measured result

| Entry | Before bytes / lines | After bytes / lines |
| --- | --- | --- |
| `skills/sah/SKILL.md` | 13,736 / 236 | 8,836 / 120 |
| `.agent/PLANS.md` | 23,671 / 400 | 2,476 / 37 |
| `AGENTS.md` | 12,149 / 193 | 12,149 / 193 |

The skill plus plan entry shrank from 37,407 to 11,312 bytes (about 70%).
Including the unchanged root policy, the three-entry input shrank by about 53%.
History was relocated, not removed; detailed references are loaded by route.

| Operation | Before milliseconds (3 observations) | After milliseconds (3 observations) | Pretty / compact output bytes |
| --- | --- | --- | --- |
| `validate` | 116/80/59 | 118/3/3 | 281 / 224 |
| `resume` | 64/58/59 | 8/3/3 | 664 / 563 |
| `current` | 242/215/222 | 15/10/9 | 1285 / 1037 |

Full JSON values for these three fixtures are unchanged. The cache retains cold compilation
cost (118 ms in the first validation) and still rereads schema files on each call. Compact
output saves about 15–20% of bytes in these examples without dropping any fields.

The refactor is implemented and verified. No target architecture bundle was authored and no
S13 claim is made for SAH itself. Assisted/judgment quality and real model-token billing were
not benchmarked; residual Vitest audit scope is documented above. Commit the reviewed files
without the user-owned future-design document; do not push.
