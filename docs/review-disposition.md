# Review Disposition Contract

This document owns the bounded evidence contract for a caller-supplied disposition of an
assisted or judgment architecture constraint. It is a contextual risk record, not a deterministic
claim about target behavior and not the independent Checker review contract.

## Record

`review-disposition/v0.1.0` is a bundle-local JSON record with:

- target root, explicit target revision, and the current design fingerprint;
- the S12 bundle ID and the exact contextual constraint IDs covered;
- a named authority and a transparent recorder identity;
- one entry per covered constraint, including the current decision, classification, capability,
  scope, invariants, assigned slices, disposition, rationale, evidence references, residual risks,
  and expiry;
- a review timestamp.

The validator requires non-empty fields and unique constraint IDs. Verification additionally
matches every trace field to the current S12 Architecture and Implementation Handoff. A record
cannot widen its scope, accept a deterministic constraint, omit a current assignment, or reuse a
different target revision or design fingerprint. The caller must pass `--target-revision`; SAH
never discovers it.

## Outcomes

| Entry state | Verification check | Overall meaning |
| --- | --- | --- |
| accepted and unexpired | `pass`, `CONSTRAINT_DISPOSITION_ACCEPTED` | The named authority accepted the contextual residual risk. |
| rejected | `violation`, `CONSTRAINT_DISPOSITION_REJECTED` | The authority did not accept the obligation. |
| deferred | `pending`, `CONSTRAINT_DISPOSITION_DEFERRED` | A decision is still required. |
| accepted after expiry | `pending`, `CONSTRAINT_DISPOSITION_EXPIRED` | The record must be renewed. |
| stale, duplicate, or mismatched | `unsupported` | The evidence cannot be applied to this constraint/context. |

The check retains `classification: assisted` or `judgment` and does not expose an observable
expected fact. A passed verification containing this code is therefore disposition-backed, not
proof that SAH observed the implementation satisfying a deterministic proposition. S13 requires
full scope, internally consistent summaries, current trace fields, and one deterministic pass or
accepted disposition for every S12-assigned constraint.

## Authority boundary

`review-disposition` validates record shape, references, context, and expiry. It does not
authenticate `authority.id`, execute commands, inspect evidence references, decide whether a
rationale is sufficient, invoke a provider, or mutate lifecycle. Those remain the responsibility
of the named authority and the target owner. Malformed/unreadable record input is operational;
valid but stale, rejected, deferred, expired, or incomplete evidence is non-passing verification.

Use `sah review-disposition <record> --target-revision <revision> --design-fingerprint <sha256>`
for standalone mechanical validation. Use `sah verify <bundle> <target> --disposition-record
<target-relative-record> --target-revision <revision> --record <bundle-record>` to bind it to a
current bundle and target, then use `sah advance <bundle> S13 --verification-record <bundle-record>`
only when the full verification record is eligible.
