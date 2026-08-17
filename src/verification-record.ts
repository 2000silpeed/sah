import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  open,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

import {
  verificationRecordSchemaId,
  type SahDiagnostic,
  type VerificationOptions,
  type VerificationRecord,
  type VerificationResult,
} from "./contracts.js";
import { collectConstraintAssignments } from "./constraint-verification.js";
import type {
  BundleManifest,
  LoadedArtifact,
  LoadedModels,
} from "./internal-model.js";
import type { SchemaRegistry } from "./schema-validation.js";

export type LoadedVerificationRecord = {
  path: string;
  source: Uint8Array;
  sha256: string;
  data: VerificationRecord;
};

type RecordLoadResult =
  | { ok: true; record: LoadedVerificationRecord }
  | { ok: false; diagnostics: SahDiagnostic[] };

type RecordPublishResult =
  | { ok: true; source: Uint8Array; sha256: string }
  | { ok: false; diagnostics: SahDiagnostic[] };

function isWithin(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))
  );
}

function recordDiagnostic(input: {
  code: string;
  path: string;
  message: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: "operational",
    capability: "Verification record storage",
    severity: "error",
    artifactPath: input.path,
    message: input.message,
    expected: input.expected,
    repair: input.repair,
  };
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function safeRecordPath(path: string): boolean {
  if (
    path.trim() === "" ||
    isAbsolute(path) ||
    path.includes("\\") ||
    hasControlCharacter(path) ||
    !path.endsWith(".json")
  )
    return false;
  return path.split("/").every((segment) => !["", ".", ".."].includes(segment));
}

function invalidPath(path: string): {
  ok: false;
  diagnostics: SahDiagnostic[];
} {
  return {
    ok: false,
    diagnostics: [
      recordDiagnostic({
        code: "VERIFICATION_RECORD_PATH_UNSAFE",
        path,
        message: `Verification record path ${path || "(empty)"} is not a safe bundle-relative JSON path.`,
        expected:
          "a non-empty forward-slash relative .json path with no dot, parent, control, or backslash segment",
        repair: "Choose a regular JSON file path inside the design bundle.",
      }),
    ],
  };
}

export function sha256(source: Uint8Array): string {
  return createHash("sha256").update(source).digest("hex");
}

function frame(
  hash: ReturnType<typeof createHash>,
  value: string | Uint8Array,
): void {
  const bytes =
    typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
  hash.update(`${String(bytes.byteLength)}:`);
  hash.update(bytes);
}

export function designFingerprint(
  manifest: BundleManifest,
  artifacts: readonly LoadedArtifact[],
): string {
  const hash = createHash("sha256");
  frame(hash, manifest.bundleId);
  frame(hash, manifest.lifecycle.profile);
  for (const artifact of [...artifacts].sort((left, right) =>
    left.role.localeCompare(right.role),
  )) {
    frame(hash, artifact.role);
    frame(hash, artifact.path);
    frame(hash, artifact.schemaId);
    frame(hash, artifact.source);
  }
  return `sha256:${hash.digest("hex")}`;
}

export function createVerificationRecord(input: {
  manifest: BundleManifest;
  artifacts: readonly LoadedArtifact[];
  options: VerificationOptions;
  result: VerificationResult & {
    bundle: NonNullable<VerificationResult["bundle"]>;
  };
}): VerificationRecord {
  const changedPaths = input.options.changedPaths;
  return {
    $schema: verificationRecordSchemaId,
    recordVersion: "0.1.0",
    bundleFingerprint: designFingerprint(input.manifest, input.artifacts),
    invocation: {
      scope: changedPaths === undefined ? "full" : "changed",
      ...(input.options.sourceMappingPath === undefined
        ? {}
        : { sourceMappingPath: input.options.sourceMappingPath }),
      ...(changedPaths === undefined
        ? {}
        : { changedPaths: [...changedPaths] }),
    },
    result: input.result,
  };
}

async function resolveRecordParent(
  bundleRoot: string,
  path: string,
): Promise<
  | { ok: true; lexicalPath: string; parentPath: string }
  | { ok: false; diagnostics: SahDiagnostic[] }
> {
  if (!safeRecordPath(path)) return invalidPath(path);
  const lexicalPath = resolve(bundleRoot, path);
  if (!isWithin(bundleRoot, lexicalPath)) return invalidPath(path);
  const parentPath = dirname(lexicalPath);
  try {
    const physicalParent = await realpath(parentPath);
    if (
      physicalParent !== parentPath ||
      !isWithin(bundleRoot, physicalParent) ||
      !(await stat(physicalParent)).isDirectory()
    )
      throw new Error("The record parent is not a direct bundle directory.");
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        recordDiagnostic({
          code: "VERIFICATION_RECORD_PATH_UNSAFE",
          path,
          message:
            error instanceof Error
              ? error.message
              : "The verification record parent cannot be resolved safely.",
          expected:
            "an existing non-symlink directory inside the design bundle",
          repair:
            "Create the record parent inside the bundle without symlinks, or choose another path.",
        }),
      ],
    };
  }
  return { ok: true, lexicalPath, parentPath };
}

export async function loadVerificationRecord(input: {
  bundleRoot: string;
  path: string;
  registry: SchemaRegistry;
  expectedSha256?: string;
}): Promise<RecordLoadResult> {
  const resolved = await resolveRecordParent(input.bundleRoot, input.path);
  if (!resolved.ok) return resolved;
  try {
    const fileStatus = await lstat(resolved.lexicalPath);
    if (fileStatus.isSymbolicLink() || !fileStatus.isFile())
      throw new Error("The verification record is not a regular local file.");
    const physicalPath = await realpath(resolved.lexicalPath);
    if (!isWithin(input.bundleRoot, physicalPath))
      throw new Error(
        "The verification record resolves outside the design bundle.",
      );
    const source = await readFile(physicalPath);
    const digest = sha256(source);
    if (input.expectedSha256 !== undefined && digest !== input.expectedSha256) {
      return {
        ok: false,
        diagnostics: [
          recordDiagnostic({
            code: "VERIFICATION_RECORD_DIGEST_MISMATCH",
            path: input.path,
            message: `Verification record ${input.path} does not match the digest pinned by the manifest.`,
            expected: input.expectedSha256,
            repair:
              "Restore the exact recorded evidence or return the manifest to S12 and create a new full-verification record.",
          }),
        ],
      };
    }
    let data: unknown;
    try {
      data = JSON.parse(source.toString("utf8")) as unknown;
    } catch (error) {
      return {
        ok: false,
        diagnostics: [
          recordDiagnostic({
            code: "VERIFICATION_RECORD_MALFORMED",
            path: input.path,
            message:
              error instanceof Error
                ? error.message
                : "The verification record is malformed JSON.",
            expected: "well-formed verification-record JSON",
            repair:
              "Create a new record with verify --record and do not edit it manually.",
          }),
        ],
      };
    }
    const diagnostics = input.registry.validate(
      verificationRecordSchemaId,
      data,
      input.path,
      "operational",
    );
    return diagnostics.length === 0
      ? {
          ok: true,
          record: {
            path: input.path,
            source,
            sha256: digest,
            data: data as VerificationRecord,
          },
        }
      : { ok: false, diagnostics };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        recordDiagnostic({
          code: "VERIFICATION_RECORD_UNREADABLE",
          path: input.path,
          message:
            error instanceof Error
              ? error.message
              : `Cannot read verification record ${input.path}.`,
          expected: "a readable non-symlink regular record inside the bundle",
          repair:
            "Restore the record or create a new one with verify --record.",
        }),
      ],
    };
  }
}

export async function publishVerificationRecord(input: {
  bundleRoot: string;
  path: string;
  forbiddenPaths: ReadonlySet<string>;
  registry: SchemaRegistry;
  record: VerificationRecord;
}): Promise<RecordPublishResult> {
  const resolved = await resolveRecordParent(input.bundleRoot, input.path);
  if (!resolved.ok) return resolved;
  if (input.forbiddenPaths.has(resolved.lexicalPath)) {
    return {
      ok: false,
      diagnostics: [
        recordDiagnostic({
          code: "VERIFICATION_RECORD_PATH_CONFLICT",
          path: input.path,
          message: `Verification record path ${input.path} is already authoritative for another bundle file.`,
          expected:
            "a path distinct from the manifest, semantic artifacts, and pinned record",
          repair: "Choose a distinct bundle-relative record path.",
        }),
      ],
    };
  }
  const schemaDiagnostics = input.registry.validate(
    verificationRecordSchemaId,
    input.record,
    input.path,
    "operational",
  );
  if (schemaDiagnostics.length > 0)
    return { ok: false, diagnostics: schemaDiagnostics };

  const source = Buffer.from(`${JSON.stringify(input.record, null, 2)}\n`);
  const temporaryPath = join(
    resolved.parentPath,
    `.${basename(input.path)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let expectedSource: Uint8Array | undefined;
  let mode = 0o600;
  try {
    const existingStatus = await lstat(resolved.lexicalPath);
    if (existingStatus.isSymbolicLink() || !existingStatus.isFile())
      throw new Error(
        "The existing verification record is not a regular local file.",
      );
    expectedSource = await readFile(resolved.lexicalPath);
    mode = existingStatus.mode & 0o7777;
  } catch (error) {
    if (!(
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    )) {
      return {
        ok: false,
        diagnostics: [
          recordDiagnostic({
            code: "VERIFICATION_RECORD_WRITE_UNSAFE",
            path: input.path,
            message:
              error instanceof Error
                ? error.message
                : "The record destination cannot be inspected safely.",
            expected: "an absent path or a non-symlink regular record file",
            repair: "Remove the special entry or choose another record path.",
          }),
        ],
      };
    }
  }

  let temporaryCreated = false;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporaryPath, "wx", mode);
    temporaryCreated = true;
    await handle.writeFile(source);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await chmod(temporaryPath, mode);

    if (expectedSource === undefined) {
      try {
        await lstat(resolved.lexicalPath);
        throw new Error("The record destination appeared during publication.");
      } catch (error) {
        if (!(
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ))
          throw error;
      }
    } else {
      const currentSource = await readFile(resolved.lexicalPath);
      if (!currentSource.equals(Buffer.from(expectedSource)))
        throw new Error("The verification record changed during publication.");
    }
    await rename(temporaryPath, resolved.lexicalPath);
    temporaryCreated = false;
    return { ok: true, source, sha256: sha256(source) };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        recordDiagnostic({
          code: "VERIFICATION_RECORD_WRITE_FAILED",
          path: input.path,
          message:
            error instanceof Error
              ? error.message
              : "The verification record could not be published atomically.",
          expected: "one complete atomic bundle-local JSON publication",
          repair:
            "Confirm the bundle path is writable and retry without another writer changing the record.",
        }),
      ],
    };
  } finally {
    if (handle !== undefined) await handle.close().catch(() => undefined);
    if (temporaryCreated) await unlink(temporaryPath).catch(() => undefined);
  }
}

function gateDiagnostic(input: {
  code: string;
  path: string;
  jsonPointer: string;
  reference?: string;
  message: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: "validation",
    capability: "S13 full-verification completion evidence",
    classification: "deterministic",
    severity: "error",
    artifactPath: input.path,
    jsonPointer: input.jsonPointer,
    ...(input.reference === undefined ? {} : { reference: input.reference }),
    message: input.message,
    expected: input.expected,
    repair: input.repair,
    owningStage: "S13",
  };
}

function sameMembers(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const sortedRight = [...right].sort();
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === sortedRight[index])
  );
}

export function validateS13VerificationRecord(input: {
  path: string;
  record: VerificationRecord | undefined;
  manifest: BundleManifest;
  artifacts: readonly LoadedArtifact[];
  models: LoadedModels;
}): SahDiagnostic[] {
  const { record } = input;
  if (record === undefined) {
    return [
      gateDiagnostic({
        code: "STAGE_S13_VERIFICATION_RECORD_REQUIRED",
        path: "sah.bundle.json",
        jsonPointer: "/verificationRecord",
        message: "S13 completion has no declared full-verification record.",
        expected: "one schema-validated full-verification record descriptor",
        repair:
          "Persist a full verification result and advance with its explicit record path.",
      }),
    ];
  }

  const diagnostics: SahDiagnostic[] = [];
  if (
    record.invocation.scope !== "full" ||
    record.invocation.changedPaths !== undefined ||
    record.result.selection !== undefined
  ) {
    diagnostics.push(
      gateDiagnostic({
        code: "STAGE_S13_FULL_VERIFICATION_REQUIRED",
        path: input.path,
        jsonPointer: "/invocation/scope",
        message: "Changed-scoped verification evidence cannot complete S13.",
        expected: "scope full with no changed paths or selection metadata",
        repair:
          "Run full verification without changedPaths and persist a new record.",
      }),
    );
  }
  if (record.result.status !== "passed") {
    diagnostics.push(
      gateDiagnostic({
        code: "STAGE_S13_VERIFICATION_NOT_PASSED",
        path: input.path,
        jsonPointer: "/result/status",
        reference: record.result.status,
        message: `Verification record status ${record.result.status} cannot complete S13.`,
        expected: "passed full verification",
        repair:
          "Resolve violations, pending or unsupported coverage, or operational failures and record a new full run.",
      }),
    );
  }
  const recordedBundle = record.result.bundle;
  if (
    recordedBundle.id !== input.manifest.bundleId ||
    recordedBundle.profile !== input.manifest.lifecycle.profile ||
    recordedBundle.completedStage !== "S12"
  ) {
    diagnostics.push(
      gateDiagnostic({
        code: "STAGE_S13_VERIFICATION_BUNDLE_MISMATCH",
        path: input.path,
        jsonPointer: "/result/bundle",
        message:
          "The record does not describe this bundle at the completed S12 source stage.",
        expected: `${input.manifest.bundleId}, ${input.manifest.lifecycle.profile}, S12`,
        repair:
          "Run full verification against the current S12 bundle and persist a new record.",
      }),
    );
  }
  if (
    record.bundleFingerprint !==
    designFingerprint(input.manifest, input.artifacts)
  ) {
    diagnostics.push(
      gateDiagnostic({
        code: "STAGE_S13_VERIFICATION_RECORD_STALE",
        path: input.path,
        jsonPointer: "/bundleFingerprint",
        message:
          "The verification record was produced from different semantic artifact bytes.",
        expected:
          "the fingerprint of the current bundle ID, profile, descriptors, and artifact bytes",
        repair:
          "Rerun full verification after the design change and persist a new record.",
      }),
    );
  }

  const result = record.result;
  const expectedSummary = {
    errors: result.diagnostics.filter(({ severity }) => severity === "error")
      .length,
    warnings: result.diagnostics.filter(
      ({ severity }) => severity === "warning",
    ).length,
    passed: result.checks.filter(({ status }) => status === "pass").length,
    violations: result.checks.filter(({ status }) => status === "violation")
      .length,
    pending: result.checks.filter(({ status }) => status === "pending").length,
    unsupported: result.checks.filter(({ status }) => status === "unsupported")
      .length,
  };
  if (
    (Object.keys(expectedSummary) as Array<keyof typeof expectedSummary>).some(
      (key) => result.summary[key] !== expectedSummary[key],
    )
  ) {
    diagnostics.push(
      gateDiagnostic({
        code: "STAGE_S13_VERIFICATION_SUMMARY_INCONSISTENT",
        path: input.path,
        jsonPointer: "/result/summary",
        message:
          "The recorded summary does not match its diagnostics and checks.",
        expected: JSON.stringify(expectedSummary),
        repair: "Recreate the record through the verification runtime.",
      }),
    );
  }
  if (
    result.status === "passed" &&
    (result.summary.errors > 0 ||
      result.summary.violations > 0 ||
      result.summary.pending > 0 ||
      result.summary.unsupported > 0)
  ) {
    diagnostics.push(
      gateDiagnostic({
        code: "STAGE_S13_VERIFICATION_STATUS_INCONSISTENT",
        path: input.path,
        jsonPointer: "/result/status",
        message: "A passed record contains errors or non-pass checks.",
        expected:
          "zero errors, violations, pending checks, and unsupported checks for passed status",
        repair: "Recreate the record through full verification.",
      }),
    );
  }

  const assignments = collectConstraintAssignments(input.models);
  const checks = new Map<string, (typeof result.checks)[number]>();
  result.checks.forEach((check, index) => {
    if (checks.has(check.constraintId)) {
      diagnostics.push(
        gateDiagnostic({
          code: "STAGE_S13_VERIFICATION_CHECK_DUPLICATE",
          path: input.path,
          jsonPointer: `/result/checks/${String(index)}/constraintId`,
          reference: check.constraintId,
          message: `Constraint ${check.constraintId} has more than one recorded check.`,
          expected: "exactly one check per assigned constraint",
          repair: "Recreate the record through full verification.",
        }),
      );
    }
    checks.set(check.constraintId, check);
  });

  for (const constraint of input.models.architecture?.constraints ?? []) {
    const assignment = assignments.get(constraint.id);
    if (assignment === undefined) continue;
    const check = checks.get(constraint.id);
    if (check === undefined) {
      diagnostics.push(
        gateDiagnostic({
          code: "STAGE_S13_VERIFICATION_CHECK_MISSING",
          path: input.path,
          jsonPointer: "/result/checks",
          reference: constraint.id,
          message: `Assigned constraint ${constraint.id} has no recorded check.`,
          expected:
            "one passing full-verification check for every S12-assigned constraint",
          repair:
            "Run and record full verification against the current handoff.",
        }),
      );
      continue;
    }
    const eligible =
      check.code === "CONSTRAINT_PASSED" &&
      check.status === "pass" &&
      check.classification === "deterministic" &&
      check.decisionRef === constraint.decisionRef &&
      check.capability === constraint.enforcement.adapterCapability &&
      sameMembers(check.scopeElementRefs, constraint.scopeElementRefs) &&
      sameMembers(check.invariantRefs, constraint.invariantRefs) &&
      sameMembers(check.sliceRefs, [...new Set(assignment.sliceRefs)]) &&
      check.blockerDecisionRefs === undefined &&
      check.expected === constraint.observable?.expected;
    if (!eligible) {
      diagnostics.push(
        gateDiagnostic({
          code: "STAGE_S13_VERIFICATION_CHECK_INELIGIBLE",
          path: input.path,
          jsonPointer: "/result/checks",
          reference: constraint.id,
          message: `Recorded check ${constraint.id} is not the passing check for its current S12 assignment and constraint contract.`,
          expected:
            "one current deterministic CONSTRAINT_PASSED check with matching trace fields",
          repair:
            "Resolve the check outcome or design drift and record a new full verification.",
        }),
      );
    }
  }
  for (const check of result.checks) {
    if (!assignments.has(check.constraintId)) {
      diagnostics.push(
        gateDiagnostic({
          code: "STAGE_S13_VERIFICATION_CHECK_UNEXPECTED",
          path: input.path,
          jsonPointer: "/result/checks",
          reference: check.constraintId,
          message: `Recorded check ${check.constraintId} is not assigned by the current S12 handoff.`,
          expected:
            "checks only for constraints assigned by the current handoff",
          repair:
            "Run full verification against the current bundle and persist a new record.",
        }),
      );
    }
  }
  return diagnostics;
}
