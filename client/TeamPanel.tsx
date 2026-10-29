import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { foldersText, newRole, parseFolders } from "../shared/draft";
import { teamApplyRpc, teamProposalRpc, teamProposeRpc, teamReadRpc } from "../shared/rpc";
import { checkTeam, type Role, type Team } from "../shared/team";
import { validateTeam, type ProviderInfo } from "../shared/validate";

type Colors = PluginWorkspacePanelProps["theme"]["colors"];

function styles(colors: Colors, compact: boolean) {
  return {
    screen: { flex: 1, backgroundColor: colors.surface0 },
    body: { padding: compact ? 12 : 20, gap: 12 },
    title: { color: colors.foreground, fontSize: 16, fontWeight: "600" as const },
    text: { color: colors.foreground },
    muted: { color: colors.foregroundMuted, fontSize: 12 },
    danger: { color: colors.statusDanger, fontSize: 12 },
    success: { color: colors.statusSuccess },
    card: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, gap: 6, backgroundColor: colors.surface1 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, backgroundColor: colors.surface0 },
    row: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, alignItems: "center" as const },
    button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: colors.accent },
    buttonText: { color: colors.accentForeground, fontWeight: "600" as const },
    secondary: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
    chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    chipOn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accent },
  };
}

type Styles = ReturnType<typeof styles>;

function Button({ s, label, onPress, disabled, secondary }: { s: Styles; label: string; onPress(): void; disabled?: boolean; secondary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[secondary ? s.secondary : s.button, disabled ? { opacity: 0.5 } : null]}>
      <Text style={secondary ? s.text : s.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Chips({ s, options, value, onChange }: { s: Styles; options: readonly string[]; value: string; onChange(value: string): void }) {
  return (
    <View style={s.row}>
      {options.map((option) => (
        <Pressable key={option} accessibilityRole="button" accessibilityLabel={option} onPress={() => onChange(option)} style={option === value ? s.chipOn : s.chip}>
          <Text style={option === value ? s.buttonText : s.text}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Provider and model pickers limited to what this host can run. */
function ModelPicker({ s, catalog, provider, model, onChange }: { s: Styles; catalog: readonly ProviderInfo[]; provider: string; model: string; onChange(next: { provider: string; model: string }): void }) {
  const ready = catalog.filter((entry) => entry.ready);
  const models = ready.find((entry) => entry.id === provider)?.models.map((entry) => entry.id) ?? [];
  return (
    <View style={{ gap: 4 }}>
      <Chips s={s} options={ready.map((entry) => entry.id)} value={provider} onChange={(next) => onChange({ provider: next, model: ready.find((entry) => entry.id === next)?.models[0]?.id ?? "" })} />
      <Chips s={s} options={models} value={model} onChange={(next) => onChange({ provider, model: next })} />
    </View>
  );
}

function RoleEditor({ s, role, catalog, onChange, onRemove }: { s: Styles; role: Role; catalog: readonly ProviderInfo[]; onChange(role: Role): void; onRemove(): void }) {
  const [folders, setFolders] = useState(foldersText(role.folders));
  return (
    <View style={s.card}>
      <View style={s.row}>
        <TextInput style={[s.input, { flex: 1 }]} value={role.name} placeholder="역할 이름" onChangeText={(name) => onChange({ ...role, name })} />
        <TextInput style={[s.input, { flex: 1 }]} value={role.workspace} placeholder="workspace 이름" onChangeText={(workspace) => onChange({ ...role, workspace })} />
        <Button s={s} secondary label="삭제" onPress={onRemove} />
      </View>
      <ModelPicker s={s} catalog={catalog} provider={role.provider} model={role.model} onChange={(next) => onChange({ ...role, ...next })} />
      <TextInput
        style={s.input}
        value={folders}
        placeholder="담당 폴더 (쉼표로 구분, 비우면 제한 없음)"
        onChangeText={(text) => {
          setFolders(text);
          onChange({ ...role, folders: parseFolders(text) });
        }}
      />
      <TextInput style={s.input} value={role.instructions} placeholder="지시" multiline onChangeText={(instructions) => onChange({ ...role, instructions })} />
    </View>
  );
}

export function TeamPanel({ theme, layout, workspaceId, navigation }: PluginWorkspacePanelProps) {
  const s = useMemo(() => styles(theme.colors, layout.compact), [theme, layout.compact]);
  const read = useRpc(teamReadRpc);
  const propose = useRpc(teamProposeRpc);
  const proposal = useRpc(teamProposalRpc);
  const apply = useRpc(teamApplyRpc);

  const current = useQuery({ queryKey: ["workspace-agents", "team", workspaceId], queryFn: () => read({ workspaceId }) });
  const [goal, setGoal] = useState("");
  const [plannerId, setPlannerId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Team | null>(null);

  const planning = useQuery({
    queryKey: ["workspace-agents", "proposal", plannerId],
    queryFn: () => proposal({ agentId: plannerId! }),
    enabled: plannerId !== null,
    refetchInterval: (query) => (query.state.data?.status === "running" || !query.state.data ? 2000 : false),
  });
  useEffect(() => {
    if (planning.data?.status === "done") setDraft(planning.data.team);
  }, [planning.data]);

  const start = useMutation({ mutationFn: () => propose({ workspaceId, goal }), onSuccess: ({ agentId }) => setPlannerId(agentId) });
  const applied = useMutation({ mutationFn: (team: Team) => apply({ workspaceId, team }), onSuccess: () => void current.refetch() });

  const catalog = current.data?.catalog ?? [];
  const checked = draft ? checkTeam(draft) : null;
  const problems = draft && checked?.ok ? validateTeam(checked.team, catalog).map((error) => `${error.target}: ${error.message}`) : (checked && !checked.ok ? checked.errors : []);
  const updateRole = (index: number, role: Role) => draft && setDraft({ ...draft, roles: draft.roles.map((entry, at) => (at === index ? role : entry)) });

  if (current.isLoading) return <View style={[s.screen, s.body]}><Text style={s.muted}>불러오는 중…</Text></View>;
  if (current.error) return <View style={[s.screen, s.body]}><Text style={s.danger}>{String(current.error)}</Text></View>;
  const data = current.data!;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Text style={s.title}>에이전트 팀 · {data.project.name}</Text>
      <Text style={s.muted}>{data.project.root}/.agents/team.json</Text>

      {data.errors.map((error) => <Text key={error} style={s.danger}>{error}</Text>)}
      {data.team && !draft ? (
        <View style={s.card}>
          <Text style={s.text}>오케스트레이터: {data.team.orchestrator.workspace} · {data.team.orchestrator.provider}/{data.team.orchestrator.model}</Text>
          {data.team.roles.map((role) => (
            <Text key={role.name} style={s.text}>• {role.name} → {role.workspace} · {role.provider}/{role.model}{role.folders.length ? ` · ${role.folders.join(", ")}` : ""}</Text>
          ))}
          {data.validation.map((error) => <Text key={error.target + error.message} style={s.danger}>{error.target}: {error.message}</Text>)}
          <View style={s.row}>
            <Button s={s} label="편집" onPress={() => setDraft(data.team)} />
            <Button s={s} secondary label="다시 적용" disabled={applied.isPending} onPress={() => applied.mutate(data.team!)} />
          </View>
        </View>
      ) : null}

      {!draft ? (
        <View style={s.card}>
          <Text style={s.text}>팀 만들기: 목표를 적으면 계획 에이전트가 역할별 provider/모델을 제안합니다.</Text>
          <TextInput style={s.input} value={goal} placeholder="예: 2D 플랫포머 게임" onChangeText={setGoal} />
          <View style={s.row}>
            <Button s={s} label="팀 제안 받기" disabled={!goal.trim() || start.isPending || planning.data?.status === "running"} onPress={() => start.mutate()} />
            <Button s={s} secondary label="빈 팀으로 시작" onPress={() => setDraft({ version: 1, goal, orchestrator: { workspace: "orchestrator", provider: "claude", model: catalog.find((entry) => entry.id === "claude")?.models[0]?.id ?? "" }, roles: [newRole(catalog, [])] })} />
          </View>
          {plannerId && (!planning.data || planning.data.status === "running") ? <Text style={s.muted}>계획 에이전트가 팀을 구성하는 중…</Text> : null}
          {planning.data?.status === "failed" ? planning.data.errors.map((error) => <Text key={error} style={s.danger}>{error}</Text>) : null}
          {start.error ? <Text style={s.danger}>{String(start.error)}</Text> : null}
          {plannerId && navigation ? <Button s={s} secondary label="계획 에이전트 열기" onPress={() => navigation.openAgent({ agentId: plannerId })} /> : null}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={s.title}>제안 검토</Text>
          <View style={s.card}>
            <Text style={s.text}>오케스트레이터</Text>
            <TextInput style={s.input} value={draft.orchestrator.workspace} placeholder="workspace 이름" onChangeText={(workspace) => setDraft({ ...draft, orchestrator: { ...draft.orchestrator, workspace } })} />
            <ModelPicker s={s} catalog={catalog} provider={draft.orchestrator.provider} model={draft.orchestrator.model} onChange={(next) => setDraft({ ...draft, orchestrator: { ...draft.orchestrator, ...next } })} />
          </View>
          {draft.roles.map((role, index) => (
            <RoleEditor key={index} s={s} role={role} catalog={catalog} onChange={(next) => updateRole(index, next)} onRemove={() => setDraft({ ...draft, roles: draft.roles.filter((_, at) => at !== index) })} />
          ))}
          <Button s={s} secondary label="역할 추가" onPress={() => setDraft({ ...draft, roles: [...draft.roles, newRole(catalog, draft.roles.map((role) => role.name))] })} />
          {problems.map((problem) => <Text key={problem} style={s.danger}>{problem}</Text>)}
          <View style={s.row}>
            <Button s={s} label="적용" disabled={problems.length > 0 || applied.isPending} onPress={() => applied.mutate(draft)} />
            <Button s={s} secondary label="취소" onPress={() => { setDraft(null); setPlannerId(null); }} />
          </View>
        </View>
      )}

      {applied.isPending ? <Text style={s.muted}>적용 중… (파일 저장 → workspace 생성 → 오케스트레이터 시작)</Text> : null}
      {applied.error ? <Text style={s.danger}>{String(applied.error)}</Text> : null}
      {applied.data && !applied.data.ok ? applied.data.errors.map((error) => <Text key={error} style={s.danger}>{error}</Text>) : null}
      {applied.data?.ok ? (
        <View style={s.card}>
          <Text style={s.success}>적용했습니다: {applied.data.file}</Text>
          {applied.data.workspaces.map((workspace) => (
            <Text key={workspace.id} style={s.text}>• {workspace.target} → {workspace.workspace} ({workspace.created ? "새로 만듦" : "기존 재사용"})</Text>
          ))}
          {navigation ? <Button s={s} label="오케스트레이터 열기" onPress={() => navigation.openAgent({ agentId: (applied.data as { orchestratorAgentId: string }).orchestratorAgentId })} /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
