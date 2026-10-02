# 2026-10-02 KR daily 자동 감지 (클라우드 루틴)

- 자동 감지 후보 — 기준일 2026-10-01, run 36946389398, DB 대조 대기

## DB 대조 및 확정 (2026-10-02, 로컬 세션)

- 자동 검증: KR daily `36946389398` 종료 직후 `kr-verify` `36946604837`이 `event=workflow_run`으로 자동 실행돼 성공(09:33 KST). Q-14의 자동 연결 첫 실측이다.
- 로컬 대조: `npm run verify:kr-candidate -- latest`(종료 코드 0, `ok:true`). 클라우드 루틴 커밋(`537003a`) 도착 후 수행했다.
- `signal_run` id `ba9f1ec0-68a8-5fda-a5af-3e6cfe45b43f`: `status=COMPLETED`, `notes.kr_full_signal_complete=true`, `notes.telegram_reported_at=2026-10-02T00:33:10.405Z` 존재.
- `signal_daily` 총 99행: P0 고정 8유형 각 10건 정확히 일치 + `new_listing:raw` 19건(가변 신호, 이날 신규 상장 이벤트). `turnover_surge` 0건.
- `bas_dd=2026-10-01`·`market=KR` run·Telegram 마커 각 1건 — 중복 없음. `trading_calendar_kr` `TRADING_COMPLETE`.
- 실수신 확인(사용자, 2026-10-02): "텔레그램에서 알람 수령 확인."
- 판정: 완전 거래일로 포함. M6 확정 누적 **4/20**(2026-09-28, 09-29, 09-30, 10-01).
