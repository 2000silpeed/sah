# Run 36 ExecPlan — Benchmark Operator Walkthrough

## Objective

Give an operator agent a single sequential runbook for the completed FP-008
chain — exact commands, preconditions, success checks, role boundaries, and
failure discipline — and surface it from both paired READMEs so an LLM can read
and execute steps 0–9 without other context.

## Scope and constraints

Docs-only run. Included: docs/benchmark-walkthrough.md, compact README sections
(English and Korean, equivalent), documentation-index entry, and this plan.
Excluded: runtime, schema, CLI, tests, benchmark fixtures, and lifecycle changes.

## Acceptance checks

- The walkthrough covers prepare → participant execution → capture → freeze →
  judge authoring → aggregation → adjudication → verdict → compare with exit-code
  checks at every step and explicit fresh-only/no-mutation rules.
- Both READMEs stay within the 400-line budget after meaning-preserving rewraps;
  their new sections are equivalent in content.
- Repository markdown link audit passes; no code or schema file changes.

## Verification log

- Markdown link audit passes across the repository; fences balanced; both
  READMEs measure 391 lines each, walkthrough 160 lines.
- `npm run format:check` passes (docs-only change; no formatting scope affected).
