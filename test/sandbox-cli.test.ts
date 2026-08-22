import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { cliPath } from "./helpers.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

type ProcessResult = {
  code: number;
  stdout: string;
  stderr: string;
};

async function runDirectCli(
  arguments_: string[],
  environment: Record<string, string>,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...arguments_], {
      cwd: process.cwd(),
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

describe("sandbox-safe direct CLI", () => {
  it("runs read-only commands without creating HOME or npm state", async () => {
    const root = await mkdtemp(join(tmpdir(), "sah-sandbox-cli-test-"));
    temporaryDirectories.push(root);
    const home = join(root, "home");
    const cache = join(root, "npm-cache");
    const userConfig = join(root, "npmrc");
    const environment = {
      HOME: home,
      npm_config_cache: cache,
      NPM_CONFIG_USERCONFIG: userConfig,
      npm_config_userconfig: userConfig,
    };

    const validation = await runDirectCli(
      ["validate", "fixtures/simple-crud", "--json"],
      environment,
    );
    const lineage = await runDirectCli(
      ["lineage", "fixtures/bookmark-lineage", "--json"],
      environment,
    );
    const current = await runDirectCli(
      ["current", "fixtures/bookmark-lineage", "--json"],
      environment,
    );

    expect(validation.code).toBe(0);
    expect(validation.stderr).toBe("");
    expect((JSON.parse(validation.stdout) as { status: string }).status).toBe(
      "passed",
    );
    expect(lineage.code).toBe(0);
    expect(lineage.stderr).toBe("");
    expect((JSON.parse(lineage.stdout) as { status: string }).status).toBe(
      "passed",
    );
    expect(current.code).toBe(0);
    expect(current.stderr).toBe("");
    expect((JSON.parse(current.stdout) as { status: string }).status).toBe(
      "ready",
    );
    expect(await exists(home)).toBe(false);
    expect(await exists(cache)).toBe(false);
    expect(await exists(userConfig)).toBe(false);
  });
});
