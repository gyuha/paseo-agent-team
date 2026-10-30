// Runs the server handlers against a live local Paseo daemon. It starts real agents
// (a planner and an orchestrator), so it only runs with PASEO_E2E=1:
//   PASEO_E2E=1 npx vitest run tests/daemon.e2e.test.ts
import { createPaseoClient, type PaseoClient } from "@getpaseo/client";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyTeam, proposeRole, startTeamHere, teamlessProjects, proposeTeam, readTeam, roleProposal, teamProposal } from "../server/team";
import { workspaceLabel } from "../shared/apply-plan";
import { orchestratorIn } from "../shared/cleanup";
import { isSharedRole, TEAM_FILE, TeamSchema, type Team } from "../shared/team";
import { agentModeOf, validateTeam } from "../shared/validate";

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

  // Archives every agent the tests left in the temp project (planners, orchestrators and the role agents they started).
  afterAll(async () => {
    if (!paseo) return;
    try {
      if (projectId) {
        const workspaceIds = new Set((await paseo.workspaces.list()).entries.filter((entry) => entry.projectId === projectId).map((entry) => entry.id));
        const { entries } = await paseo.agents.list({ filter: { includeArchived: true } });
        for (const { agent } of entries) {
          if (!workspaceIds.has(agent.workspaceId ?? "") || agent.archivedAt) continue;
          // The client's archive() has no force option, so a running agent that refuses is logged and left.
          await paseo.agents.ref(agent.id).archive().catch((error: unknown) => console.warn(`e2e cleanup: could not archive agent ${agent.id}: ${String(error)}`));
        }
      }
    } catch (error) {
      console.warn(`e2e cleanup failed: ${String(error)}`);
    } finally {
      await paseo.close();
    }
  }, 60_000);

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
    // The planner leaves most roles without a workspace of their own, so only the others get one besides the orchestrator's.
    expect(result.workspaces).toHaveLength(proposed.roles.filter((role) => !isSharedRole(role)).length + 1);

    const { entries } = await paseo.workspaces.list();
    for (const workspace of result.workspaces) {
      expect(entries.find((entry) => entry.id === workspace.id)?.projectRootPath).toBe(root);
    }
    const orchestrator = await paseo.agents.ref(result.orchestratorAgentId).refresh();
    expect(orchestrator?.agent.workspaceId).toBe(result.workspaces[0]!.id);
    expect(orchestrator?.agent.provider).toBe(proposed.orchestrator.provider);
    const orchestratorMode = agentModeOf((await paseo.providers.snapshot()).entries, proposed.orchestrator.provider);
    if (proposed.orchestrator.provider === "claude") expect(orchestratorMode).toBeDefined();
    if (orchestratorMode) expect(orchestrator?.agent.currentModeId).toBe(orchestratorMode);

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

  it("applies a team with a role that shares the orchestrator's workspace", async () => {
    const template = proposed.roles[0]!;
    const own = proposed.roles.filter((role) => !isSharedRole(role));
    const team: Team = {
      ...proposed,
      roles: [...proposed.roles, { ...template, name: "shared-qa", workspace: "", folders: [], instructions: "" }, { ...template, name: "own-docs", workspace: "own-docs", folders: [], instructions: "" }],
    };
    const result = await applyTeam({ projectId, team }, { paseo });
    if (!result.ok) throw new Error(result.errors.join("\n"));

    // Steps exist for the orchestrator and every role with its own workspace, none for the shared role.
    expect(result.workspaces.map((workspace) => workspace.target)).toEqual(["orchestrator", ...own.map((role) => role.name), "own-docs"]);
    expect(result.workspaces.find((workspace) => workspace.target === "own-docs")?.created).toBe(true);

    const titles = (await paseo.workspaces.list()).entries.filter((entry) => entry.projectId === projectId && !entry.archivingAt).map((entry) => workspaceLabel(entry).trim().toLowerCase());
    expect(titles).toContain(team.orchestrator.workspace.toLowerCase());
    expect(titles).toContain("own-docs");
    for (const role of own) expect(titles).toContain(role.workspace.toLowerCase());
    expect(titles).not.toContain("shared-qa");
    expect(titles).not.toContain("");
  }, 120_000);

  it("starts an orchestrator in another workspace and tells every orchestrator when the team is applied again", async () => {
    const projectWorkspaces = async () => (await paseo.workspaces.list()).entries.filter((entry) => entry.projectId === projectId && !entry.archivingAt);
    const team = (await readTeam({ projectId }, { paseo })).team!;
    const homeWorkspace = (await projectWorkspaces()).find((entry) => workspaceLabel(entry).trim().toLowerCase() === team.orchestrator.workspace.toLowerCase())!;
    const agentsNow = async () => (await paseo.agents.list()).entries.map((entry) => entry.agent);
    const home = orchestratorIn(await agentsNow(), homeWorkspace.id);
    expect(home).toBeDefined();

    const second = (await paseo.workspaces.create({ title: `side-${Date.now()}`, source: { kind: "directory", path: root, projectId } })).id;
    const workspacesBefore = (await projectWorkspaces()).length;

    const started = await startTeamHere({ workspaceId: second }, { paseo });
    if (!started.ok) throw new Error(started.errors.join("\n"));
    expect(started.created).toBe(true);
    const orchestrator = (await paseo.agents.ref(started.orchestratorAgentId).refresh())!.agent;
    expect(orchestrator.workspaceId).toBe(second);
    expect(orchestrator.labels["workspace-agents"]).toBe("orchestrator");
    expect(started.orchestratorAgentId).not.toBe(home!.id);
    // Starting here creates no workspace.
    expect((await projectWorkspaces()).length).toBe(workspacesBefore);

    const again = await startTeamHere({ workspaceId: second }, { paseo });
    expect(again).toEqual({ ok: true, orchestratorAgentId: started.orchestratorAgentId, created: false });

    // Applying the same team sends a message to the orchestrator in each workspace; the agent snapshot's lastUserMessageAt shows it.
    const lastUserMessage = async (id: string) => {
      const at = (await paseo.agents.ref(id).refresh())?.agent.lastUserMessageAt;
      return at ? Date.parse(at) : 0;
    };
    const before = { home: await lastUserMessage(home!.id), second: await lastUserMessage(started.orchestratorAgentId) };
    const applied = await applyTeam({ projectId, team }, { paseo });
    if (!applied.ok) throw new Error(applied.errors.join("\n"));
    expect(applied.orchestratorAgentId).toBe(home!.id);
    let after = { home: before.home, second: before.second };
    for (let attempt = 0; attempt < 20 && !(after.home > before.home && after.second > before.second); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      after = { home: await lastUserMessage(home!.id), second: await lastUserMessage(started.orchestratorAgentId) };
    }
    expect(after.home).toBeGreaterThan(before.home);
    expect(after.second).toBeGreaterThan(before.second);
  }, 180_000);
});
