import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ensureWorkspaces, planWorkspaces, workspaceLabel } from "../shared/apply-plan";
import { findOrchestrator, LABEL, PLANNER_WORKSPACE, plannerCleanup } from "../shared/cleanup";
import { orchestratorPrompt, teamChangedMessage } from "../shared/prompt";
import { extractProposal, extractRole, plannerPrompt, ROLE_JSON_SCHEMA, rolePrompt, TEAM_JSON_SCHEMA } from "../shared/proposal";
import { plannerWorkspace, projectsWithoutTeam, type ProjectRef } from "../shared/projects";
import type { teamApplyRpc, teamProjectsRpc, teamProposalRpc, teamProposeRpc, teamReadRpc, teamRoleProposalRpc, teamRoleProposeRpc } from "../shared/rpc";
import { checkTeam, parseTeam, serializeTeam, TEAM_FILE } from "../shared/team";
import { roleOwnerOf, teamFileFor, teamIn, TEAMS_DIR, workspaceClashes, workspacesOfOtherTeams, type TeamFile } from "../shared/team-files";
import { catalogFrom, roleModes, agentModeOf, validateTeam, type ProviderEntry } from "../shared/validate";


type PaseoApi = PluginHandlerContext["paseo"];
type Target = { workspaceId: string } | { projectId: string };

async function allProjects(paseo: PaseoApi): Promise<ProjectRef[]> {
  const { projects } = await paseo.projects.list();
  return projects.map((project) => ({ id: project.projectId, name: project.projectCustomName || project.projectDisplayName, root: project.projectRootPath }));
}

async function projectOf(paseo: PaseoApi, target: Target): Promise<ProjectRef> {
  if ("projectId" in target) {
    const project = (await allProjects(paseo)).find((candidate) => candidate.id === target.projectId);
    if (!project) throw new Error(`Project ${target.projectId} was not found.`);
    return project;
  }
  const workspace = await paseo.workspaces.ref(target.workspaceId).refresh();
  if (!workspace) throw new Error(`Workspace ${target.workspaceId} was not found.`);
  return { id: workspace.projectId, name: workspace.projectCustomName || workspace.projectDisplayName, root: workspace.projectRootPath };
}

/** The workspace to start the planner in: the given one, else one of the project's, else a new "Team planner". */
async function plannerWorkspaceOf(paseo: PaseoApi, target: Target): Promise<string> {
  if ("workspaceId" in target) return target.workspaceId;
  const project = await projectOf(paseo, target);
  const { entries } = await paseo.workspaces.list();
  return plannerWorkspace(entries, project.id) ?? (await paseo.workspaces.create({ title: PLANNER_WORKSPACE, source: { kind: "directory", path: project.root, projectId: project.id } })).id;
}

async function providerEntries(paseo: PaseoApi): Promise<ProviderEntry[]> {
  const snapshot = await paseo.providers.snapshot();
  return snapshot.entries as unknown as ProviderEntry[];
}

/** The planner runs on Claude when it's ready, else the first ready provider, with that provider's default model. */
function plannerProvider(entries: readonly ProviderEntry[]): string {
  const ready = entries.filter((entry) => entry.enabled && entry.status === "ready");
  const entry = ready.find((candidate) => candidate.provider === "claude") ?? ready[0];
  if (!entry) throw new Error("No provider is ready on this host.");
  const models = (entry.models ?? []) as readonly { id: string; isDefault?: boolean }[];
  const model = models.find((candidate) => candidate.isDefault) ?? models[0];
  return model ? `${entry.provider}/${model.id}` : entry.provider;
}

export async function teamlessProjects(_input: RpcInput<typeof teamProjectsRpc>, { paseo }: PluginHandlerContext): Promise<RpcOutput<typeof teamProjectsRpc>> {
  const projects = await allProjects(paseo);
  const hasTeam = await Promise.all(projects.map(async (project) => (await teamFileNames(project)).length > 0));
  return projectsWithoutTeam(projects, new Set(projects.filter((_, at) => hasTeam[at]).map((project) => project.id)));
}

/** The project's team files, relative to its root: the single-team file first, then the teams folder by name. */
async function teamFileNames(project: ProjectRef): Promise<string[]> {
  const legacy = await access(join(project.root, TEAM_FILE)).then(() => [TEAM_FILE], () => []);
  const names = await readdir(join(project.root, TEAMS_DIR)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  return [...legacy, ...names.filter((name) => name.endsWith(".json")).sort().map((name) => `${TEAMS_DIR}/${name}`)];
}

/** Every team of the project, the names of all its team files, and the problems of those that don't parse. */
async function projectTeams(project: ProjectRef): Promise<{ teams: TeamFile[]; names: string[]; errors: string[] }> {
  const names = await teamFileNames(project);
  const teams: TeamFile[] = [];
  const errors: string[] = [];
  for (const file of names) {
    const parsed = parseTeam(await readFile(join(project.root, file), "utf8"));
    if (parsed.ok) teams.push({ file, team: parsed.team });
    else errors.push(...parsed.errors.map((error) => `${file}: ${error}`));
  }
  return { teams, names, errors };
}

async function workspaceTitle(paseo: PaseoApi, workspaceId: string): Promise<string> {
  const workspace = (await paseo.workspaces.list()).entries.find((entry) => entry.id === workspaceId);
  if (!workspace) throw new Error(`Workspace ${workspaceId} was not found.`);
  return workspaceLabel(workspace);
}

export async function readTeam(target: RpcInput<typeof teamReadRpc>, { paseo }: PluginHandlerContext): Promise<RpcOutput<typeof teamReadRpc>> {
  const project = await projectOf(paseo, target);
  const catalog = catalogFrom(await providerEntries(paseo));
  const { teams, errors } = await projectTeams(project);
  const workspace = "workspaceId" in target ? await workspaceTitle(paseo, target.workspaceId) : null;
  const own = workspace === null ? undefined : teamIn(teams, workspace);
  return {
    project,
    workspace,
    file: own?.file ?? null,
    team: own?.team ?? null,
    owner: workspace === null || own ? null : (roleOwnerOf(teams, workspace) ?? null),
    takenWorkspaces: workspacesOfOtherTeams(teams, workspace ?? ""),
    errors,
    validation: own ? validateTeam(own.team, catalog) : [],
    catalog,
  };
}

export async function proposeTeam({ goal, ...target }: RpcInput<typeof teamProposeRpc>, { paseo }: PluginHandlerContext): Promise<RpcOutput<typeof teamProposeRpc>> {
  const entries = await providerEntries(paseo);
  const provider = plannerProvider(entries);
  const agent = await paseo.workspaces.ref(await plannerWorkspaceOf(paseo, target)).agents.create({
    config: { provider, modeId: agentModeOf(entries, provider.split("/")[0]!) },
    title: "Team planner",
    prompt: plannerPrompt(goal, catalogFrom(entries)),
    outputSchema: TEAM_JSON_SCHEMA,
    labels: { [LABEL]: "planner" },
  });
  return { agentId: agent.id };
}

/** Waits up to a second for a planner; its final message once it has finished. */
async function plannerAnswer(paseo: PaseoApi, agentId: string): Promise<{ status: "running" } | { status: "failed"; errors: string[] } | { status: "finished"; message: string | null }> {
  const result = await paseo.agents.ref(agentId).waitForFinish(1000);
  if (result.status === "timeout") return { status: "running" };
  if (result.status === "error") return { status: "failed", errors: [result.error ?? "the planner stopped with an error"] };
  if (result.status === "permission") return { status: "failed", errors: ["the planner is waiting for a permission; answer it in the planner's chat, then try again"] };
  return { status: "finished", message: result.lastMessage };
}

export async function teamProposal({ agentId }: RpcInput<typeof teamProposalRpc>, { paseo }: PluginHandlerContext): Promise<RpcOutput<typeof teamProposalRpc>> {
  const result = await plannerAnswer(paseo, agentId);
  if (result.status !== "finished") return result;
  const parsed = extractProposal(result.message);
  if (!parsed.ok) return { status: "failed", errors: parsed.errors };
  return { status: "done", team: parsed.team, validation: validateTeam(parsed.team, catalogFrom(await providerEntries(paseo))) };
}

export async function proposeRole({ description, team, ...target }: RpcInput<typeof teamRoleProposeRpc>, { paseo }: PluginHandlerContext): Promise<RpcOutput<typeof teamRoleProposeRpc>> {
  const entries = await providerEntries(paseo);
  const provider = plannerProvider(entries);
  const agent = await paseo.workspaces.ref(await plannerWorkspaceOf(paseo, target)).agents.create({
    config: { provider, modeId: agentModeOf(entries, provider.split("/")[0]!) },
    title: "Role planner",
    prompt: rolePrompt(description, team, catalogFrom(entries)),
    outputSchema: ROLE_JSON_SCHEMA,
    labels: { [LABEL]: "planner" },
  });
  return { agentId: agent.id };
}

export async function roleProposal({ agentId }: RpcInput<typeof teamRoleProposalRpc>, { paseo }: PluginHandlerContext): Promise<RpcOutput<typeof teamRoleProposalRpc>> {
  const result = await plannerAnswer(paseo, agentId);
  if (result.status !== "finished") return result;
  const parsed = extractRole(result.message);
  return parsed.ok ? { status: "done", role: parsed.role } : { status: "failed", errors: parsed.errors };
}

/** Archives the planners, then their emptied workspaces; returns what failed instead of throwing. */
async function archivePlanners(paseo: PaseoApi, targets: { agents: string[]; workspaces: string[] }): Promise<string[]> {
  const failures: string[] = [];
  for (const id of targets.agents) {
    await paseo.agents.ref(id).archive().catch((error: unknown) => failures.push(`planner ${id}: ${String(error)}`));
  }
  for (const id of targets.workspaces) {
    const result = await paseo.workspaces.archive(id).catch((error: unknown) => ({ error: String(error) }));
    if (result.error) failures.push(`workspace ${id}: ${result.error}`);
  }
  return failures;
}

export async function applyTeam({ team: input, ...target }: RpcInput<typeof teamApplyRpc>, { paseo }: PluginHandlerContext): Promise<RpcOutput<typeof teamApplyRpc>> {
  const checked = checkTeam(input);
  if (!checked.ok) return { ok: false, errors: checked.errors };
  const team = checked.team;
  const providers = await providerEntries(paseo);
  const problems = validateTeam(team, catalogFrom(providers));
  if (problems.length) return { ok: false, errors: problems.map((problem) => `${problem.target}: ${problem.message}`) };

  const project = await projectOf(paseo, target);
  const { teams, names } = await projectTeams(project);
  // Teams never share a workspace, so one team's role sessions can't mix with another's.
  const clashes = workspaceClashes(team, workspacesOfOtherTeams(teams, team.orchestrator.workspace));
  if (clashes.length) return { ok: false, errors: clashes.map((problem) => `${problem.target}: ${problem.message}`) };
  const relative = teamFileFor(team, teams, names);
  const file = join(project.root, relative);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, serializeTeam(team), "utf8");

  const { entries } = await paseo.workspaces.list();
  const existing = entries.filter((workspace) => workspace.projectId === project.id && !workspace.archivingAt);
  const workspaces = await ensureWorkspaces(planWorkspaces(team, existing), async (title) => (await paseo.workspaces.create({ title, source: { kind: "directory", path: project.root, projectId: project.id } })).id);

  const lead = workspaces[0]!;
  const modes = roleModes(team, providers);
  const orchestratorMode = agentModeOf(providers, team.orchestrator.provider);
  // Applying again keeps the orchestrator already running on the same model and mode and tells it to re-read the team.
  const agents = (await paseo.agents.list()).entries.map((entry) => entry.agent);
  const running = findOrchestrator(agents, lead.id, team, orchestratorMode);
  if (running) {
    await paseo.agents.ref(running.id).send(teamChangedMessage(team, modes, relative));
    return { ok: true, file, workspaces, orchestratorAgentId: running.id, cleanup: await archivePlanners(paseo, plannerCleanup(existing, agents, team)) };
  }
  const orchestrator = await paseo.workspaces.ref(lead.id).agents.create({
    config: { provider: `${team.orchestrator.provider}/${team.orchestrator.model}`, modeId: orchestratorMode, systemPrompt: orchestratorPrompt(team, modes, relative) },
    title: "Orchestrator",
    prompt: `Read ${relative}, then reply with a short summary of the team (role, workspace, provider/model) and say you are ready for a request. Do not start any agents yet.`,
    labels: { [LABEL]: "orchestrator" },
  });
  return { ok: true, file, workspaces, orchestratorAgentId: orchestrator.id, cleanup: await archivePlanners(paseo, plannerCleanup(existing, agents, team)) };
}
