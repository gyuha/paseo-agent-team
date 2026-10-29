import type { Team } from "./team";

/** The part of a Paseo workspace descriptor that matching needs. */
export interface WorkspaceRef {
  id: string;
  name: string;
  title?: string | null;
}

export interface WorkspaceStep {
  /** "orchestrator" or the role name. */
  target: string;
  /** The workspace title from the team definition. */
  workspace: string;
  /** The workspace to reuse, or null to create one. */
  existingId: string | null;
}

/** What Paseo's sidebar shows for a workspace: its title when set, else its name. */
export function workspaceLabel(workspace: WorkspaceRef): string {
  return workspace.title?.trim() || workspace.name;
}

const key = (label: string) => label.trim().toLowerCase();

/** Matches each team workspace to an existing one of the project by title, or marks it for creation. */
export function planWorkspaces(team: Team, existing: readonly WorkspaceRef[]): WorkspaceStep[] {
  const find = (title: string) => existing.find((workspace) => key(workspaceLabel(workspace)) === key(title))?.id ?? null;
  return [
    { target: "orchestrator", workspace: team.orchestrator.workspace, existingId: find(team.orchestrator.workspace) },
    ...team.roles.map((role) => ({ target: role.name, workspace: role.workspace, existingId: find(role.workspace) })),
  ];
}
