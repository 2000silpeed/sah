# ai-agent — expectations

Characterization: rules MEDIUM, with deterministic action policy · invariant criticality HIGH
for permissions, privacy, and duplicate action · dataflow MEDIUM for retrieval/evaluation ·
distribution MEDIUM · concurrency LOW/MEDIUM for retries · autonomy/uncertainty HIGH ·
integration HIGH · scale MEDIUM/HIGH · assurance HIGH · change isolation HIGH across model,
tools, policy, memory, evaluation, and provider adapters.

Expected per subsystem:

- Conversation/research → `agentic-tool-loop` with bounded context, citations/evidence,
  uncertainty, escalation, model/provider fallback, latency, and cost controls.
- Action authorization/execution → deterministic policy and stateful workflow, not delegated
  to model discretion; idempotent tool calls and human approval where policy requires.
- Tool/provider access → `integration-adapter` with least privilege and explicit failure.
- Memory/privacy → owned lifecycle and deletion enforcement; distinguish session context from
  retained learning/evaluation data.
- Evaluation/monitoring → functional dataflow over versioned datasets and trajectories,
  measuring task success, safety, action correctness, latency, and cost.

FAILURE INDICATORS

- FATAL: prompt-only design with no evaluation dataset, tool permission boundary, fallback,
  or cost/latency model.
- FATAL: model output directly authorizes refund/account action or timeout can repeat an action.
- FATAL: private conversations enter memory/evaluation indefinitely with no deletion lineage.
- “Human in the loop” without trigger, authority, information handed off, or failure behavior.
- More agents or subagents proposed as quality evidence without an evaluation result.
- One model/provider SDK defines canonical tools, memory, or policy.

MUST APPEAR: agent discretion versus deterministic workflow; helpfulness/automation versus
safety and escalation; context quality versus privacy/token cost; latency/cost versus model
quality; offline/provider fallback versus feature degradation; contaminated historical data
versus evaluation realism.
