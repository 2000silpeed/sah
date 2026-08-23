# Benchmark Evaluation Walkthrough

A sequential operator runbook for the FP-008 evaluation chain. Every step lists
the exact command, its precondition, the success check, and what to do on
failure. An agent or steward can execute steps 0–9 in order without other
context. Authoritative contracts live in [benchmark-run](benchmark-run.md),
[benchmark-trajectory](benchmark-trajectory.md), [benchmark-judging](benchmark-judging.md),
and [benchmark-verdict](benchmark-verdict.md); scoring anchors and thresholds are
owned by [benchmark-strategy](benchmark-strategy.md).

## Roles

- **Operator agent** executes every `sah` command below from the built SAH
  checkout.
- **Participant runner** performs step 2; it must be separately authorized. SAH
  never invokes a model itself.
- **Two judge sessions** perform step 5 in isolation from each other.
- **Benchmark steward** performs step 7 only when adjudication is required.

## Step 0 — Build and confirm the kernel

~~~sh
cd /absolute/path/to/sah && npm install && npm run build
npm exec -- sah validate fixtures/simple-crud
~~~

Success: `SAH validation passed`, exit 0. Stop and repair the checkout on any
other result. Prefer absolute paths for everything you pass to `sah`; SAH never
discovers Git state or infers paths for you.

## Step 1 — Prepare one treatment and one control run

~~~sh
npm exec -- sah benchmark-prepare <benchmark-dir> <parent>/<run-id>-t \
  --run-id <run-id>-t --comparison-id <cmp-id> --mode treatment --json
npm exec -- sah benchmark-prepare <benchmark-dir> <parent>/<run-id>-c \
  --run-id <run-id>-c --comparison-id <cmp-id> --mode control --json
~~~

Precondition: fresh paths (neither run directory nor sibling record may exist)
and a benchmark directory containing a direct regular `problem.md`.
Success: exit 0, JSON `status:"prepared"`. Each target contains exactly
`problem.md`; the sibling `<run>.benchmark-run.json` record stays outside the
participant target. On exit 2 read `diagnostics[].repair` — existing paths are
never overwritten; choose new paths.

Record from each preparation record for later steps: `runId`, `comparisonId`,
`benchmarkId`, `mode`, and `input.problemDigest`.

## Step 2 — Execute the participant (external, authorized)

Run your authorized participant (host agent plus released SAH skill) inside the
isolated target directory. SAH provides no command for this step and claims no
execution. Whatever artifacts the participant leaves behind belong to the run;
the reserved `output/` directory and any `.sah/design` bundle it produces are
scored later as-is.

## Step 3 — Capture the raw trajectory

For each observed event, append one envelope line (first `seq` must be 1, then
contiguous; `recordedAt` non-decreasing):

~~~sh
printf '%s\n' '{"seq":1,"recordedAt":"<iso-time>","kind":"system-event","payload":{"note":"started"}}' > entry.json
npm exec -- sah benchmark-trajectory <run-directory> --entry-file entry.json --json
~~~

`kind` is one of `agent-message | tool-invocation | tool-result | system-event`;
`payload` is your opaque content (SAH never interprets it). Success: exit 0,
`status:"appended"` with running totals. Inspect anytime with `--status` (exit 0
even when empty); corrupt lines are reported by line number and must be restored
by their owner before further appends.

## Step 4 — Freeze the completed capture

~~~sh
npm exec -- sah benchmark-freeze <run-directory> --json
~~~

Success: exit 0, `status:"frozen"`, writing sibling `<run>.benchmark-freeze.json`
with the full-file digest and output inventory. Freezing blocks all further
appends for that run; an empty capture refuses to freeze. After freezing, copy
`capture.trajectoryDigest` from the freeze record — judges must cite it.

## Step 5 — Two isolated judge sessions author review records

Start two sessions that cannot see each other's reasoning. Give each ONLY: the
problem bytes, the frozen trajectory and output inventory, hidden expectations,
and the rubric. Each session writes one file validated by
[schemas/benchmark-judge-review.schema.json](../schemas/benchmark-judge-review.schema.json):

- identity copied from the freeze/preparation records (`runId`, `comparisonId`,
  `benchmarkId`, `mode`);
- `trajectoryDigest` equal to the freeze record's digest and `problemDigest`
  equal to the preparation record's `input.problemDigest`;
- exactly six category scores with explanations, over-engineering deduction
  with justification, and any FATAL indicators.

Distinct `judgeId` values are mandatory; identical identities fail aggregation.

## Step 6 — Aggregate the pair into a score projection

~~~sh
npm exec -- sah benchmark-judge judge-a.json judge-b.json --json > score.json
~~~

Success: exit 0 and `status:"scored"` — save the printed projection; aggregation
writes nothing itself. Exit 1 means rejected records (read `diagnostics[]`) or
`status:"adjudication-required"`: disputed categories are listed in
`disputedCategories` and `judgeSubtotal` is null until step 7. Fix records, never
the projection, and rerun.

## Step 7 — Steward adjudication (only when required)

The steward writes one file per
[schemas/benchmark-adjudication.schema.json](../schemas/benchmark-adjudication.schema.json):
binding fields copied from the score projection plus one entry per disputed
category — no more, no fewer — each with final points and a rationale. Judges'
records remain untouched.

## Step 8 — Assemble the verdict

~~~sh
npm exec -- sah benchmark-verdict score.json \
  --bundle <run-directory>/.sah/design \
  [--adjudication adjudication.json] \
  --record verdict-<run-id>.json --json
~~~

Precondition: the participant bundle directory (omit nothing — assembly fails
operationally while disputes are unresolved). Deterministic categories score the
bundle honestly: full validation pass earns integrity 10/10; declared decision-
linked constraints earn enforcement 5/5; anything unscoreable earns zero and
stays visible. The total subtracts the mean over-engineering deduction, caps at
49 on any FATAL indicator (which also fails the run), and passes only at ≥70
with strategy ≥12/20 and responsibilities ≥9/15. Success: exit 0,
`status:"passed"` — or exit 1 with `status:"failed"`, which is a legitimate
result, not an operation error. `--record` is fresh-only; pick a new file name
to re-record.

## Step 9 — Compare the treatment/control pair

~~~sh
npm exec -- sah benchmark-compare verdict-treatment.json verdict-control.json --json
~~~

Precondition: both verdicts share `benchmarkId`, `problemDigest`, and
`comparisonId`, and carry distinct modes. Success: exit 0 with per-category
deltas, total delta, and outcome. A treatment losing more than five total points
reports `treatment-regressed` — the published release-regression signal.
Rejected inputs exit 1.

## Failure discipline

- Exit 0/1/2 meanings are stable; read `diagnostics[].message`,
  `expected`, and `repair` before changing anything.
- Never mutate frozen captures, judge records, or existing freeze/verdict
  records; every writer here is fresh-only by contract.
- If a step fails repeatedly, stop and consult the owning contract document
  listed above instead of retrying with mutated inputs.
