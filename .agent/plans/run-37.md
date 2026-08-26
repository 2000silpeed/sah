# Run 37 ExecPlan — Human disposition for contextual verification

## Compiled objective

Add a bounded SAH evidence path that lets an explicitly identified authority record an
assisted or judgment constraint disposition for one S12 bundle and target revision, so a
full verification can complete S13 without relabeling contextual evidence as deterministic.
Deliver the schema, public validator, verification adapter, CLI, S13 gate, tests, documentation,
and the ARN M-008 adoption evidence.

## Scope and exclusions

Included: `review-disposition/v0.1.0`, target/revision/design-fingerprint and S12 bundle binding,
exact constraint trace matching, accepted/rejected/deferred/expired dispositions, evidence and
residual-risk fields, public library and CLI validation, verification integration, S13 eligibility,
contract fixtures/tests, and M-008 re-verification/advancement.

Excluded: changing a constraint's classification, semantic judgment by SAH, identity
authentication or authorization of the named authority, live providers, independent Checker
review, Orca/OpenCode coordination, Git-state discovery, root `.sah` projection repair, and
benchmark expectations.

## Authority and accepted decision

The validation model owns the deterministic/assisted/judgment distinction and the verification
CLI owns evidence and exit semantics. ADR-0035 selects a separate disposition contract: SAH
checks structure, scope, context, exact current constraint references, disposition state, and
expiry. It does not decide whether the cited evidence is substantively adequate or authenticate
the authority. An accepted, unexpired disposition produces a `pass` check with code
`CONSTRAINT_DISPOSITION_ACCEPTED` while retaining `classification: assisted|judgment`; rejected
produces a violation, and deferred or expired produces pending. S13 accepts a full passed record
only when every current assignment has either a deterministic pass or an accepted contextual
disposition.

## Milestones

| Phase | Milestone | Status |
| --- | --- | --- |
| 0 | Reconfirm SAH and ARN authority, evidence, and seam | complete |
| 1 | Record Run 37 and ADR-0035; define contract | complete |
| 2 | Implement schema, types, validator, resolver, CLI, and S13 gate | complete |
| 3 | Add fixtures/tests and update authoritative docs | complete |
| 4 | Run full SAH verification and CLI smoke checks | complete |
| 5 | Adopt the record in ARN M-008, advance S13, review, commit, and push | complete |

## Verification contract

Run from the SAH checkout: `npm install`, `npm run format:check`, `npm run lint`,
`npm run typecheck`, `npm test`, `npm run build`, schema/trace tests, and the documented
disposition CLI/library cases. In ARN, run M-008 focused tests and `bash scripts/verify.sh full`,
then run `sah verify` with the disposition record, `sah advance ... S13 --verification-record`,
and stored-S13 validation. Report deterministic structural results separately from the supplied
authority's contextual judgment.

## Evidence log

- SAH schema, trace, format, lint, typecheck, build, and focused contract checks pass. The final
  `npm test` run passes 23 files and 342 tests. An early full run exposed three existing
  subprocess-heavy tests at Vitest's default 5-second boundary; explicit 15-second test limits
  make the full suite deterministic without changing their behavior.
- ARN `bash scripts/verify.sh full` passes 352 unit, 154 integration, and 3 MCP tests with zero
  doctor, architecture, Python, type, format, or diff failures.
- ARN disposition validation passes for target revision `git:c07d98d` and design fingerprint
  `sha256:e6f35ae7ff560ee88e86daf5d3f1ae65c9632c1f9991ad669a5c2874ae962501`. Full verification
  records 3/3 accepted contextual checks (1 judgment, 2 assisted), and S13 advances atomically;
  five retained S9 assisted warnings remain non-blocking.
- SAH is published at `d93022e` and ARN M-008 is published at `f661d19`; both intended working
  trees are clean apart from the pre-existing user-owned ARN `.claude/` and SAH future-proof design
  document, which were intentionally not staged.

## Handoff and stop conditions

Stop if the contract would require trusting ambient files, inferring Git, authenticating a person,
or turning a contextual claim into a deterministic fact. Keep the SAH source checkout and ARN
target checkout separate; do not stage the user-owned `SAH_FUTURE_PROOF_EVOLUTION_DESIGN.md` or
ARN `.claude/`. The run is complete only after both repositories' intended changes are reviewed,
committed, and pushed with exact verification evidence.
