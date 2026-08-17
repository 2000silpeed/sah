# Benchmark Strategy

This document owns suite purpose, run protocol, common scoring, judge roles, and coverage.
Each benchmark owns domain-specific expectations and scoring anchors.

## What the suite measures

The suite tests whether SAH can discriminate design forces, select and compose proportional
strategies, discover critical responsibilities/invariants, place defensible boundaries, make
quality trade-offs explicit, and separate enforceable facts from judgment. It does not reward
document length, method vocabulary, or agreement with one exact architecture.

## Run protocol

1. Create an isolated repository containing only the benchmark's `problem.md` and normal SAH
   operating instructions. Hidden expectations never enter the reasoning context.
2. Run the same released skill/CLI/library version with a recorded model, parameters, tools,
   elapsed time, and cost. No benchmark-specific prompt is allowed.
3. Freeze all IR, human views, validation output, and the reasoning trajectory.
4. Run deterministic checks, then two independent LLM judges with problem, output,
   `expectations.md`, and the common rubric. Use the mean if category scores differ by at most
   3 points; otherwise a human benchmark steward adjudicates that category.
5. Keep raw scores and explanations. A regression is not hidden by updating expectations.

## Common score: 100 points

| Category | Points | Scorer | Full-credit evidence |
|---|---:|---|---|
| Artifact and trace integrity | 10 | deterministic | Valid IR; references resolve; stage gates and required traces pass. |
| Characterization | 15 | LLM judge | Material dimensions, uncertainty, and measurable quality scenarios match the domain. |
| Strategy appropriateness | 20 | LLM judge | Proportional per-subsystem choices; simpler alternatives and disqualifiers are explicit. |
| Responsibilities and invariants | 15 | LLM judge | Critical outcomes, obligations, consistency, failure, ownership, and recovery are covered. |
| Boundaries and collaboration | 15 | LLM judge | Boundaries follow change/authority; mixed edges name semantics and failure. |
| Quality and trade-offs | 15 | LLM judge | Candidate comparison addresses benchmark MUST APPEAR items and names what worsens. |
| Continuous enforcement | 10 | 5 deterministic + 5 LLM judge | Constraints trace to decisions; hard rules are observable; judgment remains classified. |

The human benchmark steward owns fixture changes, disputed judge calibration, and acceptance
of a new valid alternative—not routine points. At least 10% of release runs are blindly
rescored by a human using the same anchors; report per-category judge agreement.

## Penalties and caps

- Over-engineering penalty: 0 to −20, scored by LLM judge from domain-specific anchors. Count
  unjustified boundaries, layers, interfaces, brokers, services, agents, and duplicated models;
  do not penalize complexity forced by evidence.
- Any listed `FATAL` failure indicator caps the total at 49 even if artifacts are thorough.
- Any non-fatal failure indicator loses its named category points. Missing a `MUST APPEAR`
  trade-off caps Quality and trade-offs at 5/15.
- Invalid/unscoreable output receives 0 for affected deterministic categories and remains
  visible; evaluator infrastructure errors invalidate the run rather than score zero.

Pass: at least 70 after penalties, no fatal indicator, Strategy ≥12/20, and Responsibilities
and invariants ≥9/15. Release regression threshold: no benchmark loses more than 5 total
points and suite mean does not fall.

## Characterization coverage

`L/M/H` are expected centers, not values exposed to the runner. Local variation appears in
benchmark expectations.

| Benchmark | Rules | Invariants | Dataflow | Distribution | Concurrency | Autonomy | Integration | Scale | Assurance | Change isolation |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| simple-crud | L | L | L | L | L | L | L | L | M | L |
| ecommerce | H | H | M | M | M | L | M | H | M | H |
| logistics | M | H | M | H | H | L | H | M | M | H |
| payment | H | H | L | H | H | L | M | H | H | M |
| realtime | L | M | H | H | H | L | L | H | M | M |
| data-pipeline | M | M | H | M | M | L | H | H | H | H |
| ai-agent | M | H | M | M | L | H | H | M | H | H |
| enterprise-integration | M | H | H | H | M | L | H | M | H | H |

No two rows are identical. Deliberate overlap in distribution tests different dominant risks:
temporal custody in logistics, atomic value in payment, latency/convergence in realtime, and
semantic translation in enterprise integration.

## Dataset evolution

Add or replace a benchmark only with a coverage comparison, expected false-positive impact,
and human review. Version problem and expectations together, but never weaken a failure
indicator solely because SAH produced it. Store acceptable novel solutions as new alternatives
after blind review. Rotate surface details periodically to detect memorization while preserving
the force vector and score anchors.
