import type { PluginServerContext } from "@getpaseo/plugin/server";
import { applyTeam, proposeTeam, readTeam, teamProposal } from "./server/team";
import { teamApplyRpc, teamProposalRpc, teamProposeRpc, teamReadRpc } from "./shared/rpc";

export default function contribute(server: PluginServerContext) {
  server.handle(teamReadRpc, readTeam);
  server.handle(teamProposeRpc, proposeTeam);
  server.handle(teamProposalRpc, teamProposal);
  server.handle(teamApplyRpc, applyTeam);
  return () => {};
}
