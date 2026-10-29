import { checkTeam, type ParseResult } from "./team";
import type { ProviderInfo } from "./validate";

const text = { type: "string", minLength: 1 } as const;

/** The planner agent's `outputSchema`: a complete team file, every field present. */
export const TEAM_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["version", "goal", "orchestrator", "roles"],
  properties: {
    version: { type: "integer", const: 1 },
    goal: { type: "string" },
    orchestrator: {
      type: "object",
      additionalProperties: false,
      required: ["workspace", "provider", "model"],
      properties: { workspace: text, provider: text, model: text },
    },
    roles: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "workspace", "provider", "model", "folders", "instructions"],
        properties: { name: text, workspace: text, provider: text, model: text, folders: { type: "array", items: text }, instructions: { type: "string" } },
      },
    },
  },
};

// outputSchema isn't enforced by every provider (Claude answered with its own key names),
// so the prompt shows the exact shape too.
const EXAMPLE = {
  version: 1,
  goal: "<the goal>",
  orchestrator: { workspace: "orchestrator", provider: "<provider id>", model: "<model id>" },
  roles: [{ name: "<role>", workspace: "<role>", provider: "<provider id>", model: "<model id>", folders: ["<relative/path>"], instructions: "<what this role does>" }],
};

/** Asks a planner agent to propose a team for the goal, using only models this host can run. */
export function plannerPrompt(goal: string, catalog: readonly ProviderInfo[]): string {
  const models = catalog.filter((provider) => provider.ready).map((provider) => `- ${provider.id}: ${provider.models.map((model) => model.id).join(", ")}`);
  return [
    "Propose an agent team for this project. Each role gets its own Paseo workspace and runs on its own provider and model; an orchestrator hands work to them.",
    "",
    `Goal: ${goal.trim()}`,
    "",
    "Providers and model ids available on this host (use these exact ids, nothing else):",
    ...models,
    "",
    "Rules:",
    "- Look around the repository to fit roles and folders to what is there. Do not create, change or delete any file.",
    "- Pick 2 to 6 roles that do clearly separate work. Prefer different providers where they suit the work better (for example one provider for visual design, another for audio).",
    "- Give each role a short lowercase name, the same short lowercase workspace, the folders it owns (relative paths, may be empty), and one or two sentences of instructions.",
    '- The orchestrator gets the workspace "orchestrator" and a strong reasoning model.',
    "- Set version to 1 and goal to the goal above.",
    "- Answer with JSON only, using exactly these keys and no others:",
    JSON.stringify(EXAMPLE, null, 2),
  ].join("\n");
}

/** Reads the planner's final message as a team, tolerating a code fence or text around the JSON. */
export function extractProposal(message: string | null): ParseResult {
  if (!message?.trim()) return { ok: false, errors: ["the planner finished without an answer"] };
  const start = message.indexOf("{");
  const end = message.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, errors: ["the planner's answer has no JSON team"] };
  let value: unknown;
  try {
    value = JSON.parse(message.slice(start, end + 1));
  } catch (error) {
    return { ok: false, errors: [`the planner's answer is not valid JSON: ${(error as Error).message}`] };
  }
  return checkTeam(value);
}
