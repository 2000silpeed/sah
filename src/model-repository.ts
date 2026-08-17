import { constants } from "node:fs";
import { access, lstat, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import type {
  AdvanceResult,
  SahDiagnostic,
  SourceLocation,
  Stage,
  ValidationResult,
} from "./contracts.js";
import { stages } from "./contracts.js";
import { advanceResult, hasErrors, result } from "./diagnostics.js";
import { replaceManifestAtomically } from "./atomic-manifest.js";
import {
  artifactRoles,
  type ArchitectureDecisionModel,
  type ArchitectureModel,
  type ArtifactRole,
  type BundleManifest,
  type DesignStrategy,
  type InvariantModel,
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

const manifestName = "sah.bundle.json";
const manifestSchemaId =
  "https://sah.dev/schemas/design-bundle-manifest/v0.2.0";

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

  const normalizedPaths = new Map<string, ArtifactRole>();
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
          expected: "one distinct JSON file per declared artifact role",
          repair:
            "Declare the correct distinct artifact path for each IR role.",
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

  const validationDiagnostics = requiredArtifactDiagnostics(
    completedStage,
    prepared.paths,
  );
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
  return result(
    hasErrors(validationDiagnostics) ? "violations" : "passed",
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

const supportedAdvanceTargets: ReadonlySet<Stage> = new Set([
  "S5",
  "S6",
  "S7",
  "S8",
  "S9",
  "S10",
  "S11",
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

  const proposedValidation = evaluatePreparedBundle(prepared, targetStage);
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

  const nextManifest: BundleManifest = {
    ...prepared.manifest,
    lifecycle: {
      ...prepared.manifest.lifecycle,
      completedStage: targetStage,
    },
  };
  const replacement = await replaceManifestAtomically({
    manifestPath: prepared.manifestLexicalPath,
    expectedSource: prepared.manifestSource,
    manifest: nextManifest,
    mode: manifestStatus.mode,
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
