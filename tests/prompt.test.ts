import { describe, expect, it } from "vitest";
import { orchestratorPrompt } from "../shared/prompt";
import type { Team } from "../shared/team";

const team: Team = {
  version: 1,
  goal: "2D platformer game",
  orchestrator: { workspace: "orchestrator", provider: "claude", model: "claude-opus-5-5" },
  roles: [
    { name: "design", workspace: "design", provider: "codex", model: "gpt-6.1-sol", folders: ["src/ui", "assets/images"], instructions: "Owns UI and art." },
    { name: "sound", workspace: "sound", provider: "antigravity", model: "gemini-4-argon-high", folders: [], instructions: "" },
  ],
};

describe("orchestratorPrompt", () => {
  const prompt = orchestratorPrompt(team);

  it("states the goal and the team file", () => {
    expect(prompt).toContain("2D platformer game");
    expect(prompt).toContain(".agents/team.json");
  });

  it("lists every role with its workspace, provider/model and folders", () => {
    expect(prompt).toContain("| design | design | codex/gpt-6.1-sol | src/ui, assets/images |");
    expect(prompt).toContain("| sound | sound | antigravity/gemini-4-argon-high | (any) |");
    expect(prompt).toContain("- design: Owns UI and art.");
  });

  it("tells it how to delegate with the role's own provider and model", () => {
    expect(prompt).toContain("paseo run --workspace <workspace-id> --provider <provider>/<model>");
    expect(prompt).toContain("--mode auto");
    expect(prompt).toMatch(/already has an agent.*send/s);
    expect(prompt).toMatch(/wait/);
  });

  it("omits the role notes section when no role has instructions", () => {
    const bare = orchestratorPrompt({ ...team, roles: [team.roles[1]!] });
    expect(bare).not.toContain("Role notes");
  });
});
