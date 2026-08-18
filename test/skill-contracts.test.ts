import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = join(repositoryRoot, "skills", "sah");

const skillFiles = [
  "SKILL.md",
  "agents/openai.yaml",
  "references/elicitation-and-method-selection.md",
  "references/artifacts-and-lifecycle.md",
  "references/implementation-and-verification.md",
] as const;

async function readSkillFile(
  path: (typeof skillFiles)[number],
): Promise<string> {
  return readFile(join(skillRoot, path), "utf8");
}

describe("portable SAH Agent Skill", () => {
  it("uses a minimal portable skill manifest and valid OpenAI metadata", async () => {
    const skill = await readSkillFile("SKILL.md");
    const match = /^---\n([\s\S]*?)\n---\n/u.exec(skill);

    expect(match).not.toBeNull();
    const frontmatter = match?.[1] ?? "";
    const keys = frontmatter
      .split("\n")
      .map((line) => /^([a-z-]+):/u.exec(line)?.[1])
      .filter((key): key is string => key !== undefined)
      .sort();

    expect(keys).toEqual(["description", "name"]);
    expect(frontmatter).toMatch(/^name: sah$/mu);
    expect(frontmatter).toContain("progressively question the user");

    const openai = await readSkillFile("agents/openai.yaml");
    expect(openai).toContain('display_name: "Software Architect Harness"');
    expect(openai).toContain('default_prompt: "Use $sah');
  });

  it("routes progressive elicitation, artifacts, implementation, and verification", async () => {
    const [skill, elicitation, artifacts, implementation] = await Promise.all([
      readSkillFile("SKILL.md"),
      readSkillFile("references/elicitation-and-method-selection.md"),
      readSkillFile("references/artifacts-and-lifecycle.md"),
      readSkillFile("references/implementation-and-verification.md"),
    ]);

    for (const reference of skillFiles.filter((path) =>
      path.startsWith("references/"),
    )) {
      expect(skill).toContain(reference);
    }
    expect(skill).toContain("Ask one or two questions at a time");
    expect(skill).toContain("Do not stop after producing suggestions or JSON");
    expect(elicitation).toContain("Do not ask the user for facts");
    expect(elicitation).toContain("lower-ceremony reversible option");
    expect(artifacts).toContain("`completedStage: S4`");
    expect(artifacts).toContain("use only `sah advance`");
    expect(implementation).toContain(
      "Implement only slices whose status is `ready`",
    );
    expect(implementation).toContain("`tsconfig.sah.json`");
    expect(implementation).toContain("`full-fallback`");
    expect(implementation).toContain("S13 lifecycle");
  });

  it("keeps the package concise, placeholder-free, and linked from product docs", async () => {
    const contents = await Promise.all(skillFiles.map(readSkillFile));
    const index = await readFile(
      join(repositoryRoot, "docs", "index.md"),
      "utf8",
    );
    const guide = await readFile(
      join(repositoryRoot, "docs", "agent-skill.md"),
      "utf8",
    );

    contents.forEach((content, index_) => {
      expect(content, skillFiles[index_]).not.toMatch(/TODO|placeholder/u);
    });
    expect(contents[0]?.split("\n").length).toBeLessThanOrEqual(500);
    contents.slice(2).forEach((content, index_) => {
      expect(
        content.split("\n").length,
        skillFiles[index_ + 2],
      ).toBeLessThanOrEqual(400);
    });

    for (const path of skillFiles) expect(index).toContain(path);
    expect(guide).toContain("~/.codex/skills");
    expect(guide).toContain("~/.claude/skills");
    expect(guide).toContain("Use $sah");
    expect(guide).toContain("/sah");
  });
});
