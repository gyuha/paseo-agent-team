import { describe, expect, it } from "vitest";
import { orchestratorPrompt, teamChangedMessage } from "../shared/prompt";
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

const modes = { design: "full-access", sound: undefined };

describe("orchestratorPrompt", () => {
  const prompt = orchestratorPrompt(team, modes);

  it("states the goal and the team file", () => {
    expect(prompt).toContain("2D platformer game");
    expect(prompt).toContain(".agents/team.json");
  });

  it("lists every role with its workspace, provider/model, mode and folders", () => {
    expect(prompt).toContain("| Role | Workspace | Provider/model | Mode | Folders |");
    expect(prompt).toContain("| design | design | codex/gpt-6.1-sol | full-access | src/ui, assets/images |");
    expect(prompt).toContain("| sound | sound | antigravity/gemini-4-argon-high | default | (any) |");
    expect(prompt).toContain("- design: Owns UI and art.");
  });

  it("tells it how to delegate with the role's own provider and model", () => {
    expect(prompt).toContain("paseo run --workspace <workspace-id> --provider <provider>/<model>");
    expect(prompt).toContain("--mode <mode>");
    expect(prompt).toMatch(/omit `--mode` when the Mode is `default`/i);
    expect(prompt).not.toContain("Add `--mode auto` when the provider offers");
    expect(prompt).toMatch(/already has an agent.*send/s);
    expect(prompt).toMatch(/wait/);
  });

  it("omits the role notes section when no role has instructions", () => {
    const bare = orchestratorPrompt({ ...team, roles: [team.roles[1]!] }, modes);
    expect(bare).not.toContain("Role notes");
  });
});

describe("teamChangedMessage", () => {
  it("starts with the re-read sentence", () => {
    const message = teamChangedMessage(team, modes);
    expect(message.startsWith("The team in .agents/team.json changed. Re-read it and use it from now on.")).toBe(true);
  });

  it("contains the team table with the Mode column", () => {
    const message = teamChangedMessage(team, modes);
    expect(message).toContain("| Role | Workspace | Provider/model | Mode | Folders |");
    expect(message).toContain("| design | design | codex/gpt-6.1-sol | full-access | src/ui, assets/images |");
    expect(message).toContain("| sound | sound | antigravity/gemini-4-argon-high | default | (any) |");
  });

  it("repeats the --mode rule", () => {
    const message = teamChangedMessage(team, modes);
    expect(message).toContain("--mode");
    expect(message).toContain("`default`");
  });
});
