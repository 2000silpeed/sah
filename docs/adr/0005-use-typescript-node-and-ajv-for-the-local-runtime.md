# ADR-0005: Use TypeScript, Node, and Ajv for the local runtime

Status: Accepted · Date: 2026-08-17 · Supersedes: —

## Context

Run 2 needs one reusable validation library and a local CLI. The repository has no runtime
implementation or package-manager commitment, while Node 24 and npm 11 are locally available.
The runtime must validate Draft 2020-12, retain precise paths, and keep implementation-specific
validator types behind the Model Repository boundary.

## Options considered

1. Strict TypeScript on Node with Ajv Draft 2020-12 ← chosen
2. Python with `jsonschema` and a separate CLI packaging path
3. Rust with a JSON Schema crate and native binary distribution
4. Untyped JavaScript on Node with Ajv

## Decision

Use strict TypeScript, Node, npm, and Ajv's Draft 2020-12 entry point. Ajv errors are translated
inside the Model Repository into SAH diagnostics; no public library type exposes Ajv objects.
Use Node's local process/filesystem APIs and keep validation independent of network services.

## Trade-offs accepted

+ One language and build covers both the library and thin CLI, with a mature 2020-12 validator.
− Consumers need a supported Node runtime and an npm install/build step.
− TypeScript build/lint/format configuration adds repository files and upgrade maintenance.
− Ajv's error vocabulary needs an explicit adapter to preserve SAH diagnostic stability.

Mitigation: pin dependency ranges in the lockfile, test the public diagnostic envelope rather
than Ajv internals, and keep the schema registry and error translation private.

## Consequences

The npm package exports the validation library and installs a `sah` executable. A future
runtime can replace Ajv behind the library contract, but a second validator interface is not
introduced until an actual alternate implementation exists. Reconsider this decision if Node
cannot meet local distribution constraints or another host runtime becomes mandatory.
