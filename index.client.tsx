import type { PluginClientContext } from "@getpaseo/plugin/client";
import { TeamPanel } from "./client/TeamPanel";

export default function contribute(client: PluginClientContext) {
  client.addWorkspacePanel({ id: "team", title: "에이전트 팀", icon: "Users", locations: ["workspace"], Component: TeamPanel });
  client.addCommandCenterItem({
    id: "team",
    title: "팀 만들기",
    icon: "Users",
    keywords: ["team", "agents", "orchestrator", "팀", "에이전트"],
    context: "workspace",
    onSelect({ openPanel }) {
      openPanel("team");
    },
  });
  return () => {};
}
