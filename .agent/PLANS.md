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
| 4     | Commit and push the verified milestone        | in_progress | planning commit `501afff` |

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

### Handoff

Run 15 implementation and verification are complete. Commit the reviewed documentation, skill,
test, and evidence changes, push the authorized commits to `origin/main`, confirm synchronization,
and close this plan.
