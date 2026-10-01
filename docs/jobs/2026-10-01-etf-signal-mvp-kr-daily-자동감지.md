# 2026-10-01 KR daily 자동 감지 (클라우드 루틴)

- 자동 감지 후보 — 기준일 2026-09-30, run 36796579546, DB 대조 대기

## DB 대조 및 확정 (2026-10-01, 로컬 세션)

- 도구: `npm run verify:kr-candidate -- 2026-09-30`(Q-12에서 만든 읽기 전용 검증 스크립트, 종료 코드 0). 클라우드 루틴 커밋(`2071195`) 도착 후 대조했다.
- `signal_run` id `ab3158a5-dc59-52ef-ab6a-24ed40415cce`: `status=COMPLETED`, `notes.kr_full_signal_complete=true`, `notes.telegram_reported_at=2026-10-01T00:33:33.605Z` 존재.
- `signal_daily` 총 80행: P0 고정 8유형 각 10건 정확히 일치, `new_listing`·`turnover_surge` 0건(가변 신호, 이날 이벤트 없음).
- `bas_dd=2026-09-30`·`market=KR` run·Telegram 마커 각 1건 — 중복 없음. `trading_calendar_kr` `TRADING_COMPLETE`.
- 실수신 확인(사용자, 2026-10-01): "telegram을 통해 문자를 받았습니다."
- 판정: 완전 거래일로 포함. M6 확정 누적 **3/20**(2026-09-28, 09-29, 09-30).
