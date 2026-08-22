import { cp, mkdir, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveArchitectureLineage } from "../src/architecture-lineage.js";
import { loadSchemaRegistry } from "../src/schema-validation.js";
import {
  bookmarkLineageDirectory,
  cleanupFixtures,
  copyBookmarkLineage,
  mutateJson,
} from "./helpers.js";

afterEach(cleanupFixtures);

describe("architecture lineage resolver", () => {
  it("resolves the bookmark direct-CLI to shared-operations evolution", async () => {
    const result = await resolveArchitectureLineage(bookmarkLineageDirectory);

    expect(result.status).toBe("passed");
    expect(result.bundles.map(({ bundleId }) => bundleId)).toEqual([
      "bookmark-direct-cli",
      "bookmark-shared-operations",
    ]);
    expect(result.edges).toEqual([
      {
        fromBundleId: "bookmark-direct-cli",
        toBundleId: "bookmark-shared-operations",
        relationship: "derives-from",
      },
    ]);
    expect(result.triggerEvents).toEqual([
      {
        id: "second-local-caller-fired",
        status: "fired",
        sourceDecision: "bookmark-direct-cli#direct-cli-ownership",
        resultingDecision:
          "bookmark-shared-operations#share-bookmark-operations",
      },
    ]);
    expect(result.heads).toEqual(["bookmark-shared-operations"]);
    expect(result.diagnostics).toEqual([]);

    const registry = await loadSchemaRegistry();
    expect(registry.ok).toBe(true);
    if (registry.ok) {
      expect(
        registry.registry.validate(
          "https://sah.dev/schemas/lineage-result/v0.1.0",
          result,
          "lineage-result.json",
        ),
      ).toEqual([]);
    }
  });

  it("reports a stale parent fingerprint without selecting another parent", async () => {
    const root = await copyBookmarkLineage();
    await mutateJson<{
      parents: Array<{ designFingerprint: string }>;
    }>(
      join(root, "shared-operations"),
      "architecture-evolution.json",
      (model) => {
        const parent = model.parents[0];
        if (parent !== undefined)
          parent.designFingerprint =
            "sha256:1111111111111111111111111111111111111111111111111111111111111111";
      },
    );

    const result = await resolveArchitectureLineage(root);

    expect(result.status).toBe("violations");
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "LINEAGE_PARENT_FINGERPRINT_MISMATCH",
    );
  });

  it("validates the exact source decision trigger and digest", async () => {
    const root = await copyBookmarkLineage();
    await mutateJson<{
      triggerEvents: Array<{
        source: { decisionId: string; reviewTriggerDigest: string };
      }>;
      decisionTransitions: Array<{ from: { decisionId: string } }>;
    }>(
      join(root, "shared-operations"),
      "architecture-evolution.json",
      (model) => {
        const event = model.triggerEvents[0];
        if (event !== undefined) {
          event.source.decisionId = "missing-source-decision";
          event.source.reviewTriggerDigest =
            "sha256:2222222222222222222222222222222222222222222222222222222222222222";
          const transition = model.decisionTransitions[0];
          if (transition !== undefined)
            transition.from.decisionId = event.source.decisionId;
        }
      },
    );

    const result = await resolveArchitectureLineage(root);

    expect(result.status).toBe("violations");
    expect(result.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "LINEAGE_SOURCE_DECISION_DANGLING",
        "LINEAGE_TRIGGER_DIGEST_MISMATCH",
      ]),
    );
  });

  it("rejects a current decision, stage-trigger, or transition reference that is dangling", async () => {
    const root = await copyBookmarkLineage();
    await mutateJson<{
      decisionTransitions: Array<{ toDecisionRef: string }>;
    }>(
      join(root, "shared-operations"),
      "architecture-evolution.json",
      (model) => {
        const transition = model.decisionTransitions[0];
        if (transition !== undefined)
          transition.toDecisionRef = "missing-current-decision";
      },
    );

    const result = await resolveArchitectureLineage(root);

    expect(result.status).toBe("violations");
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "EVOLUTION_DECISION_REFERENCE_DANGLING",
    );
  });

  it("does not pass a fired trigger without one resulting transition", async () => {
    const root = await copyBookmarkLineage();
    await mutateJson<{
      triggerEvents: Array<{
        id: string;
        status: "fired";
        source: {
          bundleId: string;
          designFingerprint: string;
          decisionId: string;
          reviewTriggerText: string;
          reviewTriggerDigest: string;
        };
        evidenceRefs: string[];
        rationale: string;
      }>;
    }>(
      join(root, "shared-operations"),
      "architecture-evolution.json",
      (evolution) => {
        const original = evolution.triggerEvents[0];
        if (original !== undefined) {
          evolution.triggerEvents.push({
            ...original,
            id: "unconnected-trigger",
            source: { ...original.source },
            evidenceRefs: [...original.evidenceRefs],
          });
        }
      },
    );

    const result = await resolveArchitectureLineage(root);

    expect(result.status).toBe("violations");
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "EVOLUTION_TRIGGER_TRANSITION_MISSING",
    );
  });

  it("reports a lineage cycle instead of resolving it by path", async () => {
    const root = await copyBookmarkLineage();
    await mutateJson<{
      parents: Array<{ bundleId: string }>;
    }>(
      join(root, "shared-operations"),
      "architecture-evolution.json",
      (model) => {
        const parent = model.parents[0];
        if (parent !== undefined)
          parent.bundleId = "bookmark-shared-operations";
      },
    );

    const result = await resolveArchitectureLineage(root);

    expect(result.status).toBe("violations");
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "LINEAGE_CYCLE",
    );
  });

  it("reports parallel heads with a shared ancestor", async () => {
    const root = await copyBookmarkLineage();
    const alternate = join(root, "alternate-operations");
    await cp(join(root, "shared-operations"), alternate, { recursive: true });
    await mutateJson<{ bundleId: string }>(
      alternate,
      "sah.bundle.json",
      (manifest) => {
        manifest.bundleId = "bookmark-alternate-operations";
      },
    );
    await mutateJson<{ currentBundleId: string; evolutionId: string }>(
      alternate,
      "architecture-evolution.json",
      (evolution) => {
        evolution.currentBundleId = "bookmark-alternate-operations";
        evolution.evolutionId = "bookmark-alternate-operations-evolution";
      },
    );

    const result = await resolveArchitectureLineage(root);

    expect(result.status).toBe("violations");
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "LINEAGE_PARALLEL_HEAD",
    );
    expect(result.heads).toEqual([
      "bookmark-alternate-operations",
      "bookmark-shared-operations",
    ]);
  });

  it("rejects symlink traversal outside the explicit root", async () => {
    const root = await copyBookmarkLineage();
    const outside = join(dirname(root), "outside-lineage");
    await mkdir(outside);
    await symlink(outside, join(root, "escape"));

    const result = await resolveArchitectureLineage(root);

    expect(result.status).toBe("operational-error");
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "LINEAGE_SYMLINK_OUTSIDE_ROOT",
    );
  });

  it("returns an operational error for an empty explicit root", async () => {
    const root = await copyBookmarkLineage();
    await writeFile(join(root, "direct-cli", "sah.bundle.json"), "not-json\n");

    const result = await resolveArchitectureLineage(root);

    expect(result.status).toBe("operational-error");
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      "JSON_MALFORMED",
    );
  });
});
