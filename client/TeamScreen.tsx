import type { PluginScreenProps, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { usePaseo, useRpc, useTranslation } from "@getpaseo/plugin/client";
import { SidebarRow, useToast } from "@getpaseo/plugin/client/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { messages } from "./i18n";
import { teamProjectsRpc } from "../shared/rpc";
import { Button, styles, TEAMLESS_KEY, TeamEditor } from "./TeamPanel";

export const SCREEN_ID = "team";

/** The projects without a team, refetched when the host's projects change. */
function useTeamlessProjects() {
  const list = useRpc(teamProjectsRpc);
  const paseo = usePaseo();
  const queryClient = useQueryClient();
  useEffect(() => paseo.projects.subscribe(() => void queryClient.invalidateQueries({ queryKey: TEAMLESS_KEY })), [paseo, queryClient]);
  return useQuery({ queryKey: TEAMLESS_KEY, queryFn: () => list({}) });
}

/** Shown only while some project has no team; hidden once every project has one. */
export function TeamSidebarItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  const { t } = useTranslation(messages);
  const teamless = useTeamlessProjects();
  if (!teamless.data?.length) return null;
  return <SidebarRow icon="Users" label={t("commandTitle")} active={currentScreen?.screenId === SCREEN_ID} onPress={() => openScreen({ screenId: SCREEN_ID })} />;
}

/** Create a team without an open workspace: pick a project without a team, then the usual flow. */
export function TeamScreen({ theme, layout, navigation }: PluginScreenProps) {
  const s = useMemo(() => styles(theme.colors, layout.compact), [theme, layout.compact]);
  const { t } = useTranslation(messages);
  const teamless = useTeamlessProjects();
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
      {teamless.isLoading ? <Text style={s.muted}>{t("loading")}</Text> : null}
      {teamless.error ? <Text style={s.danger}>{String(teamless.error)}</Text> : null}
      {teamless.data && !teamless.data.length ? <Text style={s.muted}>{t("screen.none")}</Text> : null}
      {teamless.data?.map((project) => (
        <View key={project.id} style={s.card}>
          <Text style={s.text}>{project.name}</Text>
          <Text style={s.muted}>{project.root}</Text>
          <View style={s.row}>
            <Button s={s} label={t("screen.choose")} onPress={() => setProjectId(project.id)} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
