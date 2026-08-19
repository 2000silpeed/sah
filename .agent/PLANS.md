# SAH ExecPlan

An ExecPlan is a durable handoff: another agent must be able to resume from repository facts
alone. Completed history is preserved in [Runs 1–3](plans/run-1-3.md),
[Runs 4–7](plans/run-4-7.md), [Runs 8–10](plans/run-8-10.md), and
[Runs 11–14](plans/run-11-14.md).

## Planning contract

Every active plan records outcome, included/excluded scope, constraints, milestones, decisions,
discoveries, exact verification, and handoff. Use `pending`, `in_progress`, `blocked`,
`complete`, or `superseded`; normally exactly one milestone is `in_progress`. Update after
progress, failure, discovery, decision, and verification. Preserve history, and supersede when
the outcome changes or more than half of remaining work must be reframed.

## Run 15 ExecPlan — 2026-08-18

### Outcome

A first-time Codex or Claude Code user can clone SAH once, install the portable skill without
separating it from its schemas and CLI, verify discovery, start a natural-language project run,
understand the resulting conversation and artifacts, and recover from common installation errors.

### Scope

Included: current official Codex skill-location verification, Codex user/repository installation,
existing Claude Code installation, safe symlink checks, explicit SAH/target checkout separation,
bilingual README walkthroughs, the detailed agent-skill guide, contract tests, local Codex
installation, removal of the observed untracked recursive symlink, full validation, diff review,
commits, and the explicitly requested push. Excluded: runtime, schema, CLI, library, lifecycle,
exit-code, benchmark, npm publication, plugin packaging, hosted coordination, or model behavior
changes.

### Constraints

- Treat the [Agent Skill guide](../docs/agent-skill.md) as installation authority and keep the
  English and Korean READMEs equivalent beginner-facing entry points.
- Use the official Codex user path `$HOME/.agents/skills` and repository path `.agents/skills`;
  preserve one canonical `skills/sah` package and use symlinks instead of detached copies.
- Never overwrite an existing skill path. Inspect it first, and warn that rerunning `ln -s` against
  a directory symlink can create a nested self-reference.
- Keep every governed document within 400 lines and link the archived Run 11–14 history.
- Preserve all runtime contracts and benchmark expectations. No ADR is needed because this corrects
  reversible installation/documentation details without changing the accepted delivery topology.

### Affected authority and evidence

The earliest invalid premise is the Codex user installation path in `docs/agent-skill.md`; current
official OpenAI documentation names `$HOME/.agents/skills`, repository `.agents/skills`, automatic
change detection, `$`/`/skills` invocation, and symlink support. Affected files are the paired
READMEs, Agent Skill guide, documentation index, and skill contract test. No semantic IR IDs,
architecture decisions, schemas, fixtures, or benchmarks are affected.

### Milestones

| Phase | Milestone                                      | Status      | Evidence |
| ----- | ---------------------------------------------- | ----------- | -------- |
| 0     | Inspect authority, installation, and Git state | complete    | official docs; local paths; clean tracked tree |
| 1     | Record Run 15 and archive completed history    | complete    | this ExecPlan; Runs 11–14 archive |
| 2     | Correct and expand installation/use guidance  | complete    | paired READMEs; guide; contract test |
| 3     | Verify local install, docs, tests, and diff    | complete    | 228 tests; CLI lifecycle; 71-file docs audit |
| 4     | Commit and push the verified milestone        | complete    | `501afff`; `487313a`; public `origin/main` |

### Decision log

- 2026-08-18: Use the current official Codex discovery locations rather than retain the historical
  `~/.codex/skills` example. Keep Claude Code paths separate and labeled.
- 2026-08-18: Put the complete first-run path in both root READMEs and keep troubleshooting detail
  in the indexed Agent Skill guide. Compress lower-priority library prose instead of exceeding the
  document line budget.

### Discovery log

- 2026-08-18: Both READMEs are already 398 lines, so adding onboarding verbatim would violate the
  400-line budget. The existing library example can route to its normative guide without reducing
  the natural-language product walkthrough.
- 2026-08-18: The SAH runtime is built in `/Users/sungwoon/ai-projects/sah`, while the current
  Codex link uses the older `~/.codex/skills` location. No `~/.agents/skills/sah` entry exists.
- 2026-08-18: An untracked `skills/sah/sah` symlink points back to its own parent. This is consistent
  with rerunning `ln -s SOURCE DEST` when `DEST` already resolves to a directory and must not be
  committed.

### Verification log

- 2026-08-18: Read repository policy, documentation index, Run 14 handoff, the complete SAH and
  meta-prompt skill contracts, paired READMEs, Agent Skill guide, package scripts, focused contract
  test, Git state, and current local skill links.
- 2026-08-18: OpenAI Docs confirms standalone skills, explicit `$` or `/skills` invocation,
  automatic change detection with restart fallback, user/repository discovery locations, and
  symlink support.
- 2026-08-18: Removed only the untracked recursive link, created the previously absent
  `~/.agents/skills/sah` link, confirmed it resolves to the canonical package, and validated the
  S12 fixture through the built non-global CLI.
- 2026-08-18: The first full check found only Prettier wrapping in the expanded contract test.
  Formatting that file repaired the finding; the repeated format check passed.
- 2026-08-18: `npm install` audited 164 packages with zero vulnerabilities. Final format, lint,
  strict typecheck, build, 228/228 tests, and the 4/4 schema/trace audit passed.
- 2026-08-18: Production CLI checks passed for human/JSON validation, disposable S11→S12,
  TypeScript full and changed verification, record publication, atomic S12→S13, and stored-S13
  validation. The adapter-less target remained honestly `incomplete` at exit 2.
- 2026-08-18: Audited 71 Markdown files with zero broken local links or unbalanced fences. The
  paired READMEs are 400 lines; all governed files meet budget except the unchanged 407-line
  provenance prompt preserved by policy. `git diff --check` passed, and runtime, schema, fixture,
  benchmark, package, and dependency files have no diff.
- 2026-08-18: Committed planning as `501afff` and the verified installation, bilingual guides,
  resolver rule, and contract coverage as `487313a`; pushed both to public `origin/main`.

### Handoff

Run 15 is complete. Codex uses the official user/repository skill locations, the local user link
resolves to the complete SAH checkout, both host workflows are documented from installation through
S13, and the tested documentation and skill contract are published on `origin/main`.

## Run 16 ExecPlan — 2026-08-18

### Outcome

Different LLM services and sessions can resume a local SAH run from the same canonical bundle via
`sah resume`, with a schema-tagged fingerprint and deterministic next-action projection.

### Scope and constraints

Included: public `resumeBundle`, `sah resume`, resume-result schema, ADR-0016, beginner-facing
session handoff documentation, tests, full verification, and a milestone commit. Excluded:
hosted coordination, a general evidence/session database, concurrent-writer locking, provider-
specific conversation adapters, Git-based implementation inference, and benchmark changes.
Existing lifecycle authority, library/CLI boundary, and exit codes remain unchanged.

### Milestones

| Phase | Milestone | Status |
| --- | --- | --- |
| 0 | Inspect canonical lifecycle and choose projection boundary | complete |
| 1 | Write Run 16 plan and ADR-0016 | complete |
| 2 | Implement schema, library projection, and CLI | complete |
| 3 | Document cross-session workflow and test | complete |
| 4 | Full verification, diff review, and commit | complete |

### Decision and discovery log

- The bundle remains the only authority; the resume JSON is a regenerable view and carries a
  fingerprint so a later session can detect stale output.
- Implementation completion is intentionally not inferred from Git or target code. S13 full
  verification remains the completion proof; durable progress tracking is a future authority
  decision, not hidden state in this slice.

### Verification log and handoff

- Typecheck, build, 228 existing tests, schema-contract tests, and a production `sah resume` run
  passed. The initial `npm test -- --runInBand` attempt was invalid for Vitest and was rerun as
  the supported `npm test` command.
- 229 tests, schema examples/trace audit, format, lint, strict typecheck, build, and
  `git diff --check` passed. Production `sah resume fixtures/simple-crud --json` emitted a
  schema-tagged ready handoff with a sha256 fingerprint. The first unsupported Vitest flag was
  not counted as a product failure; the supported `npm test` command passed.

### Handoff

Run 16 is complete. A later session runs `npm exec -- sah resume <bundle> --json`, checks the
fingerprint, and continues the model-neutral next action. The canonical bundle and S13 evidence
remain authoritative; no push was performed.

## Run 17 ExecPlan — 2026-08-19

### Outcome

Frontier-first SAH treats linting as a first-class, target-owned feedback signal in every coding
loop while preserving the deterministic SAH verification boundary. Agents may run the target's
configured linter early and repeatedly; lint failures block the iteration's completion contract,
but are not misclassified as architecture violations.

### Scope and constraints

Included: frontier-first/linting authority documentation, skill workflow wording, ADR-0017,
focused contract coverage, full validation, and a milestone commit. Excluded: a universal linter
engine, language-specific parser adapters, automatic lint-rule invention, benchmark changes,
hosted coordination, and changes to S13 exit meanings or lifecycle authority.

### Milestones

| Phase | Milestone | Status |
| --- | --- | --- |
| 0 | Inspect current agent loop, target checks, and SAH boundary | complete |
| 1 | Record Run 17 plan and ADR-0017 | complete |
| 2 | Document frontier-first loop and lint contract | complete |
| 3 | Update portable skill and contract tests | complete |
| 4 | Run full verification, review diff, and commit | complete |

### Decision and discovery log

- Linting is a target acceptance check, not a new universal SAH semantic validator. The target
  owns its command, configuration, rule set, and output; SAH owns whether the declared check ran
  and whether its result satisfies the iteration contract.
- Fast-path work may run lint before deep S0–S13 reasoning. Material risks still route to the
  existing reasoning path, and S13 remains the architecture-evidence gate.

### Handoff

Run 17 is complete. The indexed frontier-first/linting guides and ADR-0017 define target-owned
lint evidence, fast-path escalation, and the boundary between target-check failures and SAH
architecture violations. The portable skill and contract tests enforce the workflow.

### Verification log and handoff

- An initial contract assertion failed because Markdown wrapped the phrase across lines; the
  reference wording was repaired and the supported checks were rerun.
- Format, lint, strict typecheck, build, schema audit, `git diff --check`, and all 229 tests passed.
- No runtime CLI, schema, lifecycle, exit-code, benchmark, or target adapter behavior changed.

## Run 18 ExecPlan — 2026-08-19

### Outcome

SAH has an executable iterative product loop: a schema-validated canonical loop artifact routes a
current task to `fast`, `reasoning`, or `blocked`; an atomic outcome record feeds the next task
contract; and a read-only result lets any supported agent/session resume the same loop.

### Scope and constraints

Included: one canonical `sah.loop.json` contract containing direction, risk rules, escalation
triggers, current task/checks, and outcome history; public library operations; `sah loop` and
`sah loop-record`; fast/reasoning/blocked routing; deterministic learning-to-next-task projection;
docs, tests, ADR, and full verification. Excluded: hosted coordination, autonomous product
direction changes, universal lint/test execution, LLM judge behavior, benchmark changes, and
changes to existing S0–S13 lifecycle authority or exit meanings.

### Milestones

| Phase | Milestone | Status |
| --- | --- | --- |
| 0 | Inspect lifecycle, resume, lint, and atomic-write boundaries | complete |
| 1 | Record Run 18 plan and ADR-0018 | complete |
| 2 | Add loop/outcome/result schemas and canonical examples | complete |
| 3 | Implement routing, learning projection, atomic outcome recording, CLI/library | complete |
| 4 | Document fast path, risk escalation, and learning workflow | complete |
| 5 | Tests, full verification, diff review, and commit | complete |

### Decision and discovery log

- Keep loop control separate from the semantic design bundle: the loop selects and records work;
  S0–S13 remains the architecture/evidence authority for material changes and S13 completion.
- Risk rules are explicit canonical inputs. The router is deterministic only after the agent or
  stakeholder declares observable risk signals; it does not infer domain risk from prose.
- Learning produces a proposed next task, never an automatic product-direction mutation. A human
  or authorized owner can accept or edit the proposed contract before execution.

### Handoff

Run 18 is complete. The loop artifact, outcome recording, route projection, and next-task learning
surface are implemented and documented. Next-task output remains a proposed contract; it does not
silently mutate product direction or bypass S0–S13.

### Verification log and handoff

- Schema examples and field traces pass Draft 2020-12 validation; all 234 tests pass, including
  fast-route, escalation, atomic outcome recording, and next-task projection coverage.
- Format, lint, strict typecheck, build, schema audit, production CLI loop/loop-record smoke checks,
  and `git diff --check` passed.
- Existing validate/advance/verify/resume behavior, S13 evidence rules, exit meanings, benchmarks,
  and hosted-coordination exclusions remain unchanged.
- Milestone committed as `23f86e0` (`feat: add executable iteration loop`); no push was performed.

## Run 19 ExecPlan — 2026-08-19

### Compiled task

Goal: make an iteration's successful completion depend on schema-validated evidence produced by
real target-check execution, without replacing the S0–S13 or S13 lifecycle authorities.

Context: the current loop validates `checkId` and `status` but accepts missing required checks and
agent-authored success claims. `docs/linting.md` already requires exact invocation, working
directory, tool context when material, exit code, and an output reference. The loop is the narrow
authority for iteration evidence; design bundles remain the authority for architecture and S13.

Constraints: preserve the public CLI/library boundary, existing validate/advance/verify/resume
semantics, exit-code meanings, atomic loop writes, target-owned commands, and local/model-neutral
operation. Do not infer Git state, add hosted coordination, add a universal linter, invoke an LLM
judge, add release orchestration, or edit benchmark expectations. Keep the runner opt-in and
explicitly scoped to a caller-supplied working directory.

Done when: `loop-checks` executes declared checks and emits a schema-valid outcome with command,
cwd, timestamps, exit code, and stdout/stderr digests; `loop-record` rejects a succeeded claim
with missing, unknown, duplicate, mismatched, or non-passing required evidence; valid failed/partial
outcomes are durably recorded as blocked; valid successful evidence is atomically recorded; focused
and full tests, schema/trace validation, format, lint, typecheck, build, CLI smoke checks, diff
review, and a meaningful milestone commit all pass. No push is performed.

### Scope and constraints

Included: a versioned iteration-outcome evidence contract, the local declared-check runner, strict
required-check/evidence validation, CLI/library exports, fixture and focused tests, loop/linting
documentation, ADR-0019, and full repository verification.

Excluded: automatic next-iteration promotion, product-complete/release states, repository or Git
fingerprints, hosted/multi-writer coordination, provider adapters, telemetry, LLM judges, benchmark
changes, and changes to existing S0–S13 lifecycle or exit-code authority. Those remain separately
scoped follow-up decisions.

### Design decision

Use a new `iteration-outcome` v0.2.0 contract rather than treating optional strings as evidence.
Each check result carries the exact command, explicit cwd, start/end timestamps, exit code (or null
for an incomplete spawn), and sha256 digests of captured stdout/stderr. `sah loop-checks <loop>
--cwd <target>` executes the declared commands sequentially and emits a valid outcome template;
the caller may add learnings before recording it. `loop-record` compares evidence to the current
declared checks and only appends a succeeded outcome when every required check has one matching,
passed result with exit code zero. Failed/partial outcomes remain recordable but leave the current
iteration blocked. The runner never discovers Git state or changes a design bundle.

### Milestones

| Phase | Milestone | Status |
| --- | --- | --- |
| 0 | Inspect loop, lint, schema, atomic-write, and CLI boundaries | complete |
| 1 | Record Run 19 plan and ADR-0019 | complete |
| 2 | Add outcome v0.2 evidence schema, types, and fixture | complete |
| 3 | Implement declared-check runner and strict record gate | complete |
| 4 | Update skill/docs and contract tests | complete |
| 5 | Full verification, diff review, and milestone commit | complete |

### Discovery and verification log

- The previous v0.1 outcome contract allowed an empty `checkResults` array and did not bind a
  result to its declared command. This is the earliest invalid premise for completion claims.
- The runner requires an explicit `--cwd`; it will not infer a target root from the loop path or
  inspect Git state. This preserves SAH's model-neutral, non-Git lifecycle boundary.
- `loop-checks` emits a valid outcome with empty `learnings`; recording a successful iteration
  still requires a bounded learning/next-task proposal under the existing loop contract.
- Format, lint, strict typecheck, build, all 238 tests, schema audit, and `git diff --check` pass.
- Production CLI smoke passed for route evaluation, explicit-cwd check execution, and atomic
  evidence-backed recording on a disposable loop copy. The generated outcome contains the v0.2.0
  schema, executor identity, command/cwd/timestamps, exit code, and stdout/stderr digests.
- Markdown link audit covered 74 files with no missing local links; all governed documents remain
  within the 400-line budget, and `git diff --check` passed.
- Milestone committed as `feat: gate iteration completion on execution evidence`; no push was
  performed. See `git log` for the immutable commit identifier.

### Handoff

After Run 19, a later session can run target checks through SAH, inspect deterministic evidence,
and record only an honestly proven iteration result. Run 20 should address accept/advance, repair,
and product-complete states; it must not be smuggled into this evidence slice.
