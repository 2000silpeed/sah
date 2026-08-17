# Structured Architecture Model

This document owns the canonical IR suite, cross-IR semantics, and the relationship to C4
and ADRs. JSON Schemas own serialized shape. The reasoning model owns stage gates.

## Why seven IRs

| IR                      | Owns                                                                                               | Deliberately excludes                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| System Characterization | scope, evidence, uncertainty, problem regions, force ratings, quality scenarios                    | methods and implementation forms                                                    |
| Design Strategy         | per-subsystem strategy, alternatives, costs, mixed-edge seams, short-path decision                 | ownership, interaction mechanisms, and architecture elements                        |
| Responsibility          | required outcomes, inputs/outputs, triggers, change reasons, collaborators, logical ownership      | classes, services, and technology                                                   |
| Invariant               | precise obligations, consistency, failure, detection/recovery, enforcement ownership               | generic “business rules” with no trigger or failure meaning                         |
| Architecture            | candidate sets over elements, boundaries, relations, interfaces, scenario assessments, constraints | requirement prose and unstructured ADR text                                         |
| Architecture Decision   | evaluated options, evidence, authority, costs, consequences, reversal and review triggers          | architecture facts already owned by Architecture IR                                 |
| Implementation Handoff  | executable S12 slices, dependencies, checks, migration/rollback, readiness, and decision blockers  | selected architecture facts, source mappings, execution results, and generated code |

The split follows different writers and gates. Merging responsibility and architecture would
permit representation during S3. Merging decisions and architecture would either duplicate
elements inside options or erase rejected alternatives. No separate “methodology IR” exists:
the strategy identifier and its evidence are the only downstream facts that need transport.

## Identity and references

Identifiers are stable lowercase kebab-case within a design bundle. References are IDs, not
embedded copies, so an IR can be diffed independently. `modelId` identifies one versioned
artifact; external storage will supply revision metadata rather than polluting semantic IR.

Bundle lifecycle and artifact locations are non-semantic metadata in `sah.bundle.json`, whose
schema is separate from the seven IRs. `lifecycle.completedStage` states which gate is claimed
complete; validators must not infer it from optional fields or present files. ADR-0006 owns
the representation decision and the manifest schema owns its serialized shape. Advancement
validates a proposed explicit stage, then atomically changes only this metadata field; it does
not revise, infer, or normalize any semantic IR fact. ADR-0007 owns that transition decision.

Target source mapping is also non-semantic metadata, but it is explicit adapter configuration
rather than bundle lifecycle/storage metadata. It remains in the target checkout, outside the
manifest and seven IRs, and may map paths only to already validated Architecture element IDs.
Its schema owns serialized shape; ADR-0011 owns the separation and TypeScript boundary.

Architecture IR v0.2 makes candidates an explicit set. Each candidate points to the topology
it uses and states operational consequences; an assessment identifies the candidate it
evaluates. A single-candidate set carries structured short-path or forcing-constraint
evidence. ADR-0008 owns the coordinated manifest/Architecture schema migration; the schemas
remain the sole authority for serialized shape.

S5 may reserve a `logicalOwnerRef` before Architecture IR exists. S6 must materialize every
such owner as an architecture element with matching authority. A full-bundle reference
validator rejects dangling evidence, subsystem, responsibility, invariant, element,
interface, decision, option, scenario, and constraint references. JSON Schema alone cannot
establish referential integrity.

References form this dependency graph:

```text
Characterization → Strategy → Responsibility ─┐
                         └──→ Invariant ───────┼→ Architecture
Characterization.qualityScenarios ────────────┘       ↕
                                              Architecture Decision
                                                       ↘
                                              Architecture.constraints
Architecture + Architecture Decision ───────→ Implementation Handoff
```

The Architecture/Decision cycle is by stable ID: S9 proposes decisions against candidate
elements, S10 attaches accepted decision IDs, and S11 attaches generated constraint IDs back
to decisions. Serializers must not inline either side.

## Draft, candidate, and selected state

S0–S7 operate on partial but schema-valid IR. Optional ownership and representation fields
make incompleteness visible; absence is not inferred as approval. Semantic gates impose the
stronger conditions:

- after S5, every responsibility and invariant has an owner or an unresolved conflict;
- after S7, no architecture element remains `undecided`;
- after S8, the candidate set contains at least two proposed candidates, or one proposed
  candidate with resolved forcing-constraint evidence or eligible short-path evidence tied
  to S2 alternatives;
- after S9, every candidate/must-priority scenario pair has exactly one assessment, candidates
  and decisions remain `proposed`, and no decision option is selected before S10;
- after S10, exactly one candidate is `selected`, every other candidate is `rejected`,
  accepted decisions have a selected option and authority, and rejected alternatives remain
  in the log; proposed decisions may
  remain only behind an owned seam and block every dependent S12 slice;
- after S11, each accepted decision is classified into deterministic, assisted, or judgment
  enforcement, even when it generates no hard rule;
- after S12, every selected element and applicable constraint is assigned to an acyclic slice;
  accepted decisions accompany affected slices, and proposed decisions block each affected
  slice explicitly.

An IR update changes `modelId` only when it becomes a separately addressable artifact. Source
control supplies revision history; SAH does not add mutable revision counters with no
reasoning consumer.

Candidate count, status, and reference resolution are deterministic. Whether candidates are
coherent, materially different, proportionate, or good trade-offs remains judgment; a valid
candidate set is not an architecture-quality endorsement.

Assessment coverage and pair uniqueness are deterministic because candidate IDs, scenario
priorities, and assessment references are complete inputs. A non-pass result triggers assisted
review: the serialized enum cannot prove the measure, causal evidence, or risk authority is
adequate.

## Implementation handoff

Implementation Handoff IR is written by S12 and read by coding-agent integration and S13. Its
root references identify the selected Architecture and Decision artifacts. Each stable slice
names an outcome, ready/blocked state, selected elements, applicable constraints, accepted
decisions, proposed-decision blockers, explicit slice dependencies, acceptance checks with
expected results, and migration and rollback needs.

Dependency references, not array order, define execution order. Self-references and cycles are
invalid. A constraint applies when its element scope intersects the selected candidate and must
be assigned to a slice covering that scope. These reference, status, and coverage rules are
deterministic. Whether the slices, checks, or operational plans are adequate remains judgment;
schema-valid handoff is not an implementation-quality endorsement. ADR-0009 owns the seventh
IR decision and the schema owns serialized shape.

At S13, handoff assignment determines which constraints belong to ready or blocked slices.
Execution results are runtime evidence, not another canonical IR: they retain constraint,
decision, element, and slice IDs without being written back into Architecture or Handoff.
ADR-0010 owns the first explicit-target filesystem capability and its no-schema-change choice.
ADR-0011 owns the explicit target-local source mapping used by the bounded TypeScript adapter;
neither execution result nor mapping becomes canonical design meaning.

## Elements and relations

An element is a logical owner before it is a deployment unit. Its `logicalRole`, `authority`,
and responsibility/invariant references justify its existence. S7 adds one representation;
adapters may explicitly map modules or services to code and deployment facts, but path
convention alone cannot establish ownership.

A boundary groups elements because it protects a named change or risk, not because a diagram
needs a box. An interface is owned and states contract, versioning, consistency, and failure
semantics. A relation expresses collaboration direction and meaning. Containment alone never
proves allowed dependency direction.

The core relation catalogue is intentionally small: containment, call, publish/subscribe,
transform, read/write, control, tool use, and human approval. A new relation kind needs a
reasoning writer and a validator or view consumer.

## Constraints

Constraints live in Architecture IR because they govern selected elements and relations, but
each points to the accepted decision that authorized it. A deterministic constraint requires
an observable fact source, selector, predicate, expected result, enforcement timing, failure
message, and exception policy. Assisted and judgment constraints may omit `observable`; their
enforcement names a review capability and trigger instead.

JSON Schema validates shape. Reference validators validate graph integrity. Semantic
validators enforce stage gates. Language adapters extract code facts. LLM judges evaluate
contextual adequacy. These layers must report their own certainty and must not impersonate one
another.

## Field traceability

Every serialized property contains an `x-sah-trace` annotation:

- `writtenBy` names the reasoning stage allowed to create or revise the field;
- `readBy` names at least one downstream stage, validator, adapter, judge, or reviewer.

Schema verification walks every `properties` entry and fails if either list is missing or
empty. The annotations are the authoritative field-level trace table; duplicating hundreds
of JSON pointers here would create a second source. `$defs` primitives are not serialized
fields—the property that references them carries the trace.

Delete a field if its last reader disappears. Adding a field requires updating the producing
stage contract, at least one consumer, its schema example, and any affected benchmark.

## Relationship to C4

C4 is a view adapter, not the model. Stable elements, containment, and relations can project
to system, container, and component views when those levels fit. Pipelines, immutable data,
state machines, agents, queues, authority, invariants, decisions, and constraints remain SAH
semantics even when a C4 renderer cannot show them. View metadata belongs in adapter
configuration, not canonical IR.

## Relationship to ADRs

Architecture Decision IR is the machine-readable source for future rendered ADRs. Human ADR
Markdown in this repository records decisions about SAH itself and follows the same minimum
semantics manually. SAH never reconstructs accepted options, costs, or constraints by parsing
free-form Markdown. A future importer may create a proposed decision with unresolved fields;
only S10 can accept it.

## Change impact

Changed evidence invalidates its ratings, strategies, responsibilities, invariants,
decisions, and constraints transitively. A changed strategy invalidates downstream ownership
and representation, not the original evidence. A code violation alone does not rewrite the
model: S13 either repairs code, approves an expiring exception, or reopens the decision when
the underlying force changed.
