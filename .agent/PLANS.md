# SAH ExecPlan

An ExecPlan is a durable handoff: another agent must be able to resume from repository facts
alone. Completed history is preserved in [Runs 1–3](plans/run-1-3.md),
[Runs 4–7](plans/run-4-7.md), and [Runs 8–10](plans/run-8-10.md).

## Planning contract

Every active plan records outcome, included/excluded scope, constraints, milestones, decisions,
discoveries, exact verification, and handoff. Use `pending`, `in_progress`, `blocked`,
`complete`, or `superseded`; normally exactly one milestone is `in_progress`. Update after
progress, failure, discovery, decision, and verification. Preserve history, and supersede when
the outcome changes or more than half of remaining work must be reframed.

## Run 11 ExecPlan — 2026-08-18

### Outcome

A caller can persist a schema-validated verification record. An eligible full record is bound
to the current design snapshot and becomes the sole evidence for an atomic S12→S13 manifest
transition; changed-scoped, incomplete, violating, or operational-error records cannot pass.

### Scope

Included: one bundle-local verification-record schema, opt-in CLI/library record persistence,
design and record fingerprints, one exact manifest evidence descriptor, S13 gate evaluation,
atomic descriptor-plus-stage replacement, focused mutations, authority documentation, full
verification, diff review, and commits. Excluded: hosted coordination, a general evidence
database, LLM or human judge execution, exceptions, new fact adapters, benchmark changes, and
semantic IR changes.

### Constraints

- Runtime evidence stays outside the seven semantic IRs; the manifest names exactly one S13
  completion record without becoming a general evidence catalogue.
- `verifyBundle` retains result/status precedence and gains only opt-in bundle-local record
  publication; ordinary verification remains read-only.
- `advanceBundle` keeps exact-next semantics. S13 requires an explicit record path; earlier
  transitions retain their existing call shape and gate behavior.
- Only `scope=full`, `status=passed`, all-pass checks with complete S12 assignment coverage,
  matching bundle metadata, and a current design fingerprint can satisfy the S13 gate.
- Changed-scoped includes affected and full-fallback selection; neither can satisfy completion.
- Malformed, unreadable, unsafe, or concurrently changed evidence is operational. A valid but
  stale or non-passing record is a deterministic S13 gate error and blocks advancement.
- The manifest pins record path, schema ID, and byte digest in the same atomic replacement as
  `completedStage=S13`; semantic artifacts and target code are never written.
- Preserve CLI exit 0/1/2 meanings, public implementation-type isolation, and local-only
  lifecycle authority. Never push.

### Affected authority and evidence

Authoritative documents: `design-reasoning-model.md`, `validation-cli.md`,
`harness-architecture.md`, `architecture-model.md`, and `validation-model.md`. Runtime owners:
Model Repository, verification adapters, atomic manifest replacement, and thin CLI. The fixture
exercise traces `equipment-owns-writes` through decision `choose-equipment-module` and slice
`implement-equipment-operations`; benchmark inputs and expectations remain untouched.

### Milestones

| Phase | Milestone                                              | Status      | Evidence |
| ----- | ------------------------------------------------------ | ----------- | -------- |
| 0     | Frame evidence ownership and atomic completion contract | complete    | ADR-0014 |
| 1     | Add record and manifest schemas plus persistence      | complete    | schema/trace tests |
| 2     | Implement S13 record gate and atomic advance          | complete    | focused gate tests |
| 3     | Add library/CLI and adversarial mutations             | complete    | 106 focused tests |
| 4     | Update authority documentation and operating commands | complete    | authority docs and CLI usage |
| 5     | Run full verification, diff review, and commits       | complete    | 225 tests; `a3152e5` |

### Decision log

- 2026-08-18: Select a dedicated bundle-local record and an exact manifest descriptor over
  embedding results or introducing a general store. See ADR-0014.
- 2026-08-18: Bind eligibility to explicit invocation scope, not selection outcome; a changed
  full-fallback run is still change-scoped evidence.
- 2026-08-18: Pin both the semantic design snapshot and exact record bytes. The manifest commit
  grants lifecycle authority; record publication alone does not.

### Discovery log

- 2026-08-18: Run 10 ended clean at `56c4cab` with 211 tests and intentionally left persisted
  results and S13 advancement unsupported.
- 2026-08-18: Current verification already emits one check per assigned constraint and status
  precedence distinguishes violation, incomplete coverage, and operation failure. The S13 gate
  can validate recorded evidence without rerunning adapters or adding a compiler.
- 2026-08-18: Updating only `completedStage` would leave no durable evidence locator. Adding the
  record descriptor and stage in one manifest replacement preserves manifest authority without
  a multi-file transaction.
- 2026-08-18: A monolithic result schema exceeded the repository line budget. Split the exact
  public envelope into record, result, check, and diagnostic schemas; the record remains the
  sole lifecycle evidence artifact and the split introduces no storage abstraction.
- 2026-08-18: Typed lint rejected both a control-character regex and string spreading in the
  path guard. An indexed UTF-16 code-unit scan now expresses the ASCII control predicate
  without suppressing either rule.

### Verification log

- 2026-08-18: Re-read `AGENTS.md`, `docs/index.md`, the Run 10 handoff, lifecycle/verification
  authorities, schemas, repository/adapter/atomic seams, fixtures, and focused tests. Initial
  status was clean `main` at `56c4cab`.
- 2026-08-18: The first record-schema run exposed one trace omission and two strict-Ajv
  composition errors; all were repaired before runtime work, and 13 schemas/examples now
  compile with complete traces.
- 2026-08-18: After repairing two lint findings, formatting, lint, strict typecheck, and 106/106
  focused schema, manifest-migration, verification, advancement, and CLI tests passed. Mutations
  cover full success, both changed modes, incomplete, violation, operational-error, stale
  design, inconsistent status, byte tampering, and atomic pre-commit evidence conflict.
- 2026-08-18: On Node 24.14.1 and npm 11.11.0, `npm install` audited 164 packages with zero
  vulnerabilities. `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`, and `npm run verify:schemas` passed; the full suite was 9 files and 225/225
  tests, with the schema-specific run at 4/4.
- 2026-08-18: Production CLI runs proved S11→S12 and full-record S12→S13 success at exit 0;
  affected and full-fallback changed records, incomplete records, violation records, and
  operational-error records all left S12 unchanged and returned blocked exit 1. Original
  verification exits remained 0 for pass, 1 for violation, and 2 for incomplete or operation
  failure; stored S13 validation and pinned record digest both passed.
- 2026-08-18: Final audits found 13 schemas, 13 valid examples, 385 serialized properties,
  zero trace diagnostics, 61 Markdown files, 145 valid local links, zero broken links, and no
  product-document line-budget failure. The unchanged 407-line provenance prompt remains
  verbatim by policy. Public declarations had no Ajv, compiler, or filesystem leak; the
  74-entry package contains all four record schemas and the record runtime. `git diff --check`
  passed and benchmark diff was empty.
- 2026-08-18: Planning was committed as `4b46dde`; implementation, tests, schemas, and authority
  documentation were committed as `a3152e5`. No push was performed.

### Handoff

Run 11 is complete. The next run should select a bounded S13 capability or exception-disposition
slice from accepted constraint evidence; do not broaden the record descriptor into hosted
coordination or a general evidence registry without measured multi-writer or retention need.

## Run 12 ExecPlan — 2026-08-18

### Outcome

The repository has a concise root `README.md` that routes users to the executable entry points
and authoritative documents. Confirmed Finder metadata is removed, and the documentation-only
milestone is verified, committed, and published in the public repository.

### Scope

Included: repository inventory, exact removal of ignored `.DS_Store` files, a root README,
documentation-index linkage, full validation, diff review, a meaningful commit, and push.
Excluded: runtime behavior, schemas, fixtures, dependencies, generated build directories,
benchmark content, provenance prompt changes, lifecycle authority, and architecture decisions.

### Constraints

- Delete only files whose generated, ignored, non-product status is observable; do not infer
  that a linked document, fixture, or provenance input is obsolete.
- Keep the README English, under the document line budget, and navigational. Normative details
  remain owned by the linked documentation.
- Preserve CLI/library contracts, exit meanings, lifecycle authority, benchmark expectations,
  and the completed Run 11 evidence.
- Do not invent a Git remote or destination. Push only through an already configured remote or
  an unambiguous repository association discovered read-only.
- No ADR is required because cleanup and navigation are reversible and make no architecture
  decision.

### Milestones

| Phase | Milestone                                      | Status      | Evidence |
| ----- | ---------------------------------------------- | ----------- | -------- |
| 0     | Inventory files, links, package, and Git state | complete    | clean `main`; four ignored `.DS_Store` files |
| 1     | Record cleanup and README plan                 | complete    | this ExecPlan |
| 2     | Remove confirmed metadata and author README   | complete    | four removals; `README.md`; index backlink |
| 3     | Run full validation and adversarial diff review | complete  | 225 tests; CLI and document audits |
| 4     | Commit and push the milestone                 | complete    | `2000silpeed/sah`; local and remote `main` synchronized |

### Decision log

- 2026-08-18: Limit deletion to the four observed `.DS_Store` files. Ignored `dist/` and
  `node_modules/` remain because they are current build and verification inputs, not unexplained
  repository content.
- 2026-08-18: Add one conventional `README.md` as a reader-oriented map; keep definitions and
  contracts in `docs/` rather than restating their authority.

### Discovery log

- 2026-08-18: The initial worktree was clean at `8cb44ce`. No tracked editor backups, logs,
  temporary files, or Finder metadata were found.
- 2026-08-18: Four ignored `.DS_Store` files exist at the repository root and below `fixtures/`.
  The existing `.gitignore` already prevents recurrence in Git.
- 2026-08-18: `main` has no displayed upstream and `git remote -v` returned no configured
  remote. Push must remain pending unless a destination can be resolved without guessing.
- 2026-08-18: The authenticated GitHub account is `2000silpeed`, but repository and code
  searches found no matching SAH remote. The similarly named `design-ontology-harness` has a
  different product description and history, so it is not a safe destination.
- 2026-08-18: The user authorized creating a new public repository. The available conventional
  destination `2000silpeed/sah` resolved the publication blocker without repurposing another
  repository.

### Verification log

- 2026-08-18: Read `AGENTS.md`, `docs/index.md`, the completed Run 11 handoff, `.gitignore`,
  `package.json`, tracked paths, ignored cleanup candidates, branch state, and remote state.
- 2026-08-18: Removed exactly the four observed `.DS_Store` files. Added the root README and
  linked it from the documentation index without changing runtime, schema, fixture, benchmark,
  or provenance content.
- 2026-08-18: `npm install` audited 164 packages with zero vulnerabilities. Formatting, lint,
  strict typecheck, production build, 225/225 tests, and the 4/4 schema/trace audit passed.
- 2026-08-18: CLI validation passed; disposable S11→S12 advancement passed; the filesystem-only
  target returned its expected incomplete/exit-2 result; full and changed TypeScript checks
  passed; and the README's full-record S12→S13 flow advanced and revalidated at exit 0.
- 2026-08-18: Final document audits found 63 Markdown files with zero broken local links,
  all governed documents within line budgets, no remaining `.DS_Store`, no runtime/schema/test/
  fixture/benchmark/provenance diff, and a clean `git diff --check`. Diff review found no
  unsupported README claim or authority duplication.
- 2026-08-18: Planning was committed as `e6f1c24` and the README milestone as `5acb61a`.
  `git push` returned exit 128 with `No configured push destination`; no external state changed.
- 2026-08-18: Created public `https://github.com/2000silpeed/sah`, configured its HTTPS URL as
  `origin`, pushed `main`, and confirmed local and remote at `ec809b6` before this closure update.

### Handoff

Run 12 is complete. The repository cleanup, reader entry point, verification evidence, and
public `main` history are current; no product, benchmark, schema, or provenance content changed.
