import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  CheckerReview,
  CheckerReviewResult,
  CheckerReviewStatus,
  CheckerReviewValidationOptions,
  SahDiagnostic,
} from "./contracts.js";
import { checkerReviewSchemaId } from "./contracts.js";
import { loadSchemaRegistry } from "./schema-validation.js";

function diagnostic(input: {
  code: string;
  message: string;
  artifactPath: string;
  jsonPointer?: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: "validation",
    capability: "Independent Checker review contract",
    classification: "deterministic",
    severity: "error",
    artifactPath: input.artifactPath,
    ...(input.jsonPointer === undefined
      ? {}
      : { jsonPointer: input.jsonPointer }),
    message: input.message,
    expected: input.expected,
    repair: input.repair,
  };
}

function operationalDiagnostic(
  artifactPath: string,
  message: string,
): SahDiagnostic {
  return {
    code: "CHECKER_REVIEW_UNREADABLE",
    category: "operational",
    capability: "Independent Checker review contract",
    severity: "error",
    artifactPath,
    message,
    expected: "a readable, well-formed Checker review JSON file",
    repair:
      "Restore the review file or correct its path and rerun the command.",
  };
}

function sortDiagnostics(diagnostics: SahDiagnostic[]): SahDiagnostic[] {
  return [...diagnostics].sort((left, right) =>
    [left.artifactPath ?? "", left.jsonPointer ?? "", left.code]
      .join("\0")
      .localeCompare(
        [right.artifactPath ?? "", right.jsonPointer ?? "", right.code].join(
          "\0",
        ),
      ),
  );
}

function summarize(diagnostics: SahDiagnostic[]): {
  errors: number;
  warnings: number;
} {
  return {
    errors: diagnostics.filter(({ severity }) => severity === "error").length,
    warnings: diagnostics.filter(({ severity }) => severity === "warning")
      .length,
  };
}

function reviewResult(
  status: CheckerReviewStatus,
  reviewPath: string,
  diagnostics: SahDiagnostic[],
  review?: CheckerReview,
): CheckerReviewResult {
  const ordered = sortDiagnostics(diagnostics);
  return {
    status,
    reviewPath,
    ...(review === undefined ? {} : { reviewId: review.reviewId }),
    ...(review === undefined ? {} : { verdict: review.verdict }),
    diagnostics: ordered,
    summary: summarize(ordered),
  };
}

function mechanicalDiagnostics(
  review: CheckerReview,
  reviewPath: string,
  options: CheckerReviewValidationOptions,
): SahDiagnostic[] {
  const diagnostics: SahDiagnostic[] = [];
  if (
    options.targetRevision !== undefined &&
    options.targetRevision !== review.target.targetRevision
  ) {
    diagnostics.push(
      diagnostic({
        code: "CHECKER_REVIEW_TARGET_REVISION_MISMATCH",
        artifactPath: reviewPath,
        jsonPointer: "/target/targetRevision",
        message: `Review target revision ${review.target.targetRevision} does not match the expected revision ${options.targetRevision}.`,
        expected: "the caller-supplied expected target revision",
        repair: "Review the exact target revision and rerun the Checker.",
      }),
    );
  }
  if (
    options.designFingerprint !== undefined &&
    options.designFingerprint !== review.target.designFingerprint
  ) {
    diagnostics.push(
      diagnostic({
        code: "CHECKER_REVIEW_DESIGN_FINGERPRINT_MISMATCH",
        artifactPath: reviewPath,
        jsonPointer: "/target/designFingerprint",
        message: `Review design fingerprint ${review.target.designFingerprint} does not match the expected fingerprint ${options.designFingerprint}.`,
        expected: "the caller-supplied expected design fingerprint",
        repair: "Refresh the review against the current SAH design bundle.",
      }),
    );
  }
  const checkIds = new Map<string, number>();
  review.checks.forEach((check, index) => {
    const previous = checkIds.get(check.id);
    if (previous !== undefined) {
      diagnostics.push(
        diagnostic({
          code: "CHECKER_REVIEW_DUPLICATE_CHECK_ID",
          artifactPath: reviewPath,
          jsonPointer: `/checks/${index}/id`,
          message: `Checker review check id ${check.id} is duplicated.`,
          expected: "each check id to occur once",
          repair: "Give each independently reviewed check a unique id.",
        }),
      );
    } else {
      checkIds.set(check.id, index);
    }
  });

  const findingIds = new Map<string, number>();
  review.findings.forEach((finding, index) => {
    const previous = findingIds.get(finding.id);
    if (previous !== undefined) {
      diagnostics.push(
        diagnostic({
          code: "CHECKER_REVIEW_DUPLICATE_FINDING_ID",
          artifactPath: reviewPath,
          jsonPointer: `/findings/${index}/id`,
          message: `Checker review finding id ${finding.id} is duplicated.`,
          expected: "each finding id to occur once",
          repair: "Give each finding a unique id.",
        }),
      );
    } else {
      findingIds.set(finding.id, index);
    }
  });

  if (review.verdict === "approve") {
    review.checks.forEach((check, index) => {
      if (check.status !== "passed" || check.exitCode !== 0) {
        diagnostics.push(
          diagnostic({
            code: "CHECKER_REVIEW_APPROVAL_NONPASSING_CHECK",
            artifactPath: reviewPath,
            jsonPointer: `/checks/${index}`,
            message: `Approval includes non-passing check ${check.id}.`,
            expected:
              "every approved check to have status passed and exitCode 0",
            repair:
              "Repair or rerun the check, or change the verdict to request-changes/incomplete.",
          }),
        );
      }
    });

    review.findings.forEach((finding, index) => {
      if (
        (finding.severity === "high" || finding.severity === "medium") &&
        finding.status === "open"
      ) {
        diagnostics.push(
          diagnostic({
            code: "CHECKER_REVIEW_APPROVAL_OPEN_FINDING",
            artifactPath: reviewPath,
            jsonPointer: `/findings/${index}`,
            message: `Approval leaves open ${finding.severity}-severity finding ${finding.id}.`,
            expected: "no open high- or medium-severity finding in an approval",
            repair:
              "Resolve or explicitly reclassify the finding, or change the verdict.",
          }),
        );
      }
    });
  }

  return diagnostics;
}

/** Validate a caller-produced, revision-bound independent Checker record. */
export async function validateCheckerReview(
  reviewFile: string,
  options: CheckerReviewValidationOptions = {},
): Promise<CheckerReviewResult> {
  const reviewPath = resolve(reviewFile);
  let source: string;
  try {
    source = await readFile(reviewPath, "utf8");
  } catch (error) {
    return reviewResult("operational-error", reviewPath, [
      operationalDiagnostic(
        reviewPath,
        error instanceof Error
          ? error.message
          : "The review file is unreadable.",
      ),
    ]);
  }

  let data: unknown;
  try {
    data = JSON.parse(source) as unknown;
  } catch (error) {
    return reviewResult("operational-error", reviewPath, [
      operationalDiagnostic(
        reviewPath,
        error instanceof Error
          ? `The review file is malformed JSON: ${error.message}`
          : "The review file is malformed JSON.",
      ),
    ]);
  }

  const loaded = await loadSchemaRegistry();
  if (!loaded.ok) {
    return reviewResult("operational-error", reviewPath, loaded.diagnostics);
  }
  const schemaDiagnostics = loaded.registry.validate(
    checkerReviewSchemaId,
    data,
    reviewPath,
  );
  if (schemaDiagnostics.length > 0) {
    return reviewResult("violations", reviewPath, schemaDiagnostics);
  }

  const review = data as CheckerReview;
  const diagnostics = mechanicalDiagnostics(review, reviewPath, options);
  if (diagnostics.length > 0) {
    return reviewResult("violations", reviewPath, diagnostics, review);
  }
  if (review.verdict === "approve")
    return reviewResult("passed", reviewPath, [], review);
  if (review.verdict === "request-changes")
    return reviewResult("violations", reviewPath, [], review);
  return reviewResult("incomplete", reviewPath, [], review);
}
