# ETF 신호 MVP M6 관측 — 2026-09-28 기준일

> 확인일: 2026-09-29 KST
> 판정: 증거 미완전으로 제외 · 누적 0/20 유지

- 기준일 / 자동 실행 시각 / GitHub run ID: 2026-09-28 / 2026-09-29 09:31 KST / `36503490288` 성공
- 보충 결과: `completed=["20260922","20260923","20260928"]`, `nonTrading=["20260924","20260925"]`, `blocked=null`
- KRX 상태·행 수·경고 / Kiwoom 상태·불일치 코드 수: KRX는 보충 성공으로 `TRADING_COMPLETE`임을 간접 확인했으나 DB 행 수·경고는 미대조 / Kiwoom `COMPLETE`, 불일치 코드 수 미수집
- P0 유형별 raw·liquid 행 수: 운영 DB 읽기 자격 증명이 로컬에 없어 미수집
- 신호 실행: workflow가 run ID `fcbf9621-78b9-5cae-a309-ed0b3c97ebca`로 보고까지 성공했으나 `COMPLETED`·`kr_full_signal_complete`·`telegram_reported_at` DB 대조는 미완료
- Telegram 성공 여부·메시지 수: workflow 로그 `report.reported=true`; 운영 수신 확인·메시지 수 미수집
- 실행 시간·재시도·429·공표 지연·장애: GitHub run 00:31:06Z~00:34:17Z(약 3분 11초), 재시도 없음, 429·공표 지연 없음
- P1 플래그 / 켠 경우 신호 수·중복 관측 수: 기본 off, 미관측
- 사람이 연 조사 건수: 미수집
- 완전 거래일 포함 여부·근거 / 누적: 제외. DB 저장 상태와 운영 Telegram 실수신 증거가 없어 계약을 완전히 충족하지 못했다. 누적 0/20

## 남은 확인

1. 운영 DB 읽기 전용 조회로 위 signal run의 상태·완전성 표식·Telegram 표식과 P0 유형별 행 수를 대조한다.
2. 운영 Telegram 1회 수신을 확인한다.
3. 두 증거가 충족되면 이 기록의 판정을 포함으로 바꾸고 누적을 1/20로 갱신한다.
