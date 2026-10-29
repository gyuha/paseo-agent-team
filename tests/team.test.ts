import { describe, expect, it } from "vitest";
import { parseTeam, serializeTeam, type Team } from "../shared/team";

const team: Team = {
  version: 1,
  goal: "2D platformer game",
  orchestrator: { workspace: "orchestrator", provider: "claude", model: "claude-opus-5-5" },
  roles: [
    { name: "design", workspace: "design", provider: "codex", model: "gpt-6.1-sol", folders: ["src/ui"], instructions: "UI and art" },
    { name: "sound", workspace: "sound", provider: "antigravity", model: "gemini-4-argon-high", folders: ["assets/audio"], instructions: "" },
  ],
};

describe("parseTeam", () => {
  it("accepts a valid team and round-trips through serializeTeam", () => {
    const result = parseTeam(serializeTeam(team));
    expect(result).toEqual({ ok: true, team });
  });

  it("fills defaults for folders, instructions and goal", () => {
    const result = parseTeam(
      JSON.stringify({
        version: 1,
        orchestrator: { workspace: "lead", provider: "claude", model: "claude-opus-5-5" },
        roles: [{ name: "design", workspace: "design", provider: "codex", model: "gpt-6.1-sol" }],
      }),
    );
    expect(result.ok && result.team.roles[0]).toEqual({ name: "design", workspace: "design", provider: "codex", model: "gpt-6.1-sol", folders: [], instructions: "" });
    expect(result.ok && result.team.goal).toBe("");
  });

  it("rejects text that is not JSON", () => {
    const result = parseTeam("{ not json");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]).toMatch(/JSON/);
  });

  it("rejects a role missing its model", () => {
    const broken = { ...team, roles: [{ name: "design", workspace: "design", provider: "codex" }] };
    const result = parseTeam(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join("\n")).toMatch(/roles\.0\.model/);
  });

  it("rejects a team with no roles", () => {
    expect(parseTeam(JSON.stringify({ ...team, roles: [] })).ok).toBe(false);
  });

  it("rejects duplicate role names regardless of case", () => {
    const result = parseTeam(JSON.stringify({ ...team, roles: [team.roles[0], { ...team.roles[1], name: "Design" }] }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join("\n")).toMatch(/duplicate role name "Design"/);
  });

  it("rejects two roles sharing a workspace, including the orchestrator's", () => {
    const shared = parseTeam(JSON.stringify({ ...team, roles: [team.roles[0], { ...team.roles[1], workspace: "design" }] }));
    expect(!shared.ok && shared.errors.join("\n")).toMatch(/workspace "design" is used more than once/);
    const withLead = parseTeam(JSON.stringify({ ...team, roles: [{ ...team.roles[0], workspace: "Orchestrator" }] }));
    expect(!withLead.ok && withLead.errors.join("\n")).toMatch(/workspace "Orchestrator" is used more than once/);
  });
});
