# ADR-0032: Validate and Aggregate Benchmark Judges Without Executing Them

- Status: accepted
- Date: 2026-08-22
- Owners: SAH evaluation and delivery authority

## Context

The run protocol requires two independent LLM judges over frozen outputs, mean
agreement within three points per category, and human steward adjudication of
larger disputes. SAH's boundary forbids the runtime from invoking models, so the
existing independent-Checker pattern (ADR-0022) — host agents execute a judgment,
the runtime validates the record mechanically — is the only delivery shape that
keeps that boundary while making judge disagreement measurable.

## Decision

Add two versioned contracts and one read-only command. A `benchmark-judge-review`
record binds one judge identity to one frozen capture via trajectory and problem
digests, carries exactly six category scores with explanations, the declared
rubric version, an over-engineering deduction with justification, and any FATAL
indicators. `sah benchmark-judge <a> <b>` validates both records, rejects shared
judge identities and binding mismatches, enforces per-category maxima and
one-score-per-category completeness, preserves raw points verbatim, emits the
`benchmark-score` projection with means, disputed categories, subtotal-nulling,
and fatal flagging, and exits 1 when steward adjudication is required. Judge
protocol obligations — context isolation, allowed inputs — are documented for
evaluator operators rather than encoded in runtime or shipped inside the
participant-facing skill.

## Alternatives considered

1. Let the runtime call judge APIs directly so independence is enforced in code.
   Rejected because it crosses the no-provider boundary, adds credentials and
   cost to the kernel, and duplicates what evaluator harnesses already do.
2. Ship the judging protocol as a reference inside `skills/sah`. Rejected because
   participants run that same skill package; evaluation policy must not enter the
   participant-visible surface that input isolation (ADR-0029) keeps clean.
3. Aggregate by trusting each record's self-computed totals. Rejected because
   judge-computed sums would make the agreement gate unauditable; the runtime
   recomputes everything from raw per-category points.
4. Apply the three-point rule to over-engineering deductions too. Deferred:
   strategy text scopes the rule to category scores, so this slice echoes
   deductions raw instead of inventing an unrequested gate.

## Costs and consequences

- Independence cannot be proven from records alone; identical digests with two
  colluding judges pass mechanically, so protocol discipline stays with the
  evaluator operator.
- Per-category maxima live in aggregator code rather than schema conditionals,
  keeping the JSON Schema simple but splitting the rule across two places.
- The score projection is deliberately partial: deterministic categories, caps,
  and pass thresholds remain unbuilt, so "scored" never implies a complete
  benchmark verdict.
- Disputed runs block on humans by design; nothing advances until a steward
  resolves the flagged categories.

Revisit this decision if judges need structured finding IDs beyond free-text
explanations, if deduction agreement needs its own gate, if blind rescoring needs
steward-specific record variants, or if deterministic scoring lands and the total
assembly moves into the runtime.
