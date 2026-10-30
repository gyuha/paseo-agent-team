import { describe, expect, it } from "vitest";
import { plannerWorkspace, teamWorkspaceId } from "../shared/projects";

describe("teamWorkspaceId", () => {
  const workspace = (id: string, projectId: string, name: string, title: string | null = null, archivingAt: string | null = null) => ({ id, projectId, name, title, archivingAt });

  it("matches the workspace by title", () => {
    expect(teamWorkspaceId([workspace("wks_a", "prj_game", "main", "Lead"), workspace("wks_b", "prj_game", "other", "Core")], "prj_game", "Core")).toBe("wks_b");
  });

  it("ignores case and surrounding whitespace", () => {
    expect(teamWorkspaceId([workspace("wks_a", "prj_game", "main", "  Lead ")], "prj_game", " lEAD  ")).toBe("wks_a");
  });

  it("falls back to the name when the title is empty", () => {
    expect(teamWorkspaceId([workspace("wks_a", "prj_game", "lead", ""), workspace("wks_b", "prj_game", "core", "  ")], "prj_game", "Core")).toBe("wks_b");
  });

  it("ignores archived workspaces", () => {
    expect(teamWorkspaceId([workspace("wks_old", "prj_game", "lead", "Lead", "2026-10-29T00:00:00Z")], "prj_game", "Lead")).toBeNull();
  });

  it("ignores workspaces of other projects", () => {
    expect(teamWorkspaceId([workspace("wks_a", "prj_site", "lead", "Lead")], "prj_game", "Lead")).toBeNull();
  });

  it("is null when no workspace matches", () => {
    expect(teamWorkspaceId([workspace("wks_a", "prj_game", "main", "Lead")], "prj_game", "Core")).toBeNull();
    expect(teamWorkspaceId([], "prj_game", "Lead")).toBeNull();
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
