import { randomUUID } from "node:crypto";
import { chmod, open, readFile, rename, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import type { SahDiagnostic } from "./contracts.js";

export type AtomicManifestResult =
  { ok: true } | { ok: false; diagnostic: SahDiagnostic };

function failure(
  code: string,
  message: string,
  repair: string,
  artifactPath = "sah.bundle.json",
): AtomicManifestResult {
  return {
    ok: false,
    diagnostic: {
      code,
      category: "operational",
      capability: "Atomic bundle lifecycle update",
      severity: "error",
      artifactPath,
      message,
      expected:
        "the manifest to remain unchanged until one atomic same-directory replacement commits",
      repair,
    },
  };
}

export async function replaceManifestAtomically(input: {
  manifestPath: string;
  expectedSource: Uint8Array;
  manifest: unknown;
  mode: number;
  expectedCompanions?: ReadonlyArray<{
    path: string;
    artifactPath: string;
    source: Uint8Array;
  }>;
}): Promise<AtomicManifestResult> {
  const manifestDirectory = dirname(input.manifestPath);
  const temporaryPath = join(
    manifestDirectory,
    `.${basename(input.manifestPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let temporaryCreated = false;
  let handle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    handle = await open(temporaryPath, "wx", input.mode & 0o7777);
    temporaryCreated = true;
    await handle.writeFile(
      `${JSON.stringify(input.manifest, null, 2)}\n`,
      "utf8",
    );
    await handle.sync();
    await handle.close();
    handle = undefined;
    await chmod(temporaryPath, input.mode & 0o7777);

    for (const companion of input.expectedCompanions ?? []) {
      const currentCompanion = await readFile(companion.path);
      if (!currentCompanion.equals(Buffer.from(companion.source))) {
        return failure(
          "VERIFICATION_RECORD_CHANGED_DURING_ADVANCE",
          `${companion.artifactPath} changed after its completion evidence was loaded; S13 was not committed.`,
          "Review the changed record, create fresh full-verification evidence, and retry advancement.",
          companion.artifactPath,
        );
      }
    }

    const currentSource = await readFile(input.manifestPath);
    if (!currentSource.equals(Buffer.from(input.expectedSource))) {
      return failure(
        "BUNDLE_CHANGED_DURING_ADVANCE",
        "sah.bundle.json changed after the bundle was loaded; the proposed stage was not committed.",
        "Review the concurrent change, revalidate the current bundle, and retry the advance command.",
      );
    }

    await rename(temporaryPath, input.manifestPath);
    temporaryCreated = false;
    return { ok: true };
  } catch (error) {
    return failure(
      "MANIFEST_ADVANCE_WRITE_FAILED",
      error instanceof Error
        ? error.message
        : "The advanced manifest could not be written atomically.",
      "Confirm the bundle directory is writable and retry without another writer modifying the manifest.",
    );
  } finally {
    if (handle !== undefined) {
      await handle.close().catch(() => undefined);
    }
    if (temporaryCreated) {
      await unlink(temporaryPath).catch(() => undefined);
    }
  }
}
