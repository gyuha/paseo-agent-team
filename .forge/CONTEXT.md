# Paseo Agent Team

하나의 Paseo 프로젝트 안에서, 역할별로 다른 provider/모델을 쓰는 에이전트들을 오케스트레이터가 지휘하는 구조를 다룬다.

## Language

**프로젝트 (Project)**:
Paseo에 등록된 실제 레포 하나(`prj_…`). 오케스트레이션의 범위다.
_Avoid_: 팀, 그룹

**워크스페이스 (Workspace)**:
프로젝트 안의 Paseo 내장 workspace(`wks_…`). 한 역할을 오래 맡는 에이전트의 자리다.
_Avoid_: 봇, 슬롯

**역할 (Role)**:
팀 정의에서 하나의 워크스페이스에 붙는 이름과 provider/모델의 묶음(예: design → codex).
_Avoid_: 페르소나, 봇

**오케스트레이터 (Orchestrator)**:
프로젝트의 팀 정의를 읽고 역할들에게 일을 나눠 맡기는 에이전트.
_Avoid_: Chief of Staff, 리더, 매니저

**팀 정의 (Team definition)**:
프로젝트 레포 안에 저장되어 git으로 관리되는, 역할 목록의 원본.
_Avoid_: 로스터, 팀 설정
