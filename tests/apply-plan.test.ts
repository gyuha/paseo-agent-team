import { describe, expect, it } from "vitest";
import { planWorkspaces, workspaceLabel } from "../shared/apply-plan";
import type { Team } from "../shared/team";

const team: Team = {
  version: 1,
  goal: "",
  orchestrator: { workspace: "orchestrator", provider: "claude", model: "claude-opus-5-5" },
  roles: [
    { name: "design", workspace: "Design", provider: "codex", model: "gpt-6.1-sol", folders: [], instructions: "" },
    { name: "sound", workspace: "sound", provider: "antigravity", model: "gemini-4-argon-high", folders: [], instructions: "" },
  ],
};

describe("workspaceLabel", () => {
  it("prefers the user-set title and falls back to the name", () => {
    expect(workspaceLabel({ id: "w1", name: "main", title: "Design" })).toBe("Design");
    expect(workspaceLabel({ id: "w1", name: "main", title: null })).toBe("main");
  });
});

describe("planWorkspaces", () => {
  it("creates every workspace when none exist, orchestrator first", () => {
    expect(planWorkspaces(team, [])).toEqual([
      { target: "orchestrator", workspace: "orchestrator", existingId: null },
      { target: "design", workspace: "Design", existingId: null },
      { target: "sound", workspace: "sound", existingId: null },
    ]);
  });

  it("reuses existing workspaces matched by trimmed, case-insensitive title", () => {
    const existing = [
      { id: "wks_a", name: "main", title: " design " },
      { id: "wks_b", name: "orchestrator", title: null },
      { id: "wks_c", name: "other", title: "Docs" },
    ];
    expect(planWorkspaces(team, existing)).toEqual([
      { target: "orchestrator", workspace: "orchestrator", existingId: "wks_b" },
      { target: "design", workspace: "Design", existingId: "wks_a" },
      { target: "sound", workspace: "sound", existingId: null },
    ]);
  });

  it("uses the first match when two workspaces share a title", () => {
    const existing = [
      { id: "wks_1", name: "x", title: "sound" },
      { id: "wks_2", name: "y", title: "Sound" },
    ];
    expect(planWorkspaces(team, existing)[2]?.existingId).toBe("wks_1");
  });
});
