import type { Team } from "./team";
import type { TeamError } from "./validate";

/** Each workspace's team lives in its own file here, named after its orchestrator's workspace. */
export const TEAMS_DIR = ".agents/teams";

/** A team definition and the project-relative file it was read from. */
export interface TeamFile {
  file: string;
  team: Team;
  /** Old role workspace titles, reserved until the file is rewritten without them. */
  legacyWorkspaces?: string[];
}

const key = (title: string) => title.trim().toLowerCase();

/** Captures old role workspace titles before RoleSchema strips them. */
export function legacyWorkspacesOf(value: unknown): string[] {
  if (!value || typeof value !== "object" || !("roles" in value) || !Array.isArray(value.roles)) return [];
  const titles = value.roles.flatMap((role: unknown) => role && typeof role === "object" && "workspace" in role && typeof role.workspace === "string" && role.workspace.trim() ? [role.workspace.trim()] : []);
  return [...new Map(titles.map((title) => [key(title), title])).values()];
}

/** Workspaces reserved by a file, including old role workspaces until Apply rewrites it. */
export function teamFileWorkspaces(entry: TeamFile): string[] {
  return [...new Map([...teamWorkspaces(entry.team), ...(entry.legacyWorkspaces ?? [])].map((title) => [key(title), title])).values()];
}

/** The team reserving a workspace, including an old role workspace. */
export function workspaceOwnerOf(files: readonly TeamFile[], workspace: string): TeamFile | undefined {
  return teamIn(files, workspace) ?? files.find((entry) => teamFileWorkspaces(entry).some((title) => key(title) === key(workspace)));
}

/** The team that runs in the workspace with this title, as its home or one of its shared workspaces. */
export function teamIn(files: readonly TeamFile[], workspace: string): TeamFile | undefined {
  return files.find((entry) => teamWorkspaces(entry.team).some((title) => key(title) === key(workspace)));
}

/** The team whose home (orchestrator.workspace) is the workspace with this title; shared workspaces don't match. */
export function teamAtHome(files: readonly TeamFile[], workspace: string): TeamFile | undefined {
  return files.find((entry) => key(entry.team.orchestrator.workspace) === key(workspace));
}

/** Whether the workspace is the team's home, where its file belongs and from where it is deleted. */
export function isHome(team: Team, workspace: string): boolean {
  return key(team.orchestrator.workspace) === key(workspace);
}

/** Whether the workspace is one of the team's shared workspaces. */
export function isSharedWith(team: Team, workspace: string): boolean {
  return (team.orchestrator.sharedWorkspaces ?? []).some((title) => key(title) === key(workspace));
}

/** The team with the workspace added to its shared workspaces, unless it is the home or already listed. */
export function shareTeam(team: Team, workspace: string): Team {
  const title = workspace.trim();
  if (!title || isHome(team, title) || isSharedWith(team, title)) return team;
  return { ...team, orchestrator: { ...team.orchestrator, sharedWorkspaces: [...(team.orchestrator.sharedWorkspaces ?? []), title] } };
}

/** The team without the workspace among its shared workspaces; the field is dropped when none is left. */
export function unshareTeam(team: Team, workspace: string): Team {
  const { sharedWorkspaces, ...orchestrator } = team.orchestrator;
  const rest = (sharedWorkspaces ?? []).filter((title) => key(title) !== key(workspace));
  return { ...team, orchestrator: rest.length ? { ...orchestrator, sharedWorkspaces: rest } : orchestrator };
}

/** The file and every other team file for the same orchestrator workspace, such as an old `.agents/team.json` beside its new file. */
export function sameTeamFiles(files: readonly TeamFile[], file: string): TeamFile[] {
  const own = files.find((entry) => entry.file === file);
  return own ? files.filter((entry) => key(entry.team.orchestrator.workspace) === key(own.team.orchestrator.workspace)) : [];
}

/** Every team except the one whose home is `workspace`, one per home (the file `teamAtHome` would pick), sorted by that title. */
export function otherTeams(files: readonly TeamFile[], workspace: string): TeamFile[] {
  return files
    .filter((entry, index) => key(entry.team.orchestrator.workspace) !== key(workspace) && teamAtHome(files, entry.team.orchestrator.workspace) === files[index])
    .sort((a, b) => a.team.orchestrator.workspace.localeCompare(b.team.orchestrator.workspace));
}

/** A team copy: a new, independent team with the same goal, roles and orchestrator provider/model whose orchestrator runs in `workspace`; it shares with no workspace and the input is not changed. */
export function copyTeamTo(team: Team, workspace: string): Team {
  const { sharedWorkspaces: _shared, ...orchestrator } = team.orchestrator;
  return { ...team, orchestrator: { ...orchestrator, workspace: workspace.trim() }, roles: team.roles.map((role) => ({ ...role, folders: [...role.folders] })) };
}

/** The team's workspaces: its home, then its shared workspaces. */
export function teamWorkspaces(team: Team): string[] {
  return [team.orchestrator.workspace, ...(team.orchestrator.sharedWorkspaces ?? [])];
}

/** The workspaces (home and shared) of every team except the one whose home is `workspace`. */
export function workspacesOfOtherTeams(files: readonly TeamFile[], workspace: string): string[] {
  return files
    .filter((entry) => key(entry.team.orchestrator.workspace) !== key(workspace))
    .flatMap(teamFileWorkspaces);
}

/** The team's workspaces (home and shared) that another team already uses; teams never share a workspace with another team. */
export function workspaceClashes(team: Team, taken: readonly string[]): TeamError[] {
  const used = new Set(taken.map(key));
  const message = (workspace: string) => `workspace "${workspace}" belongs to another team`;
  return teamWorkspaces(team).filter((workspace) => used.has(key(workspace))).map((workspace) => ({ target: "orchestrator", message: message(workspace) }));
}

/** Where the team is written: the file of the team with the same home, else a new file in TEAMS_DIR named after its home. */
export function teamFileFor(team: Team, files: readonly TeamFile[], names: readonly string[]): string {
  const existing = teamAtHome(files, team.orchestrator.workspace);
  if (existing) return existing.file;
  const base = key(team.orchestrator.workspace).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "team";
  const taken = new Set(names.map((name) => name.toLowerCase()));
  let file = `${TEAMS_DIR}/${base}.json`;
  for (let index = 2; taken.has(file.toLowerCase()); index += 1) file = `${TEAMS_DIR}/${base}-${index}.json`;
  return file;
}
