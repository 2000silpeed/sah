# ADR-0022: Promote independent Checker review as a judgment gate

## Status

Accepted for Run 22.

## Context

The SAH validation model correctly classifies architecture quality and trade-off assessment as
judgment, but it does not define how a coding agent obtains an independent review. In the ARN
dogfood run, a separate read-only Checker subagent executed the target's declared checks, inspected
the exact pushed revision, avoided benchmark expectations, and recorded an `APPROVE` with residual
risks. Without a shared record contract, another target could claim “reviewed” using a stale commit,
self-review, or an untraceable prose summary.

## Decision

Add a revision-bound `checker-review` v0.1.0 JSON artifact and a read-only
`validateCheckerReview`/`sah checker-review` surface. The artifact requires the target scope,
caller-supplied target revision, SAH design fingerprint, independent read-only reviewer identity,
exact check command/cwd/status evidence, findings, residual risks, and a verdict. SAH performs
schema and mechanical consistency checks only. An `approve` record reports `passed` only if every
listed check passed and no open high/medium finding remains; `request-changes` reports a violation,
and incomplete or operational evidence stays non-passing.

The command never invokes a model, discovers Git state, mutates a target, records a loop outcome,
advances S12/S13, or changes feature status. A target Task or loop contract may require the review
and record its path; the target owner remains responsible for deciding when that requirement is
applicable. Callers may pass expected target revision and design fingerprint values; mismatches are
non-passing deterministic diagnostics. The review verdict is judgment evidence, not a deterministic
architecture claim.

## Alternatives and costs

- Keep Markdown-only target records: low implementation cost, but every target invents fields and
  stale/self-review evidence is difficult to reject mechanically.
- Add a hosted reviewer registry or coordinator: supports identity and multi-writer history, but
  introduces deployment, privacy, consistency, and operational authority outside the local SAH
  boundary.
- Let `loop-record` automatically require or create a Checker review: tighter enforcement, but
  changes existing loop semantics and makes an optional judgment capability a universal lifecycle
  dependency.
- Invoke an LLM judge inside SAH: convenient, but adds provider cost, prompt/version authority,
  nondeterminism, and benchmark coupling; it would also confuse judgment with deterministic
  validation.

The selected design costs one explicit JSON artifact and one validation command, plus target-owned
reviewer orchestration and evidence capture. It does not prove the reviewer was truthful or that a
passed command's output was semantically sufficient; those remain judgment and target authority.

## Consequences and review trigger

Independent review can be carried across agents and sessions without a service, and a malformed,
stale-context, self-review, or mechanically blocked approval cannot be represented as a passing
review result. Existing lifecycle and exit-code contracts remain unchanged. The Markdown ARN review
is a target-owned view; future targets should publish the canonical JSON record and may render a
human view from it.

Revisit this decision before adding reviewer identity verification, concurrent writers, automatic
subagent dispatch, Git revision discovery, or making Checker review a universal S13 requirement.

Decision authority: SAH architecture authority for the local evidence contract; target owner for
review applicability and target-revision provenance; independent Checker for factual review content.
