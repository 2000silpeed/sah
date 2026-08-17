# Dogfood Walkthroughs and Model Repairs

This document owns the Phase 6 manual trials and the changes they forced. The trial was not
blind—the same run authored the fixtures—but reasoning began from each `problem.md`; hidden
expectations were used only for the final comparison. This limits evaluation strength but does
not remove the value of finding internal contract contradictions.

## Trial A: simple-crud equipment register

### S0–S2: evidence, characterization, strategy

S0 extracted: three authorized writers; independent item fields and unique asset tag; search,
archive, CSV, and one-year audit; fewer than 20,000 items; weekday tolerance; and unresolved
restore, concurrent-edit, and category ownership policies.

S1 kept one Equipment Administration subsystem with assurance as a cross-cutting concern.
Rules, invariant span, dataflow, distribution, autonomy, integration, scale, and change
isolation rated low; assurance rated medium; concurrency remained unknown. Quality scenarios
covered a valid edit, one-year audit retrieval, and filtered export. The first pass cited the
general edit requirement as evidence for unknown concurrency. That is trace-shaped but false:
the cited claim does not prove the requirement is absent. **Break R1.**

S2 selected `transaction-script-modular`, rejected a richer domain strategy because no
interacting rules were evidenced, and declared the short path. There were no mixed-strategy
seams. The short path was valid, yet S8 and the validator catalogue demanded two candidates or
a hard forcing constraint. Simplicity is not a hard constraint, and inventing a second
architecture solely for ceremony violates the model. **Break R2.**

### S3–S7: responsibility through representation

S3 found: authorize change; validate and accept/reject one item mutation; query/filter/export;
archive visibility; append and retrieve audit; surface validation errors. Change reasons kept
audit/authorization reviewable without making them remote subsystems.

S4 recorded asset-tag uniqueness, required-field validity, authorized mutation, archived
default exclusion, and audit retention. Concurrent edit and restore behavior remained open;
no last-write policy was invented. S5 assigned write/invariant authority to
`equipment-operations`; an audit collaborator owns append/retention but not equipment state.

S6 formed one deployable boundary protecting equipment rules, with an internal audit seam.
S7 chose a module of plain operations and data records plus a datastore; no repositories,
services, broker, or single-implementation interfaces were justified.

### S8–S11: candidate, decision, enforcement

After R2, S8 used an explicit one-member candidate set. Its structured short-path
justification resolves to the S2 alternative and its evidence, while the candidate identifies
its topology and operational consequences. S9 assessed the candidate against the must edit
scenario exactly once and accepted the operational simplicity cost: richer rules would force
re-entry at S2/S3. It kept concurrent editing as an isolated proposed policy. S10 selected the
modular candidate without pretending that policy was decided.

S11 classified uniqueness, authorization, audit append/retention, and archive-query behavior
as deterministic when mapped to storage/API facts. Catch-all naming and future model richness
remain assisted/judgment. No distributed check was generated.

S12 assigns the selected `equipment-operations` element, its accepted decision, and the
`equipment-owns-writes` constraint to one ready slice. The slice declares an integration check
with its expected result and explicit no-data-migration/rollback plans. It has no blockers or
dependencies. This is a valid structural handoff, not a claim that its slicing or check is
contextually sufficient.

The checked-in manifest now records S12 completion. Its `source-graph` write-authority
constraint uses selector `equipment-records` and predicate
`writers-belong-to-constraint-scope`. With an explicit target-local source mapping, the bounded
TypeScript adapter uses its declared project to confirm direct, path-alias, and static
named/star re-export calls belong to `equipment-operations`; an injected unmapped writer
violates. A changed equipment-operations path selects its assigned constraint while the adapter
still scans all sources; an unmapped changed writer forces full fallback and remains a
violation. Without mapping, or with unsupported source resolution, verification remains
incomplete rather than falsely passing. The separate target fixture and focused mutations do
not alter benchmark material or claim contextual architecture quality.

Post-run comparison matched the benchmark's dominant strategy and fatal-avoidance anchors.
The remaining uncertainty was preserved rather than scored as an architecture defect.

## Trial B: environmental observation delivery

### S0–S2: evidence, characterization, strategy

S0 extracted heterogeneous nightly/daytime inputs, raw preservation, validation/quarantine,
normalization/dedup/enrichment/summaries, lineage, 5 TB nightly scale, two-minute daytime
target, 48-hour lateness, 90-day replay, sender isolation, 30-day identifier deletion, and
unresolved correction/summary-closure policy.

S1 split Source Acquisition, Data Products, and Reference Stewardship. Dataflow, integration,
scale, and assurance rated high; temporal/distribution medium; privacy invariant criticality
high. Quality scenarios covered 08:00 publication, two-minute appearance, isolated bad input,
90-day replay, traceability, and deletion.

S2 selected integration-adapter for acquisition, functional-dataflow for data products,
distributed-event support for daytime delivery, and transaction scripts for stewardship.
The first-pass Strategy IR required interaction mode, fact owner, timing, consistency, failure,
and translation owner for every cross-strategy edge. Those are S5/S6 ownership and boundary
decisions, so S2 was forcing design before responsibilities. **Break R3.** The repaired S2
records only seams: participating problem regions, reason, concerns, evidence, and unresolved
questions.

### S3–S5: responsibilities, invariants, ownership

S3 found arrival preservation; source/schema identification; validation/quarantine;
standardization; deduplication; enrichment; aggregation; publication; lineage; replay;
late/correction handling; privacy deletion; failure isolation; and reference maintenance.

S4 required source fidelity, deterministic derivation by rule version, identity-based
idempotency, source+rule lineage, quality-gated publication, identifier-free analyst outputs,
and source-identifier deletion after 30 days. “Raw is immutable” and “raw identifiers are
deleted” appear contradictory unless applicability is explicit. Free prose can encode “until,”
but compilers and reviewers need the lifecycle condition as a field. **Break R4.**

S5 assigned acquisition/source truth, curated-product publication, reference stewardship, and
privacy governance separately. Privacy governance owns the deadline; source storage executes
deletion and reports completion. No owner silently spans every dataset.

### S6–S11: boundaries, candidates, decisions, enforcement

S6 turned seams into owned interfaces and relations: sender acquisition to preserved arrival,
arrival to normalized facts, facts to summaries, and privacy policy to deletion executors.
Only here did it choose file/batch and message/low-latency interaction semantics. S7 chose
adapters, immutable datasets, pure transformations, explicit orchestration, and a simple
stewardship module—not a service per transformation.

S8 compared (A) one execution technology for all inputs with (B) separate batch and low-latency
orchestration sharing contracts and transformation logic. S9 favored B because the 5 TB/08:00
and two-minute scenarios differ operationally; it accepted duplicated operations but rejected
duplicated business transformations.

The correction and summary-closure policy was still unresolved. The original S10 language
said unresolved authority blocks selection, which would freeze unrelated acquisition, privacy,
and lineage work. Silently choosing was worse, but global blocking was too coarse. **Break
R5.** The repair permits a selected architecture with a proposed decision only when the
uncertainty is isolated and S12 blocks every dependent implementation slice.

S11 made schema/lineage reference integrity, raw write-once-before-expiry, identifier removal,
30-day deletion completion, quality-gated publication, and replay artifact presence
deterministic. Failure-isolation and idempotency adequacy are assisted; correction semantics
and closure policy remain pending judgment. Post-run comparison matched the expected mixed
strategy and all fatal-avoidance anchors.

## Repairs forced into the model

| ID  | Broken contract                                                          | Model repair                                                                                                       | Files changed                                               |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| R1  | Unknown ratings could cite unrelated positive evidence.                  | Unknown cites the inspected source and explicitly states the missing fact; examples use distinct absence evidence. | characterization doc and schema example                     |
| R2  | Short path still required artificial architecture alternatives.          | Permit one S8 candidate with eligible short-path proportionality evidence and S2 alternative analysis.             | reasoning/validation models and Architecture schema/runtime |
| R3  | S2 composition contracts decided ownership and interaction before S3–S6. | Replace them with representation-free composition seams; S6 owns full interfaces/relations.                        | strategy, reasoning, architecture-model, Strategy schema    |
| R4  | Time-bounded or superseding obligations existed only inside prose.       | Add required invariant `applicability`, read by boundary and constraint work.                                      | reasoning and Invariant schema                              |
| R5  | One unresolved policy blocked selection of the whole architecture.       | Allow scoped readiness: isolate proposed decisions and block only dependent S12 slices.                            | reasoning and architecture-model                            |

These are reasoning-model changes, not relaxed benchmark expectations. Both benchmark files
remain unchanged.
