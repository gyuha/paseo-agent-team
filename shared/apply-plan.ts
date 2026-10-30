import { isSharedRole, type Team } from "./team";

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

/** Matches each team workspace to an existing one of the project by title, or marks it for creation; shared roles get none. */
export function planWorkspaces(team: Team, existing: readonly WorkspaceRef[]): WorkspaceStep[] {
  const find = (title: string) => existing.find((workspace) => key(workspaceLabel(workspace)) === key(title))?.id ?? null;
  return [
    { target: "orchestrator", workspace: team.orchestrator.workspace, existingId: find(team.orchestrator.workspace) },
    ...team.roles.filter((role) => !isSharedRole(role)).map((role) => ({ target: role.name, workspace: role.workspace, existingId: find(role.workspace) })),
  ];
}

export interface AppliedWorkspace {
  target: string;
  workspace: string;
  id: string;
  created: boolean;
}

/**
 * Creates the missing workspaces last step first: Paseo's sidebar puts a workspace it hasn't seen yet on top,
 * so the orchestrator's ends up above the roles. Returns them in step order, orchestrator first.
 */
export async function ensureWorkspaces(steps: readonly WorkspaceStep[], create: (title: string) => Promise<string>): Promise<AppliedWorkspace[]> {
  const ids: string[] = [];
  for (let at = steps.length - 1; at >= 0; at -= 1) ids[at] = steps[at]!.existingId ?? (await create(steps[at]!.workspace));
  return steps.map((step, at) => ({ target: step.target, workspace: step.workspace, id: ids[at]!, created: step.existingId === null }));
}
