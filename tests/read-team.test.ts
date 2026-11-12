import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readTeam } from "../server/team";
import { serializeTeam, type Team } from "../shared/team";
import { TEAMS_DIR } from "../shared/team-files";

const team = (workspace: string, goal: string): Team => ({
  version: 1,
  goal,
  orchestrator: { workspace, provider: "claude", model: "m" },
  roles: [{ name: "qa", provider: "claude", model: "m", folders: [], instructions: "" }],
});

describe("readTeam projectTeams", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "read-team-"));
    mkdirSync(join(root, TEAMS_DIR), { recursive: true });
    for (const [file, workspace, goal] of [["alpha", "alpha", "Alpha goal"], ["beta", "beta", "Beta goal"], ["gamma", "gamma", "Gamma goal"]] as const) {
      writeFileSync(join(root, TEAMS_DIR, `${file}.json`), serializeTeam(team(workspace, goal)), "utf8");
    }
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const workspaces = () => ["alpha", "beta", "gamma"].map((title) => ({ id: `wks_${title}`, projectId: "prj_1", projectCustomName: null, projectDisplayName: "Demo", projectRootPath: root, archivingAt: null, name: title, title, workspaceKind: "directory" }));
  const context = {
    paseo: {
      projects: { list: async () => ({ projects: [{ projectId: "prj_1", projectCustomName: null, projectDisplayName: "Demo", projectRootPath: root }] }) },
      workspaces: {
        list: async () => ({ entries: workspaces() }),
        ref: (id: string) => ({ refresh: async () => workspaces().find((entry) => entry.id === id) }),
      },
      providers: { snapshot: async () => ({ entries: [] }) },
    } as never,
  };

  it("team copy sources exclude the target workspace's own team and are sorted by workspace", async () => {
    const result = await readTeam({ workspaceId: "wks_beta" }, context);
    expect(result.team?.orchestrator.workspace).toBe("beta");
    expect(result.projectTeams.map((entry) => entry.workspace)).toEqual(["alpha", "gamma"]);
    expect(result.projectTeams[0]).toMatchObject({ file: `${TEAMS_DIR}/alpha.json`, goal: "Alpha goal" });
    expect(result.projectTeams[0]!.team.roles[0]!.name).toBe("qa");
  });

  it("team copy sources include every team for a project target, which has no own workspace", async () => {
    const result = await readTeam({ projectId: "prj_1" }, context);
    expect(result.workspace).toBeNull();
    expect(result.projectTeams.map((entry) => entry.workspace)).toEqual(["alpha", "beta", "gamma"]);
  });
});
