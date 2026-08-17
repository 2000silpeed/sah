import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import formatsImport, { type FormatsPlugin } from "ajv-formats";

import type { DiagnosticCategory, SahDiagnostic } from "./contracts.js";
import { escapePointer } from "./diagnostics.js";

const schemaFiles = [
  "design-bundle-manifest.schema.json",
  "system-characterization.schema.json",
  "design-strategy.schema.json",
  "responsibility.schema.json",
  "invariant.schema.json",
  "architecture.schema.json",
  "architecture-decision.schema.json",
  "implementation-handoff.schema.json",
  "typescript-source-mapping.schema.json",
  "verification-check.schema.json",
  "verification-diagnostic.schema.json",
  "verification-record.schema.json",
  "verification-result.schema.json",
] as const;

const schemaDirectory = fileURLToPath(new URL("../schemas/", import.meta.url));
const addFormats = formatsImport as unknown as FormatsPlugin;

type JsonObject = Record<string, unknown>;

export type SchemaDocument = {
  file: string;
  path: string;
  id: string;
  schema: JsonObject;
};

export type SchemaRegistry = {
  documents: SchemaDocument[];
  validate: (
    schemaId: string,
    data: unknown,
    artifactPath: string,
    category?: DiagnosticCategory,
  ) => SahDiagnostic[];
};

type RegistryLoadResult =
  | { ok: true; registry: SchemaRegistry }
  | { ok: false; diagnostics: SahDiagnostic[] };

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyStringArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "string" && entry.length > 0)
  );
}

export function auditSchemaTraces(
  schema: unknown,
  artifactPath: string,
  category: DiagnosticCategory = "operational",
): SahDiagnostic[] {
  const diagnostics: SahDiagnostic[] = [];

  function visit(value: unknown, pointer: string): void {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${pointer}/${index}`));
      return;
    }
    if (!isObject(value)) return;

    const properties = value.properties;
    if (isObject(properties)) {
      for (const [name, propertySchema] of Object.entries(properties)) {
        const propertyPointer = `${pointer}/properties/${escapePointer(name)}`;
        const trace = isObject(propertySchema)
          ? propertySchema["x-sah-trace"]
          : undefined;
        const writtenBy = isObject(trace) ? trace.writtenBy : undefined;
        const readBy = isObject(trace) ? trace.readBy : undefined;

        if (!nonEmptyStringArray(writtenBy)) {
          diagnostics.push({
            code: "SCHEMA_TRACE_WRITTEN_BY_MISSING",
            category,
            capability: "Required field trace annotations",
            classification: "deterministic",
            severity: "error",
            artifactPath,
            jsonPointer: propertyPointer,
            message: `Schema property ${name} has no non-empty writer trace.`,
            expected:
              "x-sah-trace.writtenBy contains at least one non-empty writer",
            repair:
              "Add the producing stage or bundle writer to the schema property trace.",
          });
        }
        if (!nonEmptyStringArray(readBy)) {
          diagnostics.push({
            code: "SCHEMA_TRACE_READ_BY_MISSING",
            category,
            capability: "Required field trace annotations",
            classification: "deterministic",
            severity: "error",
            artifactPath,
            jsonPointer: propertyPointer,
            message: `Schema property ${name} has no non-empty reader trace.`,
            expected:
              "x-sah-trace.readBy contains at least one non-empty reader",
            repair:
              "Add a real downstream consumer or delete the unused schema property.",
          });
        }
      }
    }

    for (const [key, child] of Object.entries(value)) {
      visit(child, `${pointer}/${escapePointer(key)}`);
    }
  }

  visit(schema, "");
  return diagnostics;
}

function errorPointer(error: ErrorObject): string {
  const parameters = error.params as Record<string, unknown>;
  if (
    error.keyword === "required" &&
    typeof parameters.missingProperty === "string"
  ) {
    return `${error.instancePath}/${escapePointer(parameters.missingProperty)}`;
  }
  if (
    error.keyword === "additionalProperties" &&
    typeof parameters.additionalProperty === "string"
  ) {
    return `${error.instancePath}/${escapePointer(parameters.additionalProperty)}`;
  }
  return error.instancePath;
}

function expectation(error: ErrorObject): string {
  const parameters = error.params as Record<string, unknown>;
  switch (error.keyword) {
    case "required":
      return `property ${String(parameters.missingProperty)} to be present`;
    case "additionalProperties":
      return `property ${String(parameters.additionalProperty)} to be absent`;
    case "type":
      return `JSON type ${String(parameters.type)}`;
    case "format":
      return `format ${String(parameters.format)}`;
    case "const":
      return `constant value ${JSON.stringify(parameters.allowedValue)}`;
    case "enum":
      return `one of ${JSON.stringify(parameters.allowedValues)}`;
    case "pattern":
      return `a string matching ${String(parameters.pattern)}`;
    default:
      return error.message === undefined
        ? `schema keyword ${error.keyword}`
        : error.message;
  }
}

function schemaCode(keyword: string): string {
  return `SCHEMA_${keyword.replaceAll(/[^a-zA-Z0-9]+/g, "_").toUpperCase()}`;
}

function translateErrors(
  errors: ErrorObject[] | null | undefined,
  artifactPath: string,
  category: DiagnosticCategory,
): SahDiagnostic[] {
  return (errors ?? []).map((error) => ({
    code: schemaCode(error.keyword),
    category,
    capability: "JSON Schema shape and formats",
    classification: "deterministic",
    severity: "error",
    artifactPath,
    jsonPointer: errorPointer(error),
    message: `Value at ${errorPointer(error) || "/"} violates ${error.keyword}.`,
    expected: expectation(error),
    repair:
      category === "operational"
        ? "Repair the bundle manifest before validation can continue."
        : "Repair this field in its owning reasoning stage and revalidate the bundle.",
  }));
}

export async function loadSchemaRegistry(): Promise<RegistryLoadResult> {
  const documents: SchemaDocument[] = [];
  try {
    for (const file of schemaFiles) {
      const path = `${schemaDirectory}${file}`;
      const schema = JSON.parse(await readFile(path, "utf8")) as unknown;
      if (!isObject(schema) || typeof schema.$id !== "string") {
        throw new Error(`${file} has no schema $id`);
      }
      if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
        throw new Error(`${file} does not declare Draft 2020-12`);
      }
      documents.push({ file, path, id: schema.$id, schema });
    }

    const traceDiagnostics = documents.flatMap(({ file, schema }) =>
      auditSchemaTraces(schema, `schemas/${file}`),
    );
    if (traceDiagnostics.length > 0)
      return { ok: false, diagnostics: traceDiagnostics };

    const ajv = new Ajv2020({
      allErrors: true,
      strict: true,
      validateFormats: true,
    });
    ajv.addKeyword({
      keyword: "x-sah-trace",
      schemaType: "object",
      valid: true,
    });
    addFormats(ajv);
    for (const { schema } of documents) ajv.addSchema(schema);

    const validators = new Map<string, ValidateFunction>();
    for (const { id } of documents) {
      const validator = ajv.getSchema(id);
      if (validator === undefined)
        throw new Error(`Schema ${id} was not registered`);
      validators.set(id, validator);
    }

    return {
      ok: true,
      registry: {
        documents,
        validate: (schemaId, data, artifactPath, category = "validation") => {
          const validator = validators.get(schemaId);
          if (validator === undefined) {
            return [
              {
                code: "SCHEMA_ID_UNSUPPORTED",
                category: "operational",
                capability: "JSON Schema shape and formats",
                severity: "error",
                artifactPath,
                reference: schemaId,
                message: `Declared schema ${schemaId} is not installed.`,
                expected: "a canonical schema ID shipped with this SAH version",
                repair:
                  "Use the schema ID required for this artifact role or upgrade SAH.",
              },
            ];
          }
          return validator(data)
            ? []
            : translateErrors(validator.errors, artifactPath, category);
        },
      },
    };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "SCHEMA_REGISTRY_FAILURE",
          category: "operational",
          capability: "JSON Schema shape and formats",
          severity: "error",
          artifactPath: "schemas",
          message:
            error instanceof Error
              ? error.message
              : "The schema registry failed to load.",
          expected:
            "valid installed Draft 2020-12 schemas with unique $id values",
          repair:
            "Reinstall or repair the SAH package before validating a design bundle.",
        },
      ],
    };
  }
}
