# 2026-10-30 — 플러그인이 띄우는 에이전트의 시작 모드를 provider의 자동 검토 모드로 정하기

## 계획 대비 실제
- 계획대로 된 것:
  - Mode 열과 재사용 메시지(S2), 모드까지 비교하는 오케스트레이터 재사용(S3), e2e 모드 단언(S4), 문서(S5)는 계획대로 들어갔다.
  - 역할 분담은 tests가 red, core가 green, release가 문서였다. 오케스트레이터가 인터페이스 계약을 먼저 정해 넘겼고, 그래서 두 역할이 서로를 기다리지 않고 같은 시그니처로 일했다.
- 어긋난 것:
  - S1 판별 규칙이 두 번 바뀌었다.
    - 첫 번째 원인: 계획의 근거는 SDK 타입(`ProviderMode.isUnattended`)과 앱 번들 정의였다. 하지만 실제 daemon 0.14.0의 `providers.snapshot()`은 claude와 codex에서 `isUnattended`를 빼고 `colorTier`만 보낸다. 첫 e2e는 통과했지만 모드 단언이 조용히 건너뛰어졌고, 오케스트레이터는 `default`로 떴다. 이전 `auto`보다 나빠진 상태였다. tests 역할이 "통과했지만 아무것도 증명하지 않았다"고 보고해서 잡혔다.
    - 두 번째 원인: UAT 직전에 사용자가 "최대 권한" 대신 "auto 또는 auto-review가 있으면 그것으로 한정"을 택했다.
  - 최종 판별 순서: `auto-review` → `auto` → `isUnattended` → `colorTier: dangerous` → 기본값. codex의 `auto` ID는 "Default Permissions"(매번 물음)라서 `auto-review`를 먼저 찾아야 한다. 이 규칙은 모드 ID 이름에 기대는 하드코딩이다.
  - 배포 단계: 레지스트리 검증(`npm ci` + `node scripts/validate.ts`)을 auto mode 분류기가 막아서, 사용자가 직접 실행했다. 이때 `npm ci`는 `getpaseo/plugins`에 lockfile이 없어서 실패했지만 검증 스크립트는 통과했다.

## 배운 것
- 다음엔 다르게:
  - provider snapshot 필드에 기대는 계획은 그릴링 단계에서 실제 daemon의 `paseo.providers.snapshot()`을 한 번 덤프해 근거로 삼는다. 타입 정의(`.d.ts`)와 앱 번들은 daemon이 실제로 보내는 값이 아니다.
  - e2e 단언이 "값이 있을 때만 검사"하는 구조라면, 꼭 있어야 하는 경우(예: claude)에 `toBeDefined()`를 함께 걸어 조용히 건너뛰지 않게 한다.
  - "최대 권한"처럼 안전과 맞바꾸는 요구는 그릴링 때 provider별 실제 모드 의미(claude `auto`는 분류기 검토, codex `auto`는 매번 물음, `auto-review`는 검토 하위 에이전트)를 표로 먼저 보여 주고 고르게 한다. 이번에는 구현 후에 방향이 바뀌었다.
  - 사용자에게 붙여 넣을 셸 명령을 줄 때는 줄 끝에 `#` 주석을 달지 않는다. zsh 대화형 셸은 그것을 인자로 넘긴다.

## 문서 갱신
- CONTEXT.md 승급: 없음
- ADR 추가: 없음 (모드 판별 순서는 코드와 테스트로 쉽게 되돌릴 수 있어서 ADR 기준인 "되돌리기 어려움"에 못 미침)

## 후속 작업 후보

<!-- followup: fu-0520c8ed98cc | source: max-permission-mode | task: 4 | date: 2026-10-30 | status: open | taken: - -->
- 배포 스킬(`.claude/skills/deploy/SKILL.md`) 5단계를 실제 환경에 맞게 고친다. `getpaseo/plugins`에는 lockfile이 없어 `npm ci`가 실패하고, `node scripts/validate.ts`는 auto mode 분류기가 막는다. 의존성 설치 방식을 바꾸거나, 사용자가 직접 실행하는 단계로 명시하거나, 권한 규칙을 추가해야 한다.
  근거: v0.1.3 배포 때 release 에이전트와 오케스트레이터가 모두 거부당했고, 사용자가 직접 실행했을 때 `npm ci`가 EUSAGE로 실패했다.

<!-- followup: fu-1145da606e5c | source: max-permission-mode | task: 4 | date: 2026-10-30 | status: open | taken: - -->
- `tests/daemon.e2e.test.ts`가 끝날 때 자기가 만든 오케스트레이터와 그 오케스트레이터가 띄운 역할 에이전트를 보관(archive)하게 한다. 지금은 임시 `pwa-game-*` workspace에 idle 에이전트가 쌓인다.
  근거: 이번 e2e 3회로 오케스트레이터 3개와 smoke test 역할 에이전트 5개가 남았다.
