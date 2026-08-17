# simple-crud — expectations

Characterization: rule change complexity LOW · invariant criticality LOW and record-local ·
dataflow LOW · distribution LOW · concurrency LOW/UNKNOWN pending simultaneous-edit policy ·
autonomy LOW · integration LOW · scale LOW · assurance MEDIUM for authorization/audit ·
change isolation LOW.

Expected per subsystem:

- Record maintenance → `transaction-script-modular`. Direct operations over plain records
  and one local transaction are sufficient. Alternative accepted: a modest
  responsibility-centered model, IF new lifecycle rules are stated as the reason.
- Search/export → simple query/read functions within the same deployable boundary. Alternative
  accepted: a read-specific module, IF export/query change independently in evidence.
- Authorization/audit → focused cross-cutting policy at the write boundary; it need not become
  a separate service.

Expected responsibilities/invariants: authorize changes; validate and commit one item;
search/filter/export; record actor and time. Asset tag uniqueness, valid required fields,
archived-by-default exclusion, and audit append/retention are explicit. Ownership is local to
record maintenance; the unresolved restore and concurrent-edit policies remain questions.

FAILURE INDICATORS

- FATAL: full DDD aggregate/repository/application/domain infrastructure or multiple network
  services without new rule, scale, team, or failure evidence.
- FATAL: an event broker or eventually consistent write path for ordinary record edits.
- One interface for every single implementation, generic Base/Manager/Helper layers, or a
  separate “architecture” for each CRUD verb.
- Missing asset-tag uniqueness, authorization, or audit ownership because the domain is simple.
- Treating unknown concurrent-edit behavior as last-write-wins without recording the choice.

MUST APPEAR: simplicity now versus cost of restructuring if rules grow; one explicit choice
or open question for concurrent edits; audit retention versus storage/privacy. No distributed
consistency trade-off should be invented.
