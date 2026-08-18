# ADR-0015: Orchestrate the Full Loop Through a Portable Agent Skill

- Status: accepted
- Date: 2026-08-18
- Supersedes: the implementation-plan-only product boundary in `docs/vision.md`
- Extends: ADR-0001

## Context

SAH intends to help a coding agent reason before implementation and preserve decisions while code
changes. The repository already has canonical JSON IR, lifecycle gates, a deterministic validation
kernel, and S13 code-fact verification. It does not yet expose the Method Library, Reasoning
Orchestrator, or Coding-Agent Integration described by the harness architecture. Users must author
the IR manually, making the runnable product appear to be only a TypeScript checker.

Codex and Claude Code already supply the conversational model, repository tools, progress loop, and
code-edit authority. Reimplementing those facilities inside SAH would introduce provider coupling
before SAH has evidence that a second conversation runtime protects an independent responsibility.
The missing boundary is a portable protocol that makes the host agent apply SAH's methodology,
persist canonical artifacts, invoke public lifecycle operations, implement the handoff, and verify
the result.

## Decision

Ship the first end-to-end orchestration surface as one repository-owned Agent Skill at
`skills/sah`. The skill is the thin Coding-Agent Integration and executable reasoning protocol:
it guides the host through S0–S12, calls the existing CLI as the deterministic Model Repository,
lets the host coding agent execute only ready implementation slices, and closes the loop with S13
verification evidence.

The host owns natural-language dialogue, contextual judgment, and code mutation. SAH owns method
selection rules, artifact/gate semantics, stable evidence, and observable verification. The skill
must keep assisted and judgment conclusions labeled, stop dependent implementation at unresolved
decisions, and never manufacture a lifecycle transition by editing the manifest.

Dialogue is progressive evidence elicitation, not a static intake form. The host first inspects
available repository and user-supplied evidence, then asks one or two highest-impact questions at a
time. Each answer may refine the next question. The loop continues until the next consequential
decision is supported or the user explicitly accepts a recorded assumption. An unknown answer is
preserved as an unresolved question; it blocks only implementation whose correctness depends on it.

Use one Agent Skills-compatible package for Codex and Claude Code. Installation may link or copy
that canonical directory into a host's supported skill location; host-specific copies of the
methodology are not maintained.

## Alternatives considered

### Add a chat subcommand and embedded model client

This would offer one branded terminal interaction. It also creates provider credentials,
streaming/session storage, tool permission, retry, model-version, and privacy responsibilities.
Those costs duplicate the host agents and would couple the semantic core to a premature runtime.

### Keep SAH as manual JSON plus validators

This preserves the smallest implementation. It is insufficient because it leaves the promised
reasoning and implementation loop to undocumented user improvisation, so the methodology is not an
executable harness and cannot be forward-tested as a user invokes it.

### Maintain separate Codex and Claude prompt packages

This permits host-specific wording. It costs duplicated method authority and predictable semantic
drift. Host-specific metadata and installation instructions are sufficient until a demonstrated
capability mismatch requires a separate adapter.

## Consequences

- A natural-language request can exercise the intended product without SAH hosting an LLM.
- The existing TypeScript CLI/library remain deterministic infrastructure and retain their public
  result, exit-code, atomicity, and lifecycle contracts.
- Skill behavior depends on host-agent capability and contextual judgment; deterministic tests can
  verify package contracts, while isolated forward tests provide non-blocking behavioral evidence.
- Users must install the skill and retain a source checkout until the package is publicly
  distributed. Symlink behavior and host discovery are an onboarding cost.
- Long workflows consume model context and produce more repository artifacts. The short path and
  progressive reference loading mitigate unnecessary ceremony.
- Interactive elicitation adds user turns and can pause execution. Prioritizing questions by
  decision impact and avoiding facts observable in the repository keeps that cost proportional.

## Review triggers and mitigation

Revisit the decision when a required host cannot consume Agent Skills, measured prompt drift cannot
be controlled by shared references and tests, multi-user coordination requires durable authority,
or privacy/provider policy requires a dedicated local reasoner. Before adding a service or model
client, record the new responsibility, operating evidence, failure modes, and migration cost.

Forward-test the skill against isolated repositories, keep methodology in one canonical package,
and treat failures as assisted evidence rather than weakening deterministic bundle or S13 gates.
