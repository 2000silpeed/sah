# Linting contract

Linting is a target-repository acceptance check, not a universal SAH semantic validator. The
target owns the executable, configuration, rules, version, and severity policy. A coding loop
should run it after a coherent change and before claiming the iteration complete:

```text
format → lint → typecheck → tests → build → SAH verification
```

The agent records the exact invocation, working directory, tool version when material, exit code,
and a concise output reference in the iteration handoff or outcome view. A non-zero result is a
target-check failure and blocks the iteration's done contract. It does not become a deterministic
SAH architecture violation unless an accepted SAH decision explicitly defines the same observable
fact and an adapter exists.

SAH does not discover a target's lint command, invent rules, auto-disable findings, or provide one
language-independent linter. If the command is absent or the output cannot be observed, report the
check as incomplete and escalate when it is required by the target's definition of done. Existing
S13 scope, evidence, and exit-code rules remain unchanged.
