// UI text. English is the default; Paseo picks the resource for the app's language.

export const en = {
  panelTitle: "Agent team",
  commandTitle: "Create agent team",
  loading: "Loading…",
  title: "Agent team · {{project}}",
  current: {
    orchestrator: "Orchestrator: {{workspace}} · {{model}}",
    edit: "Edit",
    reapply: "Apply again",
  },
  create: {
    intro: "Create a team: describe the goal and a planner agent proposes a provider and model for each role.",
    goalPlaceholder: "e.g. 2D platformer game",
    propose: "Propose a team",
    blank: "Start with an empty team",
    planning: "The planner is putting the team together…",
    openPlanner: "Open planner",
  },
  review: {
    title: "Review the proposal",
    orchestrator: "Orchestrator",
    addRole: "Add role",
    apply: "Apply",
    cancel: "Cancel",
  },
  role: {
    name: "Role name",
    workspace: "Workspace name",
    remove: "Remove",
    folders: "Folders (comma-separated, empty for no limit)",
    instructions: "Instructions",
  },
  result: {
    applying: "Applying… (save file → create workspaces → start orchestrator)",
    applied: "Applied: {{file}}",
    created: "{{target}} → {{workspace}} (created)",
    reused: "{{target}} → {{workspace}} (reused)",
    openOrchestrator: "Open orchestrator",
  },
} as const;

type Shape<T> = { readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

export const ko: Shape<typeof en> = {
  panelTitle: "에이전트 팀",
  commandTitle: "에이전트 팀 만들기",
  loading: "불러오는 중…",
  title: "에이전트 팀 · {{project}}",
  current: {
    orchestrator: "오케스트레이터: {{workspace}} · {{model}}",
    edit: "편집",
    reapply: "다시 적용",
  },
  create: {
    intro: "팀 만들기: 목표를 적으면 계획 에이전트가 역할별 provider/모델을 제안합니다.",
    goalPlaceholder: "예: 2D 플랫포머 게임",
    propose: "팀 제안 받기",
    blank: "빈 팀으로 시작",
    planning: "계획 에이전트가 팀을 구성하는 중…",
    openPlanner: "계획 에이전트 열기",
  },
  review: {
    title: "제안 검토",
    orchestrator: "오케스트레이터",
    addRole: "역할 추가",
    apply: "적용",
    cancel: "취소",
  },
  role: {
    name: "역할 이름",
    workspace: "workspace 이름",
    remove: "삭제",
    folders: "담당 폴더 (쉼표로 구분, 비우면 제한 없음)",
    instructions: "지시",
  },
  result: {
    applying: "적용 중… (파일 저장 → workspace 생성 → 오케스트레이터 시작)",
    applied: "적용했습니다: {{file}}",
    created: "{{target}} → {{workspace}} (새로 만듦)",
    reused: "{{target}} → {{workspace}} (기존 재사용)",
    openOrchestrator: "오케스트레이터 열기",
  },
};
