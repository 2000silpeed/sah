import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateCheckerReview } from "../src/checker-review.js";
import { checkerReviewFixturePath } from "./helpers.js";

async function temporaryReview(): Promise<{
  directory: string;
  path: string;
  value: Record<string, unknown>;
}> {
  const directory = await mkdtemp(join(tmpdir(), "sah-checker-review-"));
  const path = join(directory, "review.json");
  const value = JSON.parse(
    await readFile(checkerReviewFixturePath, "utf8"),
  ) as Record<string, unknown>;
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  return { directory, path, value };
}

describe("independent Checker review contract", () => {
  it("accepts a passing approval with complete check evidence", async () => {
    const review = await validateCheckerReview(checkerReviewFixturePath);

    expect(review.status).toBe("passed");
    expect(review.reviewId).toBe("fixture-checker-approval");
    expect(review.verdict).toBe("approve");
    expect(review.diagnostics).toEqual([]);
  });

  it("blocks an approval with a non-passing check", async () => {
    const temporary = await temporaryReview();
    try {
      const checks = temporary.value.checks as Array<Record<string, unknown>>;
      const firstCheck = checks[0];
      if (firstCheck === undefined) throw new Error("fixture check missing");
      firstCheck.status = "failed";
      firstCheck.exitCode = 1;
      await writeFile(temporary.path, `${JSON.stringify(temporary.value)}\n`);

      const review = await validateCheckerReview(temporary.path);

      expect(review.status).toBe("violations");
      expect(review.diagnostics.map(({ code }) => code)).toContain(
        "CHECKER_REVIEW_APPROVAL_NONPASSING_CHECK",
      );
    } finally {
      await rm(temporary.directory, { recursive: true, force: true });
    }
  });

  it("reports request-changes as a non-passing judgment result", async () => {
    const temporary = await temporaryReview();
    try {
      temporary.value.verdict = "request-changes";
      await writeFile(temporary.path, `${JSON.stringify(temporary.value)}\n`);

      const review = await validateCheckerReview(temporary.path);

      expect(review.status).toBe("violations");
      expect(review.diagnostics).toEqual([]);
    } finally {
      await rm(temporary.directory, { recursive: true, force: true });
    }
  });

  it("blocks approval with an open high-severity finding", async () => {
    const temporary = await temporaryReview();
    try {
      temporary.value.findings = [
        {
          id: "open-security-finding",
          classification: "judgment",
          severity: "high",
          status: "open",
          message: "The review scope leaves a security boundary unresolved.",
        },
      ];
      await writeFile(temporary.path, `${JSON.stringify(temporary.value)}\n`);

      const review = await validateCheckerReview(temporary.path);

      expect(review.status).toBe("violations");
      expect(review.diagnostics.map(({ code }) => code)).toContain(
        "CHECKER_REVIEW_APPROVAL_OPEN_FINDING",
      );
    } finally {
      await rm(temporary.directory, { recursive: true, force: true });
    }
  });

  it("rejects a stale explicit revision or design fingerprint", async () => {
    const review = await validateCheckerReview(checkerReviewFixturePath, {
      targetRevision: "caller:other-revision",
      designFingerprint:
        "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    });

    expect(review.status).toBe("violations");
    expect(review.diagnostics.map(({ code }) => code)).toEqual([
      "CHECKER_REVIEW_DESIGN_FINGERPRINT_MISMATCH",
      "CHECKER_REVIEW_TARGET_REVISION_MISMATCH",
    ]);
  });

  it("keeps blocked or unreadable review evidence non-passing", async () => {
    const blocked = await temporaryReview();
    try {
      blocked.value.verdict = "blocked";
      await writeFile(blocked.path, `${JSON.stringify(blocked.value)}\n`);
      const blockedResult = await validateCheckerReview(blocked.path);
      expect(blockedResult.status).toBe("incomplete");
    } finally {
      await rm(blocked.directory, { recursive: true, force: true });
    }

    const missing = await validateCheckerReview(
      join(tmpdir(), "sah-review-that-does-not-exist.json"),
    );
    expect(missing.status).toBe("operational-error");
  });
});
