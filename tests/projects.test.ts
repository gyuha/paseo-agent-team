import { describe, expect, it } from "vitest";
import { plannerWorkspace, projectsWithoutTeam, type ProjectRef } from "../shared/projects";

const game: ProjectRef = { id: "prj_game", name: "game", root: "/work/game" };
const site: ProjectRef = { id: "prj_site", name: "site", root: "/work/site" };

describe("projectsWithoutTeam", () => {
  it("keeps the projects that have no team file, in order", () => {
    expect(projectsWithoutTeam([game, site], new Set(["prj_game"]))).toEqual([site]);
  });

  it("is empty when every project has a team", () => {
    expect(projectsWithoutTeam([game, site], new Set(["prj_game", "prj_site"]))).toEqual([]);
  });

  it("is empty when there are no projects", () => {
    expect(projectsWithoutTeam([], new Set())).toEqual([]);
  });
});

describe("plannerWorkspace", () => {
  const workspace = (id: string, projectId: string, archivingAt: string | null = null) => ({ id, projectId, archivingAt });

  it("picks a workspace of the project", () => {
    expect(plannerWorkspace([workspace("wks_other", "prj_site"), workspace("wks_main", "prj_game")], "prj_game")).toBe("wks_main");
  });

  it("skips workspaces being archived", () => {
    expect(plannerWorkspace([workspace("wks_old", "prj_game", "2026-10-29T00:00:00Z"), workspace("wks_main", "prj_game")], "prj_game")).toBe("wks_main");
  });

  it("is null when the project only has archived workspaces", () => {
    expect(plannerWorkspace([workspace("wks_old", "prj_game", "2026-10-29T00:00:00Z")], "prj_game")).toBeNull();
  });

  it("is null when the project has no workspace", () => {
    expect(plannerWorkspace([workspace("wks_other", "prj_site")], "prj_game")).toBeNull();
  });
});
