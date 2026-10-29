# 2026-10-29 — workspace 없이 사이드바에서 에이전트 팀 만들기

## 계획 대비 실제
- 계획대로 된 것: S1(순수 로직 TDD)·S2(프로젝트 ID 입력 RPC, e2e 먼저)·S4(README)·S5(UAT (a)~(f) 확인). 계획에 적어 둔 미확인 사항(`projects.list()`의 루트 경로)은 실데몬에 직접 조회해서 바로 해소했다.
- 달라진 점:
  - S3: 사이드바 갱신을 `projects.subscribe` + Apply 시 react-query 무효화로 구현. 호스트가 화면과 사이드바에 같은 QueryClient를 주는지는 코드로 확인하지 못했고, UAT로 동작만 확인했다.
  - 사용자 요청 위치(New workspace 화면의 Chat 드롭다운)는 플러그인 API 0.13.2에 기여 지점이 없어 그릴링 첫 질문에서 사이드바로 바뀌었다.
  - "Team planner" workspace가 실제로 생성되어 남는 것을 UAT에서 사용자가 발견했다. 비목표였지만 바로 후속 요구가 되었다.

## 배운 점
- 다음엔 다르게: Paseo UI 위치를 지정하는 요청은 그릴링 전에 `@getpaseo/plugin` `dist/client/contracts.d.ts`의 기여 지점 목록부터 대조한다. 요청 위치가 없으면 첫 질문에서 바로 대안을 고르게 한다. 플러그인이 workspace나 에이전트를 새로 만드는 기능은 "다 쓴 뒤 무엇이 남는가"를 비목표로 미루지 말고 그릴링에서 정한다. 이번에는 미룬 그대로 사용자 눈에 띄었다. e2e가 RPC 계층이 아니라 핸들러를 직접 부르므로, RPC 입력 스키마를 바꾸면 zod 파싱을 따로 확인한다.

## 문서 갱신
- CONTEXT.md 승급: 없음
- ADR 추가: 없음

## 후속 작업 후보

<!-- followup: fu-bdf2f2bad552 | source: sidebar-team-create | task: 2 | date: 2026-10-29 | status: open | taken: - -->
- Apply 성공 시 계획 에이전트 정리(플러그인이 만든 "Team planner" workspace 보관, 기존 workspace의 계획 에이전트는 에이전트만 보관).
