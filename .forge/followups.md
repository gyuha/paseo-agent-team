# Follow-ups

<!-- followup: fu-47de9e53039d | source: paseo-project-team-plugin | task: 1 | date: 2026-10-29 | status: open | taken: - -->
- `paseo.workspaces.list()`·`agents.list()`의 페이지네이션을 따라가지 않음. workspace가 많은 호스트에서는 이름 매칭이 누락돼 중복 생성될 수 있음

<!-- followup: fu-e0953b53000b | source: paseo-project-team-plugin | task: 1 | date: 2026-10-29 | status: open | taken: - -->
- 계획 에이전트를 읽기 전용 모드(claude Plan Mode 등)로 띄우기. 현재는 프롬프트로만 파일 변경을 막음

<!-- followup: fu-4a2dd60fb648 | source: paseo-project-team-plugin | task: 1 | date: 2026-10-29 | status: open | taken: - -->
- Paseo 기본 UI로 workspace에서 에이전트를 띄울 때 역할 모델을 자동 적용(생성 시점 훅 확인 필요)

<!-- followup: fu-bdf2f2bad552 | source: sidebar-team-create | task: 2 | date: 2026-10-29 | status: open | taken: - -->
- Apply 성공 시 계획 에이전트 정리: 플러그인이 만든 "Team planner" workspace는 `paseo.workspaces.archive()`로 보관하고, 기존 workspace에서 띄운 계획 에이전트는 에이전트만 보관한다. 검토 중에는 "계획 에이전트 열기"가 필요하므로 제안 완료가 아니라 Apply 성공 시점에 정리한다.
  근거: UAT 중 사용자가 agents-test 프로젝트에 남은 "Team planner" workspace를 닫을 수 있는지 문의. 이번 계획은 이 정리를 비목표로 두었다.
