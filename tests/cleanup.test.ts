import { describe, expect, it } from "vitest";
import { plannerCleanup } from "../shared/cleanup";
import type { Team } from "../shared/team";

const team: Team = {
  version: 1,
  goal: "",
  orchestrator: { workspace: "orchestrator", provider: "claude", model: "claude-opus-5-5" },
  roles: [{ name: "design", workspace: "design", provider: "codex", model: "gpt-6.1-sol", folders: [], instructions: "" }],
};

const workspace = (id: string, title: string) => ({ id, name: id, title });
const agent = (id: string, workspaceId: string, role: string, archivedAt: string | null = null) => ({ id, workspaceId, labels: { "workspace-agents": role }, archivedAt });

describe("plannerCleanup", () => {
  it("archives the project's planners and an emptied Team planner workspace", () => {
    const result = plannerCleanup(
      [workspace("wks_main", "main"), workspace("wks_plan", "Team planner")],
      [agent("a1", "wks_main", "planner"), agent("a2", "wks_plan", "planner"), agent("a3", "wks_main", "orchestrator")],
      team,
    );
    expect(result).toEqual({ agents: ["a1", "a2"], workspaces: ["wks_plan"] });
  });

  it("ignores planners outside the project's workspaces and ones already archived", () => {
    const result = plannerCleanup([workspace("wks_main", "main")], [agent("a1", "wks_other", "planner"), agent("a2", "wks_main", "planner", "2026-10-29T00:00:00Z")], team);
    expect(result).toEqual({ agents: [], workspaces: [] });
  });

  it("keeps a workspace that is not titled Team planner", () => {
    expect(plannerCleanup([workspace("wks_plan", "Team planners")], [agent("a1", "wks_plan", "planner")], team).workspaces).toEqual([]);
  });

  it("keeps a Team planner workspace the team uses", () => {
    const uses = { ...team, roles: [{ ...team.roles[0]!, workspace: "Team planner" }] };
    expect(plannerCleanup([workspace("wks_plan", "Team planner")], [agent("a1", "wks_plan", "planner")], uses)).toEqual({ agents: ["a1"], workspaces: [] });
  });

  it("keeps a Team planner workspace that still has other agents", () => {
    const result = plannerCleanup([workspace("wks_plan", "Team planner")], [agent("a1", "wks_plan", "planner"), { id: "a2", workspaceId: "wks_plan", labels: {}, archivedAt: null }], team);
    expect(result).toEqual({ agents: ["a1"], workspaces: [] });
  });

  it("archives an empty Team planner workspace", () => {
    expect(plannerCleanup([workspace("wks_plan", "Team planner")], [], team)).toEqual({ agents: [], workspaces: ["wks_plan"] });
  });
});
