<!-- auto-retro: fg-ask auto-close -->
# 2026-10-30 — 에이전트 대시보드 탭(애니메이션 트리)

## 계획 대비 실제
- 계획대로 된 것: 트리 로직(`shared/agent-tree.ts`)과 로고(`shared/provider-icons.ts`)는 TDD로 들어갔다. 패널 등록, README·OVERVIEW 갱신, v0.2.0 릴리스까지 진행했다.
- 어긋난 것:
  - 실제 wire snapshot에는 `parentAgentId`가 없고 부모는 `paseo.parent-agent-id` 라벨에 있었다(계약 단계에서 실측으로 잡음).
  - UAT 요청으로 범위가 늘었다: 뿌리 카드화, 숨쉬는 글로우(세 번 조정), 신호 점과 도착 반짝임, 위임 중(주황 테두리) 상태.
  - react-native-web 고유 버그 4건을 앱을 직접 띄워 측정한 뒤에야 찾았다:
    1. 0→1 `Animated.loop`가 `useNativeDriver: true`에서 초기화되지 않음
    2. 마지막 소비 요소가 떨어지면 `Animated.Value`가 스스로 멈춤
    3. `onLayout`이 위치만 바뀔 때는 다시 불리지 않음
    4. `agents.list()`가 보관된 에이전트를 기본으로 뺌

## 배운 것
- 다음엔 다르게:
  - 클라이언트 UI는 처음부터 app.paseo.sh(daemon의 CORS 허용 출처)로 로컬 daemon에 붙여 chrome-devtools로 실측한다. 단위 테스트와 코드 리뷰만으로는 위 4건을 하나도 못 잡았다.
  - RN 애니메이션은 웹에서 `useNativeDriver: Platform.OS !== "web"`으로 하고, 값마다 항상 붙어 있는 앵커 요소를 둔다.
  - 레이아웃 측정은 y 대신 높이를 누적해서 계산한다.
  - claude 에이전트로 "작업 중" 상태를 만들 때 `sleep`은 막히므로 읽기 전용 작업을 쓴다.
  - 오케스트레이터 자신이 도구를 실행하는 동안에는 `running`이라서, 위임 중 상태는 스스로 측정할 수 없다.

## 문서 갱신
- 검토되지 않음(자동 회고)
