import { symlink, unlink, writeFile } from "node:fs/promises";
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
  tsconfigPath?: string;
  sourceRoots: string[];
  elements: Array<{ elementRef: string; pathPrefixes: string[] }>;
  writeTargets: Array<{
    selector: string;
    modulePath: string;
    exportName: string;
  }>;
};

type TypeScriptConfig = {
  extends?: string;
  references?: Array<{ path: string }>;
  compilerOptions: Record<string, unknown> | string;
  include?: string[];
};

function compilerOptions(config: TypeScriptConfig): Record<string, unknown> {
  if (typeof config.compilerOptions === "string")
    throw new Error("fixture compilerOptions must be an object");
  return config.compilerOptions;
}

function checkCode(
  verification: Awaited<ReturnType<typeof verifyBundle>>,
): string | undefined {
  return verification.checks[0]?.code;
}

async function addSecondReadyConstraint(
  bundle: string,
  target: string,
  secondPrefix = "src/other/",
): Promise<void> {
  const elementId = "equipment-other";
  const constraintId = "equipment-other-write-authority";
  await mutateJson<{
    candidates: Array<{ elementRefs: string[] }>;
    elements: Array<Record<string, unknown> & { id: string }>;
    constraints: Array<
      Record<string, unknown> & { id: string; scopeElementRefs: string[] }
    >;
  }>(bundle, "architecture.json", (architecture) => {
    const sourceElement = architecture.elements[0];
    const sourceConstraint = architecture.constraints[0];
    if (sourceElement === undefined || sourceConstraint === undefined) return;
    architecture.elements.push({
      ...structuredClone(sourceElement),
      id: elementId,
    });
    architecture.constraints.push({
      ...structuredClone(sourceConstraint),
      id: constraintId,
      scopeElementRefs: [elementId],
    });
    architecture.candidates[0]?.elementRefs.push(elementId);
  });
  await mutateJson<{
    decisions: Array<{
      affectedElementRefs: string[];
      constraintRefs: string[];
    }>;
  }>(bundle, "architecture-decision.json", (decisions) => {
    decisions.decisions[0]?.affectedElementRefs.push(elementId);
    decisions.decisions[0]?.constraintRefs.push(constraintId);
  });
  await mutateJson<{
    slices: Array<
      Record<string, unknown> & {
        id: string;
        elementRefs: string[];
        constraintRefs: string[];
      }
    >;
  }>(bundle, "implementation-handoff.json", (handoff) => {
    const source = handoff.slices[0];
    if (source === undefined) return;
    handoff.slices.push({
      ...structuredClone(source),
      id: "implement-equipment-other",
      elementRefs: [elementId],
      constraintRefs: [constraintId],
    });
  });
  await mutateJson<SourceMapping>(target, sourceMappingPath, (mapping) => {
    mapping.elements.push({
      elementRef: elementId,
      pathPrefixes: [secondPrefix],
    });
  });
}

async function blockCanonicalSlice(bundle: string): Promise<void> {
  const blockerId = "choose-equipment-export-boundary";
  await mutateJson<{
    decisions: Array<{
      id: string;
      title: string;
      status: string;
      selectedOptionRef: string | null;
      constraintRefs: string[];
      options: Array<{ id: string }>;
    }>;
  }>(bundle, "architecture-decision.json", (model) => {
    const source = model.decisions[0];
    if (source === undefined) return;
    const proposed = structuredClone(source);
    proposed.id = blockerId;
    proposed.title = "Choose an export boundary";
    proposed.status = "proposed";
    proposed.selectedOptionRef = null;
    proposed.constraintRefs = [];
    proposed.options.forEach((option, index) => {
      option.id = `export-boundary-option-${String(index + 1)}`;
    });
    model.decisions.push(proposed);
  });
  await mutateJson<{
    slices: Array<{ status: string; blockedByDecisionRefs: string[] }>;
  }>(bundle, "implementation-handoff.json", (handoff) => {
    const slice = handoff.slices[0];
    if (slice === undefined) return;
    slice.status = "blocked";
    slice.blockedByDecisionRefs = [blockerId];
  });
}

describe("TypeScript source verification", () => {
  it("passes the canonical write-authority constraint with a named import alias", async () => {
    const verification = await verifyBundle(
      fixtureDirectory,
      typescriptTargetDirectory,
      options,
    );

    expect(verification.status).toBe("passed");
    expect(verification.selection).toBeUndefined();
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

  it("selects only constraints assigned to slices containing changed elements", async () => {
    const bundle = await copyFixture();
    const target = await copyTypeScriptTarget();
    await addSecondReadyConstraint(bundle, target);

    const verification = await verifyBundle(bundle, target, {
      sourceMappingPath,
      changedPaths: ["src/equipment-operations/save-equipment.ts"],
    });

    expect(verification.status).toBe("passed");
    expect(verification.selection).toEqual({
      mode: "affected",
      requestedPaths: ["src/equipment-operations/save-equipment.ts"],
      affectedElementRefs: ["equipment-operations"],
      issues: [],
    });
    expect(verification.checks).toHaveLength(1);
    expect(verification.checks[0]?.constraintId).toBe("equipment-owns-writes");
  });

  it("keeps full-root evidence after affected constraint selection", async () => {
    const target = await copyTypeScriptTarget();
    await writeFile(
      join(target, "src", "rogue-writer.ts"),
      'import { writeEquipmentRecord } from "@equipment/store";\nwriteEquipmentRecord();\n',
    );

    const verification = await verifyBundle(fixtureDirectory, target, {
      sourceMappingPath,
      changedPaths: ["src/equipment-operations/save-equipment.ts"],
    });

    expect(verification.selection?.mode).toBe("affected");
    expect(verification.status).toBe("violations");
    expect(verification.checks[0]).toEqual(
      expect.objectContaining({
        code: "CONSTRAINT_VIOLATION",
        observed:
          "writers outside constraint scope: src/rogue-writer.ts (unmapped)",
      }),
    );
  });

  it("selects a lexically mapped deleted path without requiring file existence", async () => {
    const target = await copyTypeScriptTarget();
    const changedPath = "src/equipment-operations/save-equipment.ts";
    await unlink(join(target, changedPath));

    const verification = await verifyBundle(fixtureDirectory, target, {
      sourceMappingPath,
      changedPaths: [changedPath],
    });

    expect(verification.status).toBe("passed");
    expect(verification.selection).toEqual(
      expect.objectContaining({
        mode: "affected",
        requestedPaths: [changedPath],
        affectedElementRefs: ["equipment-operations"],
      }),
    );
  });

  it("keeps an affected blocked slice pending", async () => {
    const bundle = await copyFixture();
    const target = await copyTypeScriptTarget();
    await blockCanonicalSlice(bundle);

    const verification = await verifyBundle(bundle, target, {
      sourceMappingPath,
      changedPaths: ["src/equipment-operations/save-equipment.ts"],
    });

    expect(verification.status).toBe("incomplete");
    expect(verification.selection?.mode).toBe("affected");
    expect(verification.checks[0]).toEqual(
      expect.objectContaining({
        code: "CONSTRAINT_SLICE_BLOCKED",
        status: "pending",
      }),
    );
  });

  it("derives readiness only from slices affected by the changed element", async () => {
    const bundle = await copyFixture();
    const target = await copyTypeScriptTarget();
    const secondConstraintId = "equipment-other-write-authority";
    await addSecondReadyConstraint(bundle, target);
    await blockCanonicalSlice(bundle);
    await mutateJson<{
      constraints: Array<{ id: string }>;
    }>(bundle, "architecture.json", (architecture) => {
      architecture.constraints = architecture.constraints.filter(
        ({ id }) => id !== secondConstraintId,
      );
    });
    await mutateJson<{
      decisions: Array<{
        id: string;
        affectedElementRefs: string[];
        constraintRefs: string[];
      }>;
    }>(bundle, "architecture-decision.json", (decisions) => {
      const accepted = decisions.decisions[0];
      if (accepted !== undefined)
        accepted.constraintRefs = accepted.constraintRefs.filter(
          (constraintRef) => constraintRef !== secondConstraintId,
        );
      const blocker = decisions.decisions.find(
        ({ id }) => id === "choose-equipment-export-boundary",
      );
      if (blocker !== undefined)
        blocker.affectedElementRefs = ["equipment-other"];
    });
    await mutateJson<{
      slices: Array<{
        id: string;
        status: "ready" | "blocked";
        elementRefs: string[];
        constraintRefs: string[];
        blockedByDecisionRefs: string[];
      }>;
    }>(bundle, "implementation-handoff.json", (handoff) => {
      const blocked = handoff.slices.find(
        ({ id }) => id === "implement-equipment-operations",
      );
      const ready = handoff.slices.find(
        ({ id }) => id === "implement-equipment-other",
      );
      blocked?.elementRefs.push("equipment-other");
      if (ready === undefined) return;
      ready.status = "ready";
      ready.elementRefs = ["equipment-operations"];
      ready.constraintRefs = ["equipment-owns-writes"];
      ready.blockedByDecisionRefs = [];
    });

    const verification = await verifyBundle(bundle, target, {
      sourceMappingPath,
      changedPaths: ["src/other/deleted.ts"],
    });

    expect(verification.status).toBe("incomplete");
    expect(verification.selection).toEqual(
      expect.objectContaining({
        mode: "affected",
        affectedElementRefs: ["equipment-other"],
      }),
    );
    expect(verification.checks).toEqual([
      expect.objectContaining({
        code: "CONSTRAINT_SLICE_BLOCKED",
        status: "pending",
        sliceRefs: ["implement-equipment-operations"],
      }),
    ]);
  });

  it("falls back to full verification and detects an unmapped changed writer", async () => {
    const target = await copyTypeScriptTarget();
    const changedPath = "src/rogue-writer.ts";
    await writeFile(
      join(target, changedPath),
      'import { writeEquipmentRecord } from "@equipment/store";\nwriteEquipmentRecord();\n',
    );

    const verification = await verifyBundle(fixtureDirectory, target, {
      sourceMappingPath,
      changedPaths: [changedPath],
    });

    expect(verification.status).toBe("violations");
    expect(verification.selection).toEqual({
      mode: "full-fallback",
      requestedPaths: [changedPath],
      affectedElementRefs: [],
      issues: [
        expect.objectContaining({
          code: "CHANGE_PATH_UNMAPPED",
          path: changedPath,
        }),
      ],
    });
    expect(verification.checks[0]).toEqual(
      expect.objectContaining({
        code: "CONSTRAINT_VIOLATION",
        observed:
          "writers outside constraint scope: src/rogue-writer.ts (unmapped)",
      }),
    );
  });

  it("falls back to full verification for a changed path outside source roots", async () => {
    const verification = await verifyBundle(
      fixtureDirectory,
      typescriptTargetDirectory,
      {
        sourceMappingPath,
        changedPaths: ["README.md"],
      },
    );

    expect(verification.status).toBe("passed");
    expect(verification.selection).toEqual(
      expect.objectContaining({
        mode: "full-fallback",
        issues: [
          expect.objectContaining({
            code: "CHANGE_PATH_OUTSIDE_SOURCE_ROOTS",
            path: "README.md",
          }),
        ],
      }),
    );
    expect(verification.checks).toHaveLength(1);
  });

  it("falls back to full verification for ambiguous changed ownership", async () => {
    const bundle = await copyFixture();
    const target = await copyTypeScriptTarget();
    await addSecondReadyConstraint(bundle, target, "src/equipment-operations/");

    const verification = await verifyBundle(bundle, target, {
      sourceMappingPath,
      changedPaths: ["src/equipment-operations/save-equipment.ts"],
    });

    expect(verification.selection).toEqual(
      expect.objectContaining({
        mode: "full-fallback",
        affectedElementRefs: ["equipment-operations", "equipment-other"],
        issues: [expect.objectContaining({ code: "CHANGE_PATH_AMBIGUOUS" })],
      }),
    );
    expect(verification.status).toBe("incomplete");
    expect(verification.checks).toContainEqual(
      expect.objectContaining({ code: "SOURCE_MAPPING_AMBIGUOUS" }),
    );
  });

  it("requires explicit mapping for changed-path verification", async () => {
    const verification = await verifyBundle(
      fixtureDirectory,
      typescriptTargetDirectory,
      { changedPaths: ["src/equipment-operations/save-equipment.ts"] },
    );

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "VERIFICATION_CHANGE_MAPPING_REQUIRED",
      }),
    );
  });

  it("rejects an explicitly empty changed-path set", async () => {
    const verification = await verifyBundle(
      fixtureDirectory,
      typescriptTargetDirectory,
      { sourceMappingPath, changedPaths: [] },
    );

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({ code: "VERIFICATION_CHANGED_PATHS_EMPTY" }),
    );
  });

  it.each([
    "../outside.ts",
    "/tmp/outside.ts",
    "C:/outside.ts",
    "src\\outside.ts",
    "src/invalid\0name.ts",
    "src/equipment-operations/",
  ])("rejects unsafe changed path %s operationally", async (changedPath) => {
    const verification = await verifyBundle(
      fixtureDirectory,
      typescriptTargetDirectory,
      { sourceMappingPath, changedPaths: [changedPath] },
    );

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "VERIFICATION_CHANGED_PATH_UNSAFE",
        reference: changedPath,
      }),
    );
  });

  it("passes a scoped writer imported through a tsconfig path alias", async () => {
    const target = await copyTypeScriptTarget();
    await writeFile(
      join(target, "src", "equipment-operations", "save-equipment.ts"),
      'import { writeEquipmentRecord as persistEquipment } from "@equipment/store";\n\nexport function saveEquipment(): void {\n  persistEquipment();\n}\n',
    );

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("passed");
    expect(verification.checks[0]).toEqual(
      expect.objectContaining({
        code: "CONSTRAINT_PASSED",
        observed:
          "all writers are in constraint scope: src/equipment-operations/save-equipment.ts (equipment-operations)",
      }),
    );
  });

  it("violates for an out-of-scope writer imported through a path alias", async () => {
    const target = await copyTypeScriptTarget();
    await writeFile(
      join(target, "src", "rogue-writer.ts"),
      'import { writeEquipmentRecord } from "@equipment/store";\nwriteEquipmentRecord();\n',
    );

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("violations");
    expect(verification.checks[0]).toEqual(
      expect.objectContaining({
        code: "CONSTRAINT_VIOLATION",
        observed:
          "writers outside constraint scope: src/rogue-writer.ts (unmapped)",
      }),
    );
  });

  it.each([
    [
      "named",
      'export { writeEquipmentRecord as persistEquipment } from "@equipment/store";\n',
      'import { persistEquipment } from "../equipment-write-barrel.js";\n\nexport function saveEquipment(): void {\n  persistEquipment();\n}\n',
    ],
    [
      "star",
      'export * from "@equipment/store";\n',
      'import { writeEquipmentRecord as persistEquipment } from "../equipment-write-barrel.js";\n\nexport function saveEquipment(): void {\n  persistEquipment();\n}\n',
    ],
  ])(
    "passes a scoped writer through a static %s re-export",
    async (_name, barrel, caller) => {
      const target = await copyTypeScriptTarget();
      await writeFile(join(target, "src", "equipment-write-barrel.ts"), barrel);
      await writeFile(
        join(target, "src", "equipment-operations", "save-equipment.ts"),
        caller,
      );

      const verification = await verifyBundle(
        fixtureDirectory,
        target,
        options,
      );

      expect(verification.status).toBe("passed");
      expect(verification.checks[0]?.code).toBe("CONSTRAINT_PASSED");
    },
  );

  it("keeps an ambiguous star re-export incomplete", async () => {
    const target = await copyTypeScriptTarget();
    await writeFile(
      join(target, "src", "other-store.ts"),
      "export function writeEquipmentRecord(): void {}\n",
    );
    await writeFile(
      join(target, "src", "equipment-write-barrel.ts"),
      'export * from "@equipment/store";\nexport * from "./other-store.js";\n',
    );
    await writeFile(
      join(target, "src", "equipment-operations", "save-equipment.ts"),
      'import { writeEquipmentRecord } from "../equipment-write-barrel.js";\nwriteEquipmentRecord();\n',
    );

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("incomplete");
    expect(checkCode(verification)).toBe("SOURCE_GRAPH_COMPILER_DIAGNOSTIC");
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

  it("requires an explicit tsconfig path in mapping v0.2", async () => {
    const target = await copyTypeScriptTarget();
    await mutateJson<SourceMapping>(target, sourceMappingPath, (mapping) => {
      delete mapping.tsconfigPath;
    });

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SCHEMA_REQUIRED",
        artifactPath: sourceMappingPath,
        jsonPointer: "/tsconfigPath",
      }),
    );
  });

  it("returns operational error for a missing tsconfig file", async () => {
    const target = await copyTypeScriptTarget();
    await mutateJson<SourceMapping>(target, sourceMappingPath, (mapping) => {
      mapping.tsconfigPath = "missing-tsconfig.json";
    });

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SOURCE_TSCONFIG_UNREADABLE",
        artifactPath: "missing-tsconfig.json",
      }),
    );
  });

  it("retains a source location for malformed tsconfig JSONC", async () => {
    const target = await copyTypeScriptTarget();
    await writeFile(join(target, "tsconfig.json"), "{\n");

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SOURCE_TSCONFIG_JSON_MALFORMED",
        artifactPath: "tsconfig.json",
        sourceLocation: expect.objectContaining({ line: 2 }),
      }),
    );
  });

  it("rejects invalid compiler options operationally", async () => {
    const target = await copyTypeScriptTarget();
    await mutateJson<TypeScriptConfig>(target, "tsconfig.json", (config) => {
      compilerOptions(config).module = "not-a-module";
    });

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({ code: "SOURCE_TSCONFIG_INVALID" }),
    );
  });

  it("rejects non-object compiler options operationally", async () => {
    const target = await copyTypeScriptTarget();
    await mutateJson<TypeScriptConfig>(target, "tsconfig.json", (config) => {
      config.compilerOptions = "strict";
    });

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SOURCE_TSCONFIG_INVALID",
        jsonPointer: "/compilerOptions",
      }),
    );
  });

  it.each([
    [
      "baseUrl",
      (config: TypeScriptConfig) => {
        compilerOptions(config).baseUrl = "../outside";
      },
      "/compilerOptions/baseUrl",
    ],
    [
      "path substitution",
      (config: TypeScriptConfig) => {
        compilerOptions(config).paths = {
          "@equipment/store": ["../outside/equipment-store.ts"],
        };
      },
      "/compilerOptions/paths/@equipment~1store/0",
    ],
    [
      "platform-ambiguous path substitution",
      (config: TypeScriptConfig) => {
        compilerOptions(config).paths = {
          "@equipment/store": ["C:/outside/equipment-store.ts"],
        };
      },
      "/compilerOptions/paths/@equipment~1store/0",
    ],
  ])(
    "rejects escaping tsconfig %s operationally",
    async (_name, mutate, pointer) => {
      const target = await copyTypeScriptTarget();
      await mutateJson<TypeScriptConfig>(target, "tsconfig.json", mutate);

      const verification = await verifyBundle(
        fixtureDirectory,
        target,
        options,
      );

      expect(verification.status).toBe("operational-error");
      expect(verification.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "SOURCE_TSCONFIG_PATH_UNSAFE",
          artifactPath: "tsconfig.json",
          jsonPointer: pointer,
        }),
      );
    },
  );

  it("rejects a symlinked baseUrl operationally", async () => {
    const target = await copyTypeScriptTarget();
    await symlink("src", join(target, "source-link"));
    await mutateJson<TypeScriptConfig>(target, "tsconfig.json", (config) => {
      compilerOptions(config).baseUrl = "./source-link";
    });

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SOURCE_TSCONFIG_PATH_UNSAFE",
        jsonPointer: "/compilerOptions/baseUrl",
      }),
    );
  });

  it("rejects a symlinked path substitution operationally", async () => {
    const target = await copyTypeScriptTarget();
    await symlink(
      "equipment-store.ts",
      join(target, "src", "equipment-store-link.ts"),
    );
    await mutateJson<TypeScriptConfig>(target, "tsconfig.json", (config) => {
      compilerOptions(config).paths = {
        "@equipment/store": ["src/equipment-store-link.ts"],
      };
    });

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SOURCE_TSCONFIG_PATH_UNSAFE",
        jsonPointer: "/compilerOptions/paths/@equipment~1store/0",
      }),
    );
  });

  it("keeps inherited project configuration unsupported", async () => {
    const target = await copyTypeScriptTarget();
    await mutateJson<TypeScriptConfig>(target, "tsconfig.json", (config) => {
      config.extends = "./base.json";
    });

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("incomplete");
    expect(checkCode(verification)).toBe("SOURCE_TSCONFIG_FEATURE_UNSUPPORTED");
  });

  it("keeps project references unsupported", async () => {
    const target = await copyTypeScriptTarget();
    await mutateJson<TypeScriptConfig>(target, "tsconfig.json", (config) => {
      config.references = [{ path: "./other" }];
    });

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("incomplete");
    expect(checkCode(verification)).toBe("SOURCE_TSCONFIG_FEATURE_UNSUPPORTED");
  });

  it("rejects a symlinked project configuration", async () => {
    const target = await copyTypeScriptTarget();
    await symlink("tsconfig.json", join(target, "tsconfig-link.json"));
    await mutateJson<SourceMapping>(target, sourceMappingPath, (mapping) => {
      mapping.tsconfigPath = "tsconfig-link.json";
    });

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("operational-error");
    expect(verification.diagnostics).toContainEqual(
      expect.objectContaining({ code: "SOURCE_TSCONFIG_UNREADABLE" }),
    );
  });

  it("keeps implementation source outside declared roots unsupported", async () => {
    const target = await copyTypeScriptTarget();
    await writeFile(
      join(target, "shared-write.ts"),
      'export { writeEquipmentRecord } from "./src/equipment-store.js";\n',
    );
    await writeFile(
      join(target, "src", "equipment-operations", "save-equipment.ts"),
      'import { writeEquipmentRecord } from "../../shared-write.js";\n\nexport function saveEquipment(): void {\n  writeEquipmentRecord();\n}\n',
    );

    const verification = await verifyBundle(fixtureDirectory, target, options);

    expect(verification.status).toBe("incomplete");
    expect(checkCode(verification)).toBe("SOURCE_GRAPH_SOURCE_OUTSIDE_ROOTS");
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
      "TypeScript import assignment",
      'import store = require("./equipment-store.js");\nstore.writeEquipmentRecord();\n',
      "SOURCE_GRAPH_IMPORT_FORM_UNSUPPORTED",
    ],
    [
      "namespace path alias",
      'import * as store from "@equipment/store";\nstore.writeEquipmentRecord();\n',
      "SOURCE_GRAPH_IMPORT_FORM_UNSUPPORTED",
    ],
    [
      "relative unresolved bridge",
      'import { writeEquipmentRecord } from "./write-bridge.js";\nwriteEquipmentRecord();\n',
      "SOURCE_GRAPH_COMPILER_DIAGNOSTIC",
    ],
    [
      "indirect alias",
      'import { writeEquipmentRecord } from "./equipment-store.js";\nconst write = writeEquipmentRecord;\nwrite();\n',
      "SOURCE_GRAPH_ALIAS_UNSUPPORTED",
    ],
    [
      "namespace re-export",
      'export * as store from "./equipment-store.js";\n',
      "SOURCE_GRAPH_REEXPORT_FORM_UNSUPPORTED",
    ],
    [
      "dynamic import",
      'void import("@equipment/store");\n',
      "SOURCE_GRAPH_DYNAMIC_IMPORT_UNSUPPORTED",
    ],
    [
      "dynamic code evaluation",
      'import { writeEquipmentRecord } from "./equipment-store.js";\neval("writeEquipmentRecord()");\n',
      "SOURCE_GRAPH_DYNAMIC_CODE_UNSUPPORTED",
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
