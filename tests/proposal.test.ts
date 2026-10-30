import { describe, expect, it } from "vitest";
import { extractProposal, plannerPrompt, ROLE_JSON_SCHEMA, TEAM_JSON_SCHEMA } from "../shared/proposal";
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

  it("shows roles with an empty workspace in the example", () => {
    const example = JSON.parse(prompt.slice(prompt.indexOf("{"), prompt.lastIndexOf("}") + 1));
    expect(example.roles[0].workspace).toBe("");
  });

  it("tells the planner to leave workspaces empty unless a role needs a separate one", () => {
    expect(prompt).toMatch(/empty string/);
    expect(prompt).toMatch(/orchestrator's workspace/);
    expect(prompt).toMatch(/separate/);
  });
});

describe("TEAM_JSON_SCHEMA", () => {
  it("requires the fields the team file needs", () => {
    expect(TEAM_JSON_SCHEMA.required).toEqual(["version", "goal", "orchestrator", "roles"]);
  });

  it("keeps a role's workspace required but lets it be an empty string", () => {
    const role = TEAM_JSON_SCHEMA.properties.roles.items;
    expect(role.required).toContain("workspace");
    expect(role.properties.workspace).toEqual({ type: "string" });
    expect(ROLE_JSON_SCHEMA.properties.workspace).toEqual({ type: "string" });
  });

  it("still requires the orchestrator's workspace to be non-empty", () => {
    expect(TEAM_JSON_SCHEMA.properties.orchestrator.properties.workspace).toEqual({ type: "string", minLength: 1 });
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

  it("accepts a proposal whose roles have an empty workspace", () => {
    const shared = { ...proposal, roles: [{ ...proposal.roles[0], workspace: "" }] };
    expect(extractProposal(JSON.stringify(shared))).toMatchObject({ ok: true, team: { roles: [{ workspace: "" }] } });
  });

  it("fails clearly when there is no answer", () => {
    expect(extractProposal(null)).toEqual({ ok: false, errors: ["the planner finished without an answer"] });
    expect(extractProposal("I could not decide").ok).toBe(false);
  });
});
