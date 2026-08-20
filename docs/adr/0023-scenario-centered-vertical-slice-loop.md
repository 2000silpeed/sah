# ADR-0023: Add scenario-centered vertical slices to the local iteration loop

## Status

Accepted for Run 23.

## Context

The iteration loop already routes risk, runs target-owned checks, binds evidence to an explicit
revision/fingerprint, records learnings, and projects the next task. It still treats a task as a
goal plus checks, so a green check can advance an implementation task without a durable statement
of the user-visible behavior it proves. A later agent or session must reconstruct that intent from
conversation or prose, which weakens the agile vertical-slice workflow.

SAH must remain a methodology-neutral local harness. It cannot infer product direction, invoke a
model, become a hosted backlog, or turn a scenario label into a deterministic architecture claim.
The design bundle and S0–S13 remain the authorities for architecture and lifecycle evidence.

## Decision

Extend the existing loop artifacts additively with two small contracts:

1. `direction.scenarios` declares stable user-observable scenario IDs, descriptions, and expected
   outcomes.
2. `taskContract.slice` selects scenario IDs and the check IDs that are its acceptance evidence.

The check runner emits `sliceEvidence` linking each selected scenario to those exact
`iterationId:checkId` results. Recording a succeeded slice requires every selected scenario to be
covered by passing, exit-zero acceptance checks. A completion request for a direction with
scenarios must provide exact `scenarioResults` coverage whose references resolve to passing checks
from an iteration slice that owns the scenario. Directions without scenarios follow the existing
criterion-only behavior, so old artifacts and commands remain valid.

The loop result includes declared scenarios so a different agent/session can understand the
current task's user-visible intent without reading the whole loop. Next-task projection copies an
existing slice contract only; it never creates, edits, or prioritizes scenarios. Missing or
ambiguous scenario intent is an elicitation question for the host agent, not a SAH default.

## Alternatives and costs

- Keep goals and checks only: smallest change, but user value and acceptance lineage remain
  implicit and cross-session continuation requires conversation archaeology.
- Add a separate scenario/evidence database: richer history, but introduces a second writer,
  synchronization, privacy, and hosted-coordination authority outside the local product boundary.
- Make scenario fields mandatory or replace schema versions: stronger enforcement, but breaks
  existing loop fixtures and forces migration before the user can continue an older run.
- Let SAH generate scenarios from natural language or call an LLM: convenient, but makes product
  direction nondeterministic, provider-dependent, and impossible to treat as authoritative.

The selected additive fields cost a few explicit IDs and evidence mappings. They do not prove that
an acceptance command semantically covers a scenario, that a human accepted the behavior, or that
the architecture is sound; those remain target/Checker judgment. The runtime must maintain both
the task's duplicated check list and the selected slice references, increasing validation surface,
but it avoids changing the established CLI and atomic writer.

## Consequences and review trigger

An agent can start a new session from a loop result that names the current user scenario, selected
slice, exact acceptance checks, revision, and design fingerprint. A successful iteration or local
product completion cannot be claimed when scenario evidence is missing, stale, non-passing, or
outside the owning slice. Existing fast/reasoning/blocked/complete routes and exit codes remain
unchanged; S13 still requires its separate full verification record and atomic S12→S13 gate.

Revisit this decision before adding automated scenario discovery, user-acceptance integrations,
multiple writers, scenario version migration, hosted history, or making scenario coverage a
universal requirement for architecture-only loops.

Decision authority: SAH architecture authority for the local contract and deterministic linkage;
product owner for scenario meaning and acceptance scope; target workflow for revision provenance;
independent Checker for any required judgment review.
