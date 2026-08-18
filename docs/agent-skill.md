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
This matches the skill model documented by [OpenAI](https://developers.openai.com/codex/skills)
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

Resolve the clone to an absolute path and keep it. The skill instructions and deterministic
runtime are separate responsibilities but must remain discoverable together:

```sh
SAH_CHECKOUT=/absolute/path/to/sah
```

- **SAH checkout:** the clone above, containing `skills/sah`, `schemas`, `package.json`, and `dist`.
- **Target checkout:** the application Codex or Claude Code will design and modify.

Do not copy only `skills/sah` to another directory. A detached copy can provide instructions, but
the agent cannot reliably locate the schemas and CLI needed to validate S12 or S13. A symlink keeps
the physical path connected to the complete SAH checkout.

## Install for Codex

OpenAI documents `$HOME/.agents/skills` for user skills and `.agents/skills` for repository skills.
Choose one scope. For a personal installation available in every checkout:

```sh
mkdir -p ~/.agents/skills
ln -s "$SAH_CHECKOUT/skills/sah" ~/.agents/skills/sah
```

For a repository-only installation, run from the target checkout. This absolute link is local
machine configuration; do not commit it to a shared repository:

```sh
mkdir -p .agents/skills
ln -s "$SAH_CHECKOUT/skills/sah" .agents/skills/sah
```

Before running either `ln` command, inspect the destination with `ls -ld`. If it exists, do not
run the command again or overwrite it. In particular, rerunning `ln -s SOURCE DEST` when `DEST`
already resolves to a directory can create an unintended nested link inside the skill package.

Codex detects skill changes automatically; restart it if the skill does not appear. Use `/skills`
to inspect available skills or type `$sah` in the prompt to invoke SAH explicitly:

```text
Use $sah to build this feature. Inspect what is already in the repository and keep asking me
focused questions when a consequential requirement cannot be discovered locally. Continue through
implementation and verification.
```

Repository and user skills with the same `name` are both discoverable; Codex does not merge them.
Install one intentional copy unless you are testing different versions.

SAH documentation before Run 15 used `~/.codex/skills/sah`. To migrate an existing link, create
and verify the new `~/.agents/skills/sah` link first, then remove only the old `sah` symlink. Never
remove the containing skills directory or the SAH checkout.

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

## Verify the installation

Confirm that the host path resolves to the canonical package. Use the path for your selected host
and scope; these examples show user installations:

```sh
realpath ~/.agents/skills/sah
realpath ~/.claude/skills/sah
```

The result should be `$SAH_CHECKOUT/skills/sah`. Then prove that the runtime is available from the
SAH checkout; `sah` is not expected to be a global shell command:

```sh
cd "$SAH_CHECKOUT"
npm exec -- sah validate fixtures/simple-crud
```

If Codex or Claude says that the skill copy has no schemas or CLI, provide the absolute checkout
path explicitly:

```text
The canonical SAH checkout is /absolute/path/to/sah. Use its schemas and run npm exec -- sah from
that checkout, passing absolute paths for the target and design bundle. Do not download another copy.
```

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

For a new target, open the target checkout in the host and give one outcome-oriented request. Name
hard technology or delivery constraints, but do not preselect layers, services, aggregates, or
patterns unless they are truly imposed. A useful starting prompt has four parts:

```text
Goal: Build the reservation feature end to end.
Context: Read this repository, its product requirements, tests, and Git state first.
Constraints: Use $sah; ask one or two consequential questions at a time; preserve existing public
boundaries; do not add hosted services or push without permission.
Done when: The ready slices are implemented, target checks pass, full SAH evidence is recorded,
the lifecycle is advanced as far as the evidence permits, and the final diff is reviewed.
```

You do not need to know SAH artifact names. The agent authors them. You only answer product facts
that cannot be learned from the repository, accept or reject consequential proposed decisions, and
grant separate permission for external actions such as downloads or pushes.

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
using a new method version on consequential work. To uninstall, remove only the exact
`~/.agents/skills/sah`, `.agents/skills/sah`, `~/.claude/skills/sah`, or
`.claude/skills/sah` symlink you created; do not delete the SAH checkout or a broad skills
directory.
