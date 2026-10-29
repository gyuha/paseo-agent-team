// Runs the server handlers against a live local Paseo daemon. It starts real agents
// (a planner and an orchestrator), so it only runs with PASEO_E2E=1:
//   PASEO_E2E=1 npx vitest run tests/daemon.e2e.test.ts
import { createPaseoClient, type PaseoClient } from "@getpaseo/client";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyTeam, proposeRole, teamlessProjects, proposeTeam, readTeam, roleProposal, teamProposal } from "../server/team";
import { TEAM_FILE, TeamSchema, type Team } from "../shared/team";
import { validateTeam } from "../shared/validate";

describe.skipIf(!process.env.PASEO_E2E)("server handlers against the local daemon", () => {
  let paseo: PaseoClient;
  let root: string;
  let workspaceId: string;
  let projectId: string;
  let proposed: Team;

  beforeAll(async () => {
    paseo = createPaseoClient({ url: process.env.PASEO_URL ?? "ws://127.0.0.1:6767/ws", reconnect: { enabled: false } });
    await paseo.connect();
    root = mkdtempSync(join(tmpdir(), "pwa-game-"));
    execFileSync("git", ["init", "-q", root]);
    workspaceId = (await paseo.workspaces.create({ title: "main", source: { kind: "directory", path: root } })).id;
    projectId = (await paseo.workspaces.ref(workspaceId).refresh())!.projectId;
  }, 60_000);

  afterAll(async () => {
    await paseo?.close();
  });

  it("reads a project without a team file", async () => {
    const result = await readTeam({ workspaceId }, { paseo });
    expect(result.team).toBeNull();
    expect(result.project.root).toBe(root);
    expect(result.catalog.some((provider) => provider.ready)).toBe(true);
  });

  it("reads the same project by its id and lists it as having no team", async () => {
    const result = await readTeam({ projectId }, { paseo });
    expect(result.team).toBeNull();
    expect(result.project).toEqual({ id: projectId, name: expect.any(String), root });
    expect((await teamlessProjects({}, { paseo })).some((project) => project.id === projectId)).toBe(true);
  });

  it("starts the planner in an existing workspace of the project when given only the project", async () => {
    const { agentId } = await proposeTeam({ projectId, goal: "A tiny CLI tool" }, { paseo });
    const planner = paseo.agents.ref(agentId);
    expect((await planner.refresh())?.agent.workspaceId).toBe(workspaceId);
    await planner.archive();
  });

  it("gets a valid proposal from the planner", async () => {
    const { agentId } = await proposeTeam({ workspaceId, goal: "A small 2D platformer game: one role for visual design on codex, one for sound on antigravity" }, { paseo });
    for (let attempt = 0; attempt < 150; attempt += 1) {
      const result = await teamProposal({ agentId }, { paseo });
      if (result.status === "failed") throw new Error(result.errors.join("\n"));
      if (result.status === "done") {
        expect(result.validation).toEqual([]);
        proposed = TeamSchema.parse(result.team);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("the planner did not finish in 5 minutes");
  }, 330_000);

  it("proposes one role from a description", async () => {
    const team = { orchestratorWorkspace: proposed.orchestrator.workspace, roles: proposed.roles.map(({ name, workspace, folders }) => ({ name, workspace, folders })) };
    const { agentId } = await proposeRole({ workspaceId, description: "Writes and runs end-to-end tests for the game", team }, { paseo });
    for (let attempt = 0; attempt < 150; attempt += 1) {
      const result = await roleProposal({ agentId }, { paseo });
      if (result.status === "failed") throw new Error(result.errors.join("\n"));
      if (result.status === "done") {
        const extended = TeamSchema.parse({ ...proposed, roles: [...proposed.roles, result.role] });
        expect(validateTeam(extended, (await readTeam({ workspaceId }, { paseo })).catalog)).toEqual([]);
        proposed = extended;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("the role planner did not finish in 5 minutes");
  }, 330_000);

  it("applies the team: file, workspaces and orchestrator", async () => {
    // A planner workspace with nothing left in it, as the sidebar screen leaves behind for a project without workspaces.
    const plannerWorkspace = (await paseo.workspaces.create({ title: "Team planner", source: { kind: "directory", path: root, projectId } })).id;
    const result = await applyTeam({ workspaceId, team: proposed }, { paseo });
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.cleanup).toEqual([]);
    expect(JSON.parse(readFileSync(join(root, TEAM_FILE), "utf8")).roles.length).toBe(proposed.roles.length);
    expect(result.workspaces).toHaveLength(proposed.roles.length + 1);

    const { entries } = await paseo.workspaces.list();
    for (const workspace of result.workspaces) {
      expect(entries.find((entry) => entry.id === workspace.id)?.projectRootPath).toBe(root);
    }
    const orchestrator = await paseo.agents.ref(result.orchestratorAgentId).refresh();
    expect(orchestrator?.agent.workspaceId).toBe(result.workspaces[0]!.id);
    expect(orchestrator?.agent.provider).toBe(proposed.orchestrator.provider);

    // Planners are archived, and so is the emptied Team planner workspace; the team's workspaces stay.
    const projectWorkspaces = (await paseo.workspaces.list()).entries.filter((entry) => entry.projectId === projectId && !entry.archivingAt).map((entry) => entry.id);
    expect(projectWorkspaces).not.toContain(plannerWorkspace);
    expect(projectWorkspaces).toEqual(expect.arrayContaining([workspaceId, ...result.workspaces.map((workspace) => workspace.id)]));
    const planners = (await paseo.agents.list()).entries.map((entry) => entry.agent).filter((agent) => agent.labels["workspace-agents"] === "planner" && !agent.archivedAt && projectWorkspaces.includes(agent.workspaceId ?? ""));
    expect(planners).toEqual([]);

    // Applying again by project id reuses everything and the project no longer lists as teamless.
    const again = await applyTeam({ projectId, team: proposed }, { paseo });
    expect(again.ok && again.workspaces.every((workspace) => !workspace.created)).toBe(true);
    expect(again.ok && again.orchestratorAgentId).toBe(result.orchestratorAgentId);
    expect((await teamlessProjects({}, { paseo })).some((project) => project.id === projectId)).toBe(false);
  }, 120_000);
});
