# Working on SAH

SAH is a methodology-neutral design reasoning harness for coding agents. Read this file before
work. Use [docs/index.md](docs/index.md) to find the authoritative document for each concept
and [.agent/PLANS.md](.agent/PLANS.md) for the active ExecPlan and evidence.

## Default prompt compilation

[CLAUDE.md](CLAUDE.md) imports this policy so Claude Code and Codex receive the same repository
authority without duplicated instructions.

- Before planning or executing a material change, multi-step investigation, or architecture
  decision, invoke the `meta-prompt` skill. Skip it for simple factual/status questions,
  trivial edits, or explicit user opt-out.
- In Codex, use the `openai-codex` guidebook with `gpt-5.6-sol` as the default execution model.
  In Claude Code, use the `anthropic-claude` guidebook with the active Claude model unless the
  user names another target.
- Summarize the compiled objective, scope, exclusions, authority, deliverables, verification,
  and stop conditions in one to three sentences, then continue the work in the same turn.
- If `meta-prompt` is unavailable or unreadable, do not silently fall back. Direct the user to
  download the canonical skill from https://github.com/2000silpeed/meta-prompt-skill.git and
  install or symlink it at `~/.codex/skills/meta-prompt` for Codex or
  `~/.claude/skills/meta-prompt` for Claude Code; a project-only Claude installation may use
  `.claude/skills/meta-prompt`. Continue without it only after explicit user opt-out.
- Never invent another source, download without authorization, auto-refresh guidebooks, invoke
  a paid external model, expand authorization, or weaken this file's constraints.

## Non-negotiable order

For every target system or material change:

1. frame scope and normalize evidence;
2. characterize problem regions without implementation names;
3. select the least elaborate fitting strategy per subsystem;
4. discover responsibilities and invariants;
5. assign authority, ownership, and collaboration;
6. design boundaries and contracts;
7. only then choose function, immutable data, class, aggregate, module, component, service,
   pipeline, state machine, agent, store, or queue;
8. compare architecture candidates against measurable quality scenarios and costs;
9. record decisions, compile only observable claims, and plan implementation;
10. verify decisions continuously as agents change code.

A stakeholder's imposed technology is a hard constraint, not permission to skip responsibility
and ownership analysis. A “subsystem” before step 6 is a problem region, not a deployment unit.

## Methodology neutrality

- Select strategies per subsystem from characterization evidence. Never default the whole
  system to OO, DDD, Clean Architecture, layers, events, microservices, FP, or agents.
- Record the simpler alternative, why it is insufficient, the selected option's real costs,
  and evidence that would reverse the choice.
- Mixed strategies require S2 composition seams. S6 resolves those seams into owned
  interfaces/relations with semantics, consistency, failure, and translation responsibility.
- Prefer the lower-ceremony option when two approaches protect the same responsibilities,
  invariants, and quality scenarios.
- Use [docs/methodology.md](docs/methodology.md) for exact keep/adapt/drop verdicts and
  [docs/strategy-selection.md](docs/strategy-selection.md) for applicability.

## Anti-failure heuristics

These are weighted review triggers with escape evidence, never universal bans:

- Controller/Service/Repository everywhere: ask which rule, invariant, or volatility each
  layer owns. Collapse layers whose only rationale is convention.
- God Service or Manager/Helper/Util catch-all: compare change reasons, authority, and
  collaborators. Split only along a cohesive ownership boundary.
- Anemic model: move behavior toward its information/invariant owner when interacting rules
  justify it; plain data is correct for simple CRUD and transformations.
- Single-implementation interface: require a substitution, test seam, protected volatility,
  or external boundary. Otherwise remove it.
- Pattern or SOLID citation: require the problem force and accepted cost it answers.
- Microservice or broker: require scale, team autonomy, deployment, or partial-failure evidence;
  otherwise prefer an in-process boundary.
- Framework-shaped domain: keep framework types outside policy ownership unless an imposed
  constraint makes translation more expensive than coupling.
- Gratuitous layers: every layer names a protected change and downstream consumer.
- CRUD on complex rules: reopen responsibility/invariant analysis.
- DDD on independent records: apply the ceremony penalty and test a transaction script.
- OO graph hiding data movement: redraw transformations, lineage, replay, and effects first.
- Architecture claim without trade-offs: keep the decision proposed.

Escape a heuristic by recording evidence, scope, cost, decision authority, and review trigger.

## IR and decision discipline

- JSON IR under `schemas/` is the machine contract. Markdown and diagrams are views; never
  infer accepted facts by parsing prose.
- Stable IDs link Characterization → Strategy → Responsibility/Invariant → Architecture ↔
  Decision → Constraints. Do not inline copied facts.
- Every schema property must have non-empty `x-sah-trace.writtenBy` and `readBy`. Delete fields
  whose last reader disappears.
- S5 may reserve logical owner IDs; S6 must materialize them. After S7 no selected element is
  `undecided`.
- Keep unresolved choices proposed. They may allow scoped progress only behind an owned seam;
  every dependent implementation slice stays blocked.
- Use an ADR for a consequential, hard-to-reverse SAH choice. Include credible alternatives,
  at least two costs, consequences, mitigation, and supersession.

## Validation honesty

Classify every capability and constraint:

- deterministic: complete observable input plus fixed predicate; may block when applicable;
- assisted: facts narrow a contextual review; emits a finding, not a hard architecture fail;
- judgment: rubric-based LLM/human assessment with confidence and counter-evidence.

Hard constraints require an accepted decision, scope, observable fact contract, failure
message, and exception authority/expiry. Missing adapters report `unsupported`, never `pass`.
Do not promote naming smells, abstraction worth, boundary fit, strategy fit, or trade-off calls
to deterministic errors. Follow [docs/validation-model.md](docs/validation-model.md).

## File discipline

- Generated product artifacts are English except the Korean-equivalent column in
  [docs/glossary.md](docs/glossary.md). Preserve user-supplied provenance prompts verbatim;
  they are inputs, not normative product documents.
- Keep `AGENTS.md` at most 200 lines and every other document at most 400 lines. Split by
  authoritative concern, cross-link, and remove restatement.
- Every file must be linked from this file or [docs/index.md](docs/index.md) with a one-sentence
  reason to exist. Do not add speculative files, fields, layers, interfaces, or extensions.
- Update the active ExecPlan after progress, failure, discovery, decision, and verification.
  Preserve history; supersede when the outcome changes.
- Do not edit benchmark expectations to excuse a product regression. Runs receive only
  `problem.md`; judges see expectations after outputs are frozen.
- The source prompts linked under index Provenance are inputs, not current product authority.
  Their no-implementation scope applies to the bootstrap plan, not forever.

## Executable validation slice

Use these exact source-checkout commands:

```text
npm install
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm exec -- sah validate fixtures/simple-crud
npm exec -- sah validate fixtures/simple-crud --json
npm exec -- sah advance /path/to/disposable-s11-bundle S12 --json
npm exec -- sah loop /path/to/target/.sah/sah.loop.json --json
npm exec -- sah loop-checks /path/to/target/.sah/sah.loop.json --cwd /path/to/target --json
npm exec -- sah loop-record /path/to/target/.sah/sah.loop.json /path/to/target/.sah/outcome.json --json
npm exec -- sah loop-accept-next /path/to/target/.sah/sah.loop.json --json
npm exec -- sah loop-accept-next /path/to/target/.sah/sah.loop.json --repair --json
npm exec -- sah loop-complete /path/to/target/.sah/sah.loop.json /path/to/target/.sah/completion.json --json
npm exec -- sah verify fixtures/simple-crud fixtures/s13-target
npm exec -- sah verify fixtures/simple-crud fixtures/s13-target --json
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target --mapping sah.source-map.json
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target --mapping sah.source-map.json --json
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target --mapping sah.source-map.json --changed src/equipment-operations/save-equipment.ts --json
npm exec -- sah verify /path/to/disposable-s12-bundle fixtures/s13-typescript-target --mapping sah.source-map.json --record verification-record.json --json
npm exec -- sah advance /path/to/disposable-s12-bundle S13 --verification-record verification-record.json --json
```

The installed package exposes `sah validate`, mutating `sah advance`, and normally read-only
`sah verify`; opt-in `verify --record <bundle-relative-record>` atomically publishes a result
without changing lifecycle. S12→S13 `advance --verification-record <bundle-relative-record>`
atomically pins eligible full evidence and the new stage. Run mutating forms only on the
intended working bundle or a disposable copy. Public library entry points remain
`validateBundle`, `advanceBundle`, and `verifyBundle`; [validation CLI usage](docs/validation-cli.md)
owns their result, transition, record, mapping, atomicity, and exit-code contracts.
TypeScript mapping v0.2 names a confined project configuration explicitly; verification does
not discover ambient `tsconfig.json` files or let project globs narrow declared source roots.
Repeat `--changed` only for explicit change-scoped verification; SAH never discovers git state,
and an incomplete change mapping expands to full verification.

## Change workflow

Before editing, identify the authoritative document, active stage, affected IR IDs, decisions,
constraints, and benchmarks. Change the earliest invalid premise and mark downstream artifacts
stale; do not patch only the document where a contradiction surfaced.

After editing:

1. validate every schema and embedded example with a Draft 2020-12 validator;
2. audit every schema property for writer and reader traces;
3. run reference/stage checks available in the current implementation;
4. run affected benchmarks and report deterministic, assisted, and judgment results separately;
5. check document line budgets, links, contradictions, and `git diff --check`;
6. update ExecPlan discoveries/verification and commit a meaningful milestone; never push
   unless the user explicitly requests it.

If evidence changes, reopen the earliest affected S0–S10 stage. If code alone violates a valid
decision, repair code or use an authorized, expiring exception. Never claim a check ran when it
did not.
