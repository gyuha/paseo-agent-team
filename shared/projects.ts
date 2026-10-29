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

/** The projects that can still get a team: those whose id isn't in `withTeam`. */
export function projectsWithoutTeam(projects: readonly ProjectRef[], withTeam: ReadonlySet<string>): ProjectRef[] {
  return projects.filter((project) => !withTeam.has(project.id));
}

/** A workspace of the project to run the planner in, or null when one has to be created. */
export function plannerWorkspace(workspaces: readonly ProjectWorkspace[], projectId: string): string | null {
  return workspaces.find((workspace) => workspace.projectId === projectId && !workspace.archivingAt)?.id ?? null;
}
