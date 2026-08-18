# Elicitation and Method Selection

Use this reference for S0–S5. It converts conversation and repository observations into design
evidence without forcing one methodology or making the user fill a long form.

## Adaptive question loop

Start by reading observable evidence. Build a private working table with four columns: known fact
and locator, confidence, decision affected, and remaining uncertainty. Do not ask the user for facts
that code, tests, policies, configuration, or supplied documents already answer.

Rank missing information by:

1. safety, legal, privacy, money, or irreversible data impact;
2. ability to change subsystem boundaries, ownership, consistency, or failure recovery;
3. cost of reversing a wrong assumption;
4. uncertainty and lack of local observability.

Ask the top one or two questions. Include one sentence explaining why they matter. Normalize each
answer as stakeholder evidence with a conversation/date locator; retain the user's wording in the
provenance input when available. Check answers against repository evidence and ask a focused
follow-up when they conflict.

Repeat until the current stage gate has enough evidence. Do not ask low-impact preference questions
merely to appear thorough. Useful question families include:

- outcome and explicit non-goals;
- affected users, owners, and decision authority;
- measurable volume, latency, availability, retention, and recovery expectations;
- invariants before and after important state changes;
- concurrent edits, ordering, duplication, retries, and stale data;
- external systems, semantic authority, volatility, and failure behavior;
- privacy, security, audit, regulatory, migration, and rollback obligations;
- team/deployment constraints and expected independent change;
- acceptable degradation and evidence that would reverse a choice.

If the answer is “unknown,” record the question, consequence, and resolution owner. Ask whether an
explicit reversible assumption is acceptable only when progress can stay safe. If not, block the
dependent decision. If the user says “you decide,” choose the lower-ceremony reversible option,
label it as an assumption or agent judgment, name confidence/counter-evidence, and define a review
trigger.

## Characterize problem regions

Split a system only where evidence shows different forces or change reasons. Before S6, call each
part a problem region or subsystem; do not imply a deployable service.

Rate these dimensions `low`, `medium`, `high`, or `unknown` with evidence and rationale:

| Dimension | Ask what makes it material |
| --- | --- |
| rule change complexity | interacting policies, exceptions, lifecycle rules |
| invariant criticality | harm and recovery cost when a rule fails |
| dataflow orientation | transformation stages, lineage, replay, batch/stream behavior |
| distribution consistency | independent authority, partial failure, stale replicas |
| concurrency temporality | races, ordering, deadlines, offline work, state transitions |
| autonomy uncertainty | probabilistic decisions, tools, memory, human control |
| integration volatility | partner churn, protocol/semantic translation, substitution |
| scale performance | measured load, latency, throughput, storage, hot paths |
| assurance governance | security, privacy, audit, regulation, approvals |
| change isolation | independently changing owners, deployments, or release cadence |

Convert important quality language into source/stimulus/environment/artifact/response/measure
scenarios. A hard constraint needs accepted authority, scope, an observable fact contract, failure
meaning, and exception authority/expiry. Otherwise keep it as evidence, an assumption, or a review
finding.

## Select strategy per subsystem

Ratings generate candidates; they do not mechanically select a strategy. Choose one dominant
strategy and only justified supporting strategies for each subsystem:

| Strategy | Candidate when | Reject or simplify when |
| --- | --- | --- |
| `transaction-script-modular` | independent records, local transaction, modest rules | interacting policy or critical cross-record invariants dominate |
| `responsibility-centered-domain` | interacting rules and cohesive invariant owner matter | direct transformations or CRUD protect the same rules |
| `functional-dataflow` | transformations, lineage, replay, explicit effects dominate | data movement is incidental and stateful policy dominates |
| `state-machine-concurrent` | legal transitions, races, ordering, or temporal rules dominate | a small transaction/lock covers the evidenced state space |
| `distributed-event-driven` | independent authority, partial failure, or async decoupling is forced | an in-process call satisfies the scenarios |
| `integration-adapter` | external semantics or providers are volatile/materially different | one stable dependency needs no protected translation boundary |
| `agentic-tool-loop` | probabilistic autonomy, tools, permissions, evals, and fallback matter | deterministic code can reliably satisfy the task |

For every selection, record the evidence and dimensions it answers, at least one simpler option,
why that option is insufficient, real costs, disqualifiers, and reversal evidence. Prefer the
simpler option when it protects the same responsibilities, invariants, and scenarios.

When different strategies meet, record a representation-free composition seam at S2. Resolve it at
S6 with semantic authority, interaction meaning, timing, ordering, consistency, idempotency, retry,
failure containment, fallback, and translation/version responsibility.

## Draw from methods without adopting them wholesale

Use only the part that fits the observed force:

- Responsibility-Driven Design, CRC, GRASP: discover cohesive work, collaborators, information,
  and authority; do not turn candidates into classes automatically.
- Design by Contract: specify precise preconditions, postconditions, invariants, and failure
  meaning where useful.
- DDD: use language boundaries, domain policy, and aggregates for complex interacting rules; avoid
  DDD ceremony for independent records.
- Clean/Hexagonal: protect justified dependency direction or external volatility; avoid mandatory
  layers and single-implementation ports with no seam.
- Functional principles/data architecture: make transformation, immutability, lineage, replay,
  and effects explicit where flow dominates.
- State machines/distributed systems/events: reason about transition legality, consistency,
  ordering, idempotency, partial failure, and recovery when those forces exist.
- QAW/ATAM: make scenarios measurable and compare sensitivity, risk, and trade-offs; scale the
  ceremony to the decision cost.
- ADR/C4/modular design/information hiding: preserve decisions, stable identity, cohesive change
  boundaries, and protected volatility without treating view types as the semantic model.
- Agent architecture: require permissions, context/memory, evaluation, fallback, latency, cost,
  and human control; reject an agent when a deterministic workflow suffices.

## Ownership gate

Before naming implementation forms, every responsibility and invariant needs one accountable
logical owner or an explicit unresolved conflict/protocol. Compare ownership candidates by
information held, authority required, cohesive change reason, and collaborators. Do not use a
generic Service, Manager, Helper, or Util as a substitute for ownership reasoning.

Return to decomposition if one owner spans unrelated change reasons. Return to invariant discovery
if consistency or failure semantics are missing. Return to strategy selection when ownership exposes
a different dominant force.
