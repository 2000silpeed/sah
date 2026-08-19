# ADR-0019: Require execution evidence for iteration completion

## Status

Accepted for Run 19.

## Context

The Run 18 iteration loop accepted a schema-valid outcome when its `checkResults` were empty or
when a submitted `passed` value did not identify the command, working directory, exit code, or
captured output. That made `status: succeeded` a claim made by the coding agent rather than a
deterministic consequence of the current iteration's required checks. The linting contract already
requires exact invocation and observable result evidence, while S13 remains a separate full SAH
verification gate.

## Decision

Version the iteration outcome contract to v0.2.0 and require every check result to carry the
declared command, explicit working directory, start/end timestamps, exit code (nullable only when
execution is incomplete), and sha256 digests for captured stdout and stderr. Add `sah loop-checks`
and its library operation to execute the current declared checks sequentially in an explicitly
supplied `--cwd` and emit a schema-valid outcome template. The runner is local, opt-in, target-owned
in command selection, and never discovers Git state or changes a design bundle.

Before the atomic loop replacement, `loop-record` compares the outcome to the current iteration:
required checks must be present exactly once, use the declared command, and be passed with exit code
zero for a successful outcome. Unknown, duplicate, missing, mismatched, failed, or incomplete
required evidence blocks a success write. Failed or partial evidence may be appended as a blocked
iteration so the failure remains durable without being misreported as completion.

Decision authority: the SAH architecture authority accepted this local Run 19 slice. The target
repository remains authoritative for the commands, configuration, and meaning of each check.

## Alternatives and costs

- Keep v0.1 optional observations: preserves compatibility and low ceremony, but cannot distinguish
  an executed check from an agent assertion and leaves the completion gate unsound.
- Add a universal language/tool linter and test engine: centralizes execution, but creates target
  coupling, false authority, and an unbounded adapter-maintenance surface.
- Require a hosted evidence database or signed remote attestations: stronger multi-writer history,
  but expands delivery topology, trust, privacy, and operational cost before local sequential
  completion is reliable.

The selected option costs a breaking artifact version, explicit caller cwd, captured output
digests, and local command execution risk. It protects the narrow observable contract now while
leaving repository revision binding, release evidence, and hosted coordination for separately
authorized decisions.

## Consequences and review

Successful iteration recording is now deterministic only when all required evidence is complete;
the existing route exit codes and S0–S13/S13 authorities remain unchanged. `loop-checks` does not
add a timeout, sandbox, Git inference, or deployment operation in this slice; review the decision
before adding those capabilities. Supersede this ADR if a future evidence authority changes the
local execution or trust boundary.
