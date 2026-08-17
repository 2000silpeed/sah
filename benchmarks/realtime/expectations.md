# realtime — expectations

Characterization: rule complexity LOW/MEDIUM · invariant criticality MEDIUM for convergence,
locks, and authorization · dataflow HIGH for edit propagation · distribution HIGH ·
concurrency/temporality HIGH · autonomy LOW · integration LOW · scale HIGH · assurance MEDIUM ·
change isolation MEDIUM between durable content, ephemeral presence, access, and history.

Expected per subsystem:

- Durable collaborative content → `state-machine-concurrent` plus distributed-event-driven;
  explicitly model operation identity, ordering/merge, reconnect, deletion, and convergence.
  CRDT, OT, serialized authority, or hybrids are accepted if trade-offs match requirements.
- Presence/cursors → lightweight ephemeral dissemination distinct from durable history.
- Access/area locks → cohesive authorization authority that applies online and reconnecting
  edits. Alternative centralized validation accepted if latency/failure is addressed.
- History/restore → append/replay or snapshot strategy with clear durability and retention.

FAILURE INDICATORS

- FATAL: last-write-wins is assumed for every edit without reasoning about move, rename,
  delete, offline replay, and user intent.
- FATAL: no convergence, operation identity/deduplication, authorization-on-reconnect, or
  durable/ephemeral distinction.
- A global lock or single sequential bottleneck proposed without the 500-editor scenario.
- Microservices, WebSockets, or a broker named as the concurrency solution.
- “Eventually consistent” without convergence condition and expected time.

MUST APPEAR: user intent versus deterministic convergence; local latency versus global order;
offline acceptance versus lock/authorization freshness; durable history versus storage/replay
cost; per-map isolation versus coordination complexity.
