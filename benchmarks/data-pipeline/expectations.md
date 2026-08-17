# data-pipeline — expectations

Characterization: rule complexity MEDIUM in normalization/quality · invariant criticality
MEDIUM, HIGH for privacy · dataflow HIGH · distribution MEDIUM · concurrency/temporality
MEDIUM because of late/corrected input · autonomy LOW · integration HIGH · scale HIGH ·
assurance HIGH · change isolation HIGH between source contracts and derived datasets.

Expected per subsystem:

- Source acquisition → `integration-adapter` supporting `functional-dataflow`; isolate sender
  semantics and preserve arrivals. Alternative accepted: one configurable ingestion form, IF
  schema variation and blast radius are addressed.
- Standardization, quality, enrichment, summaries → `functional-dataflow`. Make data contracts,
  lineage, immutable inputs, replay, deterministic rules, and quality gates primary.
- Daytime delivery coordination → functional dataflow with distributed-event-driven support.
  Alternative accepted: micro-batches, IF the two-minute target and late data are measured.
- Reference/stewardship UI → `transaction-script-modular`; it should not inherit the processing
  structure merely for uniformity.

Expected responsibilities/invariants: preserve arrival bytes; identify sender/schema; validate,
quarantine, standardize, deduplicate, enrich, summarize, publish, trace lineage, replay by rule
version, handle late/corrected data, delete identifiers, and isolate source failures. Published
values trace to source+rule; raw arrivals are immutable until mandated deletion; protected IDs
never reach analyst output; reprocessing is idempotent for a declared identity; incomplete or
failed quality partitions are not silently published.

FAILURE INDICATORS

- FATAL: Controller/Service/Repository objects describe processing with no explicit data flow,
  contracts, lineage, replay, or late-data policy.
- FATAL: corrected input overwrites the only retained source, or replay requires partner resend.
- FATAL: no explicit privacy deletion/enforcement path.
- One network service per transformation with no scale/failure argument.
- “Exactly once” stated without record identity, deduplication, retry, and correction semantics.
- “Eventual consistency” without naming which dataset changes and the closure window.

MUST APPEAR: one design serving batch and low-latency needs versus separate paths; idempotency
versus exactly-once claims; storage cost versus replay/reproducibility; late/corrected data
versus stable published summaries; source retention versus 30-day privacy deletion.
