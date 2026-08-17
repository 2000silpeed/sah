# Validation Model

This document owns the determinism split, validator catalogue, enforcement lifecycle, and
exception semantics. The catalogue is exhaustive for the current slice: a capability not
listed here is unsupported, not implicitly deterministic.

## Classifications

- **Deterministic (D):** complete observable inputs and a fixed predicate produce the same
  result. It may block when an accepted decision makes the rule applicable.
- **Assisted (A):** deterministic facts narrow a contextual question, then an LLM or human
  interprets them. It emits evidence and a review obligation, not a hard architecture fail.
- **Judgment (J):** adequacy depends on incomplete context, alternatives, and trade-offs. An
  LLM applies a rubric with confidence; an authorized human accepts material risk.

Classification concerns epistemic capability, not implementation convenience. A slow rule
can be deterministic. A perfectly repeatable LLM setting is still judgment if the proposition
has no complete observable specification.

## Catalogue

| Capability                                                       | Class | Observable boundary and result                                                                                             |
| ---------------------------------------------------------------- | ----: | -------------------------------------------------------------------------------------------------------------------------- |
| JSON Schema shape and formats                                    |     D | IR bytes against the declared Draft 2020-12 schema.                                                                        |
| Unique IDs and valid cross-IR references                         |     D | Bundle ID graph; report duplicate or dangling paths.                                                                       |
| Required field trace annotations                                 |     D | Schema `properties`; require non-empty writer and reader lists.                                                            |
| Stage-state completeness                                         |     D | Gate-specific required fields/status; e.g. no `undecided` after S7.                                                        |
| Trace presence from representation to evidence                   |     D | Reference reachability through element → responsibility/invariant → evidence.                                              |
| Trace evidence adequacy                                          |     J | Decide whether cited evidence actually supports the claim.                                                                 |
| Material requirement coverage                                    |     A | Find uncited requirements mechanically; judge whether mapped responsibilities cover meaning.                               |
| Staleness/change-impact propagation                              |     D | Traverse changed IDs through declared references and mark dependents stale.                                                |
| Characterization completeness                                    |     D | Every subsystem has all ten ratings and evidence/unknown markers.                                                          |
| Characterization correctness                                     |     J | Judge ratings, omitted forces, and whether evidence deserves its weight.                                                   |
| Subsystem merge/split suggestion                                 |     A | Compare ratings, ownership, and relation density; reviewer decides boundaries.                                             |
| Strategy trace and alternative presence                          |     D | Require dimension/evidence links, costs, and at least one alternative.                                                     |
| Strategy identifier registration                                 |     D | Every selected strategy ID resolves to a Method Library definition with required semantics.                                |
| Strategy appropriateness                                         |     J | Compare forces, simpler options, failure modes, and ceremony.                                                              |
| Responsibility statement representation leakage                  |     A | Flag class/service/repository vocabulary; judge imposed constraints and intent.                                            |
| Responsibility semantic coverage                                 |     J | Judge whether required outcomes and quality responses are actually represented.                                            |
| Duplicate or low-cohesion responsibilities                       |     A | Surface semantic similarity and divergent change reasons; reviewer resolves.                                               |
| Owner/reference coverage                                         |     D | After S5, require an owner or an explicit unresolved conflict.                                                             |
| Ownership appropriateness                                        |     J | Judge authority, information, cohesion, and change reason.                                                                 |
| Invariant structural completeness                                |     D | Require trigger, obligation, criticality, consistency, failure, detection, and recovery.                                   |
| Invariant consistency contradiction                              |     A | Compare span, owner, and stated consistency; judge whether the model is wrong.                                             |
| Invariant adequacy                                               |     J | Judge whether critical business, safety, distributed, and agent obligations are missing.                                   |
| Boundary trace presence                                          |     D | Require protected change/risk, owner, members, and decision references.                                                    |
| Boundary quality                                                 |     J | Judge semantic cohesion, change isolation, and whether translation belongs there.                                          |
| Representation ordering                                          |     D | Reject accepted representation whose responsibility/owner/boundary traces are absent.                                      |
| Representation proportionality                                   |     J | Judge whether function/module/service/agent complexity is warranted.                                                       |
| Candidate count or single-option evidence                        |     D | Require two options, a hard forcing constraint, or eligible short-path proportionality evidence linked to S2 alternatives. |
| Candidate coherence and material difference                      |     J | Judge whether options are viable and differ in a real trade-off.                                                           |
| Quality-scenario assessment coverage                             |     D | Every must scenario has a result for every candidate.                                                                      |
| Quality-scenario satisfaction                                    |     A | Verify measures where test/telemetry exists; judge projections and causal claims.                                          |
| Accepted decision integrity                                      |     D | Selected option exists; authority, costs, consequences, and review triggers exist.                                         |
| Trade-off quality and risk acceptance                            |     J | Judge whether losses are real and accepted by appropriate authority.                                                       |
| Decision-to-constraint trace                                     |     D | Every constraint references an accepted decision and valid scope.                                                          |
| Constraint observability contract                                |     D | Deterministic constraints require fact source, selector, predicate, and expected value.                                    |
| Constraint classification correctness                            |     A | Inspect observability and flag category inflation; reviewer may reclassify.                                                |
| Implementation slice coverage                                    |     D | Every selected element and applicable constraint is assigned to a slice covering its scope.                                |
| Implementation decision/blocker assignment                       |     D | Accepted decisions accompany affected slices; affecting proposed decisions block them.                                     |
| Implementation dependency order                                  |     D | Slice references resolve with no self-dependency or cycle.                                                                 |
| Implementation handoff adequacy                                  |     J | Judge slice cohesion, acceptance checks, migration, rollback, and executable usefulness.                                   |
| Source-to-element mapping syntax                                 |     D | Configured path/symbol selectors resolve uniquely or fail as unsupported.                                                  |
| Source-to-element mapping inference                              |     A | Suggest mappings from paths/symbols/ownership; human confirms before hard checks.                                          |
| Forbidden dependency/import direction                            |     D | Extracted source graph against an accepted allow/deny relation.                                                            |
| Dependency cycles                                                |     D | Graph cycle detection within the decision's declared scope and dependency types.                                           |
| Boundary bypass and unauthorized writes                          |     D | Mapped calls/writes against interface and owner authority.                                                                 |
| Layer/module independence                                        |     D | Source graph against a project decision; no universal layering rule exists.                                                |
| API/schema compatibility                                         |     D | Machine-readable contracts under the selected compatibility policy.                                                        |
| Message delivery/ordering configuration                          |     D | Declared broker/config facts against explicit decision predicates.                                                         |
| Runtime latency, error, cost, and staleness bounds               |     D | Telemetry/tests against numeric scenario thresholds with defined windows.                                                  |
| Test/evaluation artifact presence                                |     D | Required named artifact, dataset, or check exists and is runnable.                                                         |
| Test/evaluation sufficiency                                      |     J | Judge scenario realism, coverage, leakage, and acceptable risk.                                                            |
| Agent tool permission allow/deny                                 |     D | Tool manifest and invocation log against an accepted permission policy.                                                    |
| Agent fallback and human-control wiring                          |     A | Detect declared routes and tests; judge whether behavior is safe and usable.                                               |
| Data lineage/reference completeness                              |     D | Declared stage and dataset graph has no missing required edge or owner.                                                    |
| Replay/idempotency evidence                                      |     A | Surface keys, tests, and retry paths; judge behavior under real failure.                                                   |
| Naming pattern required by a decision                            |     D | Symbols/paths against the scoped pattern.                                                                                  |
| Catch-all, god-object, anemic-model, and gratuitous-layer smells |     A | Size, fan-in/out, names, and behavior distribution produce a weighted finding with escape evidence.                        |
| Cohesion/coupling and change-boundary fit                        |     A | Dependency and co-change facts inform a reviewer; counts alone never fail.                                                 |
| Methodology neutrality audit                                     |     A | Scan strategy/representation defaults and schema enums; judge whether a preference is unjustified.                         |
| Benchmark score calculation                                      |     D | Frozen rubric inputs and weights produce a reproducible numeric result.                                                    |
| Benchmark architectural scoring                                  |     J | Calibrated judge applies domain expectations; human arbitrates disputed fixture changes.                                   |

## Applicability and compilation

A capability's class does not make it universally applicable. S11 compiles a project
constraint only from an accepted decision or a universal SAH integrity rule. For a
deterministic constraint, the compiler binds its observable contract to an available fact
adapter. No binding yields `unsupported`; it never yields pass.

Assisted checks use thresholds only to select evidence for review. “Service has 20 methods”
may trigger a smell finding but cannot prove incohesion. Judgment checks cite the rubric,
input bundle, model/version, confidence, and counter-evidence; low confidence escalates rather
than silently accepting.

## Continuous enforcement loop

1. On every IR change, run schema, reference, stage, trace, and decision-integrity checks.
2. On code change, map the diff to elements and run affected deterministic constraints.
3. Emit assisted findings when changed facts cross a review trigger; deduplicate by source
   decision and evidence fingerprint.
4. Schedule judgment review when an assumption is falsified, a quality threshold trends out
   of bounds, repeated exceptions accumulate, or a decision's review trigger fires.
5. Route a code contradiction to implementation repair, a mapping gap to adapter backlog,
   and changed design forces to the earliest S0–S10 stage.

## Executable structural slice

Run 2 implements bundle loading, schema/format checks, schema field traces, cross-IR identity
and references, decision/constraint backlinks, and selected S5–S11 completeness gates. These
are deterministic because the manifest supplies explicit lifecycle and artifact declarations.
Through S11, proposed-decision isolation produces an assisted warning because no S12 slice is
yet authoritative.

Run 3 reuses those same deterministic predicates to test a proposed exact-next lifecycle
before committing it. Missing gate implementations are operational `unsupported` outcomes,
not validation passes. Deterministic errors block advancement; warnings alone do not.

Run 4 makes S8 structurally executable. It deterministically checks candidate count and
status, candidate topology and assessment references, and resolved evidence for a justified
single candidate. A short-path justification must match the manifest profile, S2 eligibility,
and every selection's evidence and alternative analysis; a forcing justification must resolve
to a declared hard constraint. Candidate coherence, material difference, proportionality,
and trade-off quality remain judgment capabilities.

Run 5 makes S9 structurally executable. It requires exactly one assessment for every
candidate/must-scenario pair, rejects duplicate pairs, and keeps candidates, decisions, and
selected-option state pre-selection through S9. A non-pass must result emits an assisted
warning because result adequacy and risk acceptance are contextual. Missing coverage or wrong
stage state blocks S8→S9; the warning alone does not.

Run 6 adds canonical Implementation Handoff IR and makes S12 structurally executable. It
checks selected-element and applicable-constraint coverage, accepted-decision context,
proposed-decision blockers, ready/blocked consistency, and an acyclic slice dependency graph.
The S10 isolation warning applies only through S11; at S12 the required slice facts make
blocker coverage a deterministic predicate. The runtime supports exact targets S5–S12.

Run 7 executes the first S13 fact binding. It selects constraints through canonical S12 slice
assignment and supports only a confined target-relative regular-file-presence predicate.
Blocked-only and contextual constraints remain pending; unavailable capabilities and unsafe
bindings are unsupported; target access failures are operational. The exact capability is
owned by [Validation CLI usage](validation-cli.md), while ADR-0010 owns its scope decision.
A structurally valid deterministic observable still is not a claim that target code passes it.

Run 8 executes one TypeScript source-graph binding:
`writers-belong-to-constraint-scope=true`. Explicit target-local configuration maps complete
source roots and path prefixes to validated Architecture element IDs and maps the observable
selector to one direct named write export. Direct relative named imports and calls are
deterministic; an outside or unmapped writer violates. Configuration defects are operational,
while incomplete language/symbol resolution is unsupported. ADR-0011 owns the mapping and
parser boundary; no general dependency graph or constraint compiler is implied.

Each result reports capability, classification, applicable decision, scope, observed facts,
expected proposition, status (`pass`, `violation`, `finding`, `pending`, `unsupported`, or
`error`), and remediation/exception path. Runs 7–8 formalize the deterministic subset as public
verification checks with `pass`, `violation`, `pending`, or `unsupported`; operational errors
remain diagnostics rather than fabricated checks.

## Exceptions

An exception names the violated constraint, authority, rationale, compensating check, issue,
and expiry. Expiry is mandatory unless the decision itself is superseded. An exception never
changes the underlying result to pass; reports show accepted risk separately. Repeated or
renewed exceptions trigger S10 review because they are evidence that the decision or mapping
may be wrong.

## False-positive policy

Prefer an `unsupported` or assisted finding over a false hard failure. Deterministic checks
must expose the exact extracted path or fact so mapping errors are distinguishable from code
violations. Heuristic weights are benchmarked, versioned, and provide escape hatches. No
anti-pattern name is a verdict without the responsibility, invariant, change, and quality
context it allegedly harms.
