# 2026-10-14 ETF 신호 MVP KR daily 관측 (기준일 2026-10-13)

> 상태: 진행 중 — 운영 DB 대조와 자동 검증은 통과했으며, Telegram 실수신·링크 화면의 사람 확인을 기다린다.

## Q-08 대조: 기준일 2026-10-13 DB 검증 완료 (9/20 유지)

- 자동 감지: run `38490681521`(2026-10-14 09:31 KST dispatch, 성공). 로그 후보는 `completed`에 2026-09-22~10-13, `nonTrading=[20260924, 20260925, 20261005, 20261009]`, `blocked=null`, `report.reported=true`, `reportRunId=c49670ec-5711-56cd-adb2-da909a3df7ee`를 기록했다.
- 자동 검증: `kr-verify` run `38491349024`이 `workflow_run`으로 연계되어 성공했다.
- 운영 DB 읽기 전용 대조: Node `22.23.2`에서 `npm run verify:kr-candidate -- 2026-10-13` 실행 결과 `COMPLETED`, `kr_full_signal_complete=true`, 고정 8유형 각 10건(80행), 가변 `new_listing:raw` 22건, 총 102행, `reportedMarkerCount=1`, `tradingCalendarStatus=TRADING_COMPLETE`, `duplicateRunCount=1`, `ok:true`.
- 확정 누적은 사용자 Telegram 실수신 확인 전까지 **9/20**으로 유지한다. 실수신 메시지 1통, 헤더 링크 날짜 일치, 해당 `/signals/kr/2026-10-13` 화면과 360px 무가로스크롤 확인 뒤에만 10/20으로 승격한다.

## 검증

- `gh run view 38490681521 --repo kwh8121/etf --json ...`: 성공.
- `gh run view 38491349024 --repo kwh8121/etf --json ...`: 성공.
- `npm run verify:kr-candidate -- 2026-10-13`: 통과(Node `22.23.2`, 운영 DB 읽기 전용).

## 다음

1. 사용자가 KR Telegram 실수신·링크·360px 화면을 확인하면 Q-08을 10/20으로 승격한다.
2. Q-23은 Telegram 헤더 링크 날짜 일치와 360px 무가로스크롤의 사용자 확인을 기다린다.

## 같은 날 US Q-23 기술 확인

- US run `38491518500`이 15분 16초 실행 후 `success`로 끝났고, 자동 `us-verify` run `38492927972`도 `workflow_run`으로 성공했다.
- 운영 DB 읽기 전용 `npm run verify:us-candidate -- latest`(Node `22.23.2`)는 run `8cb67a9d-3791-5d8c-a129-f2973f6f4c1d`에 대해 `COMPLETED`, 4유형 2528·2370·5676·3120행, 보고 표식·같은 한국 날짜 run·표식 각 1건, `ok:true`를 반환했다.
- Q-23의 기술적 해제 조건은 충족했다. Telegram 헤더 링크의 관측일 일치와 360px 무가로스크롤은 사용자 확인이 필요한 대기 조건으로 남긴다.

## 외부 동기화 상태

- 이 세션의 도구 표면에는 Linear MCP가 노출되지 않아 Linear 프로젝트·이슈의 읽기/갱신·read-back을 수행할 수 없었다. 로컬 정본과 작업 기록은 위 증거로 갱신했으며, Linear 연결이 노출되는 다음 세션에서 기존 이슈를 먼저 조회해 중복 생성 없이 상태를 맞춘다.
