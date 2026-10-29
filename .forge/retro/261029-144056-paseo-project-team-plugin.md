<!-- auto-retro: fg-ask auto-close -->
# 2026-10-29 — Paseo 프로젝트 단위 에이전트 팀 플러그인 MVP

## 계획 대비 실제
- 계획대로 된 것: S2~S4(팀 스키마·모델 검증·적용 계획/프롬프트)는 TDD로 계획대로 완료. DoD 1~3 통과, 앱 UAT (a)~(d) 사용자 확인.
- 달라진 점:
  - S1: npm 10.9.9 arborist 버그로 `.npmrc`에 `legacy-peer-deps=true` 추가, 데몬 0.13.0에 맞춰 SDK 0.13.0 고정.
  - S5: 계획에 없던 응답 파싱(`shared/proposal.ts`), 비동기 폴링용 `team.proposal` RPC, 오케스트레이터 재사용, 실데몬 e2e 추가.
  - claude provider에서 `outputSchema`가 강제되지 않음(계획 에이전트가 `title` 키로 응답) → 프롬프트에 정확한 JSON 예시를 넣고 테스트로 고정.
  - 재적용 시 오케스트레이터가 중복 생성되는 결함을 e2e에서 발견해 수정.
  - S6 앱 동작은 로컬 웹 UI가 없어 실행 중 확인 불가 → UAT로 넘김. 실행 후 UI를 영문 기본 + 한국어로 변경.

## 배운 점
- 다음엔 다르게: Paseo 에이전트의 `outputSchema`는 provider마다 강제 여부가 다르니 신뢰하지 말고, 프롬프트 예시와 파서 테스트로 형식을 고정한다. 에이전트를 만드는 RPC는 처음부터 "이미 있으면 재사용"을 설계에 넣고 e2e로 재적용을 검증한다. 클라이언트 UI는 실행 중 검증할 수단(검증 스킬 등)이 없으면 UAT까지 미검증으로 남는다는 점을 계획 단계에서 드러낸다.

## 문서 갱신
- 검토되지 않음(자동 회고)

## 후속 작업 후보

<!-- followup: fu-47de9e53039d | source: paseo-project-team-plugin | task: 1 | date: 2026-10-29 | status: open | taken: - -->
- `paseo.workspaces.list()`·`agents.list()`의 페이지네이션을 따라가지 않음. workspace가 많은 호스트에서는 이름 매칭이 누락돼 중복 생성될 수 있음
<!-- followup: fu-e0953b53000b | source: paseo-project-team-plugin | task: 1 | date: 2026-10-29 | status: open | taken: - -->
- 계획 에이전트를 읽기 전용 모드(claude Plan Mode 등)로 띄우기. 현재는 프롬프트로만 파일 변경을 막음
<!-- followup: fu-4a2dd60fb648 | source: paseo-project-team-plugin | task: 1 | date: 2026-10-29 | status: open | taken: - -->
- Paseo 기본 UI로 workspace에서 에이전트를 띄울 때 역할 모델을 자동 적용(생성 시점 훅 확인 필요)
