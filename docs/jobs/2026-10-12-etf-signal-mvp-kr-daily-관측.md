# 2026-10-12 ETF 신호 MVP KR daily 관측 (기준일 2026-10-08)

## Q-08 대조: 기준일 2026-10-08 확정 (8/20)

- run: `38188274629`(2026-10-12 09:30 KST timer dispatch, 성공), 자동 `kr-verify` run `38188471187` 성공.
- 로그: `completed`에 2026-09-22~10-08 처리일 포함, `nonTrading=[20260924, 20260925, 20261005, 20261009]`, `blocked=null`, `report.reported=true`, 기준일 `20261008`, Kiwoom `COMPLETE`, runId `3fd31960-…`. 10-09 휴장 예상과 10-12 따라잡기 예상이 모두 맞았다.
- 운영 DB 읽기 전용 대조(`verify:kr-candidate -- 20261008`): `COMPLETED`, `kr_full_signal_complete=true`, 고정 8유형 각 10건(80행), 가변 신호 0건, `reportedMarkerCount=1`, `tradingCalendarStatus=TRADING_COMPLETE`, `ok:true`.
- Telegram 실수신(사용자 확인): 헤더 링크 존재, 링크 기준일이 2026-10-08과 일치, 링크가 해당 기준일 화면을 연다. 링크 활성화(Q-17) 후 첫 링크 포함 보고 확인 완료.
- 확정 누적 7/20 → 8/20. 20번째 거래일 예상(기준일 2026-10-27, 처리 10-28)은 변동 없음.

## 메모

- 기본 Node가 v24라 `npm run verify:kr-candidate`가 `bad option: --experimental-default-type=module`로 실패했다. `nvm use`(`.nvmrc` 22.23.2) 후 정상 실행됐다.
- 다음: 2026-10-13(화) 09:30 이후 기준일 2026-10-12 결과를 같은 방식으로 대조한다.
