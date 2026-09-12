import type { PathLike } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const readState = vi.hoisted(() => ({
  paths: [] as string[],
  missingSuffix: undefined as string | undefined,
  overrides: new Map<string, string>(),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readFile: vi.fn(async (path: PathLike, encoding: BufferEncoding) => {
      const value = String(path);
      readState.paths.push(value);
      if (
        readState.missingSuffix !== undefined &&
        value.endsWith(readState.missingSuffix)
      ) {
        throw new Error(`ENOENT: ${value}`);
      }
      for (const [suffix, source] of readState.overrides) {
        if (value.endsWith(suffix)) return source;
      }
      return actual.readFile(path, encoding);
    }),
  };
});

import { loadSchemaRegistry } from "../src/schema-validation.js";

beforeEach(() => {
  readState.paths.length = 0;
  readState.missingSuffix = undefined;
  readState.overrides.clear();
});

describe("schema registry content cache", () => {
  it("freshly reads every schema while sharing compiled predicates for identical content", async () => {
    const concurrent = await Promise.all([
      loadSchemaRegistry(),
      loadSchemaRegistry(),
      loadSchemaRegistry(),
    ]);
    const schemaCount = readState.paths.length / concurrent.length;
    expect(schemaCount).toBeGreaterThan(1);
    expect(Number.isInteger(schemaCount)).toBe(true);
    const first = concurrent[0];
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    for (const loaded of concurrent) {
      expect(loaded.ok).toBe(true);
      if (loaded.ok)
        expect(loaded.registry.validate).toBe(first.registry.validate);
    }

    readState.paths.length = 0;
    const repeated = await loadSchemaRegistry();

    expect(readState.paths).toHaveLength(schemaCount);
    expect(repeated.ok).toBe(true);
    if (repeated.ok)
      expect(repeated.registry.validate).toBe(first.registry.validate);
  });

  it("does not expose cached documents to caller mutation", async () => {
    const first = await loadSchemaRegistry();
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const firstDocument = first.registry.documents[0];
    expect(firstDocument).toBeDefined();
    if (firstDocument === undefined) return;
    firstDocument.schema.title = "caller mutation";

    const second = await loadSchemaRegistry();

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.registry.documents[0]?.schema.title).not.toBe(
      "caller mutation",
    );
    expect(second.registry.documents).not.toBe(first.registry.documents);
    expect(second.registry.validate).toBe(first.registry.validate);
  });

  it("fails closed for changed-invalid or missing sources and accepts a repair", async () => {
    const warm = await loadSchemaRegistry();
    expect(warm.ok).toBe(true);
    if (!warm.ok) return;
    const schemaCount = readState.paths.length;

    readState.paths.length = 0;
    readState.overrides.set("benchmark-run.schema.json", "{invalid");
    const invalid = await loadSchemaRegistry();
    expect(invalid.ok).toBe(false);
    expect(readState.paths).toHaveLength(schemaCount);
    if (!invalid.ok) {
      expect(invalid.diagnostics.map(({ code }) => code)).toContain(
        "SCHEMA_REGISTRY_FAILURE",
      );
    }

    readState.paths.length = 0;
    readState.overrides.clear();
    readState.missingSuffix = "benchmark-run.schema.json";
    const missing = await loadSchemaRegistry();
    expect(missing.ok).toBe(false);
    expect(readState.paths).toHaveLength(schemaCount);

    readState.paths.length = 0;
    readState.missingSuffix = undefined;
    const repaired = await loadSchemaRegistry();
    expect(repaired.ok).toBe(true);
    expect(readState.paths).toHaveLength(schemaCount);
    if (repaired.ok) {
      expect(repaired.registry.validate).toBe(warm.registry.validate);
    }
  });

  it("recompiles changed valid content and restores its original validation semantics", async () => {
    const warm = await loadSchemaRegistry();
    expect(warm.ok).toBe(true);
    if (!warm.ok) return;
    const document = warm.registry.documents.find(
      ({ file }) => file === "benchmark-run.schema.json",
    );
    expect(document).toBeDefined();
    if (document === undefined) return;
    const examples = document.schema.examples;
    expect(Array.isArray(examples)).toBe(true);
    if (!Array.isArray(examples) || examples[0] === undefined) return;
    const example = structuredClone(examples[0]);
    expect(
      warm.registry.validate(document.id, example, "benchmark-run.json"),
    ).toEqual([]);

    const changedSchema = structuredClone(document.schema);
    changedSchema.not = {};
    readState.overrides.set(
      "benchmark-run.schema.json",
      JSON.stringify(changedSchema),
    );
    const changed = await loadSchemaRegistry();

    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.registry.validate).not.toBe(warm.registry.validate);
    expect(
      changed.registry
        .validate(document.id, example, "benchmark-run.json")
        .map(({ code }) => code),
    ).toContain("SCHEMA_NOT");

    readState.overrides.clear();
    const restored = await loadSchemaRegistry();

    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(
        restored.registry.validate(document.id, example, "benchmark-run.json"),
      ).toEqual([]);
    }
  });

  it("rejects changed schema content with a missing property trace", async () => {
    const warm = await loadSchemaRegistry();
    expect(warm.ok).toBe(true);
    if (!warm.ok) return;
    const document = warm.registry.documents.find(
      ({ file }) => file === "benchmark-run.schema.json",
    );
    expect(document).toBeDefined();
    if (document === undefined) return;
    const changedSchema = structuredClone(document.schema);
    const properties = changedSchema.properties as
      Record<string, Record<string, unknown>> | undefined;
    const property = properties?.[Object.keys(properties)[0] ?? ""];
    expect(property).toBeDefined();
    if (property === undefined) return;
    delete property["x-sah-trace"];
    readState.overrides.set(
      "benchmark-run.schema.json",
      JSON.stringify(changedSchema),
    );

    const changed = await loadSchemaRegistry();

    expect(changed.ok).toBe(false);
    if (!changed.ok) {
      expect(changed.diagnostics.map(({ code }) => code)).toContain(
        "SCHEMA_TRACE_WRITTEN_BY_MISSING",
      );
      expect(changed.diagnostics.map(({ code }) => code)).toContain(
        "SCHEMA_TRACE_READ_BY_MISSING",
      );
    }
  });
});
