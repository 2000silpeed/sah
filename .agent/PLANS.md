# SAH ExecPlans

An ExecPlan is a durable handoff: another agent must be able to resume from repository facts
alone. Completed history is preserved in [Runs 1–3](plans/run-1-3.md) and
[Runs 4–7](plans/run-4-7.md).

## Planning contract

Every active plan records outcome, included/excluded scope, constraints, milestones, decisions,
discoveries, exact verification, and handoff. Use `pending`, `in_progress`, `blocked`,
`complete`, or `superseded`; normally exactly one milestone is `in_progress`. Update after
progress, failure, discovery, decision, and verification. Preserve history, and supersede when
the outcome changes or more than half of remaining work must be reframed.

## Run 8 ExecPlan — 2026-08-17

### Outcome

The canonical simple-crud `equipment-owns-writes` constraint executes against a confined
TypeScript target and explicit source mapping: scoped writers pass, an outside writer violates,
and incomplete or unsafe analysis remains unsupported or operational rather than passing.

### Scope

Included: one non-semantic Draft 2020-12 mapping schema, explicit target-relative mapping
option, TypeScript compiler parsing, confined source enumeration, element/reference checks,
one named-import write-authority predicate, fixture repair, target fixture, library/CLI tests,
authority docs, verification, and commits. Excluded: semantic IR or manifest migration,
tsconfig/path-alias resolution, JavaScript or other languages, general graph/predicate
compilation, exceptions, LLM review, telemetry, code generation, services, benchmark judges,
and S13 lifecycle advancement. Benchmark inputs and expectations remain unchanged.

### Constraints

- Mapping configuration is explicit adapter context, not canonical architecture meaning.
- `verifyBundle` validates the bundle and target before optional mapping preparation.
- Scan every supported TypeScript file under each declared source root; unsupported language,
  syntax, aliasing, re-export, dynamic loading, or symlink forms cannot produce pass.
- Element ownership comes only from declared target-relative path prefixes resolving to real
  Architecture element IDs; ambiguous matches are unsupported.
- Support only source-graph + selector-to-write-target +
  `writers-belong-to-constraint-scope` + expected `true`, dispatched by
  `dependency-and-write analysis`.
- Public types expose no TypeScript compiler, Ajv, or filesystem types; CLI owns no semantics.
- Preserve the Run 7 filesystem adapter and result/exit precedence; never push.

### Milestones

| Phase | Milestone                                               | Status      | Evidence |
| ----- | ------------------------------------------------------- | ----------- | -------- |
| 0     | Frame mapping/parser ownership and exact predicate      | complete    | `18f6e14`, ADR-0011 |
| 1     | Add schema, loader, adapter request, and public options | complete    | strict typecheck |
| 2     | Add TypeScript target fixture and focused library tests | complete    | 30 focused tests |
| 3     | Add CLI mapping flow and production exit evidence       | complete    | 24 CLI tests |
| 4     | Update authority documentation and operating commands   | complete    | CLI/model docs, glossary, index, AGENTS |
| 5     | Run full verification and adversarial diff review       | complete    | 172 tests, CLI 0/1/2, clean audits |

### Decision log

- 2026-08-17: Prefer an explicit target-relative, schema-validated adapter configuration over
  a conventional filename, bundle manifest field, or semantic IR. See ADR-0011.
- 2026-08-17: Prefer the installed TypeScript compiler parser over regex or caller-supplied
  graphs. Move TypeScript to a runtime dependency because production verification imports it.
- 2026-08-17: Enumerate source roots rather than accepting an incomplete source-file list.
  Reject forms whose target resolution or writer identity the bounded adapter cannot prove.
- 2026-08-17: Repair the fixture's S11 observable vocabulary to stable selector
  `equipment-records` and predicate `writers-belong-to-constraint-scope`; retain its accepted
  decision, constraint ID, scope, capability, and backlinks.

### Discovery log

- 2026-08-17: Run 7 ended clean at `feefd83` with 138 tests; the canonical source-graph
  constraint was the only intentionally unsupported ready-slice check.
- 2026-08-17: The current adapter seam receives only an observable. Source authority requires
  constraint scope, so the internal request must add `scopeElementRefs` without changing
  serialized IR.
- 2026-08-17: `.agent/PLANS.md` was 394 lines before Run 8. Runs 4–7 were archived verbatim to
  preserve history and keep the active plan within the 400-line product-document budget.
- 2026-08-17: Adversarial review found that post-enumeration symlink replacement and unresolved
  alias/re-export/dynamic forms could otherwise evade complete analysis. Source reads now
  reconfirm confinement, and every such form produces unsupported coverage.
- 2026-08-17: A second diff audit found namespace re-exports, import assignments, and dynamic
  code evaluation could hide target calls. They now return explicit unsupported checks and
  have focused mutations; no broader symbol resolver was introduced.

### Verification log

- 2026-08-17: Re-read `AGENTS.md`, Run 7 handoff, schema registry, Architecture observable,
  adapter/repository/CLI seams, fixture, tests, package configuration, and ADR-0010.
- 2026-08-17: Initial `git status --short --branch` reported only `## main`.
- 2026-08-17: `npm run format`, `npm run lint`, and `npm run typecheck` passed. Focused
  TypeScript/library and CLI integration execution passed 51/51 tests.
- 2026-08-17: Full pre-documentation execution passed 169/169 tests across nine files; schema
  compilation/example validation and field-trace auditing are included in that suite.
- 2026-08-17: Final Node v24.14.1/npm 11.11.0 loop: `npm install` reported up to date, 164
  packages and zero vulnerabilities; format check, lint, strict typecheck, 172/172 tests,
  production build, and `npm run verify:schemas` (4/4) passed.
- 2026-08-17: Nine Draft 2020-12 schemas and nine embedded examples compiled/validated; 317
  serialized properties passed writer/reader trace audit, and public declarations exposed no
  Ajv, TypeScript compiler, or filesystem implementation types.
- 2026-08-17: Built CLI evidence: canonical TypeScript target passed/human/exit 0; an injected
  unmapped writer returned JSON `CONSTRAINT_VIOLATION`/exit 1; missing mapping returned JSON
  `SOURCE_MAPPING_UNREADABLE`/exit 2.
- 2026-08-17: All 54 Markdown files had resolving local links; changed document budgets were
  below limits; package dry-run included runtime, TypeScript adapter, and all nine schemas;
  benchmark diff was empty; `git diff --check` passed.

### Handoff

Run 8 is complete. The next bounded slice should replace conservative unsupported outcomes for
tsconfig path aliases and re-exports with compiler-program symbol resolution while preserving
explicit mapping, complete-root enumeration, and honest incomplete results for unresolved
dynamic forms. Do not add S13 lifecycle advancement in that slice.

## Run 9 ExecPlan — 2026-08-17

### Outcome

The existing write-authority constraint resolves direct named calls through an explicitly
configured TypeScript project, including `baseUrl`/`paths` imports and finite static named or
star re-export chains. Resolved scoped writers pass, resolved outside writers violate, and
unresolved or unsafe compiler state never passes.

### Scope

Included: a v0.2 source-mapping contract with explicit target-relative `tsconfigPath`, confined
JSONC config loading, TypeScript Program/TypeChecker symbol identity, direct relative/path-alias
named imports, static named/star re-exports, complete declared-root enumeration, focused
library/CLI mutations, authority documentation, verification, and commits. Excluded:
namespace/default imports, import assignments, dynamic loading/evaluation, JavaScript, project
references/config inheritance, general source graphs or predicates, S13 advancement,
exceptions, LLM review, services, and benchmark changes.

### Constraints

- Source roots remain the exhaustive scan boundary; tsconfig `files`/`include`/`exclude` cannot
  silently remove declared source files.
- The mapping names one confined regular tsconfig file; no ambient filename discovery.
- Compiler reads may use TypeScript standard-library declarations, but target implementation
  sources and symbol chains must remain confined and inside declared roots without symlinks.
- Invalid/unreadable/escaping declared config is operational. Unsupported compiler features,
  unresolved/ambiguous symbols, and analysis-undermining diagnostics are incomplete.
- Preserve the exact observable tuple, mapping ownership, result precedence, filesystem
  adapter, public library surface, CLI thinness, and no implementation-type leakage.
- Treat mapping v0.2 as an explicit local contract migration; semantic IR and manifest schemas
  do not change. Never push.

### Milestones

| Phase | Milestone                                              | Status      | Evidence |
| ----- | ------------------------------------------------------ | ----------- | -------- |
| 0     | Frame compiler/config boundary and migration          | in_progress | ADR-0012 |
| 1     | Implement v0.2 mapping and confined Program creation  | pending     | —        |
| 2     | Resolve aliases/re-exports by canonical symbol        | pending     | —        |
| 3     | Add focused library/CLI fixtures and mutations        | pending     | —        |
| 4     | Update authority docs, glossary, index, and commands  | pending     | —        |
| 5     | Run full verification and adversarial diff review    | pending     | —        |

### Decision log

- 2026-08-17: Use TypeScript Program/TypeChecker symbol identity rather than manually
  interpreting `paths` or extending the syntax scanner. See ADR-0012.
- 2026-08-17: Require `tsconfigPath` in mapping v0.2. The explicit hard cut avoids ambient
  discovery and two resolution modes while the package is still pre-1.0.
- 2026-08-17: Ignore tsconfig source-selection fields and use all enumerated mapping roots as
  Program roots. Compiler options influence resolution, not scan completeness.
- 2026-08-17: Support only static named imports and named/star re-export chains. Preserve
  conservative unsupported results for namespace/default and dynamic forms.

### Discovery log

- 2026-08-17: Run 8 ended clean at `d8724f6` with 172 tests. Its syntax scanner deliberately
  rejects every non-relative same-named import and every re-export, even when TypeScript could
  resolve the symbol exactly.
- 2026-08-17: The mapping file already owns roots and target symbols, so tsconfig belongs beside
  that adapter context rather than in `VerificationOptions`, semantic IR, or the manifest.

### Verification log

- 2026-08-17: Re-read `AGENTS.md`, Run 8 handoff, ADR-0011, mapping schema/fixture/tests,
  TypeScript configuration, adapter request, and parser/resolution implementation. Initial
  `git status --short --branch` reported only `## main`.

### Handoff

Run 9 is active. Complete ADR-0012 and planning commit, then migrate the mapping schema and
replace name/specifier inference with confined Program symbol identity without broadening the
observable predicate or lifecycle contract.
