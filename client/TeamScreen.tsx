import type { PluginScreenProps, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { usePaseo, useRpc, useTranslation } from "@getpaseo/plugin/client";
import { SidebarRow, useToast } from "@getpaseo/plugin/client/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { messages } from "./i18n";
import { teamProjectsRpc } from "../shared/rpc";
import { Button, PROJECT_TEAMS_KEY, styles, TeamEditor } from "./TeamPanel";

export const SCREEN_ID = "team";

/** Every project and its teams, refetched when the host's projects change. */
function useProjectTeams() {
  const list = useRpc(teamProjectsRpc);
  const paseo = usePaseo();
  const queryClient = useQueryClient();
  useEffect(() => paseo.projects.subscribe(() => void queryClient.invalidateQueries({ queryKey: PROJECT_TEAMS_KEY })), [paseo, queryClient]);
  return useQuery({ queryKey: PROJECT_TEAMS_KEY, queryFn: () => list({}) });
}

export function TeamSidebarItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  const { t } = useTranslation(messages);
  return <SidebarRow icon="Users" label={t("commandTitle")} active={currentScreen?.screenId === SCREEN_ID} onPress={() => openScreen({ screenId: SCREEN_ID })} />;
}

/** Browse every project's agent teams, open an existing team's panel, or create a new team. */
export function TeamScreen({ theme, layout, navigation, openTeamPanel }: PluginScreenProps & { openTeamPanel?: (workspaceId: string) => void }) {
  const s = useMemo(() => styles(theme.colors, layout.compact), [theme, layout.compact]);
  const { t } = useTranslation(messages);
  const projects = useProjectTeams();
  const toast = useToast();
  const [projectId, setProjectId] = useState<string | null>(null);

  if (projectId) {
    return (
      <View style={s.screen}>
        <View style={[s.row, { padding: layout.compact ? 12 : 20, paddingBottom: 0 }]}>
          <Button s={s} secondary label={t("screen.back")} onPress={() => setProjectId(null)} />
        </View>
        <TeamEditor
          theme={theme}
          layout={layout}
          navigation={navigation}
          target={{ projectId }}
          onApplied={(result) => {
            // The screen is left right away, so cleanup problems go to a toast instead of the result card.
            if (result.cleanup.length) toast.error(t("result.cleanupFailed", { failure: result.cleanup.join("; ") }));
            navigation?.openWorkspace({ workspaceId: result.workspaces[0]!.id });
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Text style={s.title}>{t("screen.title")}</Text>
      {projects.isLoading ? <Text style={s.muted}>{t("loading")}</Text> : null}
      {projects.error ? <Text style={s.danger}>{String(projects.error)}</Text> : null}
      {projects.data?.map((project) => (
        <View key={project.id} style={s.card}>
          <Text style={s.text}>{project.name}</Text>
          <Text style={s.muted}>{project.root}</Text>
          {project.errors.map((error) => <Text key={error} style={s.danger}>{error}</Text>)}
          {!project.teams.length ? <Text style={s.muted}>{t("screen.noTeams")}</Text> : null}
          {project.teams.map((team) => (
            <View key={team.file} style={s.row}>
              <Text style={s.text}>{team.orchestratorWorkspace}</Text>
              {team.goal ? <Text style={s.muted}>{team.goal}</Text> : null}
              <Text style={s.muted}>{t("screen.roles", { count: team.roles })}</Text>
              {!team.workspaceId ? <Text style={s.muted}>{t("screen.workspaceMissing")}</Text> : null}
              <Button s={s} secondary label={t("screen.openTeam")} disabled={!team.workspaceId} onPress={() => team.workspaceId && openTeamPanel?.(team.workspaceId)} />
            </View>
          ))}
          <View style={s.row}>
            <Button s={s} label={t("screen.newTeam")} onPress={() => setProjectId(project.id)} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
