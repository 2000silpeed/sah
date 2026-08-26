import { constants } from "node:fs";
import { access, lstat, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type {
  ReviewDisposition,
  ReviewDispositionResult,
  ReviewDispositionStatus,
  ReviewDispositionValidationOptions,
  SahDiagnostic,
} from "./contracts.js";
import { reviewDispositionSchemaId } from "./contracts.js";
import type { ArchitectureModel, BundleManifest } from "./internal-model.js";
import {
  loadSchemaRegistry,
  type SchemaRegistry,
} from "./schema-validation.js";

export const reviewDispositionCapability = "review-disposition";

type Constraint = ArchitectureModel["constraints"][number];

type Assignment = {
  sliceRefs: string[];
  readySliceRefs: string[];
  blockerDecisionRefs: string[];
};

export type ReviewDispositionContext = {
  targetRoot: string;
  targetRevision: string;
  designFingerprint: string;
  bundle: Pick<BundleManifest, "bundleId"> & {
    completedStage: "S12";
  };
};

export type ContextualDispositionInput = {
  record: ReviewDisposition;
  context: ReviewDispositionContext;
};

export type ContextualDispositionOutcome = {
  kind: "accepted" | "rejected" | "pending" | "unsupported";
  code: string;
  message: string;
  expected: string;
  observed: string;
  repair: string;
};

type LoadedDisposition = {
  path: string;
  record: ReviewDisposition;
};

type DispositionLoadResult =
  | { ok: true; disposition: LoadedDisposition }
  | { ok: false; diagnostics: SahDiagnostic[] };

function isWithin(root: string, target: string): boolean {
  const fromRoot = relative(root, target);
  return (
    fromRoot === "" ||
    (fromRoot !== ".." &&
      !fromRoot.startsWith(`..${sep}`) &&
      !isAbsolute(fromRoot))
  );
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f))
      return true;
  }
  return false;
}

function isSafeRelativeJsonPath(value: string): boolean {
  const segments = value.split("/");
  return (
    value.trim() !== "" &&
    value.endsWith(".json") &&
    !isAbsolute(value) &&
    !/^[A-Za-z]:/u.test(value) &&
    !value.includes("\\") &&
    !hasControlCharacter(value) &&
    !segments.some((segment) => ["", ".", ".."].includes(segment))
  );
}

function diagnostic(input: {
  code: string;
  category?: "validation" | "operational";
  artifactPath: string;
  jsonPointer?: string;
  message: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: input.category ?? "validation",
    capability: "Contextual review disposition contract",
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

function result(
  status: ReviewDispositionStatus,
  dispositionPath: string,
  diagnostics: SahDiagnostic[],
  disposition?: ReviewDisposition,
): ReviewDispositionResult {
  const ordered = [...diagnostics].sort((left, right) =>
    [left.artifactPath ?? "", left.jsonPointer ?? "", left.code]
      .join("\0")
      .localeCompare(
        [right.artifactPath ?? "", right.jsonPointer ?? "", right.code].join(
          "\0",
        ),
      ),
  );
  return {
    status,
    dispositionPath,
    ...(disposition === undefined
      ? {}
      : { dispositionId: disposition.dispositionId }),
    diagnostics: ordered,
    summary: {
      errors: ordered.filter(({ severity }) => severity === "error").length,
      warnings: ordered.filter(({ severity }) => severity === "warning").length,
    },
  };
}

function mechanicalDiagnostics(
  disposition: ReviewDisposition,
  dispositionPath: string,
  options: ReviewDispositionValidationOptions,
): SahDiagnostic[] {
  const diagnostics: SahDiagnostic[] = [];
  const targetChecks: Array<{
    option: keyof ReviewDispositionValidationOptions;
    actual: string;
    expected: string | undefined;
    pointer: string;
    code: string;
  }> = [
    {
      option: "targetRoot",
      actual: disposition.target.targetRoot,
      expected: options.targetRoot,
      pointer: "/target/targetRoot",
      code: "REVIEW_DISPOSITION_TARGET_ROOT_MISMATCH",
    },
    {
      option: "targetRevision",
      actual: disposition.target.targetRevision,
      expected: options.targetRevision,
      pointer: "/target/targetRevision",
      code: "REVIEW_DISPOSITION_TARGET_REVISION_MISMATCH",
    },
    {
      option: "designFingerprint",
      actual: disposition.target.designFingerprint,
      expected: options.designFingerprint,
      pointer: "/target/designFingerprint",
      code: "REVIEW_DISPOSITION_DESIGN_FINGERPRINT_MISMATCH",
    },
    {
      option: "bundleId",
      actual: disposition.scope.bundleId,
      expected: options.bundleId,
      pointer: "/scope/bundleId",
      code: "REVIEW_DISPOSITION_BUNDLE_MISMATCH",
    },
  ];
  for (const check of targetChecks) {
    if (check.expected !== undefined && check.actual !== check.expected) {
      diagnostics.push(
        diagnostic({
          code: check.code,
          artifactPath: dispositionPath,
          jsonPointer: check.pointer,
          message: `Disposition ${check.option} ${check.actual} does not match expected ${check.expected}.`,
          expected: `the caller-supplied ${check.option}`,
          repair:
            "Create a new disposition for the exact current verification context.",
        }),
      );
    }
  }

  const entryIds = new Map<string, number>();
  disposition.entries.forEach((entry, index) => {
    const previous = entryIds.get(entry.constraintId);
    if (previous !== undefined) {
      diagnostics.push(
        diagnostic({
          code: "REVIEW_DISPOSITION_DUPLICATE_CONSTRAINT",
          artifactPath: dispositionPath,
          jsonPointer: `/entries/${String(index)}/constraintId`,
          message: `Disposition contains duplicate entry ${entry.constraintId}.`,
          expected: "one disposition entry per constraint",
          repair:
            "Remove the duplicate and record one current authority decision.",
        }),
      );
    } else {
      entryIds.set(entry.constraintId, index);
    }
    if (!disposition.scope.constraintIds.includes(entry.constraintId)) {
      diagnostics.push(
        diagnostic({
          code: "REVIEW_DISPOSITION_ENTRY_OUT_OF_SCOPE",
          artifactPath: dispositionPath,
          jsonPointer: `/entries/${String(index)}/constraintId`,
          message: `Disposition entry ${entry.constraintId} is not listed in scope.constraintIds.`,
          expected:
            "every entry constraint ID to be declared in the disposition scope",
          repair:
            "Align scope.constraintIds with the entries or remove the entry.",
        }),
      );
    }
    const expiry = Date.parse(entry.expiresAt);
    const reviewedAt = Date.parse(disposition.reviewedAt);
    if (expiry <= reviewedAt) {
      diagnostics.push(
        diagnostic({
          code: "REVIEW_DISPOSITION_EXPIRY_INVALID",
          artifactPath: dispositionPath,
          jsonPointer: `/entries/${String(index)}/expiresAt`,
          message: `Disposition entry ${entry.constraintId} expires at or before its review time.`,
          expected: "expiresAt later than reviewedAt",
          repair:
            "Set an explicit future expiry for the accepted contextual risk.",
        }),
      );
    }
  });
  for (const constraintId of disposition.scope.constraintIds) {
    if (!entryIds.has(constraintId)) {
      diagnostics.push(
        diagnostic({
          code: "REVIEW_DISPOSITION_ENTRY_MISSING",
          artifactPath: dispositionPath,
          jsonPointer: "/entries",
          message: `Disposition scope has no entry for ${constraintId}.`,
          expected: "one entry for every scoped constraint ID",
          repair: "Add the authority's disposition for the missing constraint.",
        }),
      );
    }
  }
  return diagnostics;
}

/** Validate the mechanical shape and optional caller-supplied context of a disposition. */
export async function validateReviewDisposition(
  dispositionFile: string,
  options: ReviewDispositionValidationOptions = {},
): Promise<ReviewDispositionResult> {
  const dispositionPath = resolve(dispositionFile);
  let source: string;
  try {
    source = await readFile(dispositionPath, "utf8");
  } catch (error) {
    return result("operational-error", dispositionPath, [
      diagnostic({
        code: "REVIEW_DISPOSITION_UNREADABLE",
        category: "operational",
        artifactPath: dispositionPath,
        message:
          error instanceof Error
            ? error.message
            : "The disposition file is unreadable.",
        expected: "a readable contextual review disposition JSON file",
        repair:
          "Restore the disposition file or correct its path and rerun the command.",
      }),
    ]);
  }

  let data: unknown;
  try {
    data = JSON.parse(source) as unknown;
  } catch (error) {
    return result("operational-error", dispositionPath, [
      diagnostic({
        code: "REVIEW_DISPOSITION_MALFORMED",
        category: "operational",
        artifactPath: dispositionPath,
        message:
          error instanceof Error
            ? `The disposition file is malformed JSON: ${error.message}`
            : "The disposition file is malformed JSON.",
        expected: "well-formed review-disposition JSON",
        repair:
          "Create a schema-valid disposition record and rerun the command.",
      }),
    ]);
  }

  const loaded = await loadSchemaRegistry();
  if (!loaded.ok)
    return result("operational-error", dispositionPath, loaded.diagnostics);
  const schemaDiagnostics = loaded.registry.validate(
    reviewDispositionSchemaId,
    data,
    dispositionPath,
  );
  if (schemaDiagnostics.length > 0)
    return result("violations", dispositionPath, schemaDiagnostics);

  const disposition = data as ReviewDisposition;
  const diagnostics = mechanicalDiagnostics(
    disposition,
    dispositionPath,
    options,
  );
  if (diagnostics.length > 0)
    return result("violations", dispositionPath, diagnostics, disposition);

  const now = Date.now();
  if (disposition.entries.some((entry) => entry.disposition === "rejected"))
    return result("violations", dispositionPath, [], disposition);
  if (
    disposition.entries.some(
      (entry) =>
        entry.disposition === "deferred" || Date.parse(entry.expiresAt) <= now,
    )
  )
    return result("incomplete", dispositionPath, [], disposition);
  return result("passed", dispositionPath, [], disposition);
}

async function confinedRegularFile(
  targetRoot: string,
  relativePath: string,
): Promise<string> {
  let current = targetRoot;
  for (const segment of relativePath.split("/")) {
    const next = resolve(current, segment);
    if (!isWithin(targetRoot, next))
      throw new Error(`${relativePath} resolves outside the target root.`);
    const entry = await lstat(next);
    if (entry.isSymbolicLink())
      throw new Error(`${relativePath} crosses a symbolic link.`);
    current = next;
  }
  const physical = await realpath(current);
  if (!isWithin(targetRoot, physical))
    throw new Error(`${relativePath} resolves outside the target root.`);
  if (!(await stat(physical)).isFile())
    throw new Error(`${relativePath} is not a regular file.`);
  await access(physical, constants.R_OK);
  return physical;
}

/** Load a target-relative disposition without following a path outside the target root. */
export async function loadReviewDisposition(input: {
  targetRoot: string;
  dispositionRecordPath: string;
  registry: SchemaRegistry;
}): Promise<DispositionLoadResult> {
  const path = input.dispositionRecordPath;
  const operational = (
    code: string,
    message: string,
  ): DispositionLoadResult => ({
    ok: false,
    diagnostics: [
      diagnostic({
        code,
        category: "operational",
        artifactPath: path,
        message,
        expected:
          "a readable non-symlink regular disposition JSON file inside the target",
        repair:
          "Restore the disposition file or pass a safe target-relative path.",
      }),
    ],
  });
  if (!isSafeRelativeJsonPath(path))
    return operational(
      "REVIEW_DISPOSITION_PATH_UNSAFE",
      `Disposition path ${JSON.stringify(path)} is not a confined target-relative JSON path.`,
    );

  let source: string;
  try {
    source = await readFile(
      await confinedRegularFile(input.targetRoot, path),
      "utf8",
    );
  } catch (error) {
    return operational(
      "REVIEW_DISPOSITION_UNREADABLE",
      error instanceof Error
        ? error.message
        : `Cannot read disposition ${path}.`,
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(source) as unknown;
  } catch (error) {
    return operational(
      "REVIEW_DISPOSITION_MALFORMED",
      error instanceof Error
        ? `The disposition file is malformed JSON: ${error.message}`
        : `Cannot parse disposition ${path}.`,
    );
  }
  const schemaDiagnostics = input.registry.validate(
    reviewDispositionSchemaId,
    data,
    path,
    "operational",
  );
  if (schemaDiagnostics.length > 0)
    return {
      ok: false,
      diagnostics: schemaDiagnostics.map((item) => ({
        ...item,
        capability: "Contextual review disposition contract",
        repair:
          "Regenerate the evidence so it matches the review-disposition schema.",
      })),
    };
  return {
    ok: true,
    disposition: { path, record: data as ReviewDisposition },
  };
}

function sameMembers(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
}

function unsupportedOutcome(
  code: string,
  message: string,
  expected: string,
  observed: string,
  repair: string,
): ContextualDispositionOutcome {
  return { kind: "unsupported", code, message, expected, observed, repair };
}

/** Resolve one contextual entry while retaining its assisted/judgment classification. */
export function resolveReviewDisposition(input: {
  disposition: ContextualDispositionInput;
  constraint: Constraint;
  assignment: Assignment;
  assignedConstraintIds: ReadonlySet<string>;
}): ContextualDispositionOutcome {
  const { disposition, constraint, assignment, assignedConstraintIds } = input;
  const { record, context } = disposition;
  const contextIssues = [
    record.target.targetRoot === context.targetRoot
      ? undefined
      : `target root ${record.target.targetRoot} does not match ${context.targetRoot}`,
    record.target.targetRevision === context.targetRevision
      ? undefined
      : `target revision ${record.target.targetRevision} does not match ${context.targetRevision}`,
    record.target.designFingerprint === context.designFingerprint
      ? undefined
      : `design fingerprint ${record.target.designFingerprint} does not match ${context.designFingerprint}`,
    record.scope.bundleId === context.bundle.bundleId
      ? undefined
      : `bundle ${record.scope.bundleId} does not match ${context.bundle.bundleId}`,
  ].filter((issue): issue is string => issue !== undefined);
  const scopedIds = new Set(record.scope.constraintIds);
  const assignedIds = new Set(assignedConstraintIds);
  if (
    scopedIds.size !== assignedIds.size ||
    [...scopedIds].some((constraintId) => !assignedIds.has(constraintId))
  ) {
    contextIssues.push(
      "disposition constraint scope does not exactly match the current assigned constraints",
    );
  }
  if (contextIssues.length > 0)
    return unsupportedOutcome(
      "CONSTRAINT_DISPOSITION_CONTEXT_MISMATCH",
      "The contextual disposition is stale or scoped to a different verification context.",
      "target, bundle, stage, and assigned constraint context to match exactly",
      contextIssues.join("; "),
      "Create a new disposition for the current S12 bundle and target revision.",
    );

  const entries = record.entries.filter(
    (entry) => entry.constraintId === constraint.id,
  );
  if (entries.length === 0)
    return unsupportedOutcome(
      "CONSTRAINT_DISPOSITION_MISSING",
      `The contextual disposition has no entry for constraint ${constraint.id}.`,
      "one disposition entry matching every assigned contextual constraint",
      constraint.id,
      "Add the missing authority disposition and rerun verification.",
    );
  if (entries.length > 1)
    return unsupportedOutcome(
      "CONSTRAINT_DISPOSITION_DUPLICATE",
      `The contextual disposition has duplicate entries for constraint ${constraint.id}.`,
      "one disposition entry per constraint",
      String(entries.length),
      "Remove duplicate entries and create one current disposition.",
    );

  const entry = entries[0];
  if (entry === undefined) {
    return unsupportedOutcome(
      "CONSTRAINT_DISPOSITION_MISSING",
      `The contextual disposition has no entry for constraint ${constraint.id}.`,
      "one disposition entry matching every assigned contextual constraint",
      constraint.id,
      "Add the missing authority disposition and rerun verification.",
    );
  }
  const expectedSliceRefs = [...new Set(assignment.sliceRefs)];
  if (
    entry.decisionRef !== constraint.decisionRef ||
    entry.classification !== constraint.classification ||
    entry.capability !== constraint.enforcement.adapterCapability ||
    !sameMembers(entry.scopeElementRefs, constraint.scopeElementRefs) ||
    !sameMembers(entry.invariantRefs, constraint.invariantRefs) ||
    !sameMembers(entry.sliceRefs, expectedSliceRefs)
  ) {
    return unsupportedOutcome(
      "CONSTRAINT_DISPOSITION_TRACE_MISMATCH",
      `Disposition entry ${constraint.id} does not match the current constraint or S12 slice assignment.`,
      "decision, assisted/judgment classification, capability, scope, invariant, and slice traces to match",
      JSON.stringify({
        decisionRef: entry.decisionRef,
        classification: entry.classification,
        capability: entry.capability,
        scopeElementRefs: entry.scopeElementRefs,
        invariantRefs: entry.invariantRefs,
        sliceRefs: entry.sliceRefs,
      }),
      "Recreate the disposition from the current S11 constraint and S12 handoff.",
    );
  }

  const observed = `disposition ${record.dispositionId} by ${record.authority.id} reviewed ${record.reviewedAt} expires ${entry.expiresAt}`;
  const expected = "accepted contextual disposition";
  if (
    entry.disposition === "accepted" &&
    Date.parse(entry.expiresAt) <= Date.now()
  )
    return {
      kind: "pending",
      code: "CONSTRAINT_DISPOSITION_EXPIRED",
      message: `Contextual disposition for ${constraint.id} has expired.`,
      expected,
      observed,
      repair: "Renew the authority disposition for the current target context.",
    };
  if (entry.disposition === "accepted")
    return {
      kind: "accepted",
      code: "CONSTRAINT_DISPOSITION_ACCEPTED",
      message: `Contextual ${constraint.classification} disposition for ${constraint.id} was accepted by the named authority.`,
      expected,
      observed,
      repair:
        "Renew the disposition before expiry or reopen the contextual review when its trigger fires.",
    };
  if (entry.disposition === "rejected")
    return {
      kind: "rejected",
      code: "CONSTRAINT_DISPOSITION_REJECTED",
      message: `The named authority rejected contextual disposition for ${constraint.id}.`,
      expected,
      observed,
      repair:
        "Resolve the residual risk or revise the accepted decision through the owning review stage.",
    };
  return {
    kind: "pending",
    code: "CONSTRAINT_DISPOSITION_DEFERRED",
    message: `Contextual disposition for ${constraint.id} remains deferred.`,
    expected,
    observed,
    repair: "Obtain an accepted authority disposition before completing S13.",
  };
}
