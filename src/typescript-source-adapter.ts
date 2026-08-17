import { constants, lstatSync, realpathSync, type Dirent } from "node:fs";
import {
  access,
  lstat,
  readFile,
  readdir,
  realpath,
  stat,
} from "node:fs/promises";
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

import ts from "typescript";

import type { SahDiagnostic, SourceLocation } from "./contracts.js";
import { escapePointer } from "./diagnostics.js";
import type {
  CodeFactAdapter,
  FactAdapterOutcome,
  FactAdapterRequest,
} from "./code-fact-adapter.js";
import type { SchemaRegistry } from "./schema-validation.js";

export const typescriptWriteAuthorityCapability =
  "dependency-and-write analysis";
export const typescriptSourceMappingSchemaId =
  "https://sah.dev/schemas/typescript-source-mapping/v0.2.0";

type ElementMapping = {
  elementRef: string;
  pathPrefixes: string[];
};

type WriteTarget = {
  selector: string;
  modulePath: string;
  exportName: string;
};

type TypeScriptSourceMapping = {
  $schema: string;
  schemaVersion: string;
  language: "typescript";
  tsconfigPath: string;
  sourceRoots: string[];
  elements: ElementMapping[];
  writeTargets: WriteTarget[];
};

type SourceDocument = {
  relativePath: string;
  physicalPath: string;
  sourceFile: ts.SourceFile;
};

type SourceInventory =
  | {
      kind: "ready";
      documents: SourceDocument[];
      checker: ts.TypeChecker;
      semanticDiagnostics: ts.Diagnostic[];
    }
  | Exclude<FactAdapterOutcome, { kind: "observed" }>;

type TypeScriptProjectConfiguration = {
  physicalPath: string;
  options: ts.CompilerOptions;
  unsupportedFeature?: string;
};

type AdapterPreparation =
  | { ok: true; adapter: CodeFactAdapter; mappingPath: string }
  | { ok: false; diagnostics: SahDiagnostic[]; mappingPath: string };

type ProjectConfigurationLoad =
  | { ok: true; configuration: TypeScriptProjectConfiguration }
  | { ok: false; diagnostics: SahDiagnostic[] };

type ConfigurationDiagnosticInput = {
  code: string;
  artifactPath: string;
  message: string;
  expected: string;
  repair: string;
  jsonPointer?: string;
  reference?: string;
  sourceLocation?: SourceLocation;
};

const supportedExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);
const unsupportedJavaScriptExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

function configurationDiagnostic(
  input: ConfigurationDiagnosticInput,
): SahDiagnostic {
  return {
    code: input.code,
    category: "operational",
    capability: "TypeScript source mapping configuration",
    classification: "deterministic",
    severity: "error",
    artifactPath: input.artifactPath,
    ...(input.jsonPointer === undefined
      ? {}
      : { jsonPointer: input.jsonPointer }),
    ...(input.reference === undefined ? {} : { reference: input.reference }),
    ...(input.sourceLocation === undefined
      ? {}
      : { sourceLocation: input.sourceLocation }),
    message: input.message,
    expected: input.expected,
    repair: input.repair,
  };
}

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

function isSafeRelativePath(value: string): boolean {
  const segments = value.split("/");
  return (
    value.trim() !== "" &&
    !isAbsolute(value) &&
    !/^[A-Za-z]:/u.test(value) &&
    !value.includes("\\") &&
    !hasControlCharacter(value) &&
    !segments.some((segment) => ["", ".", ".."].includes(segment))
  );
}

function sourceLocation(
  message: string,
  source: string,
): SourceLocation | undefined {
  const positionMatch = /position\s+(\d+)/u.exec(message);
  if (positionMatch?.[1] === undefined) return undefined;
  const offset = Number(positionMatch[1]);
  if (!Number.isSafeInteger(offset)) return undefined;
  const prefix = source.slice(0, offset);
  const line = prefix.split("\n").length;
  const lastNewline = prefix.lastIndexOf("\n");
  return { line, column: offset - lastNewline, offset };
}

async function confinedRegularFile(
  targetRoot: string,
  relativePath: string,
): Promise<string> {
  let current = targetRoot;
  for (const segment of relativePath.split("/")) {
    const next = resolve(current, segment);
    if (!isWithin(targetRoot, next))
      throw new Error(`${relativePath} resolves outside the target root`);
    const entry = await lstat(next);
    if (entry.isSymbolicLink())
      throw new Error(`${relativePath} crosses a symbolic link`);
    current = next;
  }
  const physical = await realpath(current);
  if (!isWithin(targetRoot, physical))
    throw new Error(`${relativePath} resolves outside the target root`);
  if (!(await stat(physical)).isFile())
    throw new Error(`${relativePath} is not a regular file`);
  await access(physical, constants.R_OK);
  return physical;
}

async function confinedDirectory(
  targetRoot: string,
  relativePath: string,
): Promise<string> {
  let current = targetRoot;
  for (const segment of relativePath.split("/")) {
    const next = resolve(current, segment);
    if (!isWithin(targetRoot, next))
      throw new Error(`${relativePath} resolves outside the target root`);
    const entry = await lstat(next);
    if (entry.isSymbolicLink())
      throw new Error(`${relativePath} crosses a symbolic link`);
    current = next;
  }
  const physical = await realpath(current);
  if (!isWithin(targetRoot, physical))
    throw new Error(`${relativePath} resolves outside the target root`);
  if (!(await stat(physical)).isDirectory())
    throw new Error(`${relativePath} is not a directory`);
  await access(physical, constants.R_OK | constants.X_OK);
  return physical;
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function mappingSemanticDiagnostics(
  mapping: TypeScriptSourceMapping,
  mappingPath: string,
  architectureElementRefs: ReadonlySet<string>,
): SahDiagnostic[] {
  const diagnostics: SahDiagnostic[] = [];
  for (const duplicate of duplicateValues(
    mapping.elements.map(({ elementRef }) => elementRef),
  )) {
    diagnostics.push(
      configurationDiagnostic({
        code: "SOURCE_MAPPING_ELEMENT_DUPLICATE",
        artifactPath: mappingPath,
        reference: duplicate,
        message: `Element ${duplicate} has more than one source mapping entry.`,
        expected: "one entry per Architecture element ID",
        repair: "Merge the element's path prefixes into one mapping entry.",
      }),
    );
  }
  mapping.elements.forEach((element, index) => {
    if (!architectureElementRefs.has(element.elementRef)) {
      diagnostics.push(
        configurationDiagnostic({
          code: "SOURCE_MAPPING_ELEMENT_DANGLING",
          artifactPath: mappingPath,
          jsonPointer: `/elements/${index}/elementRef`,
          reference: element.elementRef,
          message: `Mapped element ${element.elementRef} is not present in Architecture IR.`,
          expected:
            "a stable Architecture element ID from the validated bundle",
          repair: "Correct or remove the stale source mapping entry.",
        }),
      );
    }
    element.pathPrefixes.forEach((prefix, prefixIndex) => {
      if (
        !mapping.sourceRoots.some(
          (root) => prefix === `${root}/` || prefix.startsWith(`${root}/`),
        )
      ) {
        diagnostics.push(
          configurationDiagnostic({
            code: "SOURCE_MAPPING_PREFIX_OUTSIDE_ROOTS",
            artifactPath: mappingPath,
            jsonPointer: `/elements/${index}/pathPrefixes/${prefixIndex}`,
            reference: prefix,
            message: `Element prefix ${prefix} is outside every declared source root.`,
            expected: "an element prefix contained by one declared source root",
            repair: "Correct the prefix or add its complete source root.",
          }),
        );
      }
    });
  });

  for (const duplicate of duplicateValues(
    mapping.writeTargets.map(({ selector }) => selector),
  )) {
    diagnostics.push(
      configurationDiagnostic({
        code: "SOURCE_MAPPING_TARGET_DUPLICATE",
        artifactPath: mappingPath,
        reference: duplicate,
        message: `Write target selector ${duplicate} is declared more than once.`,
        expected: "one write target per observable selector",
        repair: "Keep one unambiguous selector-to-symbol mapping.",
      }),
    );
  }
  mapping.writeTargets.forEach((target, index) => {
    if (
      !mapping.sourceRoots.some(
        (root) =>
          target.modulePath === root ||
          target.modulePath.startsWith(`${root}/`),
      )
    ) {
      diagnostics.push(
        configurationDiagnostic({
          code: "SOURCE_MAPPING_TARGET_OUTSIDE_ROOTS",
          artifactPath: mappingPath,
          jsonPointer: `/writeTargets/${index}/modulePath`,
          reference: target.modulePath,
          message: `Write target module ${target.modulePath} is outside every declared source root.`,
          expected: "a target module contained by one declared source root",
          repair: "Correct the module path or add its complete source root.",
        }),
      );
    }
  });

  for (let left = 0; left < mapping.sourceRoots.length; left += 1) {
    for (let right = left + 1; right < mapping.sourceRoots.length; right += 1) {
      const leftRoot = mapping.sourceRoots[left];
      const rightRoot = mapping.sourceRoots[right];
      if (leftRoot === undefined || rightRoot === undefined) continue;
      if (
        leftRoot.startsWith(`${rightRoot}/`) ||
        rightRoot.startsWith(`${leftRoot}/`)
      ) {
        diagnostics.push(
          configurationDiagnostic({
            code: "SOURCE_MAPPING_ROOT_OVERLAP",
            artifactPath: mappingPath,
            reference: `${leftRoot},${rightRoot}`,
            message: `Source roots ${leftRoot} and ${rightRoot} overlap.`,
            expected: "non-overlapping roots that enumerate each source once",
            repair:
              "Keep only the containing root or split roots without overlap.",
          }),
        );
      }
    }
  }
  return diagnostics;
}

async function loadMapping(
  targetRoot: string,
  mappingPath: string,
  registry: SchemaRegistry,
  architectureElementRefs: ReadonlySet<string>,
): Promise<
  | { ok: true; mapping: TypeScriptSourceMapping; physicalPath: string }
  | { ok: false; diagnostics: SahDiagnostic[] }
> {
  if (!isSafeRelativePath(mappingPath)) {
    return {
      ok: false,
      diagnostics: [
        configurationDiagnostic({
          code: "SOURCE_MAPPING_PATH_UNSAFE",
          artifactPath: mappingPath,
          reference: mappingPath,
          message: `Mapping path ${JSON.stringify(mappingPath)} is not a confined normalized target-relative path.`,
          expected: "one forward-slash relative JSON path inside the target",
          repair:
            "Pass a target-relative mapping path with no traversal or symlink.",
        }),
      ],
    };
  }

  let physicalPath: string;
  let source: string;
  try {
    physicalPath = await confinedRegularFile(targetRoot, mappingPath);
    source = await readFile(physicalPath, "utf8");
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        configurationDiagnostic({
          code: "SOURCE_MAPPING_UNREADABLE",
          artifactPath: mappingPath,
          reference: mappingPath,
          message:
            error instanceof Error
              ? error.message
              : `Cannot read source mapping ${mappingPath}.`,
          expected:
            "a readable regular mapping file confined inside the target",
          repair: "Restore the mapping file or correct the --mapping path.",
        }),
      ],
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Cannot parse ${mappingPath}.`;
    const location = sourceLocation(message, source);
    return {
      ok: false,
      diagnostics: [
        configurationDiagnostic({
          code: "SOURCE_MAPPING_JSON_MALFORMED",
          artifactPath: mappingPath,
          ...(location === undefined ? {} : { sourceLocation: location }),
          message: `${mappingPath} is malformed JSON${
            location === undefined
              ? "."
              : ` at line ${location.line}, column ${location.column}.`
          }`,
          expected:
            "well-formed JSON matching the TypeScript source mapping schema",
          repair: "Fix the JSON syntax at the reported source location.",
        }),
      ],
    };
  }

  const schemaDiagnostics = registry
    .validate(
      typescriptSourceMappingSchemaId,
      value,
      mappingPath,
      "operational",
    )
    .map((diagnostic) => ({
      ...diagnostic,
      capability: "TypeScript source mapping configuration",
      repair: "Repair the mapping field and rerun verification.",
    }));
  if (schemaDiagnostics.length > 0)
    return { ok: false, diagnostics: schemaDiagnostics };

  const mapping = value as TypeScriptSourceMapping;
  const semanticDiagnostics = mappingSemanticDiagnostics(
    mapping,
    mappingPath,
    architectureElementRefs,
  );
  if (semanticDiagnostics.length > 0)
    return { ok: false, diagnostics: semanticDiagnostics };

  for (const root of mapping.sourceRoots) {
    try {
      await confinedDirectory(targetRoot, root);
    } catch (error) {
      return {
        ok: false,
        diagnostics: [
          configurationDiagnostic({
            code: "SOURCE_MAPPING_ROOT_UNREADABLE",
            artifactPath: mappingPath,
            reference: root,
            message:
              error instanceof Error
                ? error.message
                : `Cannot read source root ${root}.`,
            expected: "a readable directory confined inside the target",
            repair: "Restore the source root or correct the mapping.",
          }),
        ],
      };
    }
  }
  return { ok: true, mapping, physicalPath };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typescriptDiagnosticMessage(diagnostic: ts.Diagnostic): string {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
}

function typescriptDiagnosticLocation(
  diagnostic: ts.Diagnostic,
): SourceLocation | undefined {
  if (diagnostic.start === undefined) return undefined;
  if (diagnostic.file !== undefined) {
    const location = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start,
    );
    return {
      line: location.line + 1,
      column: location.character + 1,
      offset: diagnostic.start,
    };
  }
  return { line: 1, column: diagnostic.start + 1, offset: diagnostic.start };
}

function unsupportedProjectFeature(
  raw: Record<string, unknown>,
): string | undefined {
  const compilerOptions = isRecord(raw.compilerOptions)
    ? raw.compilerOptions
    : {};
  const features: string[] = [];
  if (raw.extends !== undefined) features.push("extends");
  if (raw.references !== undefined) features.push("project references");
  if (compilerOptions.plugins !== undefined) features.push("compiler plugins");
  if (compilerOptions.rootDirs !== undefined) features.push("rootDirs");
  if (compilerOptions.allowJs === true || compilerOptions.checkJs === true)
    features.push("JavaScript compilation");
  return features.length === 0 ? undefined : features.join(", ");
}

function compilerPathDiagnostics(input: {
  raw: Record<string, unknown>;
  options: ts.CompilerOptions;
  targetRoot: string;
  configPath: string;
  physicalPath: string;
}): SahDiagnostic[] {
  const diagnostics: SahDiagnostic[] = [];
  const basePath = input.options.baseUrl ?? dirname(input.physicalPath);
  if (!isWithin(input.targetRoot, resolve(basePath))) {
    diagnostics.push(
      configurationDiagnostic({
        code: "SOURCE_TSCONFIG_PATH_UNSAFE",
        artifactPath: input.configPath,
        jsonPointer: "/compilerOptions/baseUrl",
        reference: String(input.options.baseUrl),
        message: "TypeScript baseUrl resolves outside the target root.",
        expected: "compiler resolution paths confined inside the target",
        repair: "Move baseUrl inside the target or remove it.",
      }),
    );
  }

  const compilerOptions = isRecord(input.raw.compilerOptions)
    ? input.raw.compilerOptions
    : undefined;
  const paths =
    compilerOptions !== undefined && isRecord(compilerOptions.paths)
      ? compilerOptions.paths
      : undefined;
  if (paths !== undefined) {
    for (const [alias, substitutions] of Object.entries(paths)) {
      if (!Array.isArray(substitutions)) continue;
      substitutions.forEach((substitution, index) => {
        if (typeof substitution !== "string") return;
        const probe = substitution.replaceAll("*", "sah-wildcard");
        if (!isWithin(input.targetRoot, resolve(basePath, probe))) {
          diagnostics.push(
            configurationDiagnostic({
              code: "SOURCE_TSCONFIG_PATH_UNSAFE",
              artifactPath: input.configPath,
              jsonPointer: `/compilerOptions/paths/${escapePointer(alias)}/${index}`,
              reference: substitution,
              message: `TypeScript path substitution ${substitution} resolves outside the target root.`,
              expected:
                "every path alias substitution confined inside the target",
              repair: "Move the substitution inside the target source roots.",
            }),
          );
        }
      });
    }
  }
  return diagnostics;
}

async function loadTypeScriptProjectConfiguration(
  targetRoot: string,
  mapping: TypeScriptSourceMapping,
): Promise<ProjectConfigurationLoad> {
  let physicalPath: string;
  let source: string;
  try {
    physicalPath = await confinedRegularFile(targetRoot, mapping.tsconfigPath);
    source = await readFile(physicalPath, "utf8");
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        configurationDiagnostic({
          code: "SOURCE_TSCONFIG_UNREADABLE",
          artifactPath: mapping.tsconfigPath,
          reference: mapping.tsconfigPath,
          message:
            error instanceof Error
              ? error.message
              : `Cannot read ${mapping.tsconfigPath}.`,
          expected: "a confined readable TypeScript project configuration",
          repair: "Restore the tsconfig file or correct tsconfigPath.",
        }),
      ],
    };
  }

  const parsed = ts.parseConfigFileTextToJson(physicalPath, source);
  if (parsed.error !== undefined || !isRecord(parsed.config)) {
    const diagnostic = parsed.error;
    const location =
      diagnostic === undefined
        ? undefined
        : typescriptDiagnosticLocation(diagnostic);
    return {
      ok: false,
      diagnostics: [
        configurationDiagnostic({
          code: "SOURCE_TSCONFIG_JSON_MALFORMED",
          artifactPath: mapping.tsconfigPath,
          ...(location === undefined ? {} : { sourceLocation: location }),
          message:
            diagnostic === undefined
              ? `${mapping.tsconfigPath} must contain a JSON object.`
              : typescriptDiagnosticMessage(diagnostic),
          expected: "a well-formed JSONC TypeScript project configuration",
          repair: "Repair the tsconfig syntax and rerun verification.",
        }),
      ],
    };
  }

  const raw = parsed.config;
  if (raw.compilerOptions !== undefined && !isRecord(raw.compilerOptions)) {
    return {
      ok: false,
      diagnostics: [
        configurationDiagnostic({
          code: "SOURCE_TSCONFIG_INVALID",
          artifactPath: mapping.tsconfigPath,
          jsonPointer: "/compilerOptions",
          message: "TypeScript compilerOptions must be a JSON object.",
          expected: "compilerOptions represented as an object when present",
          repair:
            "Replace compilerOptions with an object and rerun verification.",
        }),
      ],
    };
  }
  const compilerOptions = raw.compilerOptions ?? {};
  const converted = ts.convertCompilerOptionsFromJson(
    compilerOptions,
    dirname(physicalPath),
    physicalPath,
  );
  const conversionErrors = converted.errors.filter(
    ({ category }) => category === ts.DiagnosticCategory.Error,
  );
  if (conversionErrors.length > 0) {
    return {
      ok: false,
      diagnostics: conversionErrors.map((diagnostic) =>
        configurationDiagnostic({
          code: "SOURCE_TSCONFIG_INVALID",
          artifactPath: mapping.tsconfigPath,
          message: typescriptDiagnosticMessage(diagnostic),
          expected: "valid TypeScript compiler options",
          repair: "Correct compilerOptions and rerun verification.",
        }),
      ),
    };
  }
  const options: ts.CompilerOptions = {
    ...converted.options,
    allowJs: false,
    checkJs: false,
    noEmit: true,
  };
  const pathDiagnostics = compilerPathDiagnostics({
    raw,
    options,
    targetRoot,
    configPath: mapping.tsconfigPath,
    physicalPath,
  });
  if (pathDiagnostics.length > 0)
    return { ok: false, diagnostics: pathDiagnostics };

  if (options.baseUrl !== undefined) {
    const baseUrlPath = targetRelativePath(
      targetRoot,
      resolve(options.baseUrl),
    );
    try {
      if (baseUrlPath === undefined)
        throw new Error("baseUrl resolves outside the target root");
      if (baseUrlPath !== "") await confinedDirectory(targetRoot, baseUrlPath);
    } catch (error) {
      return {
        ok: false,
        diagnostics: [
          configurationDiagnostic({
            code: "SOURCE_TSCONFIG_PATH_UNSAFE",
            artifactPath: mapping.tsconfigPath,
            jsonPointer: "/compilerOptions/baseUrl",
            reference: options.baseUrl,
            message:
              error instanceof Error
                ? error.message
                : "TypeScript baseUrl is not a confined readable directory.",
            expected: "a confined readable baseUrl directory",
            repair: "Move baseUrl inside the target without symbolic links.",
          }),
        ],
      };
    }
  }

  const unsupportedFeature = unsupportedProjectFeature(raw);
  return {
    ok: true,
    configuration: {
      physicalPath,
      options,
      ...(unsupportedFeature === undefined ? {} : { unsupportedFeature }),
    },
  };
}

function unsupported(input: {
  code: string;
  message: string;
  expected: string;
  observed?: string;
  repair: string;
}): Exclude<FactAdapterOutcome, { kind: "observed" }> {
  return { kind: "unsupported", ...input };
}

function operational(input: {
  code: string;
  message: string;
  expected: string;
  repair: string;
}): Exclude<FactAdapterOutcome, { kind: "observed" | "unsupported" }> {
  return { kind: "operational-error", ...input };
}

async function walkSourceRoot(
  targetRoot: string,
  physicalDirectory: string,
  relativeDirectory: string,
  files: string[],
): Promise<Exclude<FactAdapterOutcome, { kind: "observed" }> | undefined> {
  let entries: Dirent[];
  try {
    entries = await readdir(physicalDirectory, { withFileTypes: true });
  } catch (error) {
    return operational({
      code: "SOURCE_GRAPH_READ_FAILED",
      message:
        error instanceof Error
          ? error.message
          : `Cannot enumerate ${relativeDirectory}.`,
      expected: "readable source metadata inside the target",
      repair: "Restore source-tree access and rerun verification.",
    });
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const relativePath =
      relativeDirectory === ""
        ? entry.name
        : `${relativeDirectory}/${entry.name}`;
    const physicalPath = resolve(physicalDirectory, entry.name);
    if (!isWithin(targetRoot, physicalPath)) {
      return unsupported({
        code: "SOURCE_GRAPH_PATH_UNSAFE",
        message: `Source path ${relativePath} resolves outside the target.`,
        expected: "all enumerated sources to remain inside the target root",
        observed: relativePath,
        repair: "Remove the escaping path and rerun verification.",
      });
    }
    if (entry.isSymbolicLink()) {
      return unsupported({
        code: "SOURCE_GRAPH_SYMLINK_UNSUPPORTED",
        message: `Source path ${relativePath} is a symbolic link.`,
        expected: "a source tree without symbolic-link traversal",
        observed: relativePath,
        repair:
          "Replace the symlink with target-local source or use an isolated checkout.",
      });
    }
    if (entry.isDirectory()) {
      const failure = await walkSourceRoot(
        targetRoot,
        physicalPath,
        relativePath,
        files,
      );
      if (failure !== undefined) return failure;
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = extname(entry.name).toLowerCase();
    if (unsupportedJavaScriptExtensions.has(extension)) {
      return unsupported({
        code: "SOURCE_GRAPH_LANGUAGE_UNSUPPORTED",
        message: `JavaScript source ${relativePath} occurs inside a declared TypeScript root.`,
        expected: "only TypeScript source in this adapter's declared roots",
        observed: relativePath,
        repair:
          "Use a complete JavaScript-capable adapter or move it outside this mapping root.",
      });
    }
    if (supportedExtensions.has(extension)) files.push(relativePath);
  }
  return undefined;
}

function compilerPathAllowed(
  targetRoot: string,
  defaultLibraryRoot: string,
  candidate: string,
): boolean {
  const absolute = resolve(candidate);
  if (isWithin(defaultLibraryRoot, absolute)) return true;
  if (!isWithin(targetRoot, absolute)) return false;
  let current = targetRoot;
  const fromRoot = relative(targetRoot, absolute);
  if (fromRoot === "") return true;
  for (const segment of fromRoot.split(sep)) {
    current = resolve(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink()) return false;
    } catch {
      return true;
    }
  }
  return true;
}

function createConfinedCompilerHost(
  targetRoot: string,
  options: ts.CompilerOptions,
): ts.CompilerHost {
  const base = ts.createCompilerHost(options, true);
  const defaultLibraryRoot = dirname(
    realpathSync(ts.getDefaultLibFilePath(options)),
  );
  const allowed = (path: string): boolean =>
    compilerPathAllowed(targetRoot, defaultLibraryRoot, path);
  return {
    ...base,
    fileExists: (path) => allowed(path) && base.fileExists(path),
    readFile: (path) => (allowed(path) ? base.readFile(path) : undefined),
    getSourceFile: (path, languageVersionOrOptions, onError, shouldCreate) =>
      allowed(path)
        ? base.getSourceFile(
            path,
            languageVersionOrOptions,
            onError,
            shouldCreate,
          )
        : undefined,
    directoryExists: (path) =>
      allowed(path) && (base.directoryExists?.(path) ?? false),
    getDirectories: (path) =>
      allowed(path) ? (base.getDirectories?.(path) ?? []).filter(allowed) : [],
    readDirectory: (root, extensions, excludes, includes, depth) =>
      allowed(root)
        ? (
            base.readDirectory?.(root, extensions, excludes, includes, depth) ??
            []
          ).filter(allowed)
        : [],
    realpath: (path) =>
      allowed(path) ? (base.realpath?.(path) ?? resolve(path)) : resolve(path),
  };
}

function programDiagnosticText(
  diagnostic: ts.Diagnostic,
  targetRoot: string,
): string {
  const message = typescriptDiagnosticMessage(diagnostic);
  if (diagnostic.file === undefined || diagnostic.start === undefined)
    return `TS${diagnostic.code}: ${message}`;
  const location = diagnostic.file.getLineAndCharacterOfPosition(
    diagnostic.start,
  );
  const absolute = resolve(diagnostic.file.fileName);
  const file = isWithin(targetRoot, absolute)
    ? relative(targetRoot, absolute).split(sep).join("/")
    : diagnostic.file.fileName;
  return `${file}:${location.line + 1}:${location.character + 1} TS${diagnostic.code}: ${message}`;
}

function programSetupErrors(program: ts.Program): ts.Diagnostic[] {
  return [
    ...program.getConfigFileParsingDiagnostics(),
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
  ].filter(({ category }) => category === ts.DiagnosticCategory.Error);
}

function targetRelativePath(
  targetRoot: string,
  physicalPath: string,
): string | undefined {
  const fromRoot = relative(targetRoot, physicalPath);
  return isWithin(targetRoot, physicalPath)
    ? fromRoot.split(sep).join("/")
    : undefined;
}

async function loadSourceInventory(
  targetRoot: string,
  mapping: TypeScriptSourceMapping,
  configuration: TypeScriptProjectConfiguration,
): Promise<SourceInventory> {
  if (configuration.unsupportedFeature !== undefined) {
    return unsupported({
      code: "SOURCE_TSCONFIG_FEATURE_UNSUPPORTED",
      message: `TypeScript project uses unsupported features: ${configuration.unsupportedFeature}.`,
      expected:
        "one standalone TypeScript-only project without config inheritance or plugins",
      observed: configuration.unsupportedFeature,
      repair:
        "Flatten the project config for verification or add bounded support for the feature.",
    });
  }

  const files: string[] = [];
  for (const root of mapping.sourceRoots) {
    let physicalRoot: string;
    try {
      physicalRoot = await confinedDirectory(targetRoot, root);
    } catch (error) {
      return operational({
        code: "SOURCE_GRAPH_READ_FAILED",
        message:
          error instanceof Error
            ? error.message
            : `Cannot inspect source root ${root}.`,
        expected: "readable source roots confined inside the target",
        repair: "Restore source-tree access and rerun verification.",
      });
    }
    const failure = await walkSourceRoot(targetRoot, physicalRoot, root, files);
    if (failure !== undefined) return failure;
  }

  const physicalFiles: Array<{ relativePath: string; physicalPath: string }> =
    [];
  for (const relativePath of files.sort()) {
    try {
      physicalFiles.push({
        relativePath,
        physicalPath: await confinedRegularFile(targetRoot, relativePath),
      });
    } catch (error) {
      return operational({
        code: "SOURCE_GRAPH_READ_FAILED",
        message:
          error instanceof Error
            ? error.message
            : `Cannot read ${relativePath}.`,
        expected: "readable TypeScript source inside the target",
        repair: "Restore source access and rerun verification.",
      });
    }
  }

  let program: ts.Program;
  try {
    program = ts.createProgram({
      rootNames: physicalFiles.map(({ physicalPath }) => physicalPath),
      options: configuration.options,
      host: createConfinedCompilerHost(targetRoot, configuration.options),
    });
  } catch (error) {
    return operational({
      code: "SOURCE_GRAPH_COMPILER_FAILED",
      message:
        error instanceof Error ? error.message : "TypeScript Program failed.",
      expected: "successful local TypeScript Program construction",
      repair: "Repair project access or report a compiler adapter defect.",
    });
  }

  const setupDiagnostics = programSetupErrors(program);
  if (setupDiagnostics.length > 0) {
    return unsupported({
      code: "SOURCE_GRAPH_COMPILER_DIAGNOSTIC",
      message:
        "TypeScript project has diagnostics that prevent complete symbol resolution.",
      expected: "a compiler-clean declared source graph",
      observed: setupDiagnostics
        .slice(0, 3)
        .map((diagnostic) => programDiagnosticText(diagnostic, targetRoot))
        .join("; "),
      repair: "Repair the compiler diagnostics and rerun verification.",
    });
  }
  const syntaxDiagnostics = program
    .getSyntacticDiagnostics()
    .filter(({ category }) => category === ts.DiagnosticCategory.Error);
  if (syntaxDiagnostics.length > 0) {
    return unsupported({
      code: "SOURCE_GRAPH_SYNTAX_UNSUPPORTED",
      message: "TypeScript project has syntax diagnostics.",
      expected: "parseable TypeScript source before symbol verification",
      observed: syntaxDiagnostics
        .slice(0, 3)
        .map((diagnostic) => programDiagnosticText(diagnostic, targetRoot))
        .join("; "),
      repair: "Repair the syntax errors and rerun verification.",
    });
  }

  const enumerated = new Set(
    physicalFiles.map(({ physicalPath }) => physicalPath),
  );
  for (const sourceFile of program.getSourceFiles()) {
    let physicalPath: string;
    try {
      physicalPath = realpathSync(resolve(sourceFile.fileName));
    } catch {
      return unsupported({
        code: "SOURCE_GRAPH_SOURCE_UNRESOLVED",
        message: `Compiler source ${sourceFile.fileName} cannot be physically resolved.`,
        expected:
          "every implementation source to resolve inside declared roots",
        observed: sourceFile.fileName,
        repair: "Restore the source or correct the project mapping.",
      });
    }
    const relativePath = targetRelativePath(targetRoot, physicalPath);
    if (sourceFile.isDeclarationFile && relativePath === undefined) continue;
    if (relativePath === undefined || !enumerated.has(physicalPath)) {
      return unsupported({
        code: "SOURCE_GRAPH_SOURCE_OUTSIDE_ROOTS",
        message: `Compiler source ${sourceFile.fileName} is outside declared source roots.`,
        expected:
          "all implementation sources enumerated by mapping sourceRoots",
        observed: relativePath ?? sourceFile.fileName,
        repair:
          "Declare the complete containing source root or remove the dependency.",
      });
    }
  }

  const documents: SourceDocument[] = [];
  for (const file of physicalFiles) {
    const sourceFile = program.getSourceFile(file.physicalPath);
    if (sourceFile === undefined) {
      return unsupported({
        code: "SOURCE_GRAPH_SOURCE_UNRESOLVED",
        message: `Compiler omitted declared source ${file.relativePath}.`,
        expected: "every enumerated source present in the TypeScript Program",
        observed: file.relativePath,
        repair: "Correct compiler options or the source-root declaration.",
      });
    }
    documents.push({ ...file, sourceFile });
  }
  return {
    kind: "ready",
    documents,
    checker: program.getTypeChecker(),
    semanticDiagnostics: program
      .getSemanticDiagnostics()
      .filter(({ category }) => category === ts.DiagnosticCategory.Error),
  };
}

function moduleText(node: ts.Expression | undefined): string | undefined {
  return node !== undefined && ts.isStringLiteralLike(node)
    ? node.text
    : undefined;
}

function directCallableExportExists(
  sourceFile: ts.SourceFile,
  exportName: string,
): boolean {
  return sourceFile.statements.some((statement) => {
    const modifiers = ts.canHaveModifiers(statement)
      ? ts.getModifiers(statement)
      : undefined;
    const exported =
      modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword) ===
      true;
    const isDefault =
      modifiers?.some(({ kind }) => kind === ts.SyntaxKind.DefaultKeyword) ===
      true;
    if (!exported || isDefault) return false;
    if (ts.isFunctionDeclaration(statement))
      return (
        statement.name?.text === exportName && statement.body !== undefined
      );
    if (!ts.isVariableStatement(statement)) return false;
    return statement.declarationList.declarations.some(
      ({ name, initializer }) =>
        ts.isIdentifier(name) &&
        name.text === exportName &&
        initializer !== undefined &&
        (ts.isArrowFunction(initializer) ||
          ts.isFunctionExpression(initializer)),
    );
  });
}

function elementRefsForPath(
  mapping: TypeScriptSourceMapping,
  sourcePath: string,
): string[] {
  return mapping.elements
    .filter(({ pathPrefixes }) =>
      pathPrefixes.some((prefix) => sourcePath.startsWith(prefix)),
    )
    .map(({ elementRef }) => elementRef);
}

function identifierIsUsed(
  sourceFile: ts.SourceFile,
  declarationName: ts.Identifier,
): boolean {
  let used = false;
  function visit(node: ts.Node): void {
    if (used) return;
    if (
      ts.isIdentifier(node) &&
      node.text === declarationName.text &&
      node !== declarationName
    ) {
      used = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return used;
}

function sourceFormFailure(
  document: SourceDocument,
): Exclude<FactAdapterOutcome, { kind: "observed" }> | undefined {
  for (const statement of document.sourceFile.statements) {
    if (ts.isImportEqualsDeclaration(statement)) {
      return unsupported({
        code: "SOURCE_GRAPH_IMPORT_FORM_UNSUPPORTED",
        message: `TypeScript import assignment occurs in ${document.relativePath}.`,
        expected: "ECMAScript direct named imports",
        observed: document.relativePath,
        repair:
          "Replace the import assignment or provide an import-assignment-aware resolver.",
      });
    }
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const named = clause?.namedBindings;
      const defaultUsed =
        clause?.name !== undefined &&
        identifierIsUsed(document.sourceFile, clause.name);
      const namespaceUsed =
        named !== undefined &&
        ts.isNamespaceImport(named) &&
        identifierIsUsed(document.sourceFile, named.name);
      if (defaultUsed || namespaceUsed) {
        return unsupported({
          code: "SOURCE_GRAPH_IMPORT_FORM_UNSUPPORTED",
          message: `Default or namespace import use occurs in ${document.relativePath}.`,
          expected: "direct named imports for complete write-symbol analysis",
          observed: document.relativePath,
          repair: "Use a named import or provide a stronger symbol resolver.",
        });
      }
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause !== undefined &&
      ts.isNamespaceExport(statement.exportClause)
    ) {
      return unsupported({
        code: "SOURCE_GRAPH_REEXPORT_FORM_UNSUPPORTED",
        message: `Namespace re-export occurs in ${document.relativePath}.`,
        expected: "static named or star re-export chains",
        observed: document.relativePath,
        repair: "Use a named/star re-export or add namespace-symbol support.",
      });
    }
  }
  return undefined;
}

function canonicalSymbol(
  checker: ts.TypeChecker,
  symbol: ts.Symbol | undefined,
): ts.Symbol | undefined {
  if (symbol === undefined) return undefined;
  return (symbol.flags & ts.SymbolFlags.Alias) === 0
    ? symbol
    : checker.getAliasedSymbol(symbol);
}

function ignoredSymbolIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent;
  return (
    ts.isImportSpecifier(parent) ||
    ts.isExportSpecifier(parent) ||
    (ts.isFunctionDeclaration(parent) && parent.name === node) ||
    (ts.isVariableDeclaration(parent) && parent.name === node)
  );
}

function mappedTargetSymbol(
  checker: ts.TypeChecker,
  moduleDocument: SourceDocument,
  target: WriteTarget,
): ts.Symbol | undefined {
  if (!directCallableExportExists(moduleDocument.sourceFile, target.exportName))
    return undefined;
  const moduleSymbol = checker.getSymbolAtLocation(moduleDocument.sourceFile);
  if (moduleSymbol === undefined) return undefined;
  const exported = checker
    .getExportsOfModule(moduleSymbol)
    .find((symbol) => symbol.getName() === target.exportName);
  return canonicalSymbol(checker, exported);
}

function writerPaths(
  documents: SourceDocument[],
  checker: ts.TypeChecker,
  semanticDiagnostics: ts.Diagnostic[],
  targetRoot: string,
  target: WriteTarget,
):
  | { ok: true; writers: string[] }
  | { ok: false; outcome: Exclude<FactAdapterOutcome, { kind: "observed" }> } {
  const moduleDocument = documents.find(
    ({ relativePath }) => relativePath === target.modulePath,
  );
  if (moduleDocument === undefined) {
    return {
      ok: false,
      outcome: unsupported({
        code: "SOURCE_MAPPING_TARGET_MISSING",
        message: `Mapped write target module ${target.modulePath} was not found in the declared roots.`,
        expected:
          "the mapped TypeScript module to be present in enumerated source",
        observed: target.modulePath,
        repair: "Correct the module path or restore the source file.",
      }),
    };
  }
  const targetSymbol = mappedTargetSymbol(checker, moduleDocument, target);
  if (targetSymbol === undefined) {
    return {
      ok: false,
      outcome: unsupported({
        code: "SOURCE_MAPPING_EXPORT_MISSING",
        message: `Mapped export ${target.exportName} was not found in ${target.modulePath}.`,
        expected: "a direct named export of a function or variable declaration",
        observed: `${target.modulePath}#${target.exportName}`,
        repair:
          "Correct the export mapping or restore the exported write symbol.",
      }),
    };
  }
  if (semanticDiagnostics.length > 0) {
    return {
      ok: false,
      outcome: unsupported({
        code: "SOURCE_GRAPH_COMPILER_DIAGNOSTIC",
        message:
          "TypeScript project has diagnostics that prevent complete symbol resolution.",
        expected: "a compiler-clean declared source graph",
        observed: semanticDiagnostics
          .slice(0, 3)
          .map((diagnostic) => programDiagnosticText(diagnostic, targetRoot))
          .join("; "),
        repair: "Repair the compiler diagnostics and rerun verification.",
      }),
    };
  }

  const writers = new Set<string>();
  for (const document of documents) {
    const formFailure = sourceFormFailure(document);
    if (formFailure !== undefined) return { ok: false, outcome: formFailure };

    let failure: Exclude<FactAdapterOutcome, { kind: "observed" }> | undefined;
    function visit(node: ts.Node): void {
      if (failure !== undefined) return;
      if (ts.isCallExpression(node)) {
        const specifier = moduleText(node.arguments[0]);
        const isDynamicImport =
          node.expression.kind === ts.SyntaxKind.ImportKeyword;
        const isRequire =
          ts.isIdentifier(node.expression) &&
          node.expression.text === "require";
        const isDynamicCode =
          (ts.isIdentifier(node.expression) &&
            ["eval", "Function"].includes(node.expression.text)) ||
          (ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === "eval");
        if (isDynamicCode) {
          failure = unsupported({
            code: "SOURCE_GRAPH_DYNAMIC_CODE_UNSUPPORTED",
            message: `Dynamic code evaluation occurs in ${document.relativePath}.`,
            expected: "statically parseable calls and module loading",
            observed: document.relativePath,
            repair:
              "Remove dynamic code evaluation or provide a sandbox-aware source adapter.",
          });
          return;
        }
        if (isDynamicImport || isRequire) {
          failure = unsupported({
            code: "SOURCE_GRAPH_DYNAMIC_IMPORT_UNSUPPORTED",
            message: `Dynamic module loading occurs in ${document.relativePath}.`,
            expected: "static direct named imports of the write symbol",
            observed: `${document.relativePath}:${specifier ?? "non-literal module"}`,
            repair:
              "Use a static named import or provide dynamic-resolution support.",
          });
          return;
        }
        if (
          ts.isIdentifier(node.expression) &&
          canonicalSymbol(
            checker,
            checker.getSymbolAtLocation(node.expression),
          ) === targetSymbol
        ) {
          writers.add(document.relativePath);
        }
      }
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "Function"
      ) {
        failure = unsupported({
          code: "SOURCE_GRAPH_DYNAMIC_CODE_UNSUPPORTED",
          message: `Dynamic code construction occurs in ${document.relativePath}.`,
          expected: "statically parseable calls and module loading",
          observed: document.relativePath,
          repair:
            "Remove dynamic code construction or provide a sandbox-aware source adapter.",
        });
        return;
      }
      if (
        ts.isIdentifier(node) &&
        !ignoredSymbolIdentifier(node) &&
        canonicalSymbol(checker, checker.getSymbolAtLocation(node)) ===
          targetSymbol
      ) {
        const directCall =
          ts.isCallExpression(node.parent) && node.parent.expression === node;
        if (!directCall) {
          failure = unsupported({
            code: "SOURCE_GRAPH_ALIAS_UNSUPPORTED",
            message: `Mapped write symbol is used indirectly in ${document.relativePath}.`,
            expected:
              "the imported write symbol used only as a direct call expression",
            observed: document.relativePath,
            repair:
              "Call the named import directly or provide alias-aware analysis.",
          });
          return;
        }
      }
      ts.forEachChild(node, visit);
    }
    for (const statement of document.sourceFile.statements) {
      visit(statement);
      if (failure !== undefined) return { ok: false, outcome: failure };
    }
  }
  return { ok: true, writers: [...writers].sort() };
}

class TypeScriptWriteAuthorityAdapter implements CodeFactAdapter {
  readonly capability = typescriptWriteAuthorityCapability;
  private inventory: Promise<SourceInventory> | undefined;

  constructor(
    private readonly targetRoot: string,
    private readonly mapping: TypeScriptSourceMapping,
    private readonly configuration: TypeScriptProjectConfiguration,
  ) {}

  async observe({
    observable,
    scopeElementRefs,
  }: FactAdapterRequest): Promise<FactAdapterOutcome> {
    if (
      observable.factSource !== "source-graph" ||
      observable.predicate !== "writers-belong-to-constraint-scope" ||
      observable.expected !== "true"
    ) {
      return unsupported({
        code: "CONSTRAINT_BINDING_UNSUPPORTED",
        message: `The TypeScript adapter cannot evaluate ${observable.factSource}/${observable.predicate}/${observable.expected}.`,
        expected:
          "factSource source-graph, predicate writers-belong-to-constraint-scope, and expected true",
        observed: `${observable.factSource}/${observable.predicate}/${observable.expected}`,
        repair:
          "Compile the constraint to the supported tuple or provide another adapter.",
      });
    }
    const target = this.mapping.writeTargets.find(
      ({ selector }) => selector === observable.selector,
    );
    if (target === undefined) {
      return unsupported({
        code: "SOURCE_MAPPING_TARGET_UNSUPPORTED",
        message: `No write target is mapped for selector ${observable.selector}.`,
        expected: "one mapping writeTargets entry for the observable selector",
        observed: observable.selector,
        repair:
          "Add the selector-to-symbol mapping or revise the S11 observable.",
      });
    }

    this.inventory ??= loadSourceInventory(
      this.targetRoot,
      this.mapping,
      this.configuration,
    );
    const inventory = await this.inventory;
    if (inventory.kind !== "ready") return inventory;
    const result = writerPaths(
      inventory.documents,
      inventory.checker,
      inventory.semanticDiagnostics,
      this.targetRoot,
      target,
    );
    if (!result.ok) return result.outcome;

    const writers = result.writers.map((sourcePath) => ({
      sourcePath,
      elementRefs: elementRefsForPath(this.mapping, sourcePath),
    }));
    const ambiguous = writers.find(({ elementRefs }) => elementRefs.length > 1);
    if (ambiguous !== undefined) {
      return unsupported({
        code: "SOURCE_MAPPING_AMBIGUOUS",
        message: `Writer ${ambiguous.sourcePath} maps to multiple Architecture elements.`,
        expected: "each writer path to resolve to at most one element",
        observed: `${ambiguous.sourcePath}: ${ambiguous.elementRefs.join(", ")}`,
        repair:
          "Make element path prefixes mutually exclusive for this source.",
      });
    }

    const allowed = new Set(scopeElementRefs);
    const outside = writers.filter(
      ({ elementRefs }) =>
        elementRefs.length === 0 ||
        elementRefs[0] === undefined ||
        !allowed.has(elementRefs[0]),
    );
    if (outside.length > 0) {
      return {
        kind: "observed",
        matches: false,
        observed: `writers outside constraint scope: ${outside
          .map(
            ({ sourcePath, elementRefs }) =>
              `${sourcePath} (${elementRefs[0] ?? "unmapped"})`,
          )
          .join(", ")}`,
      };
    }
    return {
      kind: "observed",
      matches: true,
      observed:
        writers.length === 0
          ? `no calls to ${target.selector} were found`
          : `all writers are in constraint scope: ${writers
              .map(
                ({ sourcePath, elementRefs }) =>
                  `${sourcePath} (${String(elementRefs[0])})`,
              )
              .join(", ")}`,
    };
  }
}

export async function prepareTypeScriptSourceAdapter(input: {
  targetRoot: string;
  mappingPath: string;
  registry: SchemaRegistry;
  architectureElementRefs: ReadonlySet<string>;
}): Promise<AdapterPreparation> {
  const loaded = await loadMapping(
    input.targetRoot,
    input.mappingPath,
    input.registry,
    input.architectureElementRefs,
  );
  if (!loaded.ok)
    return {
      ok: false,
      diagnostics: loaded.diagnostics,
      mappingPath: input.mappingPath,
    };
  const project = await loadTypeScriptProjectConfiguration(
    input.targetRoot,
    loaded.mapping,
  );
  if (!project.ok)
    return {
      ok: false,
      diagnostics: project.diagnostics,
      mappingPath: input.mappingPath,
    };
  return {
    ok: true,
    mappingPath: input.mappingPath,
    adapter: new TypeScriptWriteAuthorityAdapter(
      input.targetRoot,
      loaded.mapping,
      project.configuration,
    ),
  };
}
