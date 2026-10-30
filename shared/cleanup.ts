import { planWorkspaces, workspaceLabel, type WorkspaceRef } from "./apply-plan";
import type { Team } from "./team";

/** Label key on the agents this plugin starts; the value is the agent's job. */
export const LABEL = "workspace-agents";

/** Title of the workspace the planner gets when its project has none. */
export const PLANNER_WORKSPACE = "Team planner";

/** The part of a Paseo agent that cleanup needs. */
export interface AgentRef {
  id: string;
  workspaceId?: string | null;
  labels: Record<string, string>;
  archivedAt?: string | null;
}

/**
 * What to archive once a team is applied: every unarchived planner in the project's workspaces, and a
 * Team planner workspace the team doesn't use and that has no other agents left.
 */
export function plannerCleanup(workspaces: readonly WorkspaceRef[], agents: readonly AgentRef[], team: Team): { agents: string[]; workspaces: string[] } {
  const ids = new Set(workspaces.map((workspace) => workspace.id));
  const live = agents.filter((agent) => ids.has(agent.workspaceId ?? "") && !agent.archivedAt);
  const planners = live.filter((agent) => agent.labels[LABEL] === "planner");
  const emptied = workspaces.filter(
    (workspace) =>
      workspaceLabel(workspace) === PLANNER_WORKSPACE &&
      planWorkspaces(team, [workspace]).every((step) => step.existingId === null) &&
      live.every((agent) => agent.workspaceId !== workspace.id || planners.includes(agent)),
  );
  return { agents: planners.map((agent) => agent.id), workspaces: emptied.map((workspace) => workspace.id) };
}

/** An agent as orchestrator reuse needs it. */
export interface OrchestratorCandidate extends AgentRef {
  provider: string;
  model: string | null;
  currentModeId?: string | null;
}

/** The unarchived orchestrators in the given workspaces, in agent order. */
export function projectOrchestrators(agents: readonly OrchestratorCandidate[], workspaceIds: readonly string[]): OrchestratorCandidate[] {
  const ids = new Set(workspaceIds);
  return agents.filter((agent) => ids.has(agent.workspaceId ?? "") && agent.labels[LABEL] === "orchestrator" && !agent.archivedAt);
}

/** The first unarchived orchestrator in the workspace. */
export function orchestratorIn(agents: readonly OrchestratorCandidate[], workspaceId: string): OrchestratorCandidate | undefined {
  return projectOrchestrators(agents, [workspaceId])[0];
}

/** The running orchestrator in the lead workspace on the team's provider/model and, when given, mode. */
export function findOrchestrator(agents: readonly OrchestratorCandidate[], workspaceId: string, team: Team, modeId: string | undefined): OrchestratorCandidate | undefined {
  return agents.find(
    (agent) =>
      agent.workspaceId === workspaceId &&
      agent.labels[LABEL] === "orchestrator" &&
      !agent.archivedAt &&
      agent.provider === team.orchestrator.provider &&
      agent.model === team.orchestrator.model &&
      (modeId === undefined || agent.currentModeId === modeId),
  );
}
