# Software Architect Harness (SAH)

[English](README.md) | [한국어](README.ko.md)

SAH is a methodology-neutral design reasoning harness for coding agents. You describe software in
natural language; an installed host skill inspects the repository, asks focused follow-up questions,
records reviewable architecture evidence, implements ready work, and checks selected constraints
against the resulting code.

The short version:

> SAH records why a design was chosen, who owns each rule, what an implementation must do, and
> which of those claims can be verified from observable facts.

SAH is currently a pre-1.0, local-first Agent Skill plus a TypeScript validation kernel. The repository is public, but the npm package is private and runs from a source checkout.

## Why SAH exists

Coding agents can generate working code while still making expensive structural mistakes:

- selecting one methodology for every subsystem;
- creating layers, services, interfaces, or events without evidence;
- losing the reason a boundary or dependency direction exists;
- treating a subjective architecture opinion as a deterministic rule; or
- changing code without knowing which earlier decision must be reconsidered.

SAH puts an evidence trail between requirements and implementation. It does not choose one
universal architecture style. A simple CRUD area can stay simple while a payment, pipeline, or
agentic area uses stronger boundaries when its risks justify them.

Use SAH when a coding agent will make a non-trivial structural change and later agents need to
understand or preserve the decision. For a tiny, reversible, low-risk change, SAH supports a
short profile so the documentation cost stays proportional.

## The mental model

SAH works with four things:

1. **A host Agent Skill** — the conversational workflow used by Codex or Claude Code to ask,
   reason, implement, and verify.
2. **A design bundle** — schema-validated JSON files containing evidence, responsibilities,
   invariants, architecture, decisions, and an implementation handoff.
3. **A target checkout** — the code the host agent changes and checks.
4. **A lifecycle** — stages S0 through S13, with gates that stop invalid evidence from becoming
   accepted progress.

~~~mermaid
flowchart LR
    A[Natural-language request] --> B[Host skill: inspect and ask]
    B --> C0[Reasoning S0-S12]
    C0 --> C[Design bundle and implementation handoff]
    C --> D[sah validate]
    C --> E[Target implementation]
    C --> F[sah verify]
    E --> F
    F --> G[Full verification record]
    G --> H[sah advance to S13]
~~~

The flow is iterative, not a one-way waterfall. If later evidence contradicts an earlier
assumption, SAH reopens the earliest affected stage and marks downstream reasoning stale.

### S0–S13 in five beginner-friendly phases

| Phase | Stages | Main question | Main output |
| --- | --- | --- | --- |
| Understand | S0–S2 | What problem are we solving, and which strategy fits each region? | Characterization and design strategy |
| Assign ownership | S3–S5 | What work and invariants exist, and who owns them? | Responsibilities and invariants |
| Design architecture | S6–S10 | Which boundaries, representations, and candidate best satisfy measured scenarios? | Architecture and accepted decisions |
| Prepare implementation | S11–S12 | Which claims are checkable, and what ordered changes should the coding agent make? | Constraints and implementation handoff |
| Verify continuously | S13 | Does the implementation still satisfy the accepted observable constraints? | Verification evidence and lifecycle completion |

Exact stage inputs, gates, and loop-backs are in the [design reasoning model](docs/design-reasoning-model.md).

## What is inside a design bundle?

The root manifest is named sah.bundle.json. It identifies the bundle, records its completed
stage and profile, and can point to seven semantic IR (intermediate representation) files as
the lifecycle progresses:

| Artifact | What it answers |
| --- | --- |
| System Characterization | What is in scope, what evidence exists, and which quality scenarios matter? |
| Design Strategy | Which strategy fits each problem region, what simpler option was considered, and what would reverse the choice? |
| Responsibility | Which outcomes must happen, why do they change, and who collaborates? |
| Invariant | What must remain true, where, for how long, and how is failure detected or recovered? |
| Architecture | Which elements, boundaries, relations, candidates, and executable constraints exist? |
| Architecture Decision | Which option was accepted, which alternatives were rejected, and what costs or review triggers remain? |
| Implementation Handoff | Which dependency-ordered code slices, checks, migration steps, and rollback steps should an agent execute? |

JSON under [schemas](schemas/) is the machine contract. Markdown and diagrams explain it but do
not replace it. Stable IDs connect evidence → strategy → responsibility/invariant → architecture
→ decision → constraint → implementation slice.

The manifest and verification records are operational metadata, not additional semantic IR.
See the [structured architecture model](docs/architecture-model.md) for the exact ownership.

## What can SAH enforce?

SAH separates claims by how honestly they can be checked:

| Classification | Meaning | Can it hard-fail automatically? |
| --- | --- | --- |
| Deterministic | Complete observable input plus a fixed predicate | Yes, when the required adapter is available |
| Assisted | Facts narrow a contextual review | No; it emits a finding |
| Judgment | A human or LLM applies a rubric with confidence and counter-evidence | No; it remains pending until dispositioned |

A missing adapter is **unsupported**, never a pass. A naming smell, abstraction choice, strategy
fit, or trade-off judgment is not promoted into a deterministic error merely because it is
easy to phrase as a rule.

The current executable adapters check:

- whether a declared target-relative regular file exists; and
- whether direct TypeScript callers of one explicitly mapped write symbol belong to the
  architecture elements allowed by the constraint.

The [validation model](docs/validation-model.md) explains this contract and its current limits.

## Five-minute CLI kernel check

For a real project, install the conversational skill below; this fixture only proves the kernel.

### 1. Clone and install

Requirements: Node.js 22 or newer and npm.

~~~sh
git clone https://github.com/2000silpeed/sah.git
cd sah
npm install
npm run build
~~~

No global installation is required. npm exec uses the binary built from this checkout.

### 2. Validate the example design bundle

~~~sh
npm exec -- sah validate fixtures/simple-crud
~~~

Expected result: `SAH validation passed` for bundle `equipment-register (S12, short)`. This proves
that schemas, references, and stored-stage gates pass; it does not inspect target code.

Add --json when another tool or agent should consume one machine-readable result:

~~~sh
npm exec -- sah validate fixtures/simple-crud --json
~~~

### 3. Verify the example TypeScript target

~~~sh
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target --mapping sah.source-map.json
~~~

Expected result: one passing deterministic check for the equipment-owns-writes constraint.

Here `fixtures/simple-crud` is the design bundle, `fixtures/s13-typescript-target` is the target,
and the target-relative mapping connects source paths/symbols to architecture element IDs.
Verification is read-only unless --record is supplied.

## Complete S13 with recorded full evidence

Advancement mutates sah.bundle.json, so never experiment on the checked-in fixture. Make a
disposable copy:

~~~sh
bundle_root="$(mktemp -d)"
cp -R fixtures/simple-crud "$bundle_root/bundle"

npm exec -- sah verify "$bundle_root/bundle" fixtures/s13-typescript-target --mapping sah.source-map.json --record verification-record.json --json

npm exec -- sah advance "$bundle_root/bundle" S13 --verification-record verification-record.json --json

npm exec -- sah validate "$bundle_root/bundle" --json
~~~

`verify --record` stores the complete result and design fingerprint; `advance` revalidates its
coverage, bytes, and current design before atomically pinning it with S13. Publishing alone never
advances lifecycle. Only a schema-valid **full**, passed, current, completely covered record can.

### Changed-scoped verification is for feedback, not completion

Use --changed to run constraints assigned to slices affected by explicit target-relative paths:

~~~sh
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target --mapping sah.source-map.json --changed src/equipment-operations/save-equipment.ts --json
~~~

SAH does not inspect Git. You must supply every changed path explicitly. If a path is unmapped,
ambiguous, or outside declared roots, selection expands to full-fallback.

Even when every selected check passes—or fallback runs every check—the invocation is still
change-scoped evidence and cannot complete S13. Run a new verification without --changed to
produce eligible completion evidence.

## CLI reference

| Command | Purpose | Writes files? |
| --- | --- | --- |
| sah validate BUNDLE | Validate the stored bundle at its declared lifecycle stage | No |
| sah verify BUNDLE TARGET | Validate the bundle and check target facts | No, unless --record is supplied |
| sah advance BUNDLE STAGE | Validate the exact next gate and update lifecycle atomically | Yes, only after success |

Advancement is forward-only and exactly one stage. The currently executable target gates are
S5 through S13.

Exit codes are stable across the CLI:

| Exit | Meaning |
| ---: | --- |
| 0 | Validation passed, advancement committed, or all selected verification checks passed |
| 1 | Valid input contains validation/gate defects, advancement is blocked, or target facts violate a deterministic constraint |
| 2 | Invocation/operation failed, or verification is incomplete because review, blockers, unsafe binding, or adapter coverage remains pending |

See [Validation CLI and Library](docs/validation-cli.md) for exact syntax, options, result
envelopes, transition rules, path confinement, adapter coverage, and atomicity guarantees.

## Install the conversational skill

The clone built in the five-minute check is the **SAH checkout**. Your application is a separate
**target checkout**. Keep the whole SAH clone: the skill supplies the workflow while `schemas/`
and the built CLI supply deterministic validation. Copying only `skills/sah` disconnects them.

Set its absolute path for the commands below:

~~~sh
SAH_CHECKOUT=/absolute/path/to/sah
~~~

### Codex

For a user skill available in every project, use Codex's documented user location:

~~~sh
mkdir -p ~/.agents/skills
ln -s "$SAH_CHECKOUT/skills/sah" ~/.agents/skills/sah
~~~

For a skill limited to one target, run this inside it; do not commit this machine-local link:

~~~sh
mkdir -p .agents/skills
ln -s "$SAH_CHECKOUT/skills/sah" .agents/skills/sah
~~~

Inspect the destination with `ls -ld` first. If it exists, do not rerun `ln` or overwrite it;
linking to an existing directory link can create an accidental nested self-link. Codex normally
detects changes automatically; restart if needed. Use `/skills` to inspect discovery and `$sah`
to invoke SAH explicitly. These locations and invocation forms follow
[official OpenAI documentation](https://developers.openai.com/codex/skills).

### Claude Code

Use one of the equivalent personal or target-local locations:

~~~sh
# Personal:
mkdir -p ~/.claude/skills
ln -s "$SAH_CHECKOUT/skills/sah" ~/.claude/skills/sah

# Or, from the target checkout:
mkdir -p .claude/skills
ln -s "$SAH_CHECKOUT/skills/sah" .claude/skills/sah
~~~

Invoke it with `/sah` or an ordinary request that explicitly names the `sah` skill.

### Confirm both skill and runtime

For a user-scoped Codex install, `realpath ~/.agents/skills/sah` should print
`$SAH_CHECKOUT/skills/sah`. Then verify the non-global CLI from the SAH checkout:

~~~sh
cd "$SAH_CHECKOUT"
npm exec -- sah validate fixtures/simple-crud
~~~

## Use SAH in a new project

Open the **target checkout** in Codex or Claude Code and state the outcome, repository context,
hard constraints, and what completion means. You do not need to design the JSON or choose an
architecture pattern first. For example:

~~~text
Use $sah to build the reservation feature end to end.

Read this repository, its requirements, tests, and Git state first. Ask me one or two focused
questions whenever an answer could change scope, an invariant, ownership, security, recovery, or
an expensive architecture choice. Do not guess unknown product policy.

Preserve existing public boundaries and do not add hosted services or push without permission.
Finish when ready slices are implemented, target tests pass, full SAH evidence is recorded, the
lifecycle advances as far as that evidence permits, and the final diff is reviewed.
~~~

The host agent will:

1. inspect before asking and continue questioning only while consequential uncertainty remains;
2. characterize problem regions and compare the simplest credible architecture alternatives;
3. write `.sah/design`, validate S0–S12 in order, and keep unresolved decisions proposed;
4. implement only ready, dependency-ordered slices and run the target's own checks;
5. use changed verification for feedback, then fresh full evidence for possible S13 completion;
6. report deterministic results, assisted findings, judgment items, and unsupported coverage
   separately.

If you answer “I don't know,” SAH records the uncertainty and owner. It blocks only dependent work
when a safe owned seam exists. Use the full profile for material architecture work and the short
profile only for reversible, local, low-risk work.

If the agent says the skill has no schemas or CLI, it found a detached copy or failed to resolve
the link. Give it the absolute path explicitly: “The canonical SAH checkout is
`/absolute/path/to/sah`; use its schemas and run `npm exec -- sah` there with absolute target and
bundle paths. Do not download another copy.” See the complete
[Codex and Claude Code guide](docs/agent-skill.md) for updates, removal, and troubleshooting.

The same boundaries are available as `validateBundle`, `verifyBundle`, and `advanceBundle`. The
package is not yet on npm; [Validation CLI and Library](docs/validation-cli.md) owns this contract.

## Reading failures

Start with status, then diagnostic or check code:

- **violations / exit 1** — the input was understood and contradicts a schema, gate, reference,
  or deterministic target fact. Follow expected and repair fields.
- **incomplete / exit 2** — SAH cannot honestly conclude pass or violation because a review,
  blocker, adapter, or source form remains unsupported.
- **operational-error / exit 2** — invocation, path safety, I/O, parsing, or configuration
  failed. Fix the operation before interpreting architecture.
- **blocked / exit 1** — an advance candidate was validly evaluated but its next-stage gate did
  not pass. The manifest remains at its previous stage.

Common beginner mistakes:

- running advance on the checked-in fixture instead of a disposable copy;
- assuming --changed reads Git state;
- treating a changed-scoped pass as S13 completion evidence;
- omitting --mapping for the TypeScript source-graph constraint;
- treating unsupported as pass;
- editing Markdown while leaving canonical JSON contradictory; or
- skipping directly over a lifecycle stage.

## Repository map

- [schemas](schemas/) — canonical JSON IR and verification contracts.
- [skills/sah](skills/sah/) — shared Codex/Claude Code conversation and implementation workflow.
- [src](src/) — CLI/library runtime, gates, atomic manifest update, and fact adapters.
- [test](test/) — schema, stage, CLI, atomicity, and adversarial verification tests.
- [fixtures](fixtures/) — safe executable examples outside benchmark inputs.
- [benchmarks](benchmarks/) — methodology-discrimination cases and hidden expectations.
- [docs](docs/) — product, reasoning, architecture, validation, and ADR authority.
- [.agent/PLANS.md](.agent/PLANS.md) — execution history, discoveries, and verification evidence.
- [AGENTS.md](AGENTS.md) — permanent policy for Codex and other coding agents.
- [CLAUDE.md](CLAUDE.md) — Claude Code entry point importing the same policy.

The bootstrap prompts are preserved provenance inputs. They are not current product authority.

## Develop and verify SAH

Run the complete local quality suite before committing:

~~~sh
npm install
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:schemas
~~~

The current suite covers 228 tests. [AGENTS.md](AGENTS.md) owns the exact executable validation
slice, file discipline, document budgets, and change workflow.

## Current boundaries

SAH is not a universal methodology, its own foundation model or hosted chat service, a source-code
reverse-engineering product, diagram editor, or general project-management system. Product code is
edited by the user's host agent under its existing permissions. SAH does not currently provide:

- hosted coordination;
- a general evidence database;
- automatic Git change discovery;
- general source-graph or predicate evaluation;
- automated LLM/human judgment execution; or
- a published npm package.

Missing capabilities remain explicit backlog or incomplete coverage; they never manufacture a
pass.

## Where to read next

- [Documentation index](docs/index.md) — authoritative owner for every concept.
- [Vision](docs/vision.md) — audience, outcome, success, and non-goals.
- [Design reasoning model](docs/design-reasoning-model.md) — exact S0–S13 contract.
- [Validation CLI and Library](docs/validation-cli.md) — commands, results, exits, and atomicity.
- [Harness architecture](docs/harness-architecture.md) — component boundaries and dependency rules.
- [Dogfood walkthroughs](docs/dogfood.md) — concrete reasoning repairs found by using SAH on itself.
