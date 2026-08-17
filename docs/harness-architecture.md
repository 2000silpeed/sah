# Harness Architecture

This document owns SAH's component boundaries, dependency rules, delivery topology, and
failure behavior. The structured model and validator semantics are owned by their respective
documents.

## Delivery form

SAH ships as a **hybrid local toolkit**:

1. an agent-neutral skill/prompt package presents stages, gates, and review interactions to
   a host coding agent;
2. a local CLI drives artifact lifecycle, schema/reference checks, constraint compilation,
   validator execution, and implementation handoff;
3. a reusable library contains the semantic model and orchestration so the CLI is not the
   only integration surface;
4. target repositories keep JSON IR, rendered Markdown views, decisions, constraints, and
   exceptions under source control.

There is no required hosted service in the first delivery. A later collaboration service may
store runs or coordinate reviews, but it must consume the same library APIs and repository
artifacts. ADR-0001 records the choice and costs.

## Logical components and ownership

### Method Library

Owns strategy definitions, characterization questions, method verdicts, and weighted
heuristics. It returns candidates and warnings; it cannot select a strategy, mutate IR, or
emit a hard constraint. New method packs depend only on public model identifiers.

### Reasoning Orchestrator

Owns S0–S13 state transitions, gate evaluation, loop-back/staleness propagation, LLM request
contracts, retries, and human decision gates. It asks the Model Repository to persist facts;
it does not embed a language validator or host-agent API.

### Model Repository

Owns schema validation, stable identities, cross-IR references, bundle status, atomic artifact
updates, and change-impact traversal. JSON IR is canonical. It exposes typed semantic
operations rather than filesystem conventions to other components.

The first executable slice exposes `validateBundle(directory)`. Its filesystem adapter reads
the non-semantic manifest, confines declared real paths to the bundle, and translates Ajv
results into stable SAH diagnostics before reference and stage validators run. The `sah
validate` adapter only parses invocation, selects human or JSON presentation, and maps result
status to exit 0, 1, or 2. [Validation CLI usage](validation-cli.md) owns the public contract.

The next slice exposes `advanceBundle(directory, targetStage)`. The repository evaluates an
exact-next supported target against the same loaded snapshot, then replaces only manifest
lifecycle metadata through a flushed same-directory temporary file and rename. It refuses
manifest symlinks and compares source bytes immediately before the commit point. This is
atomic file replacement with optimistic conflict detection, not a lock or a multi-file/
multi-process transaction. The CLI remains an invocation, presentation, and exit-code adapter.

The S8 slice evaluates the Architecture candidate set and its resolved S2/evidence/constraint
links inside the Model Repository. It exposes no Ajv representation through the library and
does not promote candidate quality judgments into deterministic failures.

The S9 slice joins canonical candidate IDs with must-priority scenario IDs and assessment
references inside the Model Repository. It owns coverage, uniqueness, and pre-selection state;
contextual scenario satisfaction remains an assisted finding rather than CLI policy.

The S12 slice loads canonical Implementation Handoff IR and joins it with selected Architecture
and Decision facts. The Model Repository owns reference, coverage, blocker, readiness, and
acyclic-dependency checks. It does not execute handoff checks or judge slice quality.

The S13 execution surface exposes `verifyBundle(bundleDirectory, targetDirectory, options)`.
The Model Repository validates the stored S12 bundle, selects constraints assigned to ready
slices, dispatches declared adapter capabilities, and aggregates check states. Private
filesystem and TypeScript adapters implement only confined regular-file presence and one
explicitly mapped write-authority predicate. The CLI owns invocation, presentation, and exit
mapping; adapter outcomes, Ajv/compiler objects, and terminal formatting do not enter
canonical IR. S13 lifecycle advancement remains unsupported.

TypeScript mapping is target-relative, schema-validated adapter context supplied explicitly by
the caller. It relates complete declared source roots and path prefixes to Architecture element
IDs, plus observable selectors to write symbols. It is neither inferred from directory names
nor stored in semantic IR or the bundle manifest. The adapter scans all declared roots with the
TypeScript parser and refuses unresolved source forms instead of manufacturing a complete
graph. ADR-0011 owns this boundary.

### Decision and View Adapters

Render architecture-decision IR as ADR Markdown and architecture IR as C4/other views. They
never infer missing canonical facts from prose or diagram layout. Import creates proposed,
incomplete facts that must pass normal gates.

### Constraint Compiler and Validation Runtime

The compiler converts accepted, observable decision claims into a language-neutral check
plan. Fact adapters map source graphs, symbols, manifests, API schemas, tests, or telemetry to
that plan. Validators produce deterministic results; assisted reviewers and judgment graders
use separate result types. Unsupported extraction is `unsupported`, never `pass`.

### Coding-Agent Integration

Owns thin adapters for skills, commands, `AGENTS.md` fragments, context budgeting, progress
messages, implementation handoff, and change-triggered verification. It translates host
events into orchestrator operations but contains no design-method logic.

### Evaluation and Benchmarks

Owns benchmark fixtures, run isolation, scoring, judge calibration, regression comparison,
and cost/latency recording. It invokes only public skill/CLI/library surfaces. Product
components cannot read benchmark expectations during a run.

## Dependency rule

```text
Host Agent → Coding-Agent Integration → Reasoning Orchestrator
                                      ↘ Model Repository
Method Library ───────────────────────→ Reasoning Orchestrator
Reasoning Orchestrator ───────────────→ Model Repository
Decision/View Adapters ───────────────→ Model Repository
Constraint Compiler/Runtime ──────────→ Model Repository
Evaluation/Benchmarks ────────────────→ public integration and validation surfaces only
```

The semantic model has no dependency on prompts, LLM vendors, CLIs, diagram tools, source
languages, or benchmarks. The Method Library has no dependency on host agents. Evaluation
does not become a shared utility imported by production components.

## Principal interactions

### Reasoning pass

The host adapter starts or resumes a bundle. The orchestrator reads the active stage, asks the
Method Library for relevant questions, obtains LLM/human output, validates shape through the
Model Repository, runs the semantic gate, and either advances or records the causal
loop-back. Only a successful atomic update makes downstream artifacts current. The current
runtime can advance targets with implemented S5–S12 gates; it reports other exact-next stages
as unsupported rather than manufacturing a pass.

### Constraint compilation

The compiler reads selected architecture and accepted decisions. It classifies each claim,
requires an observable contract for deterministic claims, binds available fact adapters, and
emits a check plan. A missing adapter creates explicit implementation backlog. It does not
downgrade or discard a constraint silently.

### Coding change

The integration adapter maps changed paths/symbols to architecture elements. The runtime runs
applicable deterministic checks, emits assisted findings, and schedules judgment reviews from
decision triggers. Violations point to source decision, affected invariant, owner, and allowed
exception authority.

The current executable subset does not yet map diffs. It uses S12 slice assignment for
applicability and can evaluate a declared target-relative regular-file presence fact or direct
TypeScript calls to one explicitly mapped write symbol. Path aliases, re-exports, dynamic
loading/code evaluation, import assignments, indirect symbol aliases, mixed JavaScript, and
whole-program semantics remain explicit unsupported coverage.

### Benchmark run

The evaluator creates an isolated target repository with only `problem.md`, invokes SAH as a
user would, freezes outputs and trajectory, then supplies outputs—not hidden expectations—to
deterministic scorers and calibrated judges. A human arbitrates contested benchmark changes.

## Failure behavior

- Invalid LLM JSON is retried with schema errors; after a bounded retry, the stage remains
  incomplete with the raw failure reference.
- Contradictory IR is rejected atomically and routed to the earliest responsible stage.
- Unavailable LLM judgment keeps a review pending; it cannot make an architecture accepted.
- An unsupported code-fact adapter reports missing coverage and affected constraints.
- A deterministic validator crash is an infrastructure error, not an architecture violation.
- An expired exception fails its owning constraint until renewed by authorized review.
- Partial view rendering never damages canonical IR.

## Security and privacy boundary

Local-first operation keeps proprietary requirements and code in the target repository by
default. Host adapters must declare what context leaves the machine, which model/provider
receives it, and which tools can mutate files or external state. Agentic subsystems additionally
record tool permissions and human approval points in the target architecture.

## Evolution seams

Stable seams are: methodology provider, LLM reasoner, model store, view adapter, code-fact
adapter, host-agent adapter, and benchmark judge. A seam earns an interface because multiple
implementations or independent evolution are expected. Internal helpers do not receive
interfaces merely to match the diagram.

Service extraction becomes reasonable only when measured collaboration, centralized policy,
or workload isolation cannot be met locally. Language-specific validators remain adapters;
they never pull language types into canonical IR.
