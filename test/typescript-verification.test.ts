import { symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { verifyBundle } from "../src/index.js";
import {
  cleanupFixtures,
  copyFixture,
  copyTypeScriptTarget,
  fixtureDirectory,
  mutateJson,
  typescriptTargetDirectory,
} from "./helpers.js";

afterEach(cleanupFixtures);

const sourceMappingPath = "sah.source-map.json";
const options = { sourceMappingPath } as const;

type SourceMapping = {
  language?: string;
  sourceRoots: string[];
  elements: Array<{ elementRef: string; pathPrefixes: string[] }>;
  writeTargets: Array<{
    selector: string;
    modulePath: string;
    exportName: string;
  }>;
};

function checkCode(
  verification: Awaited<ReturnType<typeof verifyBundle>>,
): string | undefined {
  return verification.checks[0]?.code;
}

describe("TypeScript source verification", () => {
  it("passes the canonical write-authority constraint with a named import alias", async () => {
    const verification = await verifyBundle(
      fixtureDirectory,
      typescriptTargetDirectory,
      options,
    );

    expect(verification.status).toBe("passed");
    expect(verification.checks).toEqual([
      expect.objectContaining({
        code: "CONSTRAINT_PASSED",
        capability: "dependency-and-write analysis",
        status: "pass",
        observed:
          "all writers are in constraint scope: src/equipment-operations/save-equipment.ts (equipment-operations)",
      }),
    ]);
  });

  it("violates when an unmapped source calls the declared write symbol", async () => {
    const target = await copyTypeScriptTarget();
    await writeFile(
      join(target, "src", "rogue-writer.ts"),
      'import { writeEquipmentRecord } from "./equipment-store.js";\nwriteEquipmentRecord();\n',
    );

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("violations");
    expect(verification.checks[0]).toEqual(
      expect.objectContaining({
        code: "CONSTRAINT_VIOLATION",
        status: "violation",
        observed:
          "writers outside constraint scope: src/rogue-writer.ts (unmapped)",
      }),
    );
  });

  it("keeps the source constraint unsupported when no mapping is supplied", async () => {
    const verification = await verifyBundle(
      fixtureDirectory,
      typescriptTargetDirectory,
    );

    expect(verification.status).toBe("incomplete");
    expect(checkCode(verification)).toBe("CONSTRAINT_ADAPTER_UNSUPPORTED");
  });

  it("returns operational error for a missing mapping file", async () => {
    const verification = await verifyBundle(
      fixtureDirectory,
      typescriptTargetDirectory,
      { sourceMappingPath: "missing.json" },
    );

    expect(verification.status).toBe("operational-error");
    expect(verification.checks).toEqual([]);
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({ code: "SOURCE_MAPPING_UNREADABLE" }),
    );
  });

  it("retains a source location for malformed mapping JSON", async () => {
    const target = await copyTypeScriptTarget();
    await writeFile(join(target, sourceMappingPath), "{\n");

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SOURCE_MAPPING_JSON_MALFORMED",
        artifactPath: sourceMappingPath,
        sourceLocation: expect.objectContaining({ line: 2 }),
      }),
    );
  });

  it("retains a JSON Pointer for schema-invalid mapping", async () => {
    const target = await copyTypeScriptTarget();
    await mutateJson<SourceMapping>(target, sourceMappingPath, (mapping) => {
      delete mapping.language;
    });

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SCHEMA_REQUIRED",
        artifactPath: sourceMappingPath,
        jsonPointer: "/language",
      }),
    );
  });

  it("rejects a dangling Architecture element in mapping configuration", async () => {
    const target = await copyTypeScriptTarget();
    await mutateJson<SourceMapping>(target, sourceMappingPath, (mapping) => {
      const element = mapping.elements[0];
      if (element !== undefined) element.elementRef = "missing-element";
    });

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SOURCE_MAPPING_ELEMENT_DANGLING",
        jsonPointer: "/elements/0/elementRef",
        reference: "missing-element",
      }),
    );
  });

  it("keeps ambiguous writer ownership unsupported", async () => {
    const bundle = await copyFixture();
    const target = await copyTypeScriptTarget();
    await mutateJson<{
      candidates: Array<{ elementRefs: string[] }>;
      elements: Array<Record<string, unknown> & { id: string }>;
    }>(bundle, "architecture.json", (architecture) => {
      const source = architecture.elements[0];
      if (source === undefined) return;
      architecture.elements.push({
        ...structuredClone(source),
        id: "equipment-other",
      });
      architecture.candidates[0]?.elementRefs.push("equipment-other");
    });
    await mutateJson<{
      decisions: Array<{ affectedElementRefs: string[] }>;
    }>(bundle, "architecture-decision.json", (decisions) => {
      decisions.decisions[0]?.affectedElementRefs.push("equipment-other");
    });
    await mutateJson<{ slices: Array<{ elementRefs: string[] }> }>(
      bundle,
      "implementation-handoff.json",
      (handoff) => {
        handoff.slices[0]?.elementRefs.push("equipment-other");
      },
    );
    await mutateJson<SourceMapping>(target, sourceMappingPath, (mapping) => {
      mapping.elements.push({
        elementRef: "equipment-other",
        pathPrefixes: ["src/equipment-operations/"],
      });
    });

    const verification = await verifyBundle(bundle, target, options);

    expect(verification.status).toBe("incomplete");
    expect(checkCode(verification)).toBe("SOURCE_MAPPING_AMBIGUOUS");
  });

  it.each([
    [
      "namespace import",
      'import * as store from "./equipment-store.js";\nstore.writeEquipmentRecord();\n',
      "SOURCE_GRAPH_IMPORT_FORM_UNSUPPORTED",
    ],
    [
      "path alias",
      'import { writeEquipmentRecord } from "@equipment/store";\nwriteEquipmentRecord();\n',
      "SOURCE_GRAPH_PATH_ALIAS_UNSUPPORTED",
    ],
    [
      "namespace path alias",
      'import * as store from "@equipment/store";\nstore.writeEquipmentRecord();\n',
      "SOURCE_GRAPH_PATH_ALIAS_UNSUPPORTED",
    ],
    [
      "relative unresolved bridge",
      'import { writeEquipmentRecord } from "./write-bridge.js";\nwriteEquipmentRecord();\n',
      "SOURCE_GRAPH_PATH_ALIAS_UNSUPPORTED",
    ],
    [
      "indirect alias",
      'import { writeEquipmentRecord } from "./equipment-store.js";\nconst write = writeEquipmentRecord;\nwrite();\n',
      "SOURCE_GRAPH_ALIAS_UNSUPPORTED",
    ],
    [
      "re-export",
      'export { writeEquipmentRecord } from "./equipment-store.js";\n',
      "SOURCE_GRAPH_REEXPORT_UNSUPPORTED",
    ],
    [
      "dynamic import",
      'void import("@equipment/store");\n',
      "SOURCE_GRAPH_DYNAMIC_IMPORT_UNSUPPORTED",
    ],
  ])("keeps %s source form unsupported", async (_name, source, code) => {
    const target = await copyTypeScriptTarget();
    await writeFile(join(target, "src", "unsupported.ts"), source);

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("incomplete");
    expect(checkCode(verification)).toBe(code);
  });

  it.each([
    [
      "JavaScript",
      "unsupported.js",
      "writeEquipmentRecord();\n",
      "SOURCE_GRAPH_LANGUAGE_UNSUPPORTED",
    ],
    [
      "invalid TypeScript",
      "invalid.ts",
      "export const = ;\n",
      "SOURCE_GRAPH_SYNTAX_UNSUPPORTED",
    ],
  ])("keeps %s source incomplete", async (_name, file, source, code) => {
    const target = await copyTypeScriptTarget();
    await writeFile(join(target, "src", file), source);

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("incomplete");
    expect(checkCode(verification)).toBe(code);
  });

  it("does not follow source symlinks", async () => {
    const target = await copyTypeScriptTarget();
    await symlink(fixtureDirectory, join(target, "src", "escape"));

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("incomplete");
    expect(checkCode(verification)).toBe("SOURCE_GRAPH_SYMLINK_UNSUPPORTED");
  });

  it.each([
    [
      "missing selector",
      (mapping: SourceMapping) => {
        const target = mapping.writeTargets[0];
        if (target !== undefined) target.selector = "other-records";
      },
      "SOURCE_MAPPING_TARGET_UNSUPPORTED",
    ],
    [
      "missing module",
      (mapping: SourceMapping) => {
        const target = mapping.writeTargets[0];
        if (target !== undefined) target.modulePath = "src/missing.ts";
      },
      "SOURCE_MAPPING_TARGET_MISSING",
    ],
    [
      "missing export",
      (mapping: SourceMapping) => {
        const target = mapping.writeTargets[0];
        if (target !== undefined) target.exportName = "missingWrite";
      },
      "SOURCE_MAPPING_EXPORT_MISSING",
    ],
  ])("keeps %s coverage unsupported", async (_name, mutate, code) => {
    const target = await copyTypeScriptTarget();
    await mutateJson<SourceMapping>(target, sourceMappingPath, mutate);

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("incomplete");
    expect(checkCode(verification)).toBe(code);
  });

  it("does not treat a default function declaration as a named mapped export", async () => {
    const target = await copyTypeScriptTarget();
    await writeFile(
      join(target, "src", "equipment-store.ts"),
      "export default function writeEquipmentRecord(): void {}\n",
    );

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("incomplete");
    expect(checkCode(verification)).toBe("SOURCE_MAPPING_EXPORT_MISSING");
  });

  it("rejects a trailing slash in a declared source root", async () => {
    const target = await copyTypeScriptTarget();
    await mutateJson<SourceMapping>(target, sourceMappingPath, (mapping) => {
      mapping.sourceRoots = ["src/"];
    });

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SCHEMA_PATTERN",
        artifactPath: sourceMappingPath,
        jsonPointer: "/sourceRoots/0",
      }),
    );
  });

  it.each(["../mapping.json", "/tmp/mapping.json", "C:/mapping.json"])(
    "rejects unsafe mapping path %s operationally",
    async (mappingPath) => {
      const verification = await verifyBundle(
        fixtureDirectory,
        typescriptTargetDirectory,
        { sourceMappingPath: mappingPath },
      );

      expect(verification.status).toBe("operational-error");
      expect(verification.diagnostics).toContainEqual(
        expect.objectContaining({ code: "SOURCE_MAPPING_PATH_UNSAFE" }),
      );
    },
  );

  it("rejects a symlinked mapping file", async () => {
    const target = await copyTypeScriptTarget();
    await symlink(sourceMappingPath, join(target, "mapping-link.json"));

    const verification = await verifyBundle(fixtureDirectory, target, {
      sourceMappingPath: "mapping-link.json",
    });

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({ code: "SOURCE_MAPPING_UNREADABLE" }),
    );
  });
});
