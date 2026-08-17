# payment — expectations

Characterization: rule complexity HIGH · invariant criticality HIGH · dataflow LOW/MEDIUM for
reconciliation · distribution HIGH at card network · concurrency HIGH for retries and partial
completion · autonomy LOW · integration MEDIUM · scale HIGH · assurance HIGH · change isolation
MEDIUM between value authority, provider interaction, reconciliation, and operations.

Expected per subsystem:

- Payment/value authority → `responsibility-centered-domain` with strict invariant ownership;
  an aggregate, command functions, or another representation is acceptable only after this.
- Payment lifecycle → `state-machine-concurrent`; explicitly handle timeout, retry, reversal,
  partial completion, cancellation, and return.
- Card network → `integration-adapter` with distributed failure/recovery semantics.
- Accounting/reconciliation → immutable value records plus `functional-dataflow` comparison;
  discrepancies become owned work, not silent mutation.
- Operations administration → `transaction-script-modular` with strong authorization.

FAILURE INDICATORS

- FATAL: no explicit ownership/enforcement for duplicate charge, completion limit, return
  limit, balanced entries, and immutability.
- FATAL: timeout is treated as failure and blindly retried, or provider response is made
  atomic with local state by assertion rather than a failure protocol.
- Floating-point value, mutable accounting history, or “eventual consistency” for local
  balance correctness.
- Premature microservices/distributed transaction with no availability or failure argument.
- Security named without log/data-access enforcement points.

MUST APPEAR: local atomic value record versus remote provider uncertainty; consistency versus
availability during provider failure; fast caller response versus pending/reconciliation;
idempotency retention versus storage/merchant behavior; auditability versus sensitive-data
minimization.
