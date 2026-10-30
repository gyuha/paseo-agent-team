import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
import { RoleSchema, TeamSchema } from "./team";

const ProviderInfoSchema = z.object({
  id: z.string(),
  ready: z.boolean(),
  status: z.string(),
  models: z.array(z.object({ id: z.string(), label: z.string() })),
});

const TeamErrorSchema = z.object({ target: z.string(), message: z.string() });

const ProjectSchema = z.object({ id: z.string(), name: z.string(), root: z.string() });

/** A workspace of the project, or the project itself when no workspace is open. */
const TargetSchema = z.union([z.object({ workspaceId: z.string() }), z.object({ projectId: z.string() })]);

/** Every project on this host with its teams, orchestrator workspaces and team-file parse errors. */
export const teamProjectsRpc = defineRpc({
  name: "team.projects",
  input: z.object({}),
  output: z.array(ProjectSchema.extend({
    teams: z.array(z.object({
      file: z.string(),
      goal: z.string(),
      orchestratorWorkspace: z.string(),
      workspaceId: z.string().nullable(),
      roles: z.number(),
    })),
    errors: z.array(z.string()),
  })),
});

/** The project (or a workspace's project), the team that runs in the workspace (if any) and what this host can run. */
export const teamReadRpc = defineRpc({
  name: "team.read",
  input: TargetSchema,
  output: z.object({
    project: ProjectSchema,
    /** The target workspace's title, or null when the target is the project. */
    workspace: z.string().nullable(),
    /** The project-relative file of the team that runs in the workspace, or null when it has none. */
    file: z.string().nullable(),
    team: TeamSchema.nullable(),
    /** When the workspace has no team: the team (by its orchestrator's workspace) and role that use it as the role's own. */
    owner: z.object({ team: z.string(), role: z.string() }).nullable(),
    /** Workspace titles the project's other teams use; a team can't use them too. */
    takenWorkspaces: z.array(z.string()),
    /** Problems reading or parsing the project's team files. */
    errors: z.array(z.string()),
    /** Providers or models in the team file this host can't run. */
    validation: z.array(TeamErrorSchema),
    catalog: z.array(ProviderInfoSchema),
  }),
});

/** Starts a planner agent that proposes a team for the goal. */
export const teamProposeRpc = defineRpc({
  name: "team.propose",
  input: TargetSchema.and(z.object({ goal: z.string().trim().min(1) })),
  output: z.object({ agentId: z.string() }),
});

/** The planner's proposal once it has finished. */
export const teamProposalRpc = defineRpc({
  name: "team.proposal",
  input: z.object({ agentId: z.string() }),
  output: z.discriminatedUnion("status", [
    z.object({ status: z.literal("running") }),
    z.object({ status: z.literal("done"), team: TeamSchema, validation: z.array(TeamErrorSchema) }),
    z.object({ status: z.literal("failed"), errors: z.array(z.string()) }),
  ]),
});

const TeamOutlineSchema = z.object({
  orchestratorWorkspace: z.string(),
  roles: z.array(z.object({ name: z.string(), workspace: z.string(), folders: z.array(z.string()) })),
});

/** Starts a planner agent that proposes one more role for the team being edited. */
export const teamRoleProposeRpc = defineRpc({
  name: "team.role.propose",
  input: TargetSchema.and(z.object({ description: z.string().trim().min(1), team: TeamOutlineSchema })),
  output: z.object({ agentId: z.string() }),
});

/** The role planner's proposal once it has finished. */
export const teamRoleProposalRpc = defineRpc({
  name: "team.role.proposal",
  input: z.object({ agentId: z.string() }),
  output: z.discriminatedUnion("status", [
    z.object({ status: z.literal("running") }),
    z.object({ status: z.literal("done"), role: RoleSchema }),
    z.object({ status: z.literal("failed"), errors: z.array(z.string()) }),
  ]),
});

const AppliedWorkspaceSchema = z.object({ target: z.string(), workspace: z.string(), id: z.string(), created: z.boolean() });

/** Writes the team file, creates missing workspaces, starts the orchestrator and archives the planners. */
export const teamApplyRpc = defineRpc({
  name: "team.apply",
  input: TargetSchema.and(z.object({ team: z.unknown() })),
  output: z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(false), errors: z.array(z.string()) }),
    z.object({
      ok: z.literal(true),
      file: z.string(),
      workspaces: z.array(AppliedWorkspaceSchema),
      orchestratorAgentId: z.string(),
      /** Planners or planner workspaces that could not be archived; the team itself was applied. */
      cleanup: z.array(z.string()),
      /** The Claude settings file the orchestrator's `paseo run` allow rule was added to, or null when none was added. */
      permission: z.string().nullable(),
    }),
  ]),
});
