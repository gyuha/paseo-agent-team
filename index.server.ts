import type { PluginServerContext } from "@getpaseo/plugin/server";
import { applyTeam, projectTeamsList, proposeRole, proposeTeam, readTeam, roleProposal, teamProposal } from "./server/team";
import { teamApplyRpc, teamProjectsRpc, teamProposalRpc, teamProposeRpc, teamReadRpc, teamRoleProposalRpc, teamRoleProposeRpc } from "./shared/rpc";

export default function contribute(server: PluginServerContext) {
  server.handle(teamProjectsRpc, projectTeamsList);
  server.handle(teamReadRpc, readTeam);
  server.handle(teamProposeRpc, proposeTeam);
  server.handle(teamProposalRpc, teamProposal);
  server.handle(teamRoleProposeRpc, proposeRole);
  server.handle(teamRoleProposalRpc, roleProposal);
  server.handle(teamApplyRpc, applyTeam);
  return () => {};
}
