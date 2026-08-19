# Frontier-first development loop

SAH is designed for strong coding agents, not to replace them. The agent should be allowed to
inspect, edit, run tools, and repair a small safe change in a tight loop. SAH supplies the durable
direction, risk routing, evidence, and escalation boundaries around that loop.

## Fast path

Use this for reversible, local work with no critical invariant, migration, security boundary, or
cross-owner change:

```text
inspect → smallest change → format/lint → typecheck → tests/build → review diff → repeat
```

The target repository owns its formatter and linter commands and configuration. The agent records
the exact command and result as an acceptance check. A lint failure blocks the iteration's done
claim; it is not silently converted into an SAH architecture violation.

## Reasoning path

Route to S0–S13 when the change affects an invariant, ownership or boundary, data migration,
security/privacy, external consistency, or repeatedly fails the fast loop. The agent still runs
lint and other target checks early; the reasoning stages add decision and evidence protection,
not a replacement for executable feedback.

## Escalation and learning

Repeated lint or test failures are evidence about a missing capability, unclear contract, or bad
decomposition. Ask a focused question or reopen the earliest affected SAH stage. Do not weaken a
rule merely to make the loop pass. A proposed lint-rule improvement becomes normative only after
the target owner accepts it or an SAH decision records it.

See [ADR-0017](adr/0017-frontier-first-feedback-and-target-linting.md) for trade-offs and
[linting contract](linting.md) for the exact evidence boundary.
