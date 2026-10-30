import { describe, expect, it } from "vitest";
import { ensureWorkspaces, freeWorkspace, planWorkspaces, withFreeWorkspaces, workspaceLabel } from "../shared/apply-plan";
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

describe("planWorkspaces with shared roles", () => {
  const sharedTeam: Team = { ...team, roles: [team.roles[0]!, { name: "qa", workspace: "", provider: "claude", model: "claude-sonnet-5-5", folders: [], instructions: "" }, { name: "docs", workspace: "  ", provider: "claude", model: "claude-haiku-5-5", folders: [], instructions: "" }] };

  it("emits no step for roles without a workspace", () => {
    expect(planWorkspaces(sharedTeam, [])).toEqual([
      { target: "orchestrator", workspace: "orchestrator", existingId: null },
      { target: "design", workspace: "Design", existingId: null },
    ]);
  });

  it("does not match shared roles against existing workspaces", () => {
    const existing = [{ id: "wks_blank", name: "main", title: " " }, { id: "wks_b", name: "orchestrator", title: null }];
    expect(planWorkspaces(sharedTeam, existing).map((step) => step.target)).toEqual(["orchestrator", "design"]);
  });

  it("plans only the orchestrator when every role is shared", () => {
    const allShared: Team = { ...sharedTeam, roles: sharedTeam.roles.slice(1) };
    expect(planWorkspaces(allShared, [])).toEqual([{ target: "orchestrator", workspace: "orchestrator", existingId: null }]);
  });
});

describe("ensureWorkspaces", () => {
  it("creates missing workspaces orchestrator-last, so Paseo's sidebar shows it on top, and returns them orchestrator-first", async () => {
    const created: string[] = [];
    const steps = planWorkspaces(team, [{ id: "wks_d", name: "Design", title: null }]);
    const result = await ensureWorkspaces(steps, async (title) => {
      created.push(title);
      return `new_${title}`;
    });
    expect(created).toEqual(["sound", "orchestrator"]);
    expect(result).toEqual([
      { target: "orchestrator", workspace: "orchestrator", id: "new_orchestrator", created: true },
      { target: "design", workspace: "Design", id: "wks_d", created: false },
      { target: "sound", workspace: "sound", id: "new_sound", created: true },
    ]);
  });
});

describe("freeWorkspace", () => {
  it("keeps a free name and numbers a taken one, ignoring case and spaces", () => {
    expect(freeWorkspace("orchestrator", ["main"])).toBe("orchestrator");
    expect(freeWorkspace("orchestrator", [" Orchestrator ", "orchestrator-2"])).toBe("orchestrator-3");
  });
});

describe("withFreeWorkspaces", () => {
  it("gives a new team's orchestrator a workspace the project doesn't have yet", () => {
    const fresh: Team = { ...team, roles: [] };
    expect(withFreeWorkspaces(fresh, ["orchestrator", "main"], { orchestrator: true }).orchestrator.workspace).toBe("orchestrator-2");
  });

  it("renames own role workspaces away from the project's and each other's, leaving shared roles alone", () => {
    const draft: Team = {
      ...team,
      roles: [
        { ...team.roles[0]!, workspace: "design" },
        { ...team.roles[1]!, workspace: "" },
        { ...team.roles[1]!, name: "music", workspace: "Design-2" },
      ],
    };
    const result = withFreeWorkspaces(draft, ["Design", "orchestrator"], { orchestrator: true });
    expect(result.orchestrator.workspace).toBe("orchestrator-2");
    expect(result.roles.map((role) => role.workspace)).toEqual(["design-2", "", "Design-2-2"]);
  });

  it("keeps the orchestrator's workspace when it is fixed, and keeps role workspaces off it", () => {
    const draft: Team = { ...team, orchestrator: { ...team.orchestrator, workspace: "main" }, roles: [{ ...team.roles[0]!, workspace: "main" }] };
    const result = withFreeWorkspaces(draft, ["main"], { orchestrator: false });
    expect(result.orchestrator.workspace).toBe("main");
    expect(result.roles[0]!.workspace).toBe("main-2");
  });
});
