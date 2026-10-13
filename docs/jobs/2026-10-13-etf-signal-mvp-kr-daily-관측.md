# 2026-10-13 ETF 신호 MVP KR daily 관측 (기준일 2026-10-12)

## Q-08 대조: 기준일 2026-10-12 확정 (9/20)

- run: `38327594265`(2026-10-13 09:30 KST timer dispatch, 성공), 자동 `kr-verify` run `38327890740` 성공.
- 로그: `completed`에 2026-09-22~10-12 처리일 포함, `nonTrading=[20260924, 20260925, 20261005, 20261009]`, `blocked=null`, `report.reported=true`, 기준일 `20261012`, Kiwoom `COMPLETED` 경로의 `COMPLETE`, runId `23a2a0bf-…`, 발송 09:34:02 KST.
- 운영 DB 읽기 전용 대조(`verify:kr-candidate -- 20261012`): `COMPLETED`, `kr_full_signal_complete=true`, 고정 8유형 각 10건(80행), 가변 신호 0건, `reportedMarkerCount=1`, `tradingCalendarStatus=TRADING_COMPLETE`, `ok:true`.
- Telegram 실수신(사용자 확인): 메시지 수신, 헤더 링크의 기준일 일치, 링크로 해당 기준일 화면 열림.
- 확정 누적 8/20 → 9/20. 20번째 거래일 예상(기준일 2026-10-27, 처리 10-28)은 변동 없음.

## 같은 날 진행한 US 작업

US 관측·웹 열람·운영 전환(Q-18~Q-23)은 `docs/plans/NEXT.md`와 `docs/plans/implementation/us-signal-web-view-design.md`에 기록했다. 커밋 `9173894`, `4aab2ca`, `098e4a0`, `122a09c`.

## 다음

- 2026-10-14(수) 09:30 이후 기준일 2026-10-13을 같은 방식으로 대조한다.
- US 첫 운영 실행(2026-10-13 09:40 dispatch)은 Q-23 순서로 확인한다.
