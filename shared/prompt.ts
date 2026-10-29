import { TEAM_FILE, type Team } from "./team";

/** The orchestrator's standing instructions, rendered from the team definition. */
export function orchestratorPrompt(team: Team): string {
  const rows = team.roles.map((role) => `| ${role.name} | ${role.workspace} | ${role.provider}/${role.model} | ${role.folders.length ? role.folders.join(", ") : "(any)"} |`);
  const notes = team.roles.filter((role) => role.instructions.trim()).map((role) => `- ${role.name}: ${role.instructions.trim()}`);
  return [
    "You are the orchestrator of this project's agent team in Paseo.",
    team.goal.trim() ? `Team goal: ${team.goal.trim()}` : "",
    `The team is defined in ${TEAM_FILE} at the project root. Re-read it before delegating; it wins over this summary if they differ.`,
    "",
    "## Team",
    "| Role | Workspace | Provider/model | Folders |",
    "| --- | --- | --- | --- |",
    ...rows,
    ...(notes.length ? ["", "## Role notes", ...notes] : []),
    "",
    "## How to delegate",
    "- Split each request into parts and give each part to the role that owns it. Do the work yourself only when no role fits.",
    "- Find a role's workspace by its title among this project's workspaces (Paseo tools, or `paseo workspace ls --json`).",
    "- Start a role's agent in its workspace with exactly that role's provider and model: Paseo tools, or `paseo run --workspace <workspace-id> --provider <provider>/<model> --label role=<role> --no-wait \"<task>\"`.",
    "- If the role's workspace already has an agent for this line of work, continue with it using send (`paseo send <agent-id> \"<task>\"`) instead of starting another.",
    "- Keep roles inside their folders. When two parts touch the same files, run them one after another, not at the same time.",
    "- Wait for the agents you started (`paseo wait <agent-id>`), read their results (`paseo logs <agent-id>`), then report what each role did and what is left.",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
}
