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
| 0     | Frame compiler/config boundary and migration          | complete    | `e8c1ead`, ADR-0012 |
| 1     | Implement v0.2 mapping and confined Program creation  | complete    | strict typecheck |
| 2     | Resolve aliases/re-exports by canonical symbol        | complete    | focused symbol tests |
| 3     | Add focused library/CLI fixtures and mutations        | complete    | 76 focused tests |
| 4     | Update authority docs, glossary, index, and commands  | complete    | CLI/model docs, glossary, index, AGENTS |
| 5     | Run full verification and adversarial diff review    | complete    | 190 tests, CLI 0/1/2, clean audits |

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
- 2026-08-17: TypeChecker alias canonicalization resolves both configured path aliases and
  static named/star re-exports without teaching SAH TypeScript path semantics. Compiler errors
  are evaluated after the mapped target export so a missing mapped export keeps its precise
  unsupported code while other resolution failures remain incomplete.
- 2026-08-17: Lexical confinement alone is insufficient for explicit compiler paths. Config,
  source roots, source files, and explicit `baseUrl` are also checked for symbolic-link and
  physical-path escape before they can contribute evidence.
- 2026-08-17: Final diff review found that an exact `paths` substitution through a symlink was
  blocked by the compiler host but classified incomplete rather than unsafe configuration.
  Portable-path and existing-prefix symlink checks now reject that declared configuration
  operationally; focused drive-qualified and symlink mutations protect the boundary.

### Verification log

- 2026-08-17: Re-read `AGENTS.md`, Run 8 handoff, ADR-0011, mapping schema/fixture/tests,
  TypeScript configuration, adapter request, and parser/resolution implementation. Initial
  `git status --short --branch` reported only `## main`.
- 2026-08-17: Formatting check, lint, strict typecheck, and 74/74 focused schema, TypeScript
  verification, and CLI tests passed. Mutations cover path aliases, named/star and ambiguous
  re-exports, invalid/unsafe/symlinked config, unsupported inheritance/project references,
  source-root completeness, and JSON exit 0.
- 2026-08-17: Updated the CLI contract, component and IR boundaries, S13 reasoning/validation
  scope, dogfood evidence, glossary, index, operating policy, and ADR-0011 supersession note.
  Mapping v0.2 is documented as a hard cut; semantic IR and manifest schemas remain unchanged.
- 2026-08-17: Post-documentation adversarial review passed 76/76 focused tests after tightening
  declared compiler-path confinement.
- 2026-08-17: Final Node v24.14.1/npm 11.11.0 loop: `npm install` reported 164 packages and
  zero vulnerabilities; format check, lint, strict typecheck, 190/190 tests across nine files,
  production build, and `npm run verify:schemas` (4/4) passed.
- 2026-08-17: Built CLI evidence after the final fix: canonical TypeScript verification passed
  in human and JSON modes/exit 0; an injected alias-based unmapped writer returned
  `CONSTRAINT_VIOLATION`/exit 1; a missing declared tsconfig returned
  `SOURCE_TSCONFIG_UNREADABLE`/exit 2.
- 2026-08-17: Nine Draft 2020-12 schemas and nine embedded examples validated; all 318
  serialized properties passed writer/reader trace audit. Public declarations had zero Ajv,
  TypeScript, or filesystem implementation leaks.
- 2026-08-17: All 55 Markdown files had 128 resolving local links; 30 policy/product documents
  met line budgets; package dry-run contained 66 entries including the adapter and mapping
  schema. Benchmark and canonical simple-crud fixture diffs were empty, only the non-semantic
  mapping schema changed, and `git diff --check` passed.

### Handoff

Run 9 is complete. The next bounded slice should map an explicit changed-file set through the
existing source mapping and execute only affected ready-slice constraints, while preserving
full-root evidence for each selected deterministic check. Do not add a general dependency
compiler or advance the manifest to S13 in that slice.

## Run 10 ExecPlan — 2026-08-17

### Outcome

Callers may provide an explicit target-relative changed-file set. SAH maps complete changes to
Architecture elements, selects constraints through their assigned S12 slices, and still runs
each selected deterministic adapter against its complete declared evidence boundary. Mapping
gaps expand to full verification rather than allowing a skipped constraint to pass.

### Scope

Included: repeatable CLI `--changed`, library `VerificationOptions.changedPaths`, target-local
path validation, source-mapping element resolution, S12 slice intersection, deterministic
selection metadata in human/JSON results, safe full fallback, focused mutations, authority
documentation, verification, and milestone commits. Excluded: git discovery, change-set files,
symbol/diff inference, transitive dependency compilation, persisted results, S13 advancement,
new adapters or dependencies, semantic schema changes, LLM review, and benchmark changes.

### Constraints

- Changed paths are explicit selection hints, not target evidence and not canonical IR.
- A complete changed path maps uniquely through a source-root-contained element prefix. Its
  affected constraints are those assigned to an S12 slice containing that element.
- Deleted paths remain selectable by lexical mapping; no existence check is required.
- Any unmapped, outside-root, or ambiguous path selects full verification and reports a stable
  selection issue. Unsafe/empty inputs and changed paths without a mapping are operational.
- Selected adapters retain their current complete-root behavior. No changed path may narrow a
  TypeScript Program or filesystem observable.
- Preserve unscoped verification behavior, result/exit precedence, CLI thinness, canonical
  schemas, mapping v0.2, and public implementation-type isolation. Never push.

### Milestones

| Phase | Milestone                                               | Status      | Evidence |
| ----- | ------------------------------------------------------- | ----------- | -------- |
| 0     | Frame explicit input, selection, and fallback contract | complete    | `0437633`, ADR-0013 |
| 1     | Add public selection result and source mapping join    | complete    | `c83a520`, strict typecheck |
| 2     | Filter constraints through assigned S12 slices        | complete    | `cb4b774`, focused slice tests |
| 3     | Add library/CLI selection and fallback mutations      | complete    | `c83a520`, CLI/library tests |
| 4     | Update authority docs, index, glossary, and commands  | complete    | `4d70c55`, link audit |
| 5     | Run full verification and adversarial diff review     | complete    | 211 tests, direct exit 0/1/2 evidence |

### Decision log

- 2026-08-17: Prefer repeatable CLI values and a library array over a change-set file or
  ambient git discovery. See ADR-0013.
- 2026-08-17: Use S12 slice element membership, not path convention or a new dependency graph,
  to select constraints after path-to-element resolution.
- 2026-08-17: Fall back to all constraints on any incomplete mapping. This costs work but
  remains sound without adding a new global unsupported-result abstraction.

### Discovery log

- 2026-08-17: Run 9 ended clean at `e7c60d4` with 190 tests. The source adapter already owns
  validated element prefixes, while constraint verification already materializes S12
  assignments; the new slice can join those existing facts without schema migration.
- 2026-08-17: Mapping prefixes are directory prefixes inside declared source roots. They can
  select a deleted file lexically, but write-target modules outside an element prefix correctly
  force full fallback rather than implied ownership.
- 2026-08-17: The existing verification result had no global unsupported-selection envelope.
  Full fallback is both simpler and stronger: selection issues remain explicit metadata while
  ordinary check status and exit precedence continue to describe the complete execution.
- 2026-08-17: Constraint filtering belongs at the S12 slice boundary before assignments are
  aggregated. Intersecting changed elements there keeps blocked-only constraints pending and
  prevents an unrelated ready slice for the same constraint from changing readiness.
- 2026-08-17: Adversarial review exposed that assignment-level filtering could combine a
  selected blocked slice with an unselected ready slice. The regression mutation now proves
  readiness and blocker evidence come only from affected slices while adapters still inspect
  their complete roots.

### Verification log

- 2026-08-17: Re-read `AGENTS.md`, Run 9 handoff, public verification contracts, Model
  Repository dispatch, constraint assignment, TypeScript mapping loader, CLI parsing/output,
  focused tests, and affected authority documents. Initial status was clean `main` at
  `e7c60d4`.
- 2026-08-17: Formatting, lint, strict typecheck, production build, and 118/118 focused
  verification, TypeScript, CLI, and schema tests passed. The initial CLI-only failure used a
  stale `dist/cli.js`; rebuilding before integration execution resolved all five failures
  without a source change.
- 2026-08-17: Mutations prove affected-only constraint selection, full-root evidence after
  selection, deleted-path mapping, blocked pending state, repeatable CLI input, deterministic
  human/JSON metadata, safe full fallback, rogue-writer exit 1, and operational input failures.
- 2026-08-17: Updated the public CLI/library contract, runtime ownership and S13 descriptions,
  validation catalogue, dogfood evidence, glossary, index, and exact AGENTS commands. ADR-0013
  remains the sole authority for input alternatives and fallback costs; schemas are unchanged.
- 2026-08-17: On Node 24.14.1 and npm 11.11.0, `npm install` audited 164 packages with zero
  vulnerabilities. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`, and `npm run verify:schemas` passed; the full suite was 9 files and 211/211
  tests, with the schema-specific run at 4/4.
- 2026-08-17: Direct production CLI runs returned exit 0 for uniquely mapped affected
  verification, exit 1 with `CHANGE_PATH_UNMAPPED` plus `CONSTRAINT_VIOLATION` after safe full
  fallback, and exit 2 with `VERIFICATION_CHANGE_MAPPING_REQUIRED`.
- 2026-08-17: The final audits found 9 schemas, 9 valid embedded examples, 318 serialized
  properties, zero trace/example diagnostics, 59 Markdown files, 133 valid local links, zero
  broken links, and no product-document line-budget failure. Public declarations had no Ajv,
  TypeScript compiler, or filesystem type leak; the 66-entry package included the source
  adapter and mapping schema. `git diff --check` passed, and no benchmark, schema, or fixture
  changed.

### Handoff

Run 10 is complete. The next bounded slice should persist a schema-validated full-verification
record and use it to support atomic S12→S13 advancement. Changed-scoped or incomplete results
must not satisfy that completion gate; do not add hosted coordination or a general evidence
database.
