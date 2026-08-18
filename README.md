# Software Architect Harness (SAH)

[English](README.md) | [한국어](README.ko.md)

SAH is a methodology-neutral design reasoning harness for coding agents. You describe software in
natural language; an installed host skill inspects the repository, asks focused follow-up questions,
records reviewable architecture evidence, implements ready work, and checks selected constraints
against the resulting code.

The short version:

> SAH records why a design was chosen, who owns each rule, what an implementation must do, and
> which of those claims can be verified from observable facts.

SAH is currently a pre-1.0, local-first Agent Skill plus a TypeScript validation kernel. The
repository is public, but the npm package is private and runs from a source checkout.

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

The exact stage inputs, gates, and loop-backs are defined in the
[design reasoning model](docs/design-reasoning-model.md).

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

The [validation model](docs/validation-model.md) explains the full deterministic/assisted/
judgment contract and current limitations.

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

Expected result:

~~~text
SAH validation passed

Bundle: equipment-register (S12, short)

Summary: 0 error(s), 0 warning(s)
~~~

This proves that the JSON files match their schemas, references resolve, and every gate
required by the manifest's stored S12 lifecycle state passes. It does not inspect target code.

Add --json when another tool or agent should consume one machine-readable result:

~~~sh
npm exec -- sah validate fixtures/simple-crud --json
~~~

### 3. Verify the example TypeScript target

~~~sh
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target --mapping sah.source-map.json
~~~

Expected result: one passing deterministic check for the equipment-owns-writes constraint.

The arguments mean:

- fixtures/simple-crud is the design bundle;
- fixtures/s13-typescript-target is the target checkout;
- sah.source-map.json is relative to the target checkout and maps source paths/symbols to
  architecture element IDs.

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

What happened:

1. verify validated the S12 bundle and ran every assigned constraint;
2. --record atomically stored the complete result and design fingerprint inside the bundle;
3. advance revalidated that record, its coverage, its exact bytes, and the current design;
4. one atomic manifest replacement recorded both completedStage=S13 and the pinned record
   descriptor; and
5. the final validate confirmed the stored S13 state.

Publishing a record alone never advances lifecycle. Only a schema-valid **full** record with a
passed result, complete S12 assignment coverage, all-pass deterministic checks, and a current
design fingerprint can authorize S12→S13.

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

~~~text
sah validate <design-bundle-directory> [--json]
sah advance <design-bundle-directory> <target-stage> [--verification-record <bundle-relative-record>] [--json]
sah verify <design-bundle-directory> <target-directory> [--mapping <target-relative-mapping-file>] [--changed <target-relative-file>]... [--record <bundle-relative-record>] [--json]
~~~

Important options:

| Option | Meaning |
| --- | --- |
| --json | Emit exactly one JSON result and no prose |
| --mapping PATH | Use explicit target-local TypeScript mapping configuration |
| --changed PATH | Select affected constraints from an explicit changed file; repeatable and requires --mapping |
| --record PATH | Store a verification record at a safe bundle-relative JSON path |
| --verification-record PATH | Use that bundle-relative record only for S12→S13 advancement |

Exit codes are stable across the CLI:

| Exit | Meaning |
| ---: | --- |
| 0 | Validation passed, advancement committed, or all selected verification checks passed |
| 1 | Valid input contains validation/gate defects, advancement is blocked, or target facts violate a deterministic constraint |
| 2 | Invocation/operation failed, or verification is incomplete because review, blockers, unsafe binding, or adapter coverage remains pending |

See [Validation CLI and Library](docs/validation-cli.md) for the normative result envelopes,
transition rules, path confinement, adapter coverage, and atomicity guarantees.

## Use SAH with your own project

Install the portable skill using the [Codex and Claude Code guide](docs/agent-skill.md), open your
target repository in the host agent, and start with a natural request such as:

~~~text
Use $sah to build this feature. Inspect the repository first, keep asking me one or two focused
questions when consequential information is missing, then implement and verify the result.
~~~

The agent reads existing evidence before asking. It asks adaptively rather than sending a fixed
questionnaire, records unknowns instead of guessing, selects methods per subsystem, creates
`.sah/design`, implements only ready dependency-ordered slices, runs target tests, and attempts
honest S13 verification. A material unknown blocks only dependent work when an owned seam makes
that safe. The CLI remains usable by itself for manual bundle validation; it does not conduct the
conversation or edit product code.

Use the full profile for material architectural work. The short profile is only for reversible,
local, low-risk work with no critical invariant, distribution, probabilistic autonomy, or
material quality scenario.

## Library integration

The same boundaries are available without the CLI:

~~~ts
import {
  advanceBundle,
  validateBundle,
  verifyBundle,
  type VerificationOptions,
} from "software-architect-harness";

const validation = await validateBundle("design/equipment");

const options = {
  sourceMappingPath: "sah.source-map.json",
  verificationRecordPath: "verification-record.json",
} satisfies VerificationOptions;

const verification = await verifyBundle(
  "design/equipment",
  "target/equipment",
  options,
);

const advancement = await advanceBundle("design/equipment", "S13", {
  verificationRecordPath: "verification-record.json",
});
~~~

Expected failures are returned as typed result statuses rather than thrown. Public contracts do
not expose Ajv, the TypeScript compiler, filesystem, Git, or CLI-parser types. The package is
not yet published to npm, so this example describes the integration surface rather than an
install-from-registry workflow.

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
