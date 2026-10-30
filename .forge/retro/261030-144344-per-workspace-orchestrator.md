<!-- auto-retro: fg-done all -->
# 2026-10-30 — 워크스페이스마다 오케스트레이터 띄우기

## 계획 대비 실제
- 계획대로 된 것: S1, S2, S4~S6은 계획대로 끝났다. unit 164 → 185 passed, e2e 7 → 8 passed.
- 어긋난 것: S3에서 RPC 이름을 `team.startHere`로 정했지만, plugin SDK가 대문자가 든 RPC 이름을 거부했다(rpc.ts를 불러올 때 예외). 그래서 `team.start-here`로 바꿨다. 새 오케스트레이터의 시스템 프롬프트는 앱 화면에서 직접 보지 못했고, 단위 테스트로만 확인했다.

## 배운 것
- 다음엔 다르게: RPC 이름은 소문자와 `.`, `-`만 쓴다(예: `team.role.propose`). 계획서에 이름을 적을 때부터 이 규칙을 따른다.

## 문서 갱신
- 검토되지 않음(자동 회고)

## 후속 작업 후보

<!-- followup: fu-9d41c6a2e7b0 | source: per-workspace-orchestrator | task: 9 | date: 2026-10-30 | status: open | taken: - -->
- e2e가 만든 임시 `pwa-game-*` 프로젝트의 워크스페이스는 보관되지 않아 사이드바에 쌓인다(에이전트는 보관됨). e2e의 `afterAll`에서 임시 워크스페이스도 보관한다.
  근거: UAT 중 사이드바에 `pwa-game-*` 프로젝트가 4개 이상 보였다.
