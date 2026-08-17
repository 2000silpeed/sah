import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  auditSchemaTraces,
  loadSchemaRegistry,
} from "../src/schema-validation.js";

describe("schema contracts", () => {
  it("compiles every Draft 2020-12 schema and validates every embedded example", async () => {
    const loaded = await loadSchemaRegistry();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    for (const document of loaded.registry.documents) {
      const examples = document.schema.examples;
      expect(Array.isArray(examples), `${document.file} has examples`).toBe(
        true,
      );
      if (!Array.isArray(examples)) continue;
      examples.forEach((example, index) => {
        expect(
          loaded.registry.validate(
            document.id,
            example,
            `${document.file}#example-${index}`,
          ),
        ).toEqual([]);
      });
    }
  });

  it("audits every serialized property for non-empty writer and reader traces", async () => {
    const loaded = await loadSchemaRegistry();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const diagnostics = loaded.registry.documents.flatMap((document) =>
      auditSchemaTraces(document.schema, `schemas/${document.file}`),
    );
    expect(diagnostics).toEqual([]);
  });

  it("detects a generated missing field trace", () => {
    const schema = {
      type: "object",
      properties: {
        example: {
          type: "string",
          "x-sah-trace": { writtenBy: [], readBy: [] },
        },
      },
    };

    expect(
      auditSchemaTraces(schema, "generated.schema.json").map(
        ({ code }) => code,
      ),
    ).toEqual([
      "SCHEMA_TRACE_WRITTEN_BY_MISSING",
      "SCHEMA_TRACE_READ_BY_MISSING",
    ]);
  });

  it("keeps Ajv-specific types out of the public declaration surface", async () => {
    const distribution = resolve("dist");
    const publicDeclarations = await Promise.all(
      ["index.d.ts", "contracts.d.ts", "model-repository.d.ts"].map((file) =>
        readFile(join(distribution, file), "utf8"),
      ),
    );

    expect(publicDeclarations.join("\n")).not.toMatch(
      /\bAjv\b|ErrorObject|ValidateFunction|node:fs|FileHandle|\bStats\b/u,
    );
  });
});
