# 2026-10-30 — 팀 패널의 "세션 리셋"으로 오케스트레이터 역할을 유지한 채 컨텍스트를 비운다

## 계획 대비 실제
- 계획대로 된 것
  - S1~S5를 팀 역할 네 개에 나눠 끝냈다. 순서는 shared → (server ∥ client) → release였다. `npm test` 통과 수가 200에서 210으로 늘었고, DoD 1~6을 직접 다시 돌려 모두 통과를 확인했다.
  - UAT는 사용자가 taskle에서 통과시켰다. `daemon.log`에서 Reset 두 번이 각각 "보관 1개 → 생성 1개"였음을 측정했다.
- 어긋난 것
  - S2: 부모 id가 아예 없는 역할 세션은 오케스트레이터 아래로 옮기지 않는다. shared 역할이 정한 해석인데, `/clear` 뒤 고아가 된 세션에는 부모 라벨이 있으므로 목표는 지켜진다.
  - 계획의 S3는 `shared/rpc.ts` 계약까지 server 쪽 일로 묶었다. 하지만 `shared/`는 shared 역할의 폴더라서 계약과 문구 키는 shared에 먼저 맡겼다.
  - 실행이 끝난 뒤 사용자가 "Apply again 옆에 세션 리셋을 넣어 달라"고 요청했다. 그 기능은 이미 스크린샷 속에 있었다. 버튼 이름 "Start a new conversation"이 리셋 기능으로 읽히지 않았던 것이라, 이름을 "Reset session" / "세션 리셋"으로 바꿨다.
  - 계획의 UAT는 어느 워크스페이스에서 누를지 정하지 않았다. 오케스트레이터가 일하는 워크스페이스에서 누르면 그 오케스트레이터 자신이 보관된다는 점은 실행 중에 알았다.

## 배운 것
- 다음엔 다르게
  - 팀 오케스트레이터로 계획을 짤 때는 작업 단위를 처음부터 역할의 폴더 경계에 맞춘다. RPC 계약(`shared/rpc.ts`)과 문구(`shared/messages.ts`)는 server나 client 단위에 섞지 말고 shared 단위로 둔다.
  - 버튼 이름은 사용자가 그 기능을 부를 말로 그릴링 때 정한다. 이번에는 "세션 리셋"이었다. 설명형 이름("Start a new conversation")은 기능이 있어도 못 알아볼 수 있다.
  - 에이전트를 보관하거나 새로 만드는 기능의 UAT에는 "어느 워크스페이스에서 할지"를 DoD에 적는다. 오케스트레이터 자신이 있는 워크스페이스는 제외한다.
  - 에이전트 생명주기 UAT는 `daemon.log`의 `Archiving agent`와 `Created agent` 줄을 `clientId`로 거르면 측정할 수 있다. `plugin:paseo-agent-team`이면 플러그인이 한 일이고, 앱 cid이면 사용자가 직접 한 일이다. 저장된 에이전트 JSON의 `archivedAt`은 나중에 다시 보관되면 덮어써지므로 순서를 판단할 근거가 못 된다.

## 문서 갱신
- CONTEXT.md 승급: 없음
- ADR 추가: 없음

## 후속 후보

<!-- followup: fu-f442abd3e622 | source: keep-orchestrator-after-clear | task: 12 | date: 2026-10-30 | status: open | taken: - -->
같은 에이전트를 그 자리에서 비우는 세션 리셋을 검토한다. 테스트 에이전트에 플러그인 send("/clear")를 보내 Paseo가 보관 후 새로 만드는지, 같은 에이전트 안에서 비우는지 측정하고, 라벨·시스템 프롬프트를 유지하는 /clear를 Paseo에 기능 요청할지 판단한다.
