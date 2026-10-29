import type { PluginClientContext } from "@getpaseo/plugin/client";
import { messages } from "./client/i18n";
import { TeamPanel } from "./client/TeamPanel";

export default function contribute(client: PluginClientContext) {
  client.addWorkspacePanel({ id: "team", title: messages.message("panelTitle"), icon: "Users", locations: ["workspace"], Component: TeamPanel });
  client.addCommandCenterItem({
    id: "team",
    title: messages.message("commandTitle"),
    icon: "Users",
    keywords: ["team", "agents", "orchestrator", "팀", "에이전트"],
    context: "workspace",
    onSelect({ openPanel }) {
      openPanel("team");
    },
  });
  return () => {};
}
