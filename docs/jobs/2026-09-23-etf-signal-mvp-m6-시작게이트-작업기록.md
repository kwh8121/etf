# ETF 신호 MVP — M6 관측 시작 게이트 작업 기록

> 작업일: 2026-09-23 KST
> 상태: 시작 게이트 통과 · 완전 거래일 누적 0/20

## 확인 결과

- KR `etf-kr-daily-dispatch.timer`의 09:30 KST 정시 발화가 `kr-daily.yml` GitHub run `35802355828`을 dispatch했다.
- run은 09:32:35 KST에 성공했다. workflow의 `catchup:kr` 결과는 `completed=["20260922"]`, `nonTrading=[]`, `blocked=null`이다.
- 운영 Supabase 읽기 전용 집계에서 2026-09-22 KR `signal_run`의 `COMPLETED`·`kr_full_signal_complete=true` 1건과 신호 80행을 확인했다.
- 같은 날 09:40 KST US timer가 `us-etf-movers.yml` run `35803069606`을 성공으로 끝냈다. `ENABLE_US_ETF_P1=false`이므로 ingest는 `DISABLED`, 보고 단계는 생략됐다.

## M6 산입 판정

2026-09-22 KR 실행은 누락일 보충 경로여서 Kiwoom 마스터 동기화와 Telegram 보고를 수행하지 않았다. 따라서 M6 일별 기록 계약의 완전 거래일 요건을 충족하지 않으며 누적은 **0/20**이다. 이 기록은 timer → GitHub → KRX·신호 저장 연결을 증명해 M6 시작 게이트만 통과시킨다.

## 다음 관측 기준

다음 국내 실제 운영일에는 `docs/guides/etf-signal-mvp-m6-observation-runbook.md`의 KRX·Kiwoom·P0 신호·Telegram 증거를 모두 기록한 뒤에만 누적을 1일 증가시킨다.

## Q-05 실행 준비

KR·US 신호 저장소에 기본 off 제어 변수 `ETF_SIGNAL_TEST_FAIL_AFTER_PENDING`을 추가했다. 정확히 각 시장 코드일 때만 `PENDING`을 기록한 뒤 실패하여, 같은 입력 재실행의 실제 복구 경계를 확인할 수 있다. 단위·전체 테스트, lint, build가 통과했으며 운영 변수 전환·수동 실행은 아직 승인 대기다.
