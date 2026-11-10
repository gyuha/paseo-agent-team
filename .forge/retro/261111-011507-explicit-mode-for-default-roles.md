<!-- auto-retro: fg-loop -->
# 2026-11-11 — auto 모드가 없는 provider의 역할에 실제 모드 명시

## 계획 대비 실제
- 계획대로 된 것: S1~S3 모두 계획대로. 루프 체크 C1~C4 한 번에 통과(replan 0회).
- 달랐던 점: 프롬프트에서 "모드 생략" 지시가 featureRules 한 곳만이 아니라 위임 지시와 MODE_RULE(teamChangedMessage)에도 있었다. server/team.ts는 snapshot을 그대로 넘겨 수정이 필요 없었다.

## 배운 점
- 다음에는 다르게: v0.2.x의 Cursor auto_accept 검증은 `modeId: "agent"`를 명시한 create_agent로 했기 때문에, 프롬프트가 시키는 "modeId 생략" 경로(호출자 모드 상속)를 한 번도 실행하지 않았다. 오케스트레이터에게 시키는 호출은 프롬프트에 적힌 인자 그대로 재현해 검증해야 한다.
- provider snapshot의 기본 모드(`defaultModeId`/`defaultMode`)는 실제 모드 id가 아닐 수 있다(opencode: "default" vs build/plan). 모드 목록에 있는지 확인하고 써야 한다.

## 문서 반영
- 검토 안 됨 (auto retro)
