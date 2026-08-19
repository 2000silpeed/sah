# Run 21 ExecPlan — 2026-08-19

### Compiled task and boundaries

Bind every iteration evidence transition to an explicit target revision and design-bundle
fingerprint so stale results cannot be reused across sessions or code/design changes. Preserve the
local loop authority, atomic writes, existing CLI/library and exit semantics, and S0–S13/S13
authority. Exclude Git discovery, source-tree hashing, hosted coordination, release/deploy,
telemetry, LLM judges, benchmarks, and user-acceptance claims.

### Accepted design

Add loop `workContext` (target root, opaque caller-supplied target revision, bundle path, and
sha256 design fingerprint), bind it through `loop-bind`, and carry revision/fingerprint in outcome
evidence and completion requests. `loop-checks` requires explicit context arguments and records
them; `loop-record` requires exact equality with the current binding. `loop-accept-next` and
`--repair` accept a new explicit binding for the new iteration; `loop-complete` requires the
request, latest evidence, and current binding to agree. A mismatch is a deterministic blocked
no-op. SAH never reads Git or derives a revision; the caller supplies the value and may obtain the
bundle fingerprint from `sah resume`/verification.

### Milestones

| Phase | Milestone | Status |
| --- | --- | --- |
| 0 | Inspect Run 20 contracts and fingerprint authority | complete |
| 1 | Write Run 21 plan and ADR-0021 | complete |
| 2 | Add context-bound schemas/types/fixtures | complete |
| 3 | Implement bind/check/record/advance/complete gates | complete |
| 4 | Update CLI/docs/tests and verify stale failures | complete |
| 5 | Full verification, diff review, and milestone commit | complete |

### Discovery and handoff

- Existing `designFingerprint` is the canonical semantic-bundle digest; reuse it rather than add
  another bundle authority. Target revisions remain opaque because SAH must not infer Git state.
- A planned iteration needs `loop-bind` before checks; a completed/blocked iteration changes
  binding only through accept-next/repair, preserving the evidence history that produced it.
- Completion must compare all three contexts (loop, latest evidence, request), not merely trust a
  string embedded in the completion artifact. Run 22 can address multi-writer/hosted coordination
  only as a separate authority decision.

### Verification log

- Context-bound loop v0.4, outcome v0.4, completion request v0.2, and result v0.3 schemas pass
  Draft 2020-12 example and trace audits. Fixtures and public types carry the required binding.
- Focused loop/CLI tests pass, including missing-context blocks, stale outcome no-op, completion
  context mismatch no-op, explicit `loop-bind`, exact check execution, and accept-next rebinding.
- Full format check, lint, strict typecheck, schema verification, and the 248-test suite pass;
  production build and disposable CLI bind/record/accept smoke also pass.
- No Git discovery, source-tree hashing, hosted coordination, benchmark, judge, or lifecycle
  authority was added. The target revision remains caller-owned; SAH proves equality only.

### Milestone

Run 21 is ready for the milestone commit after the checks above; no push is authorized in this
run.
