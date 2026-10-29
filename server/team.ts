import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ensureWorkspaces, planWorkspaces } from "../shared/apply-plan";
import { LABEL, PLANNER_WORKSPACE, plannerCleanup } from "../shared/cleanup";
import { orchestratorPrompt } from "../shared/prompt";
import { extractProposal, extractRole, plannerPrompt, ROLE_JSON_SCHEMA, rolePrompt, TEAM_JSON_SCHEMA } from "../shared/proposal";
import { plannerWorkspace, projectsWithoutTeam, type ProjectRef } from "../shared/projects";
import type { teamApplyRpc, teamProjectsRpc, teamProposalRpc, teamProposeRpc, teamReadRpc, teamRoleProposalRpc, teamRoleProposeRpc } from "../shared/rpc";
import { checkTeam, parseTeam, serializeTeam, TEAM_FILE } from "../shared/team";
import { autoModeOf, catalogFrom, validateTeam, type ProviderEntry } from "../shared/validate";


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
  const hasTeam = await Promise.all(projects.map((project) => access(join(project.root, TEAM_FILE)).then(() => true, () => false)));
  return projectsWithoutTeam(projects, new Set(projects.filter((_, at) => hasTeam[at]).map((project) => project.id)));
}

export async function readTeam(target: RpcInput<typeof teamReadRpc>, { paseo }: PluginHandlerContext): Promise<RpcOutput<typeof teamReadRpc>> {
  const project = await projectOf(paseo, target);
  const catalog = catalogFrom(await providerEntries(paseo));
  const text = await readFile(join(project.root, TEAM_FILE), "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (text === null) return { project, team: null, errors: [], validation: [], catalog };
  const parsed = parseTeam(text);
  if (!parsed.ok) return { project, team: null, errors: parsed.errors, validation: [], catalog };
  return { project, team: parsed.team, errors: [], validation: validateTeam(parsed.team, catalog), catalog };
}

export async function proposeTeam({ goal, ...target }: RpcInput<typeof teamProposeRpc>, { paseo }: PluginHandlerContext): Promise<RpcOutput<typeof teamProposeRpc>> {
  const entries = await providerEntries(paseo);
  const provider = plannerProvider(entries);
  const agent = await paseo.workspaces.ref(await plannerWorkspaceOf(paseo, target)).agents.create({
    config: { provider, modeId: autoModeOf(entries, provider.split("/")[0]!) },
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
    config: { provider, modeId: autoModeOf(entries, provider.split("/")[0]!) },
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
  const file = join(project.root, TEAM_FILE);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, serializeTeam(team), "utf8");

  const { entries } = await paseo.workspaces.list();
  const existing = entries.filter((workspace) => workspace.projectId === project.id && !workspace.archivingAt);
  const workspaces = await ensureWorkspaces(planWorkspaces(team, existing), async (title) => (await paseo.workspaces.create({ title, source: { kind: "directory", path: project.root, projectId: project.id } })).id);

  const lead = workspaces[0]!;
  // Applying again keeps the orchestrator already running on the same model and tells it to re-read the team.
  const agents = (await paseo.agents.list()).entries.map((entry) => entry.agent);
  const running = agents.find((agent) => agent.workspaceId === lead.id && agent.labels[LABEL] === "orchestrator" && !agent.archivedAt && agent.provider === team.orchestrator.provider && agent.model === team.orchestrator.model);
  if (running) {
    await paseo.agents.ref(running.id).send(`The team in ${TEAM_FILE} changed. Re-read it and use it from now on.`);
    return { ok: true, file, workspaces, orchestratorAgentId: running.id, cleanup: await archivePlanners(paseo, plannerCleanup(existing, agents, team)) };
  }
  const orchestrator = await paseo.workspaces.ref(lead.id).agents.create({
    config: { provider: `${team.orchestrator.provider}/${team.orchestrator.model}`, modeId: autoModeOf(providers, team.orchestrator.provider), systemPrompt: orchestratorPrompt(team) },
    title: "Orchestrator",
    prompt: `Read ${TEAM_FILE}, then reply with a short summary of the team (role, workspace, provider/model) and say you are ready for a request. Do not start any agents yet.`,
    labels: { [LABEL]: "orchestrator" },
  });
  return { ok: true, file, workspaces, orchestratorAgentId: orchestrator.id, cleanup: await archivePlanners(paseo, plannerCleanup(existing, agents, team)) };
}
