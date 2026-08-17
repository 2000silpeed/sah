# ADR-0008: Represent architecture candidate sets explicitly

Status: Accepted · Date: 2026-08-17 · Supersedes: —

## Context

S8 requires at least two architecture candidates or explicit evidence for one. Architecture
v0.1 serializes exactly one candidate beside one global topology, so a deterministic S8 gate
could only support the short path and could not associate topology or S9 assessments with a
candidate. The canonical model must change before advancement can claim S8.

## Options considered

1. Keep singular `candidate` and implement only a short-path gate
2. Add a parallel optional candidate-comparison field beside the legacy candidate
3. Migrate to one plural candidate set with candidate-owned topology references ← chosen
4. Store one Architecture artifact per candidate and expand manifest role multiplicity

## Decision

Architecture schema v0.2.0 replaces `candidate` with `candidates`. Every candidate owns stable
references to its elements, boundaries, relations, and interfaces, plus explicit operational
consequences. S9 quality assessments gain `candidateRef`.

A one-candidate set carries `singleCandidateJustification` with a kind, evidence references,
S2 alternative strategy references, and hard-constraint references. Short-path justification
requires the short manifest profile, S2 eligibility, evidence, and alternative coverage.
Forcing justification requires a referenced hard constraint. Two or more candidates need no
single-candidate waiver. Contextual adequacy remains judgment.

Because the property and reference graph are breaking, Architecture and bundle manifest schemas
move together to v0.2.0. Other IR schema IDs remain v0.1.0. No dual read path or silent adapter
is kept before a real compatibility consumer exists.

## Trade-offs accepted

+ S8 count/evidence and S10 selection now have complete observable inputs.
+ Candidate topology and later quality results have one canonical owner/reference path.
− Existing v0.1 manifests and Architecture artifacts require explicit migration.
− Candidate references add authoring ceremony and can expose incomplete topology sooner.
− S9 still needs a later coverage gate; schema support alone does not claim evaluation quality.

Mitigation: migrate the shipped fixture and examples atomically, return normal schema diagnostics
for old bundles, document the version boundary, and defer compatibility machinery until an
external consumer exists.

## Consequences

Reference validation includes candidate IDs, topology references, assessment candidate links,
and single-candidate evidence. S8/S9 require proposed candidates. From S10 exactly one candidate
is selected and every other candidate is rejected. Reconsider storage multiplicity only if
candidate artifacts need independent revision or become too large for one Architecture IR.
