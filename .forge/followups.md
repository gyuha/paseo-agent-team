# Follow-ups

<!-- followup: fu-47de9e53039d | source: paseo-project-team-plugin | task: 1 | date: 2026-10-29 | status: open | taken: - -->
- `paseo.workspaces.list()`·`agents.list()`의 페이지네이션을 따라가지 않음. workspace가 많은 호스트에서는 이름 매칭이 누락돼 중복 생성될 수 있음

<!-- followup: fu-e0953b53000b | source: paseo-project-team-plugin | task: 1 | date: 2026-10-29 | status: open | taken: - -->
- 계획 에이전트를 읽기 전용 모드(claude Plan Mode 등)로 띄우기. 현재는 프롬프트로만 파일 변경을 막음

<!-- followup: fu-4a2dd60fb648 | source: paseo-project-team-plugin | task: 1 | date: 2026-10-29 | status: open | taken: - -->
- Paseo 기본 UI로 workspace에서 에이전트를 띄울 때 역할 모델을 자동 적용(생성 시점 훅 확인 필요)

<!-- followup: fu-bdf2f2bad552 | source: sidebar-team-create | task: 2 | date: 2026-10-29 | status: taken | taken: 3 -->
- Apply 성공 시 계획 에이전트 정리: 플러그인이 만든 "Team planner" workspace는 `paseo.workspaces.archive()`로 보관하고, 기존 workspace에서 띄운 계획 에이전트는 에이전트만 보관한다. 검토 중에는 "계획 에이전트 열기"가 필요하므로 제안 완료가 아니라 Apply 성공 시점에 정리한다.
  근거: UAT 중 사용자가 agents-test 프로젝트에 남은 "Team planner" workspace를 닫을 수 있는지 문의. 이번 계획은 이 정리를 비목표로 두었다.

<!-- followup: fu-0520c8ed98cc | source: max-permission-mode | task: 4 | date: 2026-10-30 | status: open | taken: - -->
- 배포 스킬(`.claude/skills/deploy/SKILL.md`) 5단계를 실제 환경에 맞게 고친다. `getpaseo/plugins`에는 lockfile이 없어 `npm ci`가 실패하고, `node scripts/validate.ts`는 auto mode 분류기가 막는다. 의존성 설치 방식을 바꾸거나, 사용자가 직접 실행하는 단계로 명시하거나, 권한 규칙을 추가해야 한다.
  근거: v0.1.3 배포 때 release 에이전트와 오케스트레이터가 모두 거부당했고, 사용자가 직접 실행했을 때 `npm ci`가 EUSAGE로 실패했다.

<!-- followup: fu-1145da606e5c | source: max-permission-mode | task: 4 | date: 2026-10-30 | status: taken | taken: 7 -->
- `tests/daemon.e2e.test.ts`가 끝날 때 자기가 만든 오케스트레이터와 그 오케스트레이터가 띄운 역할 에이전트를 보관(archive)하게 한다. 지금은 임시 `pwa-game-*` workspace에 idle 에이전트가 쌓인다.
  근거: 이번 e2e 3회로 오케스트레이터 3개와 smoke test 역할 에이전트 5개가 남았다.

<!-- followup: fu-3c0b7a9e21d4 | source: agent-dashboard-tab | task: 5 | date: 2026-10-30 | status: taken | taken: 6 -->
- 대시보드 effort 칩: effort 값(`thinkingOptionId`/`effectiveThinkingOptionId`)이 비어 있으면 provider snapshot의 모델 `defaultThinkingOptionId`를 흐리게 표시한다. Paseo 화면이 하는 방식과 같다.
  근거: 오케스트레이터 입력창은 effort가 비어 있는데도 "Medium"을 표시했고, snapshot의 claude-opus-5-5 기본값도 medium이다. 대시보드의 claude 카드에는 effort 칩이 없다.
