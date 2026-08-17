# enterprise-integration — expectations

Characterization: rules MEDIUM in semantic mapping · invariants HIGH for privacy, monetary
fidelity, and authority · dataflow HIGH · distribution HIGH · concurrency/temporality MEDIUM ·
autonomy LOW · integration HIGH · scale MEDIUM · assurance HIGH · change isolation HIGH across
companies, capabilities, protocols, and migration cadence.

Expected per subsystem:

- Per-system acquisition/translation → `integration-adapter`; preserve source fidelity,
  contract versions, replay, quarantine, and failure isolation.
- Bulk and incremental movement → `functional-dataflow` with distributed-event-driven support
  where delivery/retry/ordering require it.
- Capability semantics/authority → responsibility-centered policy per customer/product/order/
  invoice concept; no mandatory group-wide object for every local distinction.
- Privacy propagation and long-running corrections → stateful coordination with deadline,
  acknowledgement, retry, escalation, and audit.
- Mapping/admin operations → `transaction-script-modular` behind strong authorization.

Acceptable alternatives: a shared canonical vocabulary per stable capability, IF loss and
versioning are explicit; pairwise translation for a small temporary slice, IF its growth and
retirement are bounded; orchestration or choreography, IF failure ownership is named.

FAILURE INDICATORS

- FATAL: one enterprise-wide DTO/model erases local meaning or assigns authority by convenience.
- FATAL: no idempotency, replay, quarantine, lineage, or 24-hour privacy completion evidence.
- Point-to-point mapping mesh with no growth/retirement plan, or one service per source system.
- Invoice discrepancies are transformed away instead of preserved and reconciled.
- “Eventually consistent” without fact owner, conflict rule, affected consumers, and bound.

MUST APPEAR: shared vocabulary versus local fidelity; authority/conflict rules versus bidirectional
convenience; immediate versus batch movement; orchestration versus choreography and failure
ownership; incremental value versus temporary complexity/retirement; privacy completion versus
partial system outage.
