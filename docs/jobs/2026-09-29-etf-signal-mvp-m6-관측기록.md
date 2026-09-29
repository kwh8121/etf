# ETF 신호 MVP M6 관측 — 2026-09-28 기준일

> 확인일: 2026-09-29 KST
> 판정: DB 대조 완료 · 운영 Telegram 실수신 확인만 남음 · 누적 0/20 유지(잠정 1/20 대기)

- 기준일 / 자동 실행 시각 / GitHub run ID: 2026-09-28 / 2026-09-29 09:31 KST / `36503490288` 성공
- 보충 결과: `completed=["20260922","20260923","20260928"]`, `nonTrading=["20260924","20260925"]`, `blocked=null`
- trading_calendar_kr 대조(운영 DB 읽기 전용, 2026-09-29 추가 확인): 2026-09-22·23·28 `TRADING_COMPLETE`, 2026-09-24·25 `NON_TRADING` — workflow 로그와 일치
- P0 유형별 raw·liquid 행 수(운영 DB 읽기 전용, 2026-09-29 추가 확인): `signal_daily` run `fcbf9621-78b9-5cae-a309-ed0b3c97ebca` 총 80행. `daily_price_gain`·`daily_price_loss`·`five_day_price_gain`·`five_day_price_loss` × `raw`·`liquid` 각 10행씩 정확히 일치, 누락·초과 없음
- 신호 실행 DB 대조(2026-09-29 추가 확인): `signal_run` id `fcbf9621-78b9-5cae-a309-ed0b3c97ebca` — `status=COMPLETED`, `market=KR`, `bas_dd=2026-09-28`, `strategy_version=m3-price-movers-v1`, `notes.kr_full_signal_complete=true`, `notes.telegram_reported_at=2026-09-29T00:34:08.094Z` 존재
- 중복 실행 확인(2026-09-29 추가 확인): `bas_dd=2026-09-28`·`market=KR` run은 1건뿐이며 `telegram_reported_at` 마커도 1건 — 중복 발송 신호 없음
- Telegram 성공 여부·메시지 수: workflow 로그 `report.reported=true`, DB `telegram_reported_at` 표식 존재. 운영 Telegram 채팅 실수신(사람 확인)은 아직 미수집
- 실행 시간·재시도·429·공표 지연·장애: GitHub run 00:31:06Z~00:34:17Z(약 3분 11초), 재시도 없음, 429·공표 지연 없음
- P1 플래그 / 켠 경우 신호 수·중복 관측 수: 기본 off, 미관측
- 사람이 연 조사 건수: 미수집
- 완전 거래일 포함 여부·근거 / 누적: 잠정 보류. DB 저장·완전성 표식·행 수 대조는 모두 통과했으나, 운영 Telegram 채팅에서의 실제 수신 확인(사람 눈으로 1회 확인)만 남아 있어 아직 1/20로 확정하지 않는다. 누적 0/20 유지

## 남은 확인

1. ~~운영 DB 읽기 전용 조회로 위 signal run의 상태·완전성 표식·Telegram 표식과 P0 유형별 행 수를 대조한다.~~ 완료(2026-09-29, 위 항목 참조)
2. 운영 Telegram 채팅에서 2026-09-29 00:34 UTC(09:34 KST)경 KR 보고 메시지 1회 수신을 사용자가 직접 확인한다.
3. 2번이 확인되면 이 기록의 판정을 포함으로 바꾸고 `docs/plans/NEXT.md` Q-11·Q-08 누적을 1/20로 갱신한다.
