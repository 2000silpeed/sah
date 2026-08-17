import { constants } from "node:fs";
import { access, lstat, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type {
  CodeFactAdapter,
  FactAdapterFailure,
  FactAdapterOutcome,
  ObservableContract,
} from "./code-fact-adapter.js";

export const filesystemPresenceCapability = "filesystem-artifact-presence";

type AdapterPreparation =
  | {
      ok: true;
      targetRoot: string;
      adapter: CodeFactAdapter;
    }
  | {
      ok: false;
      targetDirectory: string;
      failure: FactAdapterFailure;
    };

function isWithin(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot === "" ||
    (pathFromRoot !== ".." &&
      !pathFromRoot.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromRoot))
  );
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
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

function unsupportedSelector(
  observable: ObservableContract,
): FactAdapterOutcome | undefined {
  if (
    observable.factSource !== "filesystem" ||
    observable.predicate !== "regular-file-exists" ||
    observable.expected !== "true"
  ) {
    return {
      kind: "unsupported",
      code: "CONSTRAINT_BINDING_UNSUPPORTED",
      message: `The filesystem adapter cannot evaluate ${observable.factSource}/${observable.predicate}/${observable.expected}.`,
      expected:
        "factSource filesystem, predicate regular-file-exists, and expected true",
      observed: `${observable.factSource}/${observable.predicate}/${observable.expected}`,
      repair:
        "Compile this constraint to the supported tuple in S11 or provide a matching adapter.",
    };
  }

  const segments = observable.selector.split("/");
  if (
    observable.selector.trim() === "" ||
    isAbsolute(observable.selector) ||
    /^[A-Za-z]:/u.test(observable.selector) ||
    observable.selector.includes("\\") ||
    hasControlCharacter(observable.selector) ||
    segments.some((segment) => ["", ".", ".."].includes(segment))
  ) {
    return {
      kind: "unsupported",
      code: "CONSTRAINT_BINDING_UNSAFE",
      message: `Filesystem selector ${JSON.stringify(observable.selector)} is not a confined normalized relative path.`,
      expected:
        "a non-empty forward-slash relative path with no drive, control character, empty, dot, parent, or backslash segment",
      observed: JSON.stringify(observable.selector),
      repair:
        "Rewrite the selector in S11 as a normalized path inside the explicit verification target.",
    };
  }
  return undefined;
}

class FilesystemPresenceAdapter implements CodeFactAdapter {
  readonly capability = filesystemPresenceCapability;

  constructor(private readonly targetRoot: string) {}

  async observe(observable: ObservableContract): Promise<FactAdapterOutcome> {
    const unsupported = unsupportedSelector(observable);
    if (unsupported !== undefined) return unsupported;

    const segments = observable.selector.split("/");
    let current = this.targetRoot;
    for (const [index, segment] of segments.entries()) {
      const next = resolve(current, segment);
      if (!isWithin(this.targetRoot, next)) {
        return {
          kind: "unsupported",
          code: "CONSTRAINT_BINDING_UNSAFE",
          message: `Filesystem selector ${observable.selector} resolves outside the verification target.`,
          expected:
            "a physical target confined inside the verification target root",
          observed: next,
          repair:
            "Remove the escaping path or symlink and bind the constraint to a target-local artifact.",
        };
      }

      let entry: Awaited<ReturnType<typeof lstat>>;
      try {
        entry = await lstat(next);
      } catch (error) {
        if (isMissing(error)) {
          return {
            kind: "observed",
            matches: false,
            observed: `missing path ${observable.selector}`,
          };
        }
        return {
          kind: "operational-error",
          code: "FACT_ADAPTER_EXECUTION_FAILED",
          message:
            error instanceof Error
              ? error.message
              : `Cannot inspect ${observable.selector}.`,
          expected:
            "readable filesystem metadata inside the verification target",
          repair:
            "Restore metadata access to the target path and rerun verification.",
        };
      }

      if (entry.isSymbolicLink()) {
        let physical: string;
        try {
          physical = await realpath(next);
        } catch (error) {
          if (isMissing(error)) {
            return {
              kind: "observed",
              matches: false,
              observed: `broken symlink at ${observable.selector}`,
            };
          }
          return {
            kind: "operational-error",
            code: "FACT_ADAPTER_EXECUTION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : `Cannot resolve ${observable.selector}.`,
            expected: "a safely resolvable target-local path",
            repair:
              "Repair or remove the unreadable symlink and rerun verification.",
          };
        }
        if (!isWithin(this.targetRoot, physical)) {
          return {
            kind: "unsupported",
            code: "CONSTRAINT_BINDING_UNSAFE",
            message: `Filesystem selector ${observable.selector} escapes the verification target through a symlink.`,
            expected:
              "every physical path component to remain inside the target root",
            observed: physical,
            repair:
              "Replace the escaping symlink with a target-local artifact or revise the selector.",
          };
        }
        current = physical;
        try {
          entry = await stat(current);
        } catch (error) {
          return {
            kind: "operational-error",
            code: "FACT_ADAPTER_EXECUTION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : `Cannot inspect ${observable.selector}.`,
            expected:
              "readable filesystem metadata inside the verification target",
            repair:
              "Restore metadata access to the target path and rerun verification.",
          };
        }
      } else {
        current = next;
      }

      const final = index === segments.length - 1;
      if (!final && !entry.isDirectory()) {
        return {
          kind: "observed",
          matches: false,
          observed: `non-directory ancestor in ${observable.selector}`,
        };
      }
      if (final) {
        return {
          kind: "observed",
          matches: entry.isFile(),
          observed: entry.isFile()
            ? `regular file exists at ${observable.selector}`
            : `path is not a regular file at ${observable.selector}`,
        };
      }
    }

    return {
      kind: "unsupported",
      code: "CONSTRAINT_BINDING_UNSAFE",
      message: "The filesystem selector has no path segments.",
      expected: "a non-empty target-relative file path",
      repair: "Add a target-relative selector in S11.",
    };
  }
}

export async function prepareFilesystemPresenceAdapter(
  targetDirectory: string,
): Promise<AdapterPreparation> {
  if (targetDirectory.trim() === "") {
    return {
      ok: false,
      targetDirectory,
      failure: {
        kind: "operational-error",
        code: "VERIFICATION_TARGET_UNREADABLE",
        message: "The verification target directory is empty.",
        expected: "an explicit existing readable target directory",
        repair: "Pass the target checkout directory to sah verify.",
      },
    };
  }
  const requestedTarget = resolve(targetDirectory);
  try {
    const targetRoot = await realpath(requestedTarget);
    await access(targetRoot, constants.R_OK | constants.X_OK);
    if (!(await stat(targetRoot)).isDirectory()) {
      throw new Error(`${targetDirectory} is not a directory`);
    }
    return {
      ok: true,
      targetRoot,
      adapter: new FilesystemPresenceAdapter(targetRoot),
    };
  } catch (error) {
    return {
      ok: false,
      targetDirectory: requestedTarget,
      failure: {
        kind: "operational-error",
        code: "VERIFICATION_TARGET_UNREADABLE",
        message:
          error instanceof Error
            ? error.message
            : `Cannot open verification target ${targetDirectory}.`,
        expected: "an existing readable target directory",
        repair: "Pass a readable target checkout directory to sah verify.",
      },
    };
  }
}
