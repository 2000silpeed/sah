# Artifacts and Lifecycle

Use this reference when creating or changing `.sah/design` and moving through S0–S13. JSON schemas
in the SAH checkout are the machine contract; read each relevant schema and its embedded example
instead of guessing fields.

## Canonical bundle

Keep one `sah.bundle.json` plus declared JSON artifacts in the bundle directory. Default file names
are:

| Artifact | Produced by | Schema |
| --- | --- | --- |
| `system-characterization.json` | S0–S1 | `schemas/system-characterization.schema.json` |
| `design-strategy.json` | S2 | `schemas/design-strategy.schema.json` |
| `responsibility.json` | S3/S5 | `schemas/responsibility.schema.json` |
| `invariant.json` | S4/S5 | `schemas/invariant.schema.json` |
| `architecture.json` | S6–S11 | `schemas/architecture.schema.json` |
| `architecture-decision.json` | S9–S10 | `schemas/architecture-decision.schema.json` |
| `implementation-handoff.json` | S12 | `schemas/implementation-handoff.schema.json` |

The manifest schema is `schemas/design-bundle-manifest.schema.json`. Copy schema IDs and versions
from the schemas, never memory. Use stable kebab-case IDs. Link facts by ID; do not copy prose as a
substitute for traceability.

JSON is canonical. An ADR or diagram may be generated as a view, but validation never parses it to
recover accepted facts. Every consequential ADR includes credible alternatives, at least two costs,
consequences, mitigation, authority, and supersession/review triggers.

## New-bundle bootstrap

The current CLI implements atomic exact-next advancement for target gates S5–S13. It does not
implement S0–S4 transition commands. For a new target:

1. complete the conversational S0–S4 reasoning loop;
2. write the four corresponding semantic artifacts in a staging/new bundle directory;
3. publish the first `sah.bundle.json` once with `completedStage: S4` and the selected `profile`;
4. run `sah validate` and repair schema/reference/stage diagnostics;
5. from then on, use only `sah advance` for forward lifecycle changes.

Initial publication at S4 is an orchestrator bootstrap, not permission to relabel an existing
bundle. Never hand-edit an existing manifest to skip, advance, or lower a completed stage. If new
evidence invalidates an accepted earlier premise and the current runtime cannot represent the
reopen atomically, preserve the old bundle as historical evidence, report the lifecycle limitation,
and prepare a new corrected working bundle rather than claiming the old state remains current.

## Stage workflow

At each stage, update only the artifact fields owned by that stage, run validation, review
contextual claims, and then advance exactly one stage when the gate is satisfied.

| Target | Required evidence before advance |
| --- | --- |
| S5 | each responsibility/invariant has one owner or explicit unresolved conflict/protocol |
| S6 | logical owners materialize as architecture elements; boundaries/contracts reflect ownership |
| S7 | every element has the least elaborate fitting representation |
| S8 | multiple proposed candidates, or one candidate with valid forcing/short-path evidence |
| S9 | every candidate × must-scenario assessment exists; choices remain proposed |
| S10 | one coherent candidate selected; consequential decisions accepted or dependents isolated |
| S11 | accepted observable claims classified and bound; non-observable claims remain review work |
| S12 | ready/blocked slices cover selected elements, constraints, decisions, and acyclic dependencies |
| S13 | eligible schema-valid full verification record; see implementation reference |

The CLI validates the proposed target state before atomically replacing lifecycle metadata. An
assisted warning may accompany an otherwise valid earlier transition; it is not proof that a human
accepted risk. Never rewrite a diagnostic category to force advancement.

From the SAH checkout, using absolute paths:

```text
npm exec -- sah validate /absolute/target/.sah/design --json
npm exec -- sah advance /absolute/target/.sah/design S5 --json
```

Repeat the second command only with the exact next supported stage after preparing its artifacts.
Do not run mutating commands on examples or a user's bundle unless that exact working bundle is the
intended target.

## Stage-specific content

- **S0–S1:** scope, stakeholders, verbatim-locatable evidence, assumptions/unresolved questions,
  subsystem dimensions, measurable scenarios, and real hard constraints.
- **S2:** one strategy per subsystem, simpler alternatives, costs/disqualifiers/reversal evidence,
  composition seams, and short-path eligibility.
- **S3–S5:** outcome-oriented responsibilities and precise invariants first; then authority,
  logical ownership, collaborators, and unresolved conflicts. Avoid representation names in S3.
- **S6–S7:** materialize owners, protected-change boundaries, semantic relations/interfaces, and
  only then functions/data/classes/aggregates/modules/components/services/pipelines/state machines/
  agents/stores/queues/external systems.
- **S8–S10:** compare candidate topologies against must scenarios and costs. Keep selection proposed
  through S9. Preserve rejected options and evidence after acceptance.
- **S11:** deterministic claims need complete observable input, a fixed predicate, failure message,
  scope, accepted decision, and exception authority/expiry. Assisted and judgment checks do not
  become hard errors.
- **S12:** each slice names outcome, elements, constraints, accepted decisions, proposed blockers,
  dependencies, acceptance checks/expected results, migration, rollback, and honest status.

## Validation interpretation

Use exit status and JSON `status` together:

| Exit | Meaning |
| --- | --- |
| 0 | validation passed, advancement committed, or selected verification checks passed |
| 1 | deterministic validation/gate violations, blocked advance, or observed architecture violation |
| 2 | operational error or incomplete/unsupported verification evidence |

Never claim a command ran if it did not. Operational errors are tool/input failures, not design
violations. Unsupported extraction is incomplete, never pass.

## Trace and change discipline

When evidence changes, repair the earliest premise and enumerate downstream IDs that need review.
When code violates a still-valid decision, repair code or obtain an authorized, expiring exception.
Do not patch only the last artifact where a contradiction surfaced.

Before a milestone, validate all bundle artifacts, inspect diagnostics by classification, run the
target's tests, check document links/line budgets when applicable, run `git diff --check`, and review
the complete diff for accidental authority or benchmark changes.
