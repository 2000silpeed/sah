# logistics — expectations

Characterization: rules MEDIUM/HIGH for routing/handling · invariants HIGH for custody and
temperature suitability · dataflow MEDIUM · distribution HIGH · concurrency/temporality HIGH ·
autonomy LOW · integration HIGH · scale MEDIUM/HIGH · assurance MEDIUM/HIGH · change isolation
HIGH by carrier, tracking, dispatch, and customer projection.

Expected per subsystem:

- Shipment/custody lifecycle → `state-machine-concurrent` with responsibility-centered domain
  support; transitions, temporal rules, and authority are primary.
- Route and handling policy → `responsibility-centered-domain`; alternative pure policy
  functions accepted if invariants remain cohesive and explainable.
- Carrier acquisition/translation → `integration-adapter` with distributed-event-driven
  support for retries, duplicate/out-of-order reports, and failure isolation.
- Customer view/alerts → read/dataflow projections with distinct freshness guarantees.
- Carrier/account administration → `transaction-script-modular`.

FAILURE INDICATORS

- FATAL: shipment is CRUD plus a mutable status string with no allowed-transition, custody,
  late-report, or reroute reasoning.
- FATAL: duplicate/out-of-order carrier reports can repeat transitions or erase source history.
- One provider's vocabulary becomes the internal truth, or a shared DTO crosses all regions.
- A service per carrier or leg with no volatility/failure/ownership rationale.
- “Eventually consistent tracking” without naming customer and alert freshness separately.

MUST APPEAR: ordered truth versus late correction; customer availability versus authoritative
custody; normalized events versus original-provider fidelity; alert speed versus completeness;
reroute flexibility versus already accepted commitments.
