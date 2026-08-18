# Software Architect Harness (SAH)

SAH is a methodology-neutral design reasoning harness for coding agents. It turns requirements
into traceable responsibilities, invariants, architecture decisions, implementation slices,
and executable constraints before code changes make those choices expensive to reverse.

JSON IR under [`schemas/`](schemas/) is the machine contract. Markdown documents and diagrams
are explanatory views; [`docs/index.md`](docs/index.md) routes each concept to its authoritative
document.

## What works today

The local TypeScript runtime provides:

- Draft 2020-12 schema, reference, and lifecycle-gate validation for a design bundle;
- exact-next, atomic lifecycle advancement through the implemented S5–S13 gates;
- read-only full or explicit change-scoped verification against a target checkout;
- filesystem-presence and explicitly mapped TypeScript write-authority fact adapters; and
- schema-validated full-verification records that can atomically authorize S12→S13.

Changed-scoped, incomplete, violating, stale, malformed, or operational-error evidence cannot
complete S13. The exact CLI/library behavior and exit codes are owned by
[`docs/validation-cli.md`](docs/validation-cli.md).

## Requirements

- Node.js 22 or newer
- npm

The package is currently private and intended to run from a source checkout.

## Quick start

Install, build, validate the example bundle, and verify its implementation target:

```sh
npm install
npm run build
npm exec -- sah validate fixtures/simple-crud
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target \
  --mapping sah.source-map.json
```

Use `--json` on any command for one machine-readable result envelope.

### Record full evidence and complete S13

`advance` mutates a bundle, so work on a disposable copy:

```sh
bundle_root="$(mktemp -d)"
cp -R fixtures/simple-crud "$bundle_root/bundle"

npm exec -- sah verify "$bundle_root/bundle" fixtures/s13-typescript-target \
  --mapping sah.source-map.json \
  --record verification-record.json \
  --json

npm exec -- sah advance "$bundle_root/bundle" S13 \
  --verification-record verification-record.json \
  --json
```

Publishing a verification record does not advance lifecycle by itself. Advancement validates
the record, its complete S12 assignment coverage, its design fingerprint, and its pinned bytes
before replacing the manifest atomically.

## CLI and library surfaces

```text
sah validate <design-bundle-directory> [--json]
sah advance <design-bundle-directory> <target-stage> [--verification-record <bundle-relative-record>] [--json]
sah verify <design-bundle-directory> <target-directory> [--mapping <target-relative-mapping-file>] [--changed <target-relative-file>]... [--record <bundle-relative-record>] [--json]
```

The public library exports `validateBundle`, `advanceBundle`, and `verifyBundle` plus their
framework-neutral result contracts. See the
[`validation CLI and library guide`](docs/validation-cli.md) before integrating either surface.

## Reasoning flow

SAH progresses from evidence and problem characterization to strategy, responsibility,
invariants, ownership, boundaries, representation, candidate comparison, decisions,
constraints, implementation handoff, and continuous verification (S0–S13). Gates can reopen
the earliest invalid premise instead of patching only the document where a contradiction
appears.

Read [`docs/design-reasoning-model.md`](docs/design-reasoning-model.md) for the complete stage
contract and [`docs/validation-model.md`](docs/validation-model.md) for the deterministic,
assisted, and judgment distinction.

## Repository map

- [`schemas/`](schemas/) — canonical JSON IR and runtime evidence contracts.
- [`src/`](src/) — the local CLI/library implementation and fact-adapter seams.
- [`fixtures/`](fixtures/) — executable validation and verification examples.
- [`benchmarks/`](benchmarks/) — isolated methodology-discrimination cases and scoring inputs.
- [`docs/`](docs/) — product, reasoning, architecture, validation, and ADR authority.
- [`.agent/PLANS.md`](.agent/PLANS.md) — active execution plan, discoveries, and verification
  evidence.
- [`AGENTS.md`](AGENTS.md) — permanent repository policy for coding agents.
- [`CLAUDE.md`](CLAUDE.md) — Claude Code entry point importing the same repository policy.

The bootstrap prompts are preserved provenance inputs, not current product authority.

## Development verification

Run the full local quality suite before committing a change:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

The exact executable validation slice and change workflow live in [`AGENTS.md`](AGENTS.md).
Do not mutate checked-in fixtures with `advance`; use a disposable copy.

## Current boundary

SAH is local-first. It does not currently provide hosted coordination, a general evidence
database, source-code reverse engineering, or automated LLM/human judgment execution. Missing
fact adapters and pending contextual review remain explicit incomplete coverage rather than a
manufactured pass.
