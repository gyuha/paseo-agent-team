import { describe, expect, it } from "vitest";
import { extractProposal, plannerPrompt, TEAM_JSON_SCHEMA } from "../shared/proposal";
import type { ProviderInfo } from "../shared/validate";

const catalog: ProviderInfo[] = [
  { id: "claude", ready: true, status: "ready", models: [{ id: "claude-opus-5-5", label: "Opus 5.5" }] },
  { id: "codex", ready: true, status: "ready", models: [{ id: "gpt-6.1-sol", label: "GPT-6.1-Sol" }] },
  { id: "copilot", ready: false, status: "unavailable", models: [{ id: "x", label: "x" }] },
];

const proposal = {
  version: 1,
  goal: "2D platformer game",
  orchestrator: { workspace: "orchestrator", provider: "claude", model: "claude-opus-5-5" },
  roles: [{ name: "design", workspace: "design", provider: "codex", model: "gpt-6.1-sol", folders: ["src/ui"], instructions: "UI" }],
};

describe("plannerPrompt", () => {
  const prompt = plannerPrompt("2D platformer game", catalog);

  it("includes the goal and only ready providers with their model ids", () => {
    expect(prompt).toContain("2D platformer game");
    expect(prompt).toContain("- claude: claude-opus-5-5");
    expect(prompt).toContain("- codex: gpt-6.1-sol");
    expect(prompt).not.toContain("copilot");
  });

  it("shows the exact JSON shape with every key the team file needs", () => {
    const start = prompt.indexOf("{");
    const example = JSON.parse(prompt.slice(start, prompt.lastIndexOf("}") + 1));
    expect(Object.keys(example)).toEqual(["version", "goal", "orchestrator", "roles"]);
    expect(Object.keys(example.orchestrator)).toEqual(["workspace", "provider", "model"]);
    expect(Object.keys(example.roles[0])).toEqual(["name", "workspace", "provider", "model", "folders", "instructions"]);
  });

  it("forbids changing files", () => {
    expect(prompt).toMatch(/do not (create|change|edit)/i);
  });
});

describe("TEAM_JSON_SCHEMA", () => {
  it("requires the fields the team file needs", () => {
    expect(TEAM_JSON_SCHEMA.required).toEqual(["version", "goal", "orchestrator", "roles"]);
  });
});

describe("extractProposal", () => {
  it("parses a bare JSON answer", () => {
    expect(extractProposal(JSON.stringify(proposal))).toMatchObject({ ok: true, team: { roles: [{ name: "design" }] } });
  });

  it("parses JSON wrapped in a code fence with text around it", () => {
    const text = "Here is the team:\n```json\n" + JSON.stringify(proposal, null, 2) + "\n```\nDone.";
    expect(extractProposal(text).ok).toBe(true);
  });

  it("fails clearly when there is no answer", () => {
    expect(extractProposal(null)).toEqual({ ok: false, errors: ["the planner finished without an answer"] });
    expect(extractProposal("I could not decide").ok).toBe(false);
  });
});
