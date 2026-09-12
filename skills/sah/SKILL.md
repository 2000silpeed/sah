---
name: sah
description: Use Software Architect Harness to turn a natural-language software request into evidence-backed architecture, implemented code, tests, and honest verification. Trigger for new software, material features, refactors, migrations, integrations, or architecture decisions in Codex or Claude Code when the agent should inspect the repository, progressively question the user, select fitting methods per subsystem, author SAH design artifacts, implement ready slices, and preserve decisions as code changes.
---

# Software Architect Harness

Use the host agent to reason and implement; use canonical JSON and the local CLI for durable
architecture evidence and deterministic gates. Deliver working, verified software. Do not stop after producing suggestions or JSON when authorized implementation remains.

## Establish authority and runtime

Obey the target's instructions, inspect Git state, and preserve existing work. Distinguish the
**target checkout** (product code and design artifacts) from the **SAH checkout** (this runtime).
Resolve the skill directory through any host symlink. If its physical path ends in `skills/sah`,
the SAH checkout is two parents above it. Confirm `package.json` names
`software-architect-harness` and `schemas/` exists; do not use
`command -v sah` as an installation test. For a detached copy, obtain the checkout path before
claiming validation. Run commands from that checkout with absolute target/bundle paths. Build
with `npm run build` when needed; install with `npm install` only within existing authorization.
Never download software or call a paid model without authorization.

The SAH checkout's `AGENTS.md`, schemas, and linked authority override this condensed guide.
JSON is canonical; Markdown, diagrams, and CLI projections are views. Preserve source prompts
verbatim. Do not infer accepted facts from prose, file dates, names, or conversation memory.

## Select the route before loading references

Read only the current task's authority and the references needed for its route. Reuse inspected
context until its source changes. Keep IDs, paths, fingerprints, unresolved questions, and check
results in the handoff; retrieve details when required. Do not load all history or a whole
schema/guide directory speculatively. Use `--json=compact` for machine results when the installed
CLI supports it; it preserves every field and diagnostic. Existing `--json` remains available.

| Route | Required context and action |
| --- | --- |
| Reversible local change with no invariant, owner/boundary, migration, security/privacy, or external-consistency change | Use the fast feedback loop below; no new design bundle solely for ceremony. |
| New system or changed architectural premise; repeated fast-loop failure | Read [elicitation and method selection](references/elicitation-and-method-selection.md); reason in the order below. |
| Create or change a design bundle | First read [artifacts and lifecycle](references/artifacts-and-lifecycle.md); use stable IDs and normal lifecycle gates. |
| Any product code change or completion claim | First read [implementation and verification](references/implementation-and-verification.md); its S12 precondition applies to full-path work. |
| Task contract requires independent review | Read [Checker review](references/checker-review.md), delegate a read-only independent Checker, and validate its revision-bound record. |
| Review-only request | Inspect and report; mutate code or lifecycle only when requested. |

An existing loop's `sah loop` route and accepted target authority take precedence over an inferred
fast path. A proposed decision blocks its dependent slice. The short architecture profile is
available only when its recorded evidence meets every short-path condition.

## Existing-target current-state preflight

If the target has an explicit `.sah` root, run `sah current <sah-root> --json` before authoring a
new design. Inspect heads, active/superseded decisions, exact open triggers, pending judgments,
and conflicts. Run `sah resume <selected-head-bundle> --json` only after the current result is
ready and head authority is explicit. The skill never selects a head by date, filename, Git
order, or model preference. `ready` means a conflict-free projection, not passed target evidence.
An applicable trigger, stale parent, missing history, or conflicting head reopens reasoning;
create a new evolution snapshot instead of rewriting its parent.

## Fast feedback loop

Inspect → smallest coherent change → target formatter/linter → typecheck → relevant tests/build
→ review the diff. Repair failures, or reopen reasoning if they expose an invalid premise.
Preserve accepted decisions and exact commands/results. A target-check failure blocks completion
but is not automatically an architecture violation. Successful fast-path work is not an S13 claim.

## Full reasoning and implementation

Ask one or two questions at a time, only for consequential facts unavailable from local evidence.
Use each answer to choose the next question. Record unknowns with consequence and resolution
owner; label delegated reversible choices as assumptions with confidence and reversal evidence.
The host model has no independent risk authority. Block only dependent work behind an owned seam;
continue other authorized work. Never choose a consequential unresolved decision silently.

Follow this order: scope/evidence → characterization and measurable quality scenarios → fitting
strategy and simpler alternative → responsibilities/invariants → ownership/collaboration →
boundaries/contracts → representation → architecture candidates and costs → accepted decisions,
observable constraints, and dependency-ordered slices → implementation and verification.
An imposed technology is a hard constraint, not permission to skip ownership reasoning.

For a new bundle use `.sah/design/` unless the target specifies another location. Update the
earliest invalid premise and mark dependent artifacts stale. Validate an existing bundle and
resume at its earliest invalid or incomplete stage. Keep consequential choices proposed until
accepted by the authorized decision owner. Never hand-edit lifecycle to simulate advancement.

A full-path implementation requires valid S12 evidence. Read the selected architecture, accepted
decisions, constraints, and handoff directly from JSON; implement ready slices in dependency
order. Use explicit changed paths for early feedback. Final S13 needs a fresh full verification
record and atomic `S12 -> S13` advance; changed or `full-fallback` evidence is insufficient.
Run target checks as well as SAH checks. Missing adapter coverage stays `unsupported`/`incomplete`;
assisted findings and judgment never become deterministic architectural truth.

## Iteration evidence

When a schema-valid loop exists, `sah loop` routes work to `fast`, `reasoning`, or `blocked`.
Bind explicit revision/fingerprint using `loop-bind`, execute declared checks with `loop-checks
--cwd <target> --target-revision <revision> --design-fingerprint <sha256>`, then `loop-record`
the outcome. `loop-accept-next` creates only the declared next task with its new context;
`--repair` is required from a blocked iteration. Never infer the revision from Git.

For scenario-centered work, declare user-observable `direction.scenarios`, choose the task
`slice`, and name acceptance check IDs. `loop-checks` emits structured slice evidence;
`loop-record` requires passing exit-zero acceptance checks. `loop-complete` requires exact
scenario coverage when declared. The loop selects work; the bundle retains S0–S13 authority.

## Optional bounded continuous mode

Require the user's explicit request and a positive `maxIterations` bound. Repeat only ready,
declared tasks through implementation, checks, recording, and accepting executable learning.
It does not invent a next task or product direction. Stop at the bound, reasoning/blocked route,
failed/partial/incomplete/operational evidence, stale context, missing next-task checks, required
Checker/stakeholder decision, or user acceptance/S13 gate. Do not auto-repair a blocked iteration
or call `loop-complete` automatically. Keep a resumable handoff. The default remains interactive;
existing CLI/library commands, result schemas, and exit codes are unchanged by this mode.

## Completion and handoff

Report implemented behavior, remaining assumptions/decisions, actual checks, and commits/external
actions. Separate target test results, deterministic checks, assisted dispositions, judgment,
and unsupported coverage. State the lifecycle stage and evidence scope reached; do not claim an
unrun check or that a projection proves implementation quality. Keep progress concise and retain
locators for the evidence the next session needs.
