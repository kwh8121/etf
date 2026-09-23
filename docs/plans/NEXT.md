# ETF 신호 MVP 다음 작업 큐

> 기준: 2026-09-23 KST. 실행 상태의 정본은 이 파일이며 제품·데이터 계약은 v2.2 계획서와 ROADMAP을 따른다.
> 완료 항목은 검증 증거와 커밋을 기록한다. 새 사실을 확인하면 라벨·해제 조건을 갱신한다.

## 큐 (위에서부터 실행)

- [ ] `WAIT` Q-11 KR timer 완전 보고 경로의 첫 운영 실행 확인 (KOR-58)
  - 해제: 다음 근무시간 KR timer 실행(runner PC가 켜져 있으면 2026-09-24 09:30 KST, 아니면 연휴 뒤 첫 기동)
  - 완료 조건: workflow 로그 `report.reported=true`·기준일 2026-09-23, Kiwoom 스냅샷·신호 실행 `COMPLETED`·`telegram_reported_at` 읽기 전용 확인, 운영 Telegram 1회 수신. 충족 시 M6 1/20 기록. 같은 기준일 재실행은 `already_reported`여야 한다.
- [ ] `WAIT` Q-07 US 휴장 시간 동일 콘텐츠 중복 관측 실측 (KOR-56)
  - 해제: 미국 휴장 구간과 승인된 US 실행 경로가 마련된 때. 실행이 외부 쓰기·발송을 수반하면 별도 승인 필요
  - 완료 조건: 관측 행 2개·기준 콘텐츠 1개·중복 신호 없음 확인
- [ ] `WAIT` Q-08 M6 완전 거래일 20일 관측 (KOR-58)
  - 해제: Q-03 게이트 통과 후 각 KR 거래일의 실제 운영 결과 확인
  - 완료 조건: `docs/guides/etf-signal-mvp-m6-observation-runbook.md` 기준 20/20; 현재 0/20
  - 휴장(2026-09-24·25 추석 연휴): 거래일이 아니므로 누적 대상이 아니다. 다음 보충은 KRX 빈 응답을 과거일 `NON_TRADING`으로 기록하고 건너뛴다. runner PC가 꺼져 있으면 다음 기동 후 근무시간 09:30 timer가 2026-09-23 수집과 함께 휴장일을 따라잡는다.
- [ ] `WAIT` Q-09 M5-A 순설정·환매 추정 설계·착수
  - 결정(2026-09-22): A안. M6의 완전 거래일 20일 관측 완료 뒤 근거를 모아 설계·착수
  - 해제: Q-08 완료 및 M6 관측 근거·수치 계약 확정
  - 완료 조건: 별도 구현 계획과 임계값 계약을 정본에 반영

## 완료

- [x] `DONE` Q-10 M6 완전 거래일 자동 경로 결정·구현 (A안)
  - 결정(2026-09-23 사용자): A. KR timer 보충 뒤 마지막 거래일 1건에 Kiwoom 동기화·신호 재생성·운영 Telegram 보고를 수행한다.
  - 구현: `reportLatestCatchupDay()`(`scripts/run-kr-catchup.ts`), `telegram_reported_at` 표식으로 1회 발송, 재생성·수동 `daily:kr` 경로도 표식 보존·기록. 계획: `docs/plans/implementation/M6-kr-timer-full-report-plan.md`
  - 검증: `npm test` 29개 파일·99개 테스트, `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과. 독립 코드 리뷰의 중복 발송 위험 2건 반영, 19:15 timer 지적은 설치본이 09:30임을 확인해 해당 없음.
  - 운영 영향: runner 설치본 변경 없이 다음 timer 실행부터 운영 Telegram 발송이 시작된다(workflow가 `main`을 checkout).

- [x] `DONE` Q-04 US 새 상위 10건 보고 형식의 staging 실발송 1회 (KOR-57)
  - 발송: Q-05 US 재시도 run `35810255322`(staging, 2026-09-23 11:25~11:38 KST 성공)의 `report:us-movers`가 `send=true`로 `{"runId":"43eb933d-…","messageCount":1}`을 출력했다.
  - 플래그 복귀: 사용자 승인 후 2026-09-23 13:01 KST staging `ENABLE_US_ETF_P1=false`로 되돌렸고 변수 목록으로 확인했다. 실패 주입 변수는 없다.

- [x] `DONE` Q-05 KR·US 저장 실패·재시도 운영 E2E (KOR-59)
  - KR(2026-09-23): 2026-09-22 KR 생성기에 `ETF_SIGNAL_TEST_FAIL_AFTER_PENDING=KR`을 주입해 `PENDING`·신호 80행 상태에서 실패시켰고, 주입 제거 후 재실행에서 같은 `run_id` `21771080-…`가 `COMPLETED`·80행으로 복구됐다.
  - US 실패(2026-09-23): staging run `35805628815`가 `ingest-us-movers failed: Injected US signal persistence failure after PENDING`으로 실패했다. 운영 DB 읽기 전용 확인 결과 run `80e23559-…`는 `PENDING`, `completed_at` 없음, 신호 0행이다.
  - US 재시도: 주입을 비운 run `35810255322`가 성공했다. 공급자 응답이 바뀌어(snapshot 17,821→17,833행, 544→545페이지, `sha256` 상이) 동일 콘텐츠 재사용 대신 새 snapshot `ccf4b5ed-…`와 새 run `43eb933d-…`가 `COMPLETED`·11,978행으로 저장됐다. 보고는 `COMPLETED`만 읽으므로 남은 `PENDING` run은 노출되지 않는다.
  - 한계: US의 동일 콘텐츠 `PENDING` 재사용 경로는 운영에서 재현되지 않았고 단위 테스트로만 보장된다. 고아 `PENDING` run `80e23559-…`은 운영 데이터로 남겨 두었다(삭제는 별도 승인 대상).
  - 원복: `ETF_SIGNAL_TEST_FAIL_AFTER_PENDING`는 repo·staging·production 변수 목록에 없음을 확인했다. `ENABLE_US_ETF_P1` 복귀는 Q-04로 추적한다.

- [x] `DONE` Q-03 KR timer 첫 자동 경로 E2E 및 M6 관측 시작 판정
  - 정시 발화·실행(2026-09-23): 09:30:23 KST timer dispatch가 `kr-daily.yml` GitHub run `35802355828`을 생성했고, 09:32:35 KST 성공으로 완료됐다. workflow 로그의 `catchup:kr` 결과는 `completed=["20260922"]`, `nonTrading=[]`, `blocked=null`이다.
  - 저장 대조: 운영 Supabase 읽기 전용 집계에서 2026-09-22 KR `COMPLETED` 실행 1건(`kr_full_signal_complete=true`)과 신호 80행을 확인했다.
  - M6 경계: 이 실행은 전일 누락일 보충으로 Kiwoom·Telegram을 실행하지 않았으므로 M6 완전 거래일에는 산입하지 않는다. 시작 게이트만 통과했고 누적은 0/20이다.

- [x] `DONE` Q-02 runner PC의 KR timer·독립 dispatch 설치본을 저장소의 09:30 방식으로 갱신
  - 설치·검증(2026-09-22 17:54 KST): timer·service·dispatch script 설치본 SHA-256이 저장소 원본 `ba391713…`, `25bb03aa…`, `c23f2abb…`와 일치. 다음 KR 발화는 2026-09-23 09:30 KST.
  - 최초 timer 경로: `Persistent=true`가 17:54 KST에 한 번 발화했다. 근무시간 밖이라 dispatch는 `{"dispatched":false,"reason":"outside_work_hours"}`로 정상 종료됐고 GitHub run은 생성되지 않았다. Q-03은 정시 또는 근무시간 내 다음 기동 경로의 E2E 증거를 기다린다.
- [x] `DONE` Q-06 US timer 설치본을 평일 09:40 KST 방식으로 갱신
  - 결정: A안. 평일 09:40 KST에 직전 미국 거래일 장 마감 결과를 처리.
  - 설치·검증(2026-09-22 17:54 KST): timer·service·dispatch script 설치본 SHA-256이 저장소 원본 `8afa5f88…`, `e67d0a69…`, `c23f2abb…`와 일치. 다음 US 발화는 2026-09-23 09:40 KST.
  - 최초 timer 경로: `Persistent=true`가 17:54 KST에 한 번 발화했고 `us-etf-movers.yml` GitHub run `35707361859`를 dispatch했다. run은 17:58 KST에 성공으로 완료됐다.
- [x] `DONE` Q-01 Codex 연속 실행 운영 가이드를 현재 운영 상태·공식 기능 설명에 맞춰 개선
  - 검증: `npm test` 29개 파일·90개 테스트, `npm run lint`, `npm run build`, `npm run continuity:check`, `git diff --check` 통과
  - 커밋: 이 완료 기록과 가이드 변경을 함께 담은 Git 커밋 (`git log -1 --format=%h -- docs/plans/NEXT.md`로 확인)
