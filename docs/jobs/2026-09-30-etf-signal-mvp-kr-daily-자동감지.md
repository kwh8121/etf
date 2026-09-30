# 2026-09-30 KR daily 자동 감지 (클라우드 루틴)

- 자동 감지 후보 — 기준일 2026-09-29, run 36650719083, DB 대조 대기

## DB 대조 및 확정 (2026-09-30, 로컬 세션)

- `signal_run` id `e9c0df32-82d5-584b-a1f4-ae85875ee95c`: `status=COMPLETED`, `market=KR`, `bas_dd=2026-09-29`, `notes.kr_full_signal_complete=true`, `notes.telegram_reported_at=2026-09-30T00:33:17.034Z` 존재.
- `signal_daily` 총 86행: P0 고정 8유형(`daily`/`5-day` × `gain`/`loss` × `raw`/`liquid`) 각 10건=80건 정확히 일치 + `new_listing:raw` 6건. **방법론 정정**: `new_listing`(신규 상장)과 `turnover_surge`(거래대금 급증)는 그날 실제 이벤트 수에 따라 0건 이상으로 달라지는 가변 신호이며 고정 상위 10건이 아니다. 2026-09-28에는 두 유형 모두 0건이라 우연히 총 80행이었을 뿐, "정확히 80행"은 일반 완전성 기준이 아니다. 앞으로는 "고정 8유형 각 10건(80행 이상 포함)"을 기준으로 확인한다.
- `bas_dd=2026-09-29`·`market=KR` run·Telegram 마커 각 1건 — 중복 없음.
- `trading_calendar_kr`: 2026-09-29 `TRADING_COMPLETE` — workflow 로그와 일치.
- 실수신 확인(사용자, 2026-09-30): "텔레그램으로 문자 받았습니다."
- 판정: 완전 거래일로 포함. M6 완전 거래일 관측 확정 누적 **2/20**(2026-09-28, 2026-09-29).
