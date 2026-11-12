import type { Team } from "./team";
import { teamWorkspaces } from "./team-files";
import type { AgentFeatures } from "./validate";

const MODE_RULE = "Start each role's agent with its Mode from the table: `--mode <mode>` with `paseo run`, settings.modeId with Paseo tools; omit it only when the Mode is `default`.";

function workspaceLookup(workspace: string): string {
  return `Your own workspace id is the one whose title is "${workspace}" in this project (Paseo tools, or \`paseo workspace ls --json\`). Use that id as <your-workspace-id> in \`paseo run\`.`;
}

/** For a shared team, which other workspaces use the same file; empty when the team is not shared. */
function sharedNote(team: Team, workspace: string, file: string): string[] {
  const others = teamWorkspaces(team).filter((title) => title.trim().toLowerCase() !== workspace.trim().toLowerCase());
  if (!team.orchestrator.sharedWorkspaces?.length || !others.length) return [];
  return [`This team definition is shared with the workspaces ${others.map((title) => `"${title}"`).join(", ")}, each with its own orchestrator and role agents; editing ${file} changes the team in all of them. Never start or continue agents in those workspaces.`];
}

// A provider can have a single, unattended mode (Antigravity has only `full-access`); swapping it fails or changes the team.
const NO_SUBSTITUTE = "Use exactly the role's provider, model and Mode: never substitute another mode or provider, for example `auto` for a provider that has only `full-access`. If starting a role's agent is denied, do not retry it another way; tell the user which role, provider and Mode were blocked.";

/**
 * The team as a markdown table; Mode is the role's agent mode, or "default" when its provider has none.
 */
function teamTable(team: Team, modes: Record<string, string | undefined>, features?: Record<string, AgentFeatures>): string[] {
  const hasFeatures = team.roles.some((role) => features?.[role.name]);
  return [
    `| Role | Provider/model | Mode | Folders |${hasFeatures ? " Features |" : ""}`,
    `| --- | --- | --- | --- |${hasFeatures ? " --- |" : ""}`,
    ...team.roles.map((role) => `| ${role.name} | ${role.provider}/${role.model} | ${modes[role.name] ?? "default"} | ${role.folders.length ? role.folders.join(", ") : "(any)"} |${hasFeatures ? ` ${JSON.stringify(features?.[role.name]) ?? "-"} |` : ""}`),
  ];
}

function featureRules(team: Team, features?: Record<string, AgentFeatures>): string[] {
  if (!team.roles.some((role) => features?.[role.name])) return [];
  return [
    'For roles with Features other than "-", use the Paseo `create_agent` tool: workspaceId = your own workspace id, provider = <provider>/<model>, title = <role>#<id> with 4 random uppercase hex characters, labels = {"role":"<role>"}, initialPrompt = the task, and settings.features exactly as in the table. Always set settings.modeId to the role\'s Mode from the table; omit it only when the Mode is `default`. The --mode / paseo run instructions apply only to roles without features.',
    "Never drop or substitute a role's Features or fall back to `paseo run` for it: `paseo run` cannot set features. If create_agent is unavailable or denied, tell the user which role, provider, Mode and Features were blocked; do not retry another way.",
  ];
}

/**
 * The orchestrator's standing instructions, rendered from the team definition in `file` (project-relative).
 * `workspace` is the orchestrator's own workspace title: the team's home, or one of its shared workspaces.
 */
export function orchestratorPrompt(team: Team, modes: Record<string, string | undefined>, file: string, features?: Record<string, AgentFeatures>, workspace: string = team.orchestrator.workspace): string {
  const notes = team.roles.filter((role) => role.instructions.trim()).map((role) => `- ${role.name}: ${role.instructions.trim()}`);
  return [
    "You are the orchestrator of this project's agent team in Paseo.",
    team.goal.trim() ? `Team goal: ${team.goal.trim()}` : "",
    `The team is defined in ${file} at the project root. Re-read it before delegating; it wins over this summary if they differ.`,
    "Other workspaces of this project may run other teams from other files in .agents/. Ignore them and their workspaces.",
    ...sharedNote(team, workspace, file),
    "",
    "## Team",
    ...teamTable(team, modes, features),
    `Every role runs in the orchestrator's workspace "${workspace}".`,
    ...(notes.length ? ["", "## Role notes", ...notes] : []),
    "",
    "## How to delegate",
    "- Split each request into parts and give each part to the role that owns it. Do the work yourself only when no role fits.",
    workspaceLookup(workspace),
    "- Start a role's agent in your own workspace with exactly that role's provider and model: Paseo tools, or `paseo run --workspace <your-workspace-id> --provider <provider>/<model> --mode <mode> --title <role>#<id> --label role=<role> --no-wait \"<task>\"`. Use 4 random uppercase hex characters for <id> (e.g. ui#ADB2); set the same agent title through Paseo tools. Use the role's Mode from the table as `--mode` with `paseo run` or as settings.modeId with Paseo tools, and omit it only when the Mode is `default`.",
    `- ${NO_SUBSTITUTE}`,
    ...featureRules(team, features).map((rule) => `- ${rule}`),
    "- Look in your own workspace for an unarchived agent labelled role=<role> and continue it using send (`paseo send <agent-id> \"<task>\"`) instead of starting another.",
    "- Keep roles inside their folders. When two parts touch the same files, run them one after another, not at the same time.",
    "- Wait for the agents you started (`paseo wait <agent-id>`), read their results (`paseo logs <agent-id>`), then report what each role did and what is left.",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
}

/** What a running orchestrator is told when the team is applied again; `workspace` is that orchestrator's own workspace title. */
export function teamChangedMessage(team: Team, modes: Record<string, string | undefined>, file: string, features?: Record<string, AgentFeatures>, workspace: string = team.orchestrator.workspace): string {
  return [
    `The team in ${file} changed. Re-read it and use it from now on.`,
    `Every role now runs in the orchestrator's workspace "${workspace}". Earlier instructions about per-role workspaces no longer apply.`,
    ...sharedNote(team, workspace, file),
    "Start and continue role agents only in your own workspace. Find a role's unarchived agent by label role=<role> and continue it with send; start it here if none exists.",
    workspaceLookup(workspace),
    "", ...teamTable(team, modes, features), "", MODE_RULE, NO_SUBSTITUTE, ...featureRules(team, features),
  ].join("\n");
}
