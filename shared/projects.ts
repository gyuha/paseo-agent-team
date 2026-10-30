import { workspaceLabel, type WorkspaceRef } from "./apply-plan";

/** A Paseo project as the plugin shows it. */
export interface ProjectRef {
  id: string;
  name: string;
  root: string;
}

/** The part of a Paseo workspace descriptor that picking a planner workspace needs. */
export interface ProjectWorkspace {
  id: string;
  projectId: string;
  archivingAt: string | null;
}

/** The team's non-archived orchestrator workspace in the project, or null when missing. */
export function teamWorkspaceId(workspaces: readonly (ProjectWorkspace & WorkspaceRef)[], projectId: string, title: string): string | null {
  return workspaces.find((workspace) => workspace.projectId === projectId && !workspace.archivingAt && workspaceLabel(workspace).trim().toLowerCase() === title.trim().toLowerCase())?.id ?? null;
}

/** A workspace of the project to run the planner in, or null when one has to be created. */
export function plannerWorkspace(workspaces: readonly ProjectWorkspace[], projectId: string): string | null {
  return workspaces.find((workspace) => workspace.projectId === projectId && !workspace.archivingAt)?.id ?? null;
}
