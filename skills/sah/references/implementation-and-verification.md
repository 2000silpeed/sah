# Implementation and Verification

Use this reference after architecture selection, before editing product code, and for S13.

## Implementation preconditions

For a full-path run, require a valid bundle at S12. Read the selected candidate, accepted decisions,
constraints, and implementation handoff directly from canonical JSON. Do not infer authority from a
diagram or prose summary.

Implement only slices whose status is `ready`, in dependency order. A proposed decision listed in
`blockedByDecisionRefs` is a real stop condition for that slice. Do not quietly choose it in code.
If the unresolved choice can be settled only by the user or another authority, ask a focused
question and explain its implementation consequence.

Before each slice:

1. state its intended outcome, owning elements, invariants, accepted decisions, and constraints;
2. inspect current code/tests and refine the change plan without changing the architecture premise;
3. implement the smallest coherent vertical change;
4. run its named acceptance checks and the target repository's relevant static/test suite;
5. update evidence if implementation exposes a missing force, ownership conflict, or invalid
   assumption; reopen reasoning instead of forcing code through the old plan.

Code structure follows the selected responsibilities and authority. Do not add layers, interfaces,
repositories, events, services, agents, or helper catch-alls without an evidenced force and accepted
cost. An imposed framework stays a constraint; keep framework types outside policy ownership when
translation costs do not outweigh coupling.

## Mapping code facts

SAH's current executable S13 adapters support:

- target-confined regular-file presence; and
- direct TypeScript write-authority checks through an explicit target-relative
  `sah.source-map.json` and confined project configuration.

Read `schemas/typescript-source-mapping.schema.json` before authoring a mapping. Declare complete
source roots and explicit element path prefixes. SAH does not discover Git changes or ambient
`tsconfig.json` files. Missing mapping or unsupported language/source forms remain incomplete.
When the normal project config includes tests, examples, or ambient declarations outside the mapped
product roots, use a dedicated target-relative `tsconfig.sah.json` that includes all mapped product
sources and only their required compiler types. It must not narrow the declared source roots; it
only prevents unrelated compiler inputs from manufacturing incomplete coverage.

Do not invent a deterministic constraint merely because the current adapters can check it. Start
from an accepted architecture decision, then determine whether its observable contract matches an
available capability. Keep other claims assisted or judgment and report the missing disposition or
adapter.

## Feedback loop

During implementation, explicit changed paths can shorten feedback:

```text
npm exec -- sah verify /absolute/target/.sah/design /absolute/target \
  --mapping sah.source-map.json \
  --changed src/changed-file.ts \
  --json
```

Repeat `--changed` for every explicit path. A mapping gap expands selection to `full-fallback`, but
the result is still change-scoped evidence. It never authorizes S13 completion. Treat:

- `passed` as all selected executable checks passing for this feedback scope;
- `violations` as observed contradictions requiring code repair or an authorized exception;
- `incomplete` as unsupported/pending coverage that cannot prove compliance;
- `operational-error` as an invocation, input, adapter, or record failure.

Also run the target's own formatter, linter, typechecker, tests, build, migration checks, and other
acceptance commands. Record the exact command and outcome in the iteration handoff or outcome
view. A required non-zero lint result blocks the iteration's done contract, but is a target-check failure rather than an SAH architecture violation. SAH verification complements these checks; it does not replace functional correctness.

## Full S13 evidence

After all ready slices and target checks pass, publish a fresh full result from the SAH checkout:

```text
npm exec -- sah verify /absolute/target/.sah/design /absolute/target \
  --mapping sah.source-map.json \
  --record verification-record.json \
  --json
```

Omit `--mapping` only when no declared constraint requires it. Omit every `--changed` option. Record
publication is opt-in and atomic; it does not change lifecycle.

Advance only when the command produced a schema-valid record with `scope=full`, `status=passed`, no
selection metadata, all checks passing, complete S12 assignment coverage, and a current design
fingerprint:

```text
npm exec -- sah advance /absolute/target/.sah/design S13 \
  --verification-record verification-record.json \
  --json
```

The advance atomically pins the eligible record path, schema, digest, and S13 lifecycle. Never edit
those fields manually. Changed-scoped, full-fallback, stale/tampered, `incomplete`, `violations`, or
`operational-error` evidence cannot satisfy the gate.

At stored S13, run `sah validate` again. For future code changes, use changed verification as early
feedback and publish a new full record before claiming the design remains continuously verified.

## Completion report

Separate four kinds of evidence:

1. target functional/static test results;
2. deterministic SAH checks and violations;
3. assisted findings and their disposition authority;
4. judgment decisions, confidence, counter-evidence, and unresolved items.

State the final bundle stage and evidence scope. If adapter coverage is unavailable, the correct
outcome is implemented/tested software with S13 incomplete—not a false architectural pass. Include
the exact commands run, important files changed, remaining risks, and commits/external actions.
