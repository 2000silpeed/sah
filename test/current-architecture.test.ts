import { cp, readFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveCurrentArchitecture } from "../src/current-architecture.js";
import { loadSchemaRegistry } from "../src/schema-validation.js";
import {
  bookmarkLineageDirectory,
  cleanupFixtures,
  copyBookmarkLineage,
  fixtureDirectory,
  mutateJson,
} from "./helpers.js";

afterEach(cleanupFixtures);

describe("current architecture projection", () => {
  it("projects the bookmark head without rewriting the parent decision", async () => {
    const result = await resolveCurrentArchitecture(bookmarkLineageDirectory);

    expect(result.status).toBe("ready");
    expect(result.heads.map(({ bundleId }) => bundleId)).toEqual([
      "bookmark-shared-operations",
    ]);
    expect(result.activeDecisions).toEqual([
      {
        qualifiedRef: "bookmark-shared-operations#share-bookmark-operations",
        title: "Share bookmark operations across local callers",
        scopeElementRefs: ["bookmark-operations"],
      },
    ]);
    expect(result.supersededDecisions).toEqual([
      {
        qualifiedRef: "bookmark-direct-cli#direct-cli-ownership",
        supersededBy: "bookmark-shared-operations#share-bookmark-operations",
      },
    ]);
    expect(result.openReviewTriggers).toEqual([
      {
        decisionRef: "bookmark-shared-operations#share-bookmark-operations",
        trigger: "A second local caller appears.",
      },
    ]);
    expect(result.conflicts).toEqual([]);
    expect(result.diagnostics).toEqual([]);

    const registry = await loadSchemaRegistry();
    expect(registry.ok).toBe(true);
    if (registry.ok) {
      expect(
        registry.registry.validate(
          "https://sah.dev/schemas/current-architecture-result/v0.1.0",
          result,
          "current-architecture-result.json",
        ),
      ).toEqual([]);
    }
  });

  it("keeps a v0.4 bundle independently readable", async () => {
    const before = await readFile(join(fixtureDirectory, "sah.bundle.json"));
    const result = await resolveCurrentArchitecture(fixtureDirectory);
    const after = await readFile(join(fixtureDirectory, "sah.bundle.json"));

    expect(result.status).toBe("ready");
    expect(result.heads[0]?.bundleId).toBe("equipment-register");
    expect(result.activeDecisions[0]?.qualifiedRef).toBe(
      "equipment-register#choose-equipment-module",
    );
    expect(result.openReviewTriggers).toEqual([
      {
        decisionRef: "equipment-register#choose-equipment-module",
        trigger:
          "A rule coordinates multiple equipment records or independent owners",
      },
    ]);
    expect(after).toEqual(before);
    expect(result.heads[0]?.fingerprint).toBe(
      "sha256:cc8663147472dc70644fd5feb6aabac0bfd0cc6dd4403bad7cc4ee419d9fa261",
    );
  });

  it("keeps missing lineage incomplete instead of projecting a pass", async () => {
    const root = await copyBookmarkLineage();
    await mutateJson<{ parents: Array<{ bundleId: string }> }>(
      join(root, "shared-operations"),
      "architecture-evolution.json",
      (evolution) => {
        const parent = evolution.parents[0];
        if (parent !== undefined) parent.bundleId = "missing-parent";
      },
    );

    const result = await resolveCurrentArchitecture(root);

    expect(result.status).toBe("incomplete");
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "LINEAGE_PARENT_MISSING",
    );
  });

  it("surfaces overlapping independent heads without latest-wins", async () => {
    const root = await copyBookmarkLineage();
    const alternate = join(root, "alternate-direct-cli");
    await cp(join(root, "direct-cli"), alternate, { recursive: true });
    await mutateJson<{ bundleId: string }>(
      alternate,
      "sah.bundle.json",
      (manifest) => {
        manifest.bundleId = "bookmark-alternate-direct-cli";
      },
    );

    const result = await resolveCurrentArchitecture(root);

    expect(result.status).toBe("conflicted");
    expect(result.heads.map(({ bundleId }) => bundleId)).toEqual([
      "bookmark-alternate-direct-cli",
      "bookmark-shared-operations",
    ]);
    expect(result.conflicts.map(({ code }) => code)).toContain(
      "CURRENT_DECISION_SCOPE_CONFLICT",
    );
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "CURRENT_DECISION_SCOPE_CONFLICT",
    );
  });
});
