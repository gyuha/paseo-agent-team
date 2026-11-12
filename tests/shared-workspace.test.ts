import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteTeam, shareWorkspace, unshareWorkspace } from "../server/team";
import { LABEL } from "../shared/cleanup";
import { orchestratorPrompt, teamChangedMessage } from "../shared/prompt";
import { parseTeam, serializeTeam, TeamSchema, type Team } from "../shared/team";
import { applyTeamEdit } from "../shared/team-edit";
import { copyTeamTo, shareTeam, teamIn, TEAMS_DIR, unshareTeam, workspaceClashes, workspacesOfOtherTeams, type TeamFile } from "../shared/team-files";

const team = (workspace: string, shared?: string[]): Team => ({
  version: 1,
  goal: "Ship it",
  orchestrator: { workspace, provider: "claude", model: "m", ...(shared ? { sharedWorkspaces: shared } : {}) },
  roles: [{ name: "qa", provider: "claude", model: "m", folders: ["tests"], instructions: "Tests." }],
});
const entry = (file: string, value: Team): TeamFile => ({ file, team: value });

describe("shared workspace schema", () => {
  it("shared workspace is optional: a file without sharedWorkspaces parses as before", () => {
    const result = parseTeam(JSON.stringify(team("lead")));
    expect(result.ok && result.team.orchestrator).toEqual({ workspace: "lead", provider: "claude", model: "m" });
    expect(result.ok && "sharedWorkspaces" in result.team.orchestrator).toBe(false);
  });

  it("shared workspace titles are trimmed, and a blank title is rejected", () => {
    const result = TeamSchema.safeParse({ ...team("lead"), orchestrator: { workspace: "lead", provider: "claude", model: "m", sharedWorkspaces: ["  side  ", "extra"] } });
    expect(result.success && result.data.orchestrator.sharedWorkspaces).toEqual(["side", "extra"]);
    expect(TeamSchema.safeParse({ ...team("lead"), orchestrator: { workspace: "lead", provider: "claude", model: "m", sharedWorkspaces: ["  "] } }).success).toBe(false);
  });
});

describe("shared workspace lookup and clashes", () => {
  const files = [entry("a.json", team("lead", ["Side", "extra"])), entry("b.json", team("other"))];

  it("shared workspace: teamIn finds the team by a shared title, case-insensitively, and still by its home", () => {
    expect(teamIn(files, "side")?.file).toBe("a.json");
    expect(teamIn(files, " EXTRA ")?.file).toBe("a.json");
    expect(teamIn(files, "LEAD")?.file).toBe("a.json");
    expect(teamIn(files, "nowhere")).toBeUndefined();
  });

  it("shared workspace: workspacesOfOtherTeams includes another team's shared workspaces", () => {
    expect(workspacesOfOtherTeams(files, "other")).toEqual(["lead", "Side", "extra"]);
    expect(workspacesOfOtherTeams(files, "lead")).toEqual(["other"]);
  });

  it("shared workspace: workspaceClashes flags another team's shared workspace, and a team never clashes with its own", () => {
    const mine = team("other", ["side"]);
    expect(workspaceClashes(mine, workspacesOfOtherTeams(files, "other"))).toEqual([{ target: "orchestrator", message: 'workspace "side" belongs to another team' }]);
    const own = team("lead", ["side", "extra"]);
    expect(workspaceClashes(own, workspacesOfOtherTeams(files, "lead"))).toEqual([]);
  });
});

describe("shared workspace team functions", () => {
  it("shared workspace: copyTeamTo drops sharedWorkspaces and does not mutate the input", () => {
    const source = team("lead", ["side"]);
    const snapshot = structuredClone(source);
    const copy = copyTeamTo(source, " new ");
    expect(copy.orchestrator).toEqual({ workspace: "new", provider: "claude", model: "m" });
    expect("sharedWorkspaces" in copy.orchestrator).toBe(false);
    expect(source).toEqual(snapshot);
  });

  it("shared workspace: shareTeam adds a title but not the home or an existing one, case-insensitively", () => {
    const base = team("Lead", ["Side"]);
    expect(shareTeam(base, "  extra ").orchestrator.sharedWorkspaces).toEqual(["Side", "extra"]);
    expect(shareTeam(base, "lead")).toBe(base);
    expect(shareTeam(base, " SIDE ")).toBe(base);
    expect(shareTeam(base, "  ")).toBe(base);
    expect(shareTeam(team("lead"), "side").orchestrator.sharedWorkspaces).toEqual(["side"]);
    expect(base.orchestrator.sharedWorkspaces).toEqual(["Side"]);
  });

  it("shared workspace: unshareTeam removes the title and drops the field when empty", () => {
    const base = team("lead", ["side", "extra"]);
    expect(unshareTeam(base, "SIDE").orchestrator.sharedWorkspaces).toEqual(["extra"]);
    const empty = unshareTeam(unshareTeam(base, "side"), "extra");
    expect("sharedWorkspaces" in empty.orchestrator).toBe(false);
    expect(base.orchestrator.sharedWorkspaces).toEqual(["side", "extra"]);
  });

  it("shared workspace: applyTeamEdit keeps the current team's sharedWorkspaces and ignores the proposal's", () => {
    const draft = team("lead", ["side"]);
    expect(applyTeamEdit(draft, team("lead", ["hijack"])).orchestrator.sharedWorkspaces).toEqual(["side"]);
    expect(applyTeamEdit(draft, team("lead")).orchestrator.sharedWorkspaces).toEqual(["side"]);
    expect("sharedWorkspaces" in applyTeamEdit(team("lead"), team("lead", ["hijack"])).orchestrator).toBe(false);
  });
});

describe("shared workspace orchestrator prompt", () => {
  const shared = team("lead", ["side"]);
  const file = ".agents/teams/lead.json";
  const modes = { qa: "auto" };

  it("shared workspace: the prompt uses that workspace's own title and the same team file, and mentions the sharing", () => {
    const prompt = orchestratorPrompt(shared, modes, file, undefined, "side");
    expect(prompt).toContain(`The team is defined in ${file} at the project root.`);
    expect(prompt).toContain('Every role runs in the orchestrator\'s workspace "side".');
    expect(prompt).toContain('whose title is "side"');
    expect(prompt).not.toContain('whose title is "lead"');
    expect(prompt).toContain('shared with the workspaces "lead"');
    expect(prompt).toContain("Never start or continue agents in those workspaces.");
  });

  it("shared workspace: the home orchestrator is told about the shared workspaces, an unshared team about none", () => {
    expect(orchestratorPrompt(shared, modes, file)).toContain('shared with the workspaces "side"');
    expect(orchestratorPrompt(team("lead"), modes, file)).not.toContain("shared with");
    expect(teamChangedMessage(shared, modes, file, undefined, "side")).toContain('workspace "side"');
    expect(teamChangedMessage(shared, modes, file, undefined, "side")).toContain('shared with the workspaces "lead"');
  });
});

describe("shared workspace server handlers", () => {
  const leadFile = `${TEAMS_DIR}/lead.json`;
  let root: string;
  let archived: string[];
  let sent: { id: string; message: string }[];

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "shared-workspace-"));
    mkdirSync(join(root, TEAMS_DIR), { recursive: true });
    writeFileSync(join(root, leadFile), serializeTeam(team("lead", ["side"])), "utf8");
    writeFileSync(join(root, TEAMS_DIR, "other.json"), serializeTeam(team("other")), "utf8");
    archived = [];
    sent = [];
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const workspace = (title: string) => ({ id: `wks_${title}`, projectId: "prj_1", projectCustomName: null, projectDisplayName: "Demo", projectRootPath: root, archivingAt: null, name: title, title, workspaceKind: "directory" });
  const agent = (id: string, workspaceId: string, labels: Record<string, string>) => ({ id, workspaceId, labels, archivedAt: null });
  const agents = () => [
    agent("orch-lead", "wks_lead", { [LABEL]: "orchestrator" }),
    agent("orch-side", "wks_side", { [LABEL]: "orchestrator" }),
    agent("role-side", "wks_side", { role: "qa" }),
    agent("orch-other", "wks_other", { [LABEL]: "orchestrator" }),
    agent("role-other", "wks_other", { role: "qa" }),
  ];
  const context = () => ({
    paseo: {
      projects: { list: async () => ({ projects: [{ projectId: "prj_1", projectCustomName: null, projectDisplayName: "Demo", projectRootPath: root }] }) },
      workspaces: { list: async () => ({ entries: ["lead", "side", "other", "extra"].map(workspace) }) },
      providers: { snapshot: async () => ({ entries: [{ provider: "claude", enabled: true, status: "ready", modes: [{ id: "auto" }], models: [{ id: "m", label: "m" }] }] }) },
      agents: {
        list: async () => ({ entries: agents().map((value) => ({ agent: value })) }),
        ref: (id: string) => ({ archive: async () => { archived.push(id); return {}; }, send: async (message: string) => { sent.push({ id, message }); } }),
      },
    } as never,
  });

  it("shared workspace: share refuses the team's home", async () => {
    const result = await shareWorkspace({ projectId: "prj_1", file: leadFile, workspaceId: "wks_lead" }, context());
    expect(result).toEqual({ ok: false, errors: ['Workspace "lead" is the team\'s home.'] });
  });

  it("shared workspace: share refuses a workspace that already has a team, shared or its own", async () => {
    const own = await shareWorkspace({ projectId: "prj_1", file: leadFile, workspaceId: "wks_other" }, context());
    expect(own).toEqual({ ok: false, errors: ['Workspace "other" already has a team.'] });
    const again = await shareWorkspace({ projectId: "prj_1", file: leadFile, workspaceId: "wks_side" }, context());
    expect(again).toEqual({ ok: false, errors: ['Workspace "side" already has a team.'] });
    expect(JSON.parse(readFileSync(join(root, leadFile), "utf8")).orchestrator.sharedWorkspaces).toEqual(["side"]);
  });

  it("shared workspace: unshare archives only that workspace's orchestrator, rewrites the file and notifies the others", async () => {
    const result = await unshareWorkspace({ projectId: "prj_1", file: leadFile, workspaceId: "wks_side" }, context());
    expect(result).toEqual({ ok: true, files: [leadFile], archived: ["orch-side"], failures: [] });
    expect(archived).toEqual(["orch-side"]);
    expect("sharedWorkspaces" in JSON.parse(readFileSync(join(root, leadFile), "utf8")).orchestrator).toBe(false);
    expect(sent.map((item) => item.id)).toEqual(["orch-lead"]);
    expect(sent[0]!.message).toContain(`The team in ${leadFile} changed.`);
    expect(sent[0]!.message).not.toContain("shared with");
  });

  it("shared workspace: unshare refuses a workspace the team does not share", async () => {
    const result = await unshareWorkspace({ projectId: "prj_1", file: leadFile, workspaceId: "wks_extra" }, context());
    expect(result).toEqual({ ok: false, errors: ['Workspace "extra" does not share this team.'] });
    expect(archived).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("shared workspace: deleting from the home archives the agents in the shared workspaces too, and leaves other teams", async () => {
    const result = await deleteTeam({ projectId: "prj_1", file: leadFile }, context());
    expect(result).toMatchObject({ files: [leadFile], failures: [], fileFailures: [] });
    expect([...archived].sort()).toEqual(["orch-lead", "orch-side", "role-side"]);
    expect(existsSync(join(root, leadFile))).toBe(false);
    expect(existsSync(join(root, TEAMS_DIR, "other.json"))).toBe(true);
  });
});
