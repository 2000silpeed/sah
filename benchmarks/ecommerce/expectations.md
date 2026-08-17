# ecommerce — expectations

Characterization: rule complexity HIGH in pricing/refunds but LOW in seller catalog · invariant
criticality HIGH in checkout/payment/stock · dataflow MEDIUM for reporting/search feeds ·
distribution MEDIUM/HIGH at providers and split fulfillment · concurrency MEDIUM/HIGH for
stock · autonomy LOW · integration MEDIUM · scale HIGH · assurance MEDIUM/HIGH · change
isolation HIGH across catalog, pricing, order, fulfillment, and reporting.

Expected per subsystem:

- Seller catalog/admin → `transaction-script-modular`. Alternative richer model only if seller
  eligibility or product rules become interacting.
- Pricing/offers/tax → `responsibility-centered-domain`; cohesive policies and explainable
  calculations. Alternative decision tables/pure functions accepted if rule ownership and
  composition remain explicit.
- Checkout/order → responsibility-centered domain with `state-machine-concurrent` support;
  own accepted quote, stock hold, payment intent, cancellation, and refund transitions.
- Payment/shipping providers → `integration-adapter`, with distributed-event-driven support
  only where partial failure and asynchronous recovery require it.
- Search/reporting → read-oriented and `functional-dataflow`; tolerated lag must not leak into
  checkout authority.

FAILURE INDICATORS

- FATAL: one CRUD Controller/Service/Repository treatment for catalog, pricing, payment, and
  reporting, with offer rules scattered through request handlers.
- FATAL: no explicit protection against duplicate charge, oversell, or refund beyond captured
  value; no recovery from provider timeout.
- One uniform rich-domain model across simple catalog and reporting, or service-per-capability
  with no team/failure/deployment evidence.
- Search or reporting data is authoritative for checkout because it is convenient.
- “Eventual consistency” without naming stock, order, payment, or search staleness and bounds.

MUST APPEAR: pricing flexibility versus explainability; stock/payment/order consistency versus
availability under provider failure; synchronous checkout feedback versus asynchronous
recovery; modular deployment versus service extraction at campaign scale; unresolved cart,
partial-cancellation, and rounding policies.
