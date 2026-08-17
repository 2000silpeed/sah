import { constants } from "node:fs";
import { access, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import type {
  SahDiagnostic,
  SourceLocation,
  ValidationResult,
} from "./contracts.js";
import { hasErrors, result } from "./diagnostics.js";
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
import { loadSchemaRegistry } from "./schema-validation.js";
import {
  requiredArtifactDiagnostics,
  validateStageGates,
} from "./stage-validation.js";

const manifestName = "sah.bundle.json";
const manifestSchemaId =
  "https://sah.dev/schemas/design-bundle-manifest/v0.1.0";

type JsonReadResult =
  { ok: true; data: unknown } | { ok: false; diagnostic: SahDiagnostic };

type ArtifactReadResult =
  | { ok: true; artifact: LoadedArtifact }
  | { ok: false; diagnostic: SahDiagnostic };

function operationalDiagnostic(input: {
  code: string;
  artifactPath?: string;
  jsonPointer?: string;
  sourceLocation?: SourceLocation;
  reference?: string;
  message: string;
  expected: string;
  repair: string;
}): SahDiagnostic {
  return {
    code: input.code,
    category: "operational",
    capability: "Bundle loading",
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
  let source: string;
  try {
    await access(path, constants.R_OK);
    source = await readFile(path, "utf8");
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

  try {
    return { ok: true, data: JSON.parse(source) as unknown };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Cannot parse ${artifactPath}.`;
    const location = sourceLocation(message, source);
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

export async function validateBundle(
  directory: string,
): Promise<ValidationResult> {
  const requestedDirectory = resolve(directory);
  const registryResult = await loadSchemaRegistry();
  if (!registryResult.ok) {
    return result(
      "operational-error",
      requestedDirectory,
      registryResult.diagnostics,
    );
  }

  let bundleRoot: string;
  try {
    bundleRoot = await realpath(requestedDirectory);
    if (!(await stat(bundleRoot)).isDirectory())
      throw new Error(`${directory} is not a directory`);
  } catch (error) {
    return result("operational-error", requestedDirectory, [
      operationalDiagnostic({
        code: "BUNDLE_DIRECTORY_UNREADABLE",
        artifactPath: directory,
        message:
          error instanceof Error
            ? error.message
            : `Cannot open bundle directory ${directory}.`,
        expected: "an existing readable design-bundle directory",
        repair: "Pass a readable bundle directory to sah validate.",
      }),
    ]);
  }

  const manifestLexicalPath = resolve(bundleRoot, manifestName);
  let manifestPhysicalPath: string;
  try {
    manifestPhysicalPath = await realpath(manifestLexicalPath);
    if (!isWithin(bundleRoot, manifestPhysicalPath)) {
      return result("operational-error", bundleRoot, [
        operationalDiagnostic({
          code: "MANIFEST_PATH_OUTSIDE_BUNDLE",
          artifactPath: manifestName,
          message: `${manifestName} resolves outside the design bundle.`,
          expected: "a physical manifest file inside the bundle root",
          repair:
            "Replace the escaping manifest symlink with a local manifest file.",
        }),
      ]);
    }
  } catch {
    manifestPhysicalPath = manifestLexicalPath;
  }

  const manifestRead = await readJson(manifestPhysicalPath, manifestName);
  if (!manifestRead.ok) {
    return result("operational-error", bundleRoot, [manifestRead.diagnostic]);
  }

  const manifestDiagnostics = registryResult.registry.validate(
    manifestSchemaId,
    manifestRead.data,
    manifestName,
    "operational",
  );
  if (manifestDiagnostics.length > 0) {
    return result("operational-error", bundleRoot, manifestDiagnostics);
  }
  const manifest = manifestRead.data as BundleManifest;
  const bundle = {
    id: manifest.bundleId,
    completedStage: manifest.lifecycle.completedStage,
    profile: manifest.lifecycle.profile,
  };
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
    return result("operational-error", bundleRoot, pathDiagnostics, bundle);
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
    return result("operational-error", bundleRoot, operationalFailures, bundle);
  }
  const artifacts = readResults.flatMap((read) =>
    read.ok ? [read.artifact] : [],
  );

  const validationDiagnostics = requiredArtifactDiagnostics(
    bundle.completedStage,
    paths,
  );
  for (const artifact of artifacts) {
    validationDiagnostics.push(
      ...registryResult.registry.validate(
        artifact.schemaId,
        artifact.data,
        artifact.path,
        "validation",
      ),
    );
  }
  if (hasErrors(validationDiagnostics)) {
    return result("violations", bundleRoot, validationDiagnostics, bundle);
  }

  const models = toModels(artifacts);
  validationDiagnostics.push(...validateReferences(models, paths));
  validationDiagnostics.push(
    ...validateStageGates(bundle.completedStage, models, paths),
  );
  return result(
    hasErrors(validationDiagnostics) ? "violations" : "passed",
    bundleRoot,
    validationDiagnostics,
    bundle,
  );
}
