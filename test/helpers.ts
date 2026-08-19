import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const fixtureDirectory = join(repositoryRoot, "fixtures", "simple-crud");
export const verificationTargetDirectory = join(
  repositoryRoot,
  "fixtures",
  "s13-target",
);
export const typescriptTargetDirectory = join(
  repositoryRoot,
  "fixtures",
  "s13-typescript-target",
);
export const iterationLoopFixtureDirectory = join(
  repositoryRoot,
  "fixtures",
  "iteration-loop",
);
export const cliPath = join(repositoryRoot, "dist", "cli.js");

const temporaryDirectories: string[] = [];

export async function copyFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "sah-test-"));
  const bundle = join(root, "bundle");
  await cp(fixtureDirectory, bundle, { recursive: true });
  temporaryDirectories.push(root);
  return bundle;
}

export async function copyVerificationTarget(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "sah-target-test-"));
  const target = join(root, "target");
  await cp(verificationTargetDirectory, target, { recursive: true });
  temporaryDirectories.push(root);
  return target;
}

export async function copyTypeScriptTarget(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "sah-typescript-target-test-"));
  const target = join(root, "target");
  await cp(typescriptTargetDirectory, target, { recursive: true });
  temporaryDirectories.push(root);
  return target;
}

export async function copyIterationLoop(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "sah-loop-test-"));
  const loop = join(root, "loop");
  await cp(iterationLoopFixtureDirectory, loop, { recursive: true });
  temporaryDirectories.push(root);
  return loop;
}

export async function mutateJson<T>(
  bundle: string,
  file: string,
  mutate: (value: T) => void,
): Promise<void> {
  const path = join(bundle, file);
  const value = JSON.parse(await readFile(path, "utf8")) as T;
  mutate(value);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function cleanupFixtures(): Promise<void> {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        recursive: true,
        force: true,
      }),
    ),
  );
}
