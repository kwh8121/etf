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

KR·US 신호 저장소에 기본 off 제어 변수 `ETF_SIGNAL_TEST_FAIL_AFTER_PENDING`을 추가했다. 정확히 각 시장 코드일 때만 `PENDING`을 기록한 뒤 실패하여, 같은 입력 재실행의 실제 복구 경계를 확인할 수 있다. 단위·전체 테스트, lint, build가 통과했다.

## Q-05 KR 운영 실측

- 승인 후 2026-09-22 KR 신호 생성기에 `ETF_SIGNAL_TEST_FAIL_AFTER_PENDING=KR`을 한 번 주입했다. Node 24의 지원하지 않는 옵션으로 시작 전 실패한 첫 시도는 DB 변경이 없었고, runner와 같은 Node 22.23.2 재시도에서 의도한 `PENDING` 직후 실패를 확인했다.
- 운영 Supabase 읽기 전용 확인: 실패 직후 `PENDING`, 신호 80행. 실패 주입을 제거하고 같은 생성기를 재실행한 결과 같은 `run_id`가 `COMPLETED`, `completed_at` 존재, 신호 80행으로 복구됐다.
- US staging workflow `35805628815`는 실패 주입을 설정한 뒤 실행했으나 GitHub API rate limit으로 종료 결과와 변수 원복 상태를 즉시 읽을 수 없었다. 원복 명령(실패 주입 변수 삭제, P1 플래그 false)은 성공 종료했지만, API 읽기 확인이 가능해질 때까지 US Q-05 및 Q-04를 완료 처리하지 않는다.
