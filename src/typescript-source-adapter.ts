import { constants, type Dirent } from "node:fs";
import {
  access,
  lstat,
  readFile,
  readdir,
  realpath,
  stat,
} from "node:fs/promises";
import { extname, isAbsolute, posix, relative, resolve, sep } from "node:path";

import ts from "typescript";

import type { SahDiagnostic, SourceLocation } from "./contracts.js";
import type {
  CodeFactAdapter,
  FactAdapterOutcome,
  FactAdapterRequest,
} from "./code-fact-adapter.js";
import type { SchemaRegistry } from "./schema-validation.js";

export const typescriptWriteAuthorityCapability =
  "dependency-and-write analysis";
export const typescriptSourceMappingSchemaId =
  "https://sah.dev/schemas/typescript-source-mapping/v0.1.0";

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
  sourceRoots: string[];
  elements: ElementMapping[];
  writeTargets: WriteTarget[];
};

type SourceDocument = {
  relativePath: string;
  sourceFile: ts.SourceFile;
};

type SourceInventory =
  | { kind: "ready"; documents: SourceDocument[] }
  | Exclude<FactAdapterOutcome, { kind: "observed" }>;

type AdapterPreparation =
  | { ok: true; adapter: CodeFactAdapter; mappingPath: string }
  | { ok: false; diagnostics: SahDiagnostic[]; mappingPath: string };

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

async function loadSourceInventory(
  targetRoot: string,
  mapping: TypeScriptSourceMapping,
): Promise<SourceInventory> {
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

  const documents: SourceDocument[] = [];
  for (const relativePath of files.sort()) {
    let source: string;
    try {
      const physicalPath = await confinedRegularFile(targetRoot, relativePath);
      source = await readFile(physicalPath, "utf8");
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
    const transpiled = ts.transpileModule(source, {
      fileName: relativePath,
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const syntaxErrors = (transpiled.diagnostics ?? []).filter(
      ({ category }) => category === ts.DiagnosticCategory.Error,
    );
    if (syntaxErrors.length > 0) {
      return unsupported({
        code: "SOURCE_GRAPH_SYNTAX_UNSUPPORTED",
        message: `TypeScript source ${relativePath} has syntax diagnostics.`,
        expected:
          "parseable TypeScript source before architectural verification",
        observed: relativePath,
        repair: "Repair the syntax errors and rerun verification.",
      });
    }
    documents.push({
      relativePath,
      sourceFile: ts.createSourceFile(
        relativePath,
        source,
        ts.ScriptTarget.ES2022,
        true,
        scriptKind(relativePath),
      ),
    });
  }
  return { kind: "ready", documents };
}

function importCandidates(
  containingPath: string,
  specifier: string,
): Set<string> {
  if (!specifier.startsWith(".")) return new Set();
  const base = posix.normalize(
    posix.join(posix.dirname(containingPath), specifier),
  );
  const extension = posix.extname(base);
  const stem = extension === "" ? base : base.slice(0, -extension.length);
  const candidates = new Set<string>([base]);
  for (const sourceExtension of supportedExtensions) {
    candidates.add(`${extension === "" ? base : stem}${sourceExtension}`);
    candidates.add(`${base}/index${sourceExtension}`);
  }
  return candidates;
}

function resolvesToTarget(
  containingPath: string,
  specifier: string,
  modulePath: string,
): boolean {
  return importCandidates(containingPath, specifier).has(modulePath);
}

function moduleText(node: ts.Expression | undefined): string | undefined {
  return node !== undefined && ts.isStringLiteralLike(node)
    ? node.text
    : undefined;
}

function isTypeOnlyImport(element: ts.ImportSpecifier): boolean {
  return element
    .getChildren()
    .some(({ kind }) => kind === ts.SyntaxKind.TypeKeyword);
}

function scriptKind(relativePath: string): ts.ScriptKind {
  return extname(relativePath).toLowerCase() === ".tsx"
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
}

function hasExportedSymbol(
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

function importedObjectIsUsed(
  sourceFile: ts.SourceFile,
  declarationName: ts.Identifier,
): boolean {
  let found = false;
  function visit(node: ts.Node): void {
    if (found) return;
    if (
      ts.isIdentifier(node) &&
      node.text === declarationName.text &&
      node !== declarationName
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
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

function targetImportDetails(
  document: SourceDocument,
  target: WriteTarget,
):
  | { ok: true; localNames: Set<string> }
  | { ok: false; outcome: Exclude<FactAdapterOutcome, { kind: "observed" }> } {
  const localNames = new Set<string>();
  for (const statement of document.sourceFile.statements) {
    if (ts.isImportEqualsDeclaration(statement)) {
      return {
        ok: false,
        outcome: unsupported({
          code: "SOURCE_GRAPH_IMPORT_FORM_UNSUPPORTED",
          message: `TypeScript import assignment occurs in ${document.relativePath}.`,
          expected: "ECMAScript direct relative named imports",
          observed: document.relativePath,
          repair:
            "Replace the import assignment or provide an import-assignment-aware resolver.",
        }),
      };
    }
    if (ts.isImportDeclaration(statement)) {
      const specifier = moduleText(statement.moduleSpecifier);
      if (specifier === undefined) continue;
      const matches = resolvesToTarget(
        document.relativePath,
        specifier,
        target.modulePath,
      );
      const clause = statement.importClause;
      const named = clause?.namedBindings;
      const importsTargetName =
        named !== undefined &&
        ts.isNamedImports(named) &&
        named.elements.some(
          (element) =>
            !isTypeOnlyImport(element) &&
            (element.propertyName?.text ?? element.name.text) ===
              target.exportName,
        );
      const indirectObjectUse =
        (clause?.name !== undefined &&
          importedObjectIsUsed(document.sourceFile, clause.name)) ||
        (named !== undefined &&
          ts.isNamespaceImport(named) &&
          importedObjectIsUsed(document.sourceFile, named.name));
      if (!matches && (importsTargetName || indirectObjectUse)) {
        return {
          ok: false,
          outcome: unsupported({
            code: "SOURCE_GRAPH_PATH_ALIAS_UNSUPPORTED",
            message: `Import ${specifier} in ${document.relativePath} may alias write symbol ${target.exportName}.`,
            expected:
              "a direct relative named import resolvable to the mapped module",
            observed: `${document.relativePath}:${specifier}`,
            repair:
              "Replace the path alias or add a tsconfig-aware source adapter.",
          }),
        };
      }
      if (!matches || clause?.phaseModifier === ts.SyntaxKind.TypeKeyword)
        continue;
      if (
        clause?.name !== undefined ||
        (named !== undefined && ts.isNamespaceImport(named))
      ) {
        return {
          ok: false,
          outcome: unsupported({
            code: "SOURCE_GRAPH_IMPORT_FORM_UNSUPPORTED",
            message: `Write target ${target.selector} uses a default or namespace import in ${document.relativePath}.`,
            expected: "a direct named import of the mapped write symbol",
            observed: document.relativePath,
            repair: "Use a named import or provide a stronger symbol resolver.",
          }),
        };
      }
      if (named !== undefined && ts.isNamedImports(named)) {
        for (const element of named.elements) {
          if (
            !isTypeOnlyImport(element) &&
            (element.propertyName?.text ?? element.name.text) ===
              target.exportName
          ) {
            localNames.add(element.name.text);
          }
        }
      }
      continue;
    }
    if (ts.isExportDeclaration(statement)) {
      const specifier = moduleText(statement.moduleSpecifier);
      if (specifier === undefined) continue;
      const matches = resolvesToTarget(
        document.relativePath,
        specifier,
        target.modulePath,
      );
      const exportsTarget =
        statement.exportClause === undefined ||
        ts.isNamespaceExport(statement.exportClause) ||
        (ts.isNamedExports(statement.exportClause) &&
          statement.exportClause.elements.some(
            (element) =>
              (element.propertyName?.text ?? element.name.text) ===
              target.exportName,
          ));
      if (exportsTarget) {
        return {
          ok: false,
          outcome: unsupported({
            code: matches
              ? "SOURCE_GRAPH_REEXPORT_UNSUPPORTED"
              : "SOURCE_GRAPH_PATH_ALIAS_UNSUPPORTED",
            message: `Write symbol ${target.exportName} is re-exported by ${document.relativePath}.`,
            expected: "direct imports from the declared write target module",
            observed: document.relativePath,
            repair:
              "Import the write symbol directly or provide re-export-aware resolution.",
          }),
        };
      }
    }
  }
  return { ok: true, localNames };
}

function writerPaths(
  documents: SourceDocument[],
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
  if (!hasExportedSymbol(moduleDocument.sourceFile, target.exportName)) {
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

  const writers = new Set<string>();
  for (const document of documents) {
    const importDetails = targetImportDetails(document, target);
    if (!importDetails.ok) return importDetails;
    const localNames = importDetails.localNames;

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
          (localNames.has(node.expression.text) ||
            (document.relativePath === target.modulePath &&
              node.expression.text === target.exportName))
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
        localNames.has(node.text) &&
        !ts.isImportSpecifier(node.parent)
      ) {
        const directCall =
          ts.isCallExpression(node.parent) && node.parent.expression === node;
        if (!directCall) {
          failure = unsupported({
            code: "SOURCE_GRAPH_ALIAS_UNSUPPORTED",
            message: `Write symbol ${node.text} is used indirectly in ${document.relativePath}.`,
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
      if (!ts.isImportDeclaration(statement)) visit(statement);
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

    this.inventory ??= loadSourceInventory(this.targetRoot, this.mapping);
    const inventory = await this.inventory;
    if (inventory.kind !== "ready") return inventory;
    const result = writerPaths(inventory.documents, target);
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
  return {
    ok: true,
    mappingPath: input.mappingPath,
    adapter: new TypeScriptWriteAuthorityAdapter(
      input.targetRoot,
      loaded.mapping,
    ),
  };
}
