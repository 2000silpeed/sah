import { constants } from "node:fs";
import { access, lstat, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import type {
  AdvanceOptions,
  AdvanceResult,
  SahDiagnostic,
  SourceLocation,
  Stage,
  ValidationResult,
  VerificationOptions,
  VerificationResult,
  VerificationSelection,
} from "./contracts.js";
import { stages, verificationRecordSchemaId } from "./contracts.js";
import {
  advanceResult,
  hasErrors,
  result,
  verificationResult,
} from "./diagnostics.js";
import { replaceManifestAtomically } from "./atomic-manifest.js";
import type { CodeFactAdapter } from "./code-fact-adapter.js";
import { verifyConstraints } from "./constraint-verification.js";
import { prepareFilesystemPresenceAdapter } from "./filesystem-presence-adapter.js";
import {
  artifactRoles,
  type ArchitectureDecisionModel,
  type ArchitectureModel,
  type ArtifactRole,
  type BundleManifest,
  type DesignStrategy,
  type InvariantModel,
  type ImplementationHandoffModel,
  type LoadedArtifact,
  type LoadedModels,
  type ResponsibilityModel,
  type SystemCharacterization,
} from "./internal-model.js";
import { validateReferences } from "./reference-validation.js";
import {
  loadSchemaRegistry,
  type SchemaRegistry,
} from "./schema-validation.js";
import {
  requiredArtifactDiagnostics,
  validateStageGates,
} from "./stage-validation.js";
import { prepareTypeScriptSourceAdapter } from "./typescript-source-adapter.js";
import {
  createVerificationRecord,
  loadVerificationRecord,
  publishVerificationRecord,
  validateS13VerificationRecord,
  type LoadedVerificationRecord,
} from "./verification-record.js";

const manifestName = "sah.bundle.json";
const manifestSchemaId =
  "https://sah.dev/schemas/design-bundle-manifest/v0.4.0";

type JsonReadResult =
  | { ok: true; data: unknown; source: Uint8Array }
  | {
      ok: false;
      diagnostic: SahDiagnostic;
    };

type ArtifactReadResult =
  | { ok: true; artifact: LoadedArtifact }
  | { ok: false; diagnostic: SahDiagnostic };

function operationalDiagnostic(input: {
  code: string;
  artifactPath?: string;
  jsonPointer?: string;
  sourceLocation?: SourceLocation;
  reference?: string;
  capability?: string;
  message: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: "operational",
    capability: input.capability ?? "Bundle loading",
    severity: "error",
    ...(input.artifactPath === undefined
      ? {}
      : { artifactPath: input.artifactPath }),
    ...(input.jsonPointer === undefined
      ? {}
      : { jsonPointer: input.jsonPointer }),
    ...(input.sourceLocation === undefined
      ? {}
      : { sourceLocation: input.sourceLocation }),
    ...(input.reference === undefined ? {} : { reference: input.reference }),
    message: input.message,
    expected: input.expected,
    repair: input.repair,
  };
}

function sourceLocation(
  message: string,
  source: string,
): SourceLocation | undefined {
  const positionMatch = /position\s+(\d+)/u.exec(message);
  let offset: number | undefined;
  if (positionMatch?.[1] !== undefined) offset = Number(positionMatch[1]);

  if (offset === undefined || !Number.isSafeInteger(offset)) {
    const lineMatch = /line\s+(\d+)\s+column\s+(\d+)/u.exec(message);
    if (lineMatch?.[1] === undefined || lineMatch[2] === undefined)
      return undefined;
    const line = Number(lineMatch[1]);
    const column = Number(lineMatch[2]);
    const lines = source.split("\n");
    offset =
      lines
        .slice(0, line - 1)
        .reduce((sum, value) => sum + value.length + 1, 0) +
      column -
      1;
    return { line, column, offset };
  }

  const prefix = source.slice(0, offset);
  const line = prefix.split("\n").length;
  const lastNewline = prefix.lastIndexOf("\n");
  return { line, column: offset - lastNewline, offset };
}

async function readJson(
  path: string,
  artifactPath: string,
): Promise<JsonReadResult> {
  let source: Uint8Array;
  try {
    await access(path, constants.R_OK);
    source = await readFile(path);
  } catch (error) {
    return {
      ok: false,
      diagnostic: operationalDiagnostic({
        code:
          artifactPath === manifestName
            ? "MANIFEST_NOT_FOUND"
            : "ARTIFACT_UNREADABLE",
        artifactPath,
        message:
          error instanceof Error
            ? error.message
            : `Cannot read ${artifactPath}.`,
        expected: "a readable JSON file declared inside the design bundle",
        repair:
          artifactPath === manifestName
            ? `Create a readable ${manifestName} at the bundle root.`
            : "Restore the declared artifact or correct its manifest path.",
      }),
    };
  }

  const sourceText = Buffer.from(source).toString("utf8");
  try {
    return { ok: true, data: JSON.parse(sourceText) as unknown, source };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Cannot parse ${artifactPath}.`;
    const location = sourceLocation(message, sourceText);
    return {
      ok: false,
      diagnostic: operationalDiagnostic({
        code: "JSON_MALFORMED",
        artifactPath,
        ...(location === undefined ? {} : { sourceLocation: location }),
        message: `${artifactPath} is malformed JSON${
          location === undefined
            ? "."
            : ` at line ${location.line}, column ${location.column}.`
        }`,
        expected: "well-formed JSON",
        repair:
          "Fix the JSON syntax at the reported source location and rerun validation.",
      }),
    };
  }
}

function isWithin(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))
  );
}

async function loadArtifact(
  bundleRoot: string,
  role: ArtifactRole,
  descriptor: { path: string; schemaId: string },
): Promise<ArtifactReadResult> {
  const lexicalPath = resolve(bundleRoot, descriptor.path);
  if (isAbsolute(descriptor.path) || !isWithin(bundleRoot, lexicalPath)) {
    return {
      ok: false,
      diagnostic: operationalDiagnostic({
        code: "ARTIFACT_PATH_OUTSIDE_BUNDLE",
        artifactPath: manifestName,
        jsonPointer: `/artifacts/${role}/path`,
        reference: descriptor.path,
        message: `Artifact path ${descriptor.path} escapes the design bundle.`,
        expected:
          "a relative path whose resolved target remains inside the bundle",
        repair:
          "Move the artifact inside the bundle and update its manifest path.",
      }),
    };
  }

  let physicalPath: string;
  try {
    physicalPath = await realpath(lexicalPath);
  } catch (error) {
    return {
      ok: false,
      diagnostic: operationalDiagnostic({
        code: "ARTIFACT_UNREADABLE",
        artifactPath: descriptor.path,
        message:
          error instanceof Error
            ? error.message
            : `Cannot resolve ${descriptor.path}.`,
        expected: "a readable declared artifact inside the bundle",
        repair: "Restore the artifact or correct its manifest path.",
      }),
    };
  }

  if (!isWithin(bundleRoot, physicalPath)) {
    return {
      ok: false,
      diagnostic: operationalDiagnostic({
        code: "ARTIFACT_PATH_OUTSIDE_BUNDLE",
        artifactPath: manifestName,
        jsonPointer: `/artifacts/${role}/path`,
        reference: descriptor.path,
        message: `Artifact path ${descriptor.path} resolves outside the design bundle.`,
        expected:
          "a relative path whose physical target remains inside the bundle",
        repair:
          "Replace the escaping symlink with an artifact stored inside the bundle.",
      }),
    };
  }

  const read = await readJson(physicalPath, descriptor.path);
  return read.ok
    ? {
        ok: true,
        artifact: {
          role,
          path: descriptor.path,
          schemaId: descriptor.schemaId,
          data: read.data,
          source: read.source,
        },
      }
    : read;
}

function toModels(artifacts: LoadedArtifact[]): LoadedModels {
  const models: LoadedModels = {};
  for (const artifact of artifacts) {
    switch (artifact.role) {
      case "systemCharacterization":
        models.systemCharacterization = artifact.data as SystemCharacterization;
        break;
      case "designStrategy":
        models.designStrategy = artifact.data as DesignStrategy;
        break;
      case "responsibility":
        models.responsibility = artifact.data as ResponsibilityModel;
        break;
      case "invariant":
        models.invariant = artifact.data as InvariantModel;
        break;
      case "architecture":
        models.architecture = artifact.data as ArchitectureModel;
        break;
      case "architectureDecision":
        models.architectureDecision =
          artifact.data as ArchitectureDecisionModel;
        break;
      case "implementationHandoff":
        models.implementationHandoff =
          artifact.data as ImplementationHandoffModel;
        break;
    }
  }
  return models;
}

type PreparedBundle = {
  bundleRoot: string;
  manifestLexicalPath: string;
  manifestSource: Uint8Array;
  manifest: BundleManifest;
  registry: SchemaRegistry;
  paths: Partial<Record<ArtifactRole, string>>;
  artifacts: LoadedArtifact[];
  verificationRecord?: LoadedVerificationRecord;
};

type PreparationResult =
  | { ok: true; prepared: PreparedBundle }
  | { ok: false; validation: ValidationResult };

async function prepareBundle(directory: string): Promise<PreparationResult> {
  const requestedDirectory = resolve(directory);
  const registryResult = await loadSchemaRegistry();
  if (!registryResult.ok) {
    return {
      ok: false,
      validation: result(
        "operational-error",
        requestedDirectory,
        registryResult.diagnostics,
      ),
    };
  }

  let bundleRoot: string;
  try {
    bundleRoot = await realpath(requestedDirectory);
    if (!(await stat(bundleRoot)).isDirectory())
      throw new Error(`${directory} is not a directory`);
  } catch (error) {
    return {
      ok: false,
      validation: result("operational-error", requestedDirectory, [
        operationalDiagnostic({
          code: "BUNDLE_DIRECTORY_UNREADABLE",
          artifactPath: directory,
          message:
            error instanceof Error
              ? error.message
              : `Cannot open bundle directory ${directory}.`,
          expected: "an existing readable design-bundle directory",
          repair: "Pass a readable bundle directory to the SAH command.",
        }),
      ]),
    };
  }

  const manifestLexicalPath = resolve(bundleRoot, manifestName);
  let manifestPhysicalPath: string;
  try {
    manifestPhysicalPath = await realpath(manifestLexicalPath);
    if (!isWithin(bundleRoot, manifestPhysicalPath)) {
      return {
        ok: false,
        validation: result("operational-error", bundleRoot, [
          operationalDiagnostic({
            code: "MANIFEST_PATH_OUTSIDE_BUNDLE",
            artifactPath: manifestName,
            message: `${manifestName} resolves outside the design bundle.`,
            expected: "a physical manifest file inside the bundle root",
            repair:
              "Replace the escaping manifest symlink with a local manifest file.",
          }),
        ]),
      };
    }
  } catch {
    manifestPhysicalPath = manifestLexicalPath;
  }

  const manifestRead = await readJson(manifestPhysicalPath, manifestName);
  if (!manifestRead.ok) {
    return {
      ok: false,
      validation: result("operational-error", bundleRoot, [
        manifestRead.diagnostic,
      ]),
    };
  }

  const manifestDiagnostics = registryResult.registry.validate(
    manifestSchemaId,
    manifestRead.data,
    manifestName,
    "operational",
  );
  if (manifestDiagnostics.length > 0) {
    return {
      ok: false,
      validation: result("operational-error", bundleRoot, manifestDiagnostics),
    };
  }
  const manifest = manifestRead.data as BundleManifest;
  const bundle = bundleMetadata(manifest, manifest.lifecycle.completedStage);
  const paths: Partial<Record<ArtifactRole, string>> = {};
  for (const role of artifactRoles) {
    const descriptor = manifest.artifacts[role];
    if (descriptor !== undefined) paths[role] = descriptor.path;
  }

  const normalizedPaths = new Map<string, string>([
    [manifestLexicalPath, "bundle manifest"],
  ]);
  const pathDiagnostics: SahDiagnostic[] = [];
  for (const role of artifactRoles) {
    const descriptor = manifest.artifacts[role];
    if (descriptor === undefined) continue;
    const normalized = resolve(bundleRoot, descriptor.path);
    const existing = normalizedPaths.get(normalized);
    if (existing === undefined) {
      normalizedPaths.set(normalized, role);
    } else {
      pathDiagnostics.push(
        operationalDiagnostic({
          code: "ARTIFACT_PATH_DUPLICATE",
          artifactPath: manifestName,
          jsonPointer: `/artifacts/${role}/path`,
          reference: descriptor.path,
          message: `${role} and ${existing} declare the same artifact path.`,
          expected: "one distinct JSON file per declared bundle role",
          repair:
            "Declare the correct distinct artifact path for each IR role.",
        }),
      );
    }
  }
  const recordDescriptor = manifest.verificationRecord;
  if (recordDescriptor !== undefined) {
    const normalized = resolve(bundleRoot, recordDescriptor.path);
    const existing = normalizedPaths.get(normalized);
    if (existing === undefined) {
      normalizedPaths.set(normalized, "verification record");
    } else {
      pathDiagnostics.push(
        operationalDiagnostic({
          code: "VERIFICATION_RECORD_PATH_CONFLICT",
          artifactPath: manifestName,
          jsonPointer: "/verificationRecord/path",
          reference: recordDescriptor.path,
          message: `verificationRecord and ${existing} declare the same bundle path.`,
          expected: "a distinct bundle-local verification record path",
          repair: "Declare the verification record at its own JSON path.",
        }),
      );
    }
  }
  if (pathDiagnostics.length > 0) {
    return {
      ok: false,
      validation: result(
        "operational-error",
        bundleRoot,
        pathDiagnostics,
        bundle,
      ),
    };
  }

  const readResults = await Promise.all(
    artifactRoles.flatMap((role) => {
      const descriptor = manifest.artifacts[role];
      return descriptor === undefined
        ? []
        : [loadArtifact(bundleRoot, role, descriptor)];
    }),
  );
  const operationalFailures = readResults.flatMap((read) =>
    read.ok ? [] : [read.diagnostic],
  );
  if (operationalFailures.length > 0) {
    return {
      ok: false,
      validation: result(
        "operational-error",
        bundleRoot,
        operationalFailures,
        bundle,
      ),
    };
  }
  const artifacts = readResults.flatMap((read) =>
    read.ok ? [read.artifact] : [],
  );
  let verificationRecord: LoadedVerificationRecord | undefined;
  if (recordDescriptor !== undefined) {
    const record = await loadVerificationRecord({
      bundleRoot,
      path: recordDescriptor.path,
      registry: registryResult.registry,
      expectedSha256: recordDescriptor.sha256,
    });
    if (!record.ok) {
      return {
        ok: false,
        validation: result(
          "operational-error",
          bundleRoot,
          record.diagnostics,
          bundle,
        ),
      };
    }
    verificationRecord = record.record;
  }

  return {
    ok: true,
    prepared: {
      bundleRoot,
      manifestLexicalPath,
      manifestSource: manifestRead.source,
      manifest,
      registry: registryResult.registry,
      paths,
      artifacts,
      ...(verificationRecord === undefined ? {} : { verificationRecord }),
    },
  };
}

function bundleMetadata(manifest: BundleManifest, completedStage: Stage) {
  return {
    id: manifest.bundleId,
    completedStage,
    profile: manifest.lifecycle.profile,
  };
}

function evaluatePreparedBundle(
  prepared: PreparedBundle,
  completedStage: Stage,
): ValidationResult {
  const bundle = bundleMetadata(prepared.manifest, completedStage);

  const validationDiagnostics = [
    ...prepared.registry.validate(
      manifestSchemaId,
      prepared.manifest,
      manifestName,
      "operational",
    ),
    ...requiredArtifactDiagnostics(completedStage, prepared.paths),
  ];
  for (const artifact of prepared.artifacts) {
    validationDiagnostics.push(
      ...prepared.registry.validate(
        artifact.schemaId,
        artifact.data,
        artifact.path,
        "validation",
      ),
    );
  }
  if (hasErrors(validationDiagnostics)) {
    return result(
      validationDiagnostics.some(({ category }) => category === "operational")
        ? "operational-error"
        : "violations",
      prepared.bundleRoot,
      validationDiagnostics,
      bundle,
    );
  }

  const models = toModels(prepared.artifacts);
  validationDiagnostics.push(...validateReferences(models, prepared.paths));
  validationDiagnostics.push(
    ...validateStageGates(
      completedStage,
      prepared.manifest.lifecycle.profile,
      models,
      prepared.paths,
    ),
  );
  if (stages.indexOf(completedStage) >= stages.indexOf("S13")) {
    validationDiagnostics.push(
      ...validateS13VerificationRecord({
        path:
          prepared.manifest.verificationRecord?.path ??
          prepared.verificationRecord?.path ??
          manifestName,
        record: prepared.verificationRecord?.data,
        manifest: prepared.manifest,
        artifacts: prepared.artifacts,
        models,
      }),
    );
  }
  return result(
    hasErrors(validationDiagnostics)
      ? validationDiagnostics.some(({ category }) => category === "operational")
        ? "operational-error"
        : "violations"
      : "passed",
    prepared.bundleRoot,
    validationDiagnostics,
    bundle,
  );
}

export async function validateBundle(
  directory: string,
): Promise<ValidationResult> {
  const preparation = await prepareBundle(directory);
  return preparation.ok
    ? evaluatePreparedBundle(
        preparation.prepared,
        preparation.prepared.manifest.lifecycle.completedStage,
      )
    : preparation.validation;
}

function failedValidationForVerification(
  validation: ValidationResult,
  targetDirectory: string,
): VerificationResult {
  return verificationResult(
    validation.status === "violations" ? "violations" : "operational-error",
    validation.bundleDirectory,
    targetDirectory.trim() === "" ? targetDirectory : resolve(targetDirectory),
    [],
    validation.diagnostics,
    validation.bundle,
  );
}

async function finishVerification(
  prepared: PreparedBundle,
  options: VerificationOptions,
  verification: VerificationResult,
): Promise<VerificationResult> {
  const recordPath = options.verificationRecordPath;
  if (recordPath === undefined) return verification;
  if (verification.bundle === undefined) {
    return verificationResult(
      "operational-error",
      verification.bundleDirectory,
      verification.targetDirectory,
      verification.checks,
      [
        ...verification.diagnostics,
        operationalDiagnostic({
          code: "VERIFICATION_RECORD_CONTEXT_MISSING",
          capability: "Verification record storage",
          artifactPath: recordPath,
          message:
            "A verification result without validated bundle metadata cannot be recorded.",
          expected: "validated bundle identity, lifecycle stage, and profile",
          repair: "Repair the bundle and rerun verification with --record.",
        }),
      ],
      verification.bundle,
      verification.selection,
    );
  }
  const record = createVerificationRecord({
    manifest: prepared.manifest,
    artifacts: prepared.artifacts,
    options,
    result: { ...verification, bundle: verification.bundle },
  });
  const forbiddenPaths = new Set([
    prepared.manifestLexicalPath,
    ...Object.values(prepared.paths).map((path) =>
      resolve(prepared.bundleRoot, path),
    ),
    ...(prepared.manifest.verificationRecord === undefined
      ? []
      : [
          resolve(
            prepared.bundleRoot,
            prepared.manifest.verificationRecord.path,
          ),
        ]),
  ]);
  const publication = await publishVerificationRecord({
    bundleRoot: prepared.bundleRoot,
    path: recordPath,
    forbiddenPaths,
    registry: prepared.registry,
    record,
  });
  return publication.ok
    ? verification
    : verificationResult(
        "operational-error",
        verification.bundleDirectory,
        verification.targetDirectory,
        verification.checks,
        [...verification.diagnostics, ...publication.diagnostics],
        verification.bundle,
        verification.selection,
      );
}

export async function verifyBundle(
  directory: string,
  targetDirectory: string,
  options: VerificationOptions = {},
): Promise<VerificationResult> {
  const preparation = await prepareBundle(directory);
  if (!preparation.ok)
    return failedValidationForVerification(
      preparation.validation,
      targetDirectory,
    );

  const { prepared } = preparation;
  const completedStage = prepared.manifest.lifecycle.completedStage;
  const validation = evaluatePreparedBundle(prepared, completedStage);
  if (validation.status !== "passed")
    return finishVerification(
      prepared,
      options,
      failedValidationForVerification(validation, targetDirectory),
    );

  if (stages.indexOf(completedStage) < stages.indexOf("S12")) {
    return finishVerification(
      prepared,
      options,
      verificationResult(
        "operational-error",
        prepared.bundleRoot,
        targetDirectory.trim() === ""
          ? targetDirectory
          : resolve(targetDirectory),
        [],
        [
          operationalDiagnostic({
            code: "VERIFICATION_STAGE_NOT_READY",
            capability: "Continuous constraint verification",
            artifactPath: manifestName,
            jsonPointer: "/lifecycle/completedStage",
            reference: completedStage,
            message: `Bundle ${prepared.manifest.bundleId} has not completed the S12 implementation handoff.`,
            expected: "completedStage S12 or later before target verification",
            repair:
              "Complete and advance the canonical implementation handoff through S12.",
          }),
        ],
        validation.bundle,
      ),
    );
  }

  if (
    options.changedPaths !== undefined &&
    options.sourceMappingPath === undefined
  ) {
    return finishVerification(
      prepared,
      options,
      verificationResult(
        "operational-error",
        prepared.bundleRoot,
        targetDirectory.trim() === ""
          ? targetDirectory
          : resolve(targetDirectory),
        [],
        [
          operationalDiagnostic({
            code: "VERIFICATION_CHANGE_MAPPING_REQUIRED",
            capability: "Change-scoped verification",
            message:
              "Changed paths require an explicit source mapping for Architecture element resolution.",
            expected:
              "sourceMappingPath supplied whenever changedPaths is present",
            repair:
              "Supply the target-relative source mapping or omit changedPaths for full verification.",
          }),
        ],
        validation.bundle,
      ),
    );
  }

  const target = await prepareFilesystemPresenceAdapter(targetDirectory);
  if (!target.ok) {
    return finishVerification(
      prepared,
      options,
      verificationResult(
        "operational-error",
        prepared.bundleRoot,
        target.targetDirectory,
        [],
        [
          operationalDiagnostic({
            ...target.failure,
            capability: "Filesystem artifact-presence adapter",
            artifactPath: target.targetDirectory,
          }),
        ],
        validation.bundle,
      ),
    );
  }

  const models = toModels(prepared.artifacts);
  const adapters: CodeFactAdapter[] = [target.adapter];
  let selection: VerificationSelection | undefined;
  if (options.sourceMappingPath !== undefined) {
    const sourceAdapter = await prepareTypeScriptSourceAdapter({
      targetRoot: target.targetRoot,
      mappingPath: options.sourceMappingPath,
      registry: prepared.registry,
      architectureElementRefs: new Set(
        models.architecture?.elements.map(({ id }) => id) ?? [],
      ),
      ...(options.changedPaths === undefined
        ? {}
        : { changedPaths: options.changedPaths }),
    });
    if (!sourceAdapter.ok) {
      return finishVerification(
        prepared,
        options,
        verificationResult(
          "operational-error",
          prepared.bundleRoot,
          target.targetRoot,
          [],
          sourceAdapter.diagnostics,
          validation.bundle,
        ),
      );
    }
    adapters.push(sourceAdapter.adapter);
    selection = sourceAdapter.selection;
  }
  const affectedElementRefs =
    selection?.mode === "affected"
      ? new Set(selection.affectedElementRefs)
      : undefined;
  const execution = await verifyConstraints(
    models,
    adapters,
    affectedElementRefs,
  );
  const executionDiagnostics = execution.failures.map((failure) => {
    const constraintIndex =
      failure.constraintId === undefined
        ? undefined
        : models.architecture?.constraints.findIndex(
            ({ id }) => id === failure.constraintId,
          );
    return operationalDiagnostic({
      code: failure.code,
      capability: failure.capability,
      ...(prepared.paths.architecture === undefined
        ? {}
        : { artifactPath: prepared.paths.architecture }),
      ...(constraintIndex === undefined || constraintIndex < 0
        ? {}
        : { jsonPointer: `/constraints/${constraintIndex}/observable` }),
      ...(failure.constraintId === undefined
        ? {}
        : { reference: failure.constraintId }),
      message: failure.message,
      expected: failure.expected,
      repair: failure.repair,
    });
  });
  return finishVerification(
    prepared,
    options,
    verificationResult(
      execution.status,
      prepared.bundleRoot,
      target.targetRoot,
      execution.checks,
      executionDiagnostics,
      validation.bundle,
      selection,
    ),
  );
}

const supportedAdvanceTargets: ReadonlySet<Stage> = new Set([
  "S5",
  "S6",
  "S7",
  "S8",
  "S9",
  "S10",
  "S11",
  "S12",
  "S13",
]);

function transitionDiagnostic(input: {
  code: string;
  message: string;
  expected: string;
  repair: string;
  reference?: string;
}): SahDiagnostic {
  return operationalDiagnostic({
    ...input,
    capability: "Bundle lifecycle transition",
    artifactPath: manifestName,
    jsonPointer: "/lifecycle/completedStage",
  });
}

function failedPreparationForAdvance(
  validation: ValidationResult,
  targetStage: Stage,
): AdvanceResult {
  const bundle =
    validation.bundle === undefined
      ? undefined
      : {
          id: validation.bundle.id,
          profile: validation.bundle.profile,
          previousStage: validation.bundle.completedStage,
          targetStage,
          completedStage: validation.bundle.completedStage,
        };
  return advanceResult(
    "operational-error",
    validation.bundleDirectory,
    validation.diagnostics,
    bundle,
  );
}

export async function advanceBundle(
  directory: string,
  targetStage: Stage,
  options: AdvanceOptions = {},
): Promise<AdvanceResult> {
  const requestedDirectory = resolve(directory);
  if (!(stages as readonly string[]).includes(targetStage)) {
    return advanceResult("operational-error", requestedDirectory, [
      transitionDiagnostic({
        code: "ADVANCE_STAGE_INVALID",
        reference: targetStage,
        message: `${targetStage} is not a valid SAH lifecycle stage.`,
        expected: `one of ${stages.join(", ")}`,
        repair: "Choose the exact next lifecycle stage and retry.",
      }),
    ]);
  }

  const preparation = await prepareBundle(directory);
  if (!preparation.ok)
    return failedPreparationForAdvance(preparation.validation, targetStage);

  const { prepared } = preparation;
  const previousStage = prepared.manifest.lifecycle.completedStage;
  const bundle = {
    id: prepared.manifest.bundleId,
    profile: prepared.manifest.lifecycle.profile,
    previousStage,
    targetStage,
    completedStage: previousStage,
  };
  const currentIndex = stages.indexOf(previousStage);
  const targetIndex = stages.indexOf(targetStage);
  let invalidTransition: SahDiagnostic | undefined;
  if (targetIndex <= currentIndex) {
    invalidTransition = transitionDiagnostic({
      code: "ADVANCE_STAGE_NOT_FORWARD",
      reference: `${previousStage}->${targetStage}`,
      message: `Cannot advance from ${previousStage} to ${targetStage}.`,
      expected: `the exact stage after ${previousStage}`,
      repair: "Choose the next uncompleted lifecycle stage.",
    });
  } else if (targetIndex !== currentIndex + 1) {
    invalidTransition = transitionDiagnostic({
      code: "ADVANCE_STAGE_SKIPPED",
      reference: `${previousStage}->${targetStage}`,
      message: `Advancing from ${previousStage} to ${targetStage} would skip lifecycle stages.`,
      expected: `the exact stage after ${previousStage}`,
      repair: `Advance to ${stages[currentIndex + 1]} first.`,
    });
  } else if (!supportedAdvanceTargets.has(targetStage)) {
    invalidTransition = transitionDiagnostic({
      code: "ADVANCE_STAGE_UNSUPPORTED",
      reference: targetStage,
      message: `The deterministic gate for target ${targetStage} is not implemented.`,
      expected: `an exact-next target with implemented gates: ${[...supportedAdvanceTargets].join(", ")}`,
      repair:
        "Keep the manifest at its current stage until this target gate is supported.",
    });
  } else if (
    targetStage === "S13" &&
    options.verificationRecordPath === undefined
  ) {
    invalidTransition = transitionDiagnostic({
      code: "ADVANCE_VERIFICATION_RECORD_REQUIRED",
      reference: targetStage,
      message:
        "S12 to S13 advancement requires an explicit verification record path.",
      expected:
        "verificationRecordPath naming one bundle-local full-verification record",
      repair:
        "Persist a full verification result and retry S13 advancement with its record path.",
    });
  } else if (
    targetStage !== "S13" &&
    options.verificationRecordPath !== undefined
  ) {
    invalidTransition = transitionDiagnostic({
      code: "ADVANCE_VERIFICATION_RECORD_UNEXPECTED",
      reference: targetStage,
      message: `Verification evidence cannot be attached while advancing to ${targetStage}.`,
      expected:
        "verificationRecordPath only for the exact S12 to S13 transition",
      repair:
        "Remove the verification record option for this earlier transition.",
    });
  }
  if (invalidTransition !== undefined) {
    return advanceResult(
      "operational-error",
      prepared.bundleRoot,
      [invalidTransition],
      bundle,
    );
  }

  let manifestStatus: Awaited<ReturnType<typeof lstat>>;
  try {
    manifestStatus = await lstat(prepared.manifestLexicalPath);
  } catch (error) {
    return advanceResult(
      "operational-error",
      prepared.bundleRoot,
      [
        operationalDiagnostic({
          code: "MANIFEST_ADVANCE_UNSAFE",
          capability: "Atomic bundle lifecycle update",
          artifactPath: manifestName,
          message:
            error instanceof Error
              ? error.message
              : `Cannot inspect ${manifestName}.`,
          expected: "a regular, writable manifest file at the bundle root",
          repair: "Restore the local manifest file and retry.",
        }),
      ],
      bundle,
    );
  }
  if (manifestStatus.isSymbolicLink() || !manifestStatus.isFile()) {
    return advanceResult(
      "operational-error",
      prepared.bundleRoot,
      [
        operationalDiagnostic({
          code: "MANIFEST_ADVANCE_UNSAFE",
          capability: "Atomic bundle lifecycle update",
          artifactPath: manifestName,
          message: `${manifestName} is not a regular local file; stage advancement was refused.`,
          expected: "a non-symlink regular manifest file at the bundle root",
          repair:
            "Replace the manifest symlink or special file with a regular local file.",
        }),
      ],
      bundle,
    );
  }

  let nextManifest: BundleManifest = {
    ...prepared.manifest,
    lifecycle: {
      ...prepared.manifest.lifecycle,
      completedStage: targetStage,
    },
  };
  let proposedPrepared = { ...prepared, manifest: nextManifest };
  let expectedCompanions:
    | Array<{ path: string; artifactPath: string; source: Uint8Array }>
    | undefined;
  if (targetStage === "S13") {
    const recordPath = options.verificationRecordPath;
    if (recordPath === undefined) {
      return advanceResult(
        "operational-error",
        prepared.bundleRoot,
        [
          transitionDiagnostic({
            code: "ADVANCE_VERIFICATION_RECORD_REQUIRED",
            reference: targetStage,
            message:
              "S12 to S13 advancement requires an explicit verification record path.",
            expected:
              "verificationRecordPath naming one bundle-local full-verification record",
            repair:
              "Persist a full verification result and retry S13 advancement with its record path.",
          }),
        ],
        bundle,
      );
    }
    const normalizedRecordPath = resolve(prepared.bundleRoot, recordPath);
    const conflictingRole = artifactRoles.find(
      (role) =>
        prepared.paths[role] !== undefined &&
        resolve(prepared.bundleRoot, prepared.paths[role]) ===
          normalizedRecordPath,
    );
    if (
      normalizedRecordPath === prepared.manifestLexicalPath ||
      conflictingRole !== undefined
    ) {
      return advanceResult(
        "operational-error",
        prepared.bundleRoot,
        [
          operationalDiagnostic({
            code: "VERIFICATION_RECORD_PATH_CONFLICT",
            capability: "Verification record storage",
            artifactPath: recordPath,
            message: `Verification record path ${recordPath} conflicts with an authoritative bundle file.`,
            expected:
              "a path distinct from the manifest and every semantic artifact",
            repair: "Choose a distinct bundle-relative record path.",
          }),
        ],
        bundle,
      );
    }
    const record = await loadVerificationRecord({
      bundleRoot: prepared.bundleRoot,
      path: recordPath,
      registry: prepared.registry,
    });
    if (!record.ok) {
      return advanceResult(
        "operational-error",
        prepared.bundleRoot,
        record.diagnostics,
        bundle,
      );
    }
    nextManifest = {
      ...nextManifest,
      verificationRecord: {
        path: recordPath,
        schemaId: verificationRecordSchemaId,
        sha256: record.record.sha256,
      },
    };
    proposedPrepared = {
      ...proposedPrepared,
      manifest: nextManifest,
      verificationRecord: record.record,
    };
    expectedCompanions = [
      {
        path: normalizedRecordPath,
        artifactPath: recordPath,
        source: record.record.source,
      },
    ];
  }

  const proposedValidation = evaluatePreparedBundle(
    proposedPrepared,
    targetStage,
  );
  if (proposedValidation.status !== "passed") {
    return advanceResult(
      proposedValidation.status === "violations"
        ? "blocked"
        : "operational-error",
      prepared.bundleRoot,
      proposedValidation.diagnostics,
      bundle,
    );
  }

  const replacement = await replaceManifestAtomically({
    manifestPath: prepared.manifestLexicalPath,
    expectedSource: prepared.manifestSource,
    manifest: nextManifest,
    mode: manifestStatus.mode,
    ...(expectedCompanions === undefined ? {} : { expectedCompanions }),
  });
  if (!replacement.ok) {
    return advanceResult(
      "operational-error",
      prepared.bundleRoot,
      [replacement.diagnostic],
      bundle,
    );
  }

  return advanceResult(
    "advanced",
    prepared.bundleRoot,
    proposedValidation.diagnostics,
    { ...bundle, completedStage: targetStage },
  );
}
