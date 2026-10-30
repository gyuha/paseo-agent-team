import { describe, expect, it } from "vitest";
import type { Team } from "../shared/team";
import { roleOwnerOf, teamFileFor, teamIn, workspaceClashes, workspacesOfOtherTeams, type TeamFile } from "../shared/team-files";

const team = (workspace: string, roles: { name: string; workspace: string }[]): Team => ({
  version: 1,
  goal: "",
  orchestrator: { workspace, provider: "claude", model: "claude-opus-5-5" },
  roles: roles.map((role) => ({ ...role, provider: "claude", model: "claude-sonnet-5-5", folders: [], instructions: "" })),
});

const files: TeamFile[] = [
  { file: ".agents/team.json", team: team("orchestrator", [{ name: "design", workspace: "design" }, { name: "tests", workspace: "" }]) },
  { file: ".agents/teams/feature-x.json", team: team("Feature X", [{ name: "core", workspace: "" }, { name: "docs", workspace: "docs-x" }]) },
];

describe("teamIn", () => {
  it("finds the team whose orchestrator runs in the workspace, ignoring case and spaces", () => {
    expect(teamIn(files, "orchestrator")?.file).toBe(".agents/team.json");
    expect(teamIn(files, " feature x ")?.file).toBe(".agents/teams/feature-x.json");
  });

  it("finds none for a role's workspace or an unknown one", () => {
    expect(teamIn(files, "design")).toBeUndefined();
    expect(teamIn(files, "main")).toBeUndefined();
  });
});

describe("roleOwnerOf", () => {
  it("names the team and role that use the workspace as the role's own", () => {
    expect(roleOwnerOf(files, "Design")).toEqual({ team: "orchestrator", role: "design" });
    expect(roleOwnerOf(files, "docs-x")).toEqual({ team: "Feature X", role: "docs" });
  });

  it("ignores shared roles and orchestrator workspaces", () => {
    expect(roleOwnerOf(files, "")).toBeUndefined();
    expect(roleOwnerOf(files, "orchestrator")).toBeUndefined();
    expect(roleOwnerOf(files, "main")).toBeUndefined();
  });
});

describe("workspacesOfOtherTeams", () => {
  it("lists the orchestrator and own role workspaces of every other team", () => {
    expect(workspacesOfOtherTeams(files, "orchestrator")).toEqual(["Feature X", "docs-x"]);
    expect(workspacesOfOtherTeams(files, "FEATURE X")).toEqual(["orchestrator", "design"]);
  });

  it("lists every team's workspaces for a workspace without a team", () => {
    expect(workspacesOfOtherTeams(files, "main")).toEqual(["orchestrator", "design", "Feature X", "docs-x"]);
  });
});

describe("workspaceClashes", () => {
  const taken = ["orchestrator", "design"];

  it("accepts a team that uses none of the taken workspaces", () => {
    expect(workspaceClashes(team("main", [{ name: "a", workspace: "" }, { name: "b", workspace: "b-main" }]), taken)).toEqual([]);
  });

  it("rejects an orchestrator or own role workspace another team uses", () => {
    expect(workspaceClashes(team("Orchestrator", [{ name: "a", workspace: "" }, { name: "b", workspace: " design " }]), taken)).toEqual([
      { target: "orchestrator", message: 'workspace "Orchestrator" belongs to another team' },
      { target: "b", message: 'workspace " design " belongs to another team' },
    ]);
  });

  it("never flags shared roles", () => {
    expect(workspaceClashes(team("main", [{ name: "a", workspace: "" }]), ["", "main-x"])).toEqual([]);
  });
});

describe("teamFileFor", () => {
  const names = files.map((entry) => entry.file);

  it("keeps a team in the file it already lives in, including the single-team file", () => {
    expect(teamFileFor(team("orchestrator", [{ name: "x", workspace: "" }]), files, names)).toBe(".agents/team.json");
    expect(teamFileFor(team("feature x", [{ name: "x", workspace: "" }]), files, names)).toBe(".agents/teams/feature-x.json");
  });

  it("names a new team's file after its orchestrator's workspace", () => {
    expect(teamFileFor(team("Bug fixes / v2", [{ name: "x", workspace: "" }]), files, names)).toBe(".agents/teams/bug-fixes-v2.json");
    expect(teamFileFor(team("버그 수정", [{ name: "x", workspace: "" }]), files, names)).toBe(".agents/teams/버그-수정.json");
  });

  it("does not reuse a name another file already has", () => {
    expect(teamFileFor(team("feature-x", [{ name: "x", workspace: "" }]), files, names)).toBe(".agents/teams/feature-x-2.json");
    expect(teamFileFor(team("feature-x", [{ name: "x", workspace: "" }]), files, [...names, ".agents/teams/feature-x-2.json"])).toBe(".agents/teams/feature-x-3.json");
  });

  it("falls back to a generic name when the title has no letters or digits", () => {
    expect(teamFileFor(team("***", [{ name: "x", workspace: "" }]), [], [])).toBe(".agents/teams/team.json");
  });
});
