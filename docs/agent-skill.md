# SAH Agent Skill

This guide owns installation and invocation of the portable `sah` skill for Codex and Claude Code.
The [skill contract](../skills/sah/SKILL.md) owns agent behavior; the
[design reasoning model](design-reasoning-model.md) and JSON schemas remain product authority.

## What changes when the skill is installed

Without the skill, the TypeScript CLI is a deterministic kernel: it validates design bundles,
advances supported lifecycle gates, and checks the observable constraints it can see. It does not
conduct a conversation or edit the user's product.

With the skill, the host coding agent becomes SAH's conversational and implementation runtime. It:

1. inspects the target repository and requirement evidence;
2. asks one or two adaptive questions at a time when important facts are missing;
3. selects fitting architecture methods per subsystem instead of imposing one stack;
4. creates and validates canonical `.sah/design` evidence;
5. implements dependency-ordered ready slices in the actual target code;
6. runs target tests plus changed and full SAH verification; and
7. advances S13 only with eligible full evidence.

The skill does not contain or call a hosted model. Codex or Claude Code supplies the model, tools,
conversation, and existing permissions. SAH supplies the reusable method and evidence protocol.
This matches the general skill model documented by [OpenAI](https://openai.com/index/introducing-the-codex-app/)
and [Claude Code](https://code.claude.com/docs/en/slash-commands).

## Prerequisites

- Git
- Node.js 22 or newer
- Codex or Claude Code with local Agent Skills support

Clone and build SAH once:

```sh
git clone https://github.com/2000silpeed/sah.git
cd sah
npm install
npm run build
```

Use the absolute clone path as `SAH_CHECKOUT` in the following examples:

```sh
SAH_CHECKOUT=/absolute/path/to/sah
```

## Install for Codex

Link the canonical package into the personal Codex skill directory:

```sh
mkdir -p ~/.codex/skills
ln -s "$SAH_CHECKOUT/skills/sah" ~/.codex/skills/sah
```

Restart or refresh Codex skill discovery, then begin a target-repository conversation with:

```text
Use $sah to build this feature. Inspect what is already in the repository and keep asking me
focused questions when a consequential requirement cannot be discovered locally. Continue through
implementation and verification.
```

If `~/.codex/skills/sah` already exists, inspect it before replacing anything. Keep one canonical
copy rather than silently overwriting a customized skill.

## Install for Claude Code

For a personal skill available across projects:

```sh
mkdir -p ~/.claude/skills
ln -s "$SAH_CHECKOUT/skills/sah" ~/.claude/skills/sah
```

For a skill visible only in the current project, run from that target checkout:

```sh
mkdir -p .claude/skills
ln -s "$SAH_CHECKOUT/skills/sah" .claude/skills/sah
```

Invoke it with `/sah` or ask Claude to use the `sah` skill in ordinary language:

```text
/sah Create the reservation feature we discussed. Read the repository first, ask for missing
high-impact facts one or two at a time, then design, implement, test, and verify it.
```

Claude Code officially supports project skills at `.claude/skills/<name>/SKILL.md`, personal skills
at `~/.claude/skills/<name>/SKILL.md`, supporting files, and symlinks. A repository-owned symlink
keeps Codex and Claude Code on the same method version.

## What the conversation looks like

The agent does not ask you to complete a fixed architecture questionnaire. It first reads the code,
tests, documentation, configuration, and Git state. It then asks only questions it cannot answer and
whose answer could change a consequential choice, for example:

> When two users reserve the last unit concurrently, must exactly one succeed, or is temporary
> overbooking acceptable? This determines whether inventory needs one atomic write authority.

Your answer becomes located evidence. The next question depends on it. “I don't know” is valid: the
agent records the uncertainty, consequence, and decision owner. If safe progress can be isolated,
only the dependent slice remains blocked. If you delegate a reversible choice, the agent labels its
assumption and records what evidence would reverse it.

Once enough evidence exists, the agent proceeds without repeatedly asking for permission for normal
in-scope work. It chooses responsibilities and ownership before functions, classes, modules,
services, events, queues, or agents. It then writes the bundle, implements the actual software, and
runs the relevant tests and SAH checks.

## Where artifacts live

By default the target gets `.sah/design/` containing `sah.bundle.json` and the seven semantic JSON
artifacts. The target's source code stays in its normal locations. A TypeScript target may also get
`sah.source-map.json` when an accepted observable constraint matches the current write-authority
adapter.

For a new bundle, the skill completes S0–S4 before the first manifest publication because the
current CLI's atomic exact-next gates begin at S5. Every subsequent forward transition uses
`sah advance`; the agent may not edit the stored stage to simulate progress. Full details are in the
skill's [artifact/lifecycle reference](../skills/sah/references/artifacts-and-lifecycle.md).

## Reading the result

The completion report separates:

- functional tests and builds from the target project;
- deterministic SAH checks;
- assisted architecture findings;
- judgment decisions and unresolved authority; and
- unsupported adapter coverage.

Working code does not automatically mean S13 is complete. A changed-scoped pass is feedback only.
`incomplete`, `violations`, `operational-error`, or unsupported evidence cannot authorize S13. The
agent must publish a fresh full verification record and atomically advance it, or clearly say why
the lifecycle remains earlier.

## Updating or uninstalling

A symlinked installation updates when you pull the SAH checkout. Review release changes before
using a new method version on consequential work. To uninstall, remove only the exact `sah` symlink
from the host's skill directory; do not delete the SAH checkout or a broad skills directory.
