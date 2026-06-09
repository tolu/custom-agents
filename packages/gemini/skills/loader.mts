import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Type, type FunctionDeclaration } from "@google/genai";

// The Copilot SDK ingests skill directories natively (frontmatter description
// drives discovery, body is injected on invoke). @google/genai has no such
// concept, so we replicate it: parse each SKILL.md's frontmatter, advertise the
// descriptions to the model, and expose a `use_skill` tool that returns a
// skill's body when the model decides it's relevant.

export type Skill = { name: string; description: string; body: string };

const FRONTMATTER = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

const parseSkill = (raw: string): Skill => {
  const match = raw.match(FRONTMATTER);
  if (!match) throw new Error("SKILL.md missing frontmatter");
  const [, fm, body] = match;
  const field = (key: string) =>
    fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? "";
  return { name: field("name"), description: field("description"), body: body.trim() };
};

export const loadSkills = (dir: string): Skill[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => parseSkill(readFileSync(join(dir, e.name, "SKILL.md"), "utf8")))
    .filter((s) => s.name);

// The tool name we use to surface skills — main.mts watches for it to log a
// distinct skill-invocation event (mirroring Copilot's `skill.invoked`).
export const USE_SKILL = "use_skill";

export const makeSkillTool = (skills: Skill[]) => ({
  declaration: {
    name: USE_SKILL,
    description:
      "Load the instructions for a named skill before answering. Available skills:\n" +
      skills.map((s) => `- ${s.name}: ${s.description}`).join("\n"),
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "The skill to load",
          enum: skills.map((s) => s.name),
        },
      },
      required: ["name"],
    },
  } satisfies FunctionDeclaration,
  handler: ({ name }: { name: string }) => {
    const skill = skills.find((s) => s.name === name);
    if (!skill) return { error: `Unknown skill: ${name}` };
    return { name: skill.name, instructions: skill.body };
  },
});
