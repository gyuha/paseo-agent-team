import type { PluginServerContext } from "@getpaseo/plugin/server";
import { applyTeam, cancelProposal, pendingProposal, projectTeamsList, proposeRole, proposeTeam, readTeam, restartOrchestrator, roleProposal, teamProposal, teamRoster } from "./server/team";
import { teamApplyRpc, teamPendingProposalRpc, teamProjectsRpc, teamProposalCancelRpc, teamProposalRpc, teamProposeRpc, teamReadRpc, teamRestartOrchestratorRpc, teamRoleProposalRpc, teamRoleProposeRpc, teamRosterRpc } from "./shared/rpc";

export default function contribute(server: PluginServerContext) {
  server.handle(teamProjectsRpc, projectTeamsList);
  server.handle(teamReadRpc, readTeam);
  server.handle(teamProposeRpc, proposeTeam);
  server.handle(teamProposalRpc, teamProposal);
  server.handle(teamPendingProposalRpc, pendingProposal);
  server.handle(teamProposalCancelRpc, cancelProposal);
  server.handle(teamRoleProposeRpc, proposeRole);
  server.handle(teamRoleProposalRpc, roleProposal);
  server.handle(teamApplyRpc, applyTeam);
  server.handle(teamRestartOrchestratorRpc, restartOrchestrator);
  server.handle(teamRosterRpc, teamRoster);
  return () => {};
}
