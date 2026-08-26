# ADR-0035: Bind Human Dispositions to Contextual Verification

- Status: accepted
- Date: 2026-08-26
- Owners: SAH validation and lifecycle authority

## Context

S13 currently executes deterministic adapters and leaves assisted or judgment constraints
pending. That preserves the validation model, but it leaves a bounded target whose implementation
is complete yet whose remaining obligations are explicitly contextual without a durable way to
record the authorized risk decision. M-008 in the ARN target is this case: its three checks are
one judgment and two assisted obligations, and no live provider or independent Checker is in
scope.

## Decision

Add a separate `review-disposition/v0.1.0` record and `review-disposition` capability. A caller
must provide one schema-valid record whose target root, explicit target revision, design
fingerprint, bundle ID, completed source stage, and listed constraint IDs match the verification
context. Every entry must exactly match the current decision, classification, capability, scope,
invariants, and assigned slices; entries are limited to assisted or judgment constraints and
include an authority, rationale, evidence references, residual risks, and an expiry.

SAH performs only these mechanical checks. It does not authenticate the named authority, inspect
the cited evidence for adequacy, invoke a model, or infer target/Git state. An accepted and
unexpired entry emits a `pass` check with code `CONSTRAINT_DISPOSITION_ACCEPTED` while retaining
the original assisted or judgment classification. A rejected entry emits a violation; deferred
or expired entries remain pending; stale, mis-scoped, or unsupported records remain incomplete.
S13 accepts full verification when each current assignment has either a deterministic passing
check or an accepted contextual disposition. The standalone `review-disposition` command validates
the record, while `verify --disposition-record` consumes it in the bundle/target context.

## Alternatives considered

1. Reclassify the constraints as deterministic and reuse existing adapters. Rejected because it
   would make contextual adequacy look like an observable fact and violate the D/A/J contract.
2. Reuse the independent Checker review. Rejected because Checker is a separate read-only review
   surface with different scope, and M-008 explicitly excludes an independent Checker.
3. Keep S13 blocked until a live provider or model judge exists. Rejected for this bounded case:
   the target has an authorized human disposition need that does not require either integration.
4. Let SAH or an LLM decide whether the rationale is adequate. Rejected because that would make
   the local harness the authority for a contextual judgment and create an unverifiable semantic
   pass.

## Costs and consequences

- S13 now proves a mixed evidence condition rather than deterministic truth alone; consumers must
  inspect the check code and retained classification when interpreting a passed record.
- The caller remains responsible for naming a real authority and supplying adequate evidence;
  SAH's structural result cannot authenticate a person or replace human review.
- Dispositions expire and are bound to exact semantic artifacts and target context, so design or
  implementation drift requires a new record rather than silent reuse.
- The record adds a small schema and adapter surface, but it avoids a provider integration,
  coordination service, or universal judgment engine.

## Mitigation and review trigger

Documentation labels disposition-backed checks as accepted contextual risk, and verification keeps
deterministic, assisted, and judgment classifications visible. Tests cover accepted, rejected,
deferred, expired, stale-context, duplicate, and malformed cases. Revisit this decision if an
authenticated authority service is introduced, if multiple disposition policies need independent
workflow, or if S13 consumers require a stronger assurance level than a caller-supplied review
record can provide.
