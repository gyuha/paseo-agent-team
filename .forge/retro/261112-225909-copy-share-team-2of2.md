<!-- auto-retro: fg-done all -->
# 2026-11-12 — 팀 공유 (part 2/2)

## 계획 대비 실제
- 계획대로 된 것: 스키마(sharedWorkspaces)·share/unshare RPC·원본 삭제·알림·프롬프트·UI·문서. "shared workspace" 테스트 16개, 전체 465개 통과, 앱 확인 통과.
- 달랐던 점: (1) AI 편집 결과 병합(applyTeamEdit)과 planner 스키마에 sharedWorkspaces가 없어 공유 팀을 AI로 편집하면 공유가 조용히 풀리는 위험을 core가 구현 중 발견해, 클라이언트·서버 양쪽에서 보존하도록 같은 작업 안에서 고쳤다. (2) share/unshare 뒤 다른 오케스트레이터 알림이 계획에 없어 추가했다. (3) 팀 패널에는 원래 [삭제]가 없어 원본 삭제 확인은 Agent teams 화면에만 반영됐다. (4) 문서에 Agent teams 행의 "공유: …" 표시가 빠졌다.

## 배운 점
- 다음에는 다르게: 팀 파일에 필드를 추가할 때는 그 필드를 통과시키지 않는 경로(planner 출력 스키마, applyTeamEdit 같은 병합 함수, 편집기 초안)를 계획 단계에서 찾아 슬라이스에 넣는다. 이번에는 구현자가 우연히 찾았다.
- 계획의 "모든 변경에 알림" 같은 원칙은 새 진입점(share/unshare)에도 적용되는지 슬라이스에 명시한다.

## 문서 반영
- 검토 안 됨 (auto retro)

## 후속 작업 후보

<!-- followup: fu-362feeaab3c2 | source: copy-share-team-2of2 | task: 22 | date: 2026-11-12 | status: open | taken: - -->
- 공유 성공 경로(teamShareRpc가 워크스페이스에 오케스트레이터를 시작하고 다른 워크스페이스에 알림)의 서버 핸들러 테스트를 추가한다.
  Evidence: S3 tester는 providers.listFeatures·agents.create·권한 파일까지 fake가 커져 거부 경로만 테스트했다(run.md S3).

<!-- followup: fu-01dcbbeea0b3 | source: copy-share-team-2of2 | task: 22 | date: 2026-11-12 | status: open | taken: - -->
- README·OVERVIEW에 Agent teams 화면 팀 행의 "공유: …" 표시를 설명한다.
  Evidence: release가 문서에 넣지 않았다고 보고했다(run.md S5 ⚠). 표시는 client/TeamScreen.tsx:282에 구현돼 있다.
