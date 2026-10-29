import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
import { TeamSchema } from "./team";

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

/** The projects on this host that have no team file yet. */
export const teamProjectsRpc = defineRpc({
  name: "team.projects",
  input: z.object({}),
  output: z.array(ProjectSchema),
});

/** The project (or a workspace's project), its team file (if any) and what this host can run. */
export const teamReadRpc = defineRpc({
  name: "team.read",
  input: TargetSchema,
  output: z.object({
    project: ProjectSchema,
    team: TeamSchema.nullable(),
    /** Problems reading or parsing the team file. */
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

const AppliedWorkspaceSchema = z.object({ target: z.string(), workspace: z.string(), id: z.string(), created: z.boolean() });

/** Writes the team file, creates missing workspaces and starts the orchestrator. */
export const teamApplyRpc = defineRpc({
  name: "team.apply",
  input: TargetSchema.and(z.object({ team: z.unknown() })),
  output: z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(false), errors: z.array(z.string()) }),
    z.object({ ok: z.literal(true), file: z.string(), workspaces: z.array(AppliedWorkspaceSchema), orchestratorAgentId: z.string() }),
  ]),
});
