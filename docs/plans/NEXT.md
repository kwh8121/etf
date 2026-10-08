# ETF 신호 MVP 다음 작업 큐

> 기준: 2026-10-08 KST. 실행 상태의 정본은 이 파일이며 제품·데이터 계약은 v2.2 계획서와 ROADMAP을 따른다.
> 완료 항목은 검증 증거와 커밋을 기록한다. 새 사실을 확인하면 라벨·해제 조건을 갱신한다.
> 웹 현황판(읽기 전용 보조 화면): `docs/guides/etf-signal-mvp-status-dashboard.md` 참조.

## 큐 (위에서부터 실행)

- [ ] `WAIT` Q-07 US 휴장 시간 동일 콘텐츠 중복 관측 실측 (KOR-56)
  - 해제: 다음 미국 시장 완전 휴장일 2026-11-26(추수감사절, 가장 이른 기회) 또는 2026-12-25(크리스마스). 실행은 기능 플래그 전환을 포함한 외부 부작용이라 매번 사용자 승인 필요
  - 완료 조건: 관측 행 2개·기준 콘텐츠 1개·중복 신호 없음 확인
  - 사전 준비(2026-09-30): 코드의 중복 감지 경로(`persistUsEtfMoverSnapshot`)는 이미 구현·테스트돼 있어 추가 구현이 필요 없음을 확인했다. 실행 절차·승인 체크포인트·증거 수집 방법은 `docs/guides/etf-signal-mvp-q07-us-holiday-observation-runbook.md`에 정리했다.
- [ ] `WAIT` Q-08 M6 완전 거래일 20일 관측 (KOR-58)
  - 해제: Q-03 게이트 통과 후 각 KR 거래일의 실제 운영 결과 확인
  - 완료 조건: `docs/guides/etf-signal-mvp-m6-observation-runbook.md` 기준 20/20; **확정 누적 7/20**(2026-09-28·09-29·09-30·10-01·10-02·10-06·10-07 기준일, Q-11 및 `docs/jobs/2026-09-30-…`·`2026-10-01-…`·`2026-10-02-…`·`2026-10-06-…`·`2026-10-08-etf-signal-mvp-kr-daily-관측.md` 참조).
  - **링크 활성화 후 첫 보고 확인(2026-10-08 16:57 KST 이후 첫 timer 실행):** 확정 대조 때 함께 본다. Telegram 헤더에 `상세: https://etf-signal-azure.vercel.app/signals/kr/<기준일>` 한 줄이 있는지, 기준일이 보고 기준일과 같은지, 링크가 해당 기준일 화면을 여는지. 링크가 없으면 `production` environment 변수와 `kr-daily.yml` 매핑을 먼저 확인한다. 상세: Q-17.
  - 휴장(2026-09-24·25 추석 연휴): 거래일이 아니므로 누적 대상이 아니다. 다음 보충은 KRX 빈 응답을 과거일 `NON_TRADING`으로 기록하고 건너뛴다. runner PC가 꺼져 있으면 다음 기동 후 근무시간 09:30 timer가 2026-09-23 수집과 함께 휴장일을 따라잡는다.
  - 휴장: 2026-10-05는 운영 DB에서 `NON_TRADING` 확인. 2026-10-09(금)는 휴장 예정(2026-10-01 사용자 확인, KRX 공식 캘린더 미대조)이며 실제 기록을 확인한 뒤 제외한다. 휴장일은 누적 대상이 아니다.
  - 예상 일정(2026-10-08 기준 추정, 일정 변동 없음): 확정 7/20에서 남은 13개 거래일을 채우면 기준일 2026-10-27(화)이 20번째 거래일이다. 이를 처리하는 KR timer 실행은 2026-10-28(수) 09:30 KST다. 10-09 외 추가 휴장이나 runner PC 장기 정지가 없다는 가정이며, 어긋나면 뒤로 밀린다.
  - 신호 행 수 방법론 정정(2026-09-30): P0 고정 8유형(`daily`/`5-day` × `gain`/`loss` × `raw`/`liquid`) 각 10건=80건은 고정이지만, `new_listing`(신규 상장)·`turnover_surge`(거래대금 급증)는 그날 실제 이벤트 수에 따라 0건 이상으로 달라지는 가변 신호다. 완전성 확인은 "고정 8유형 각 10건 정확히 일치"를 기준으로 하며, 총 행 수가 80을 넘는 것은 정상이다.
  - 자동 감지(2026-09-29부터): 클라우드 루틴이 평일 09:45 KST에 `kr-daily.yml`의 새 run을 감지해 `docs/plans/kr-daily-watermark.json`을 갱신하고, 운영 DB 접근 없이 GitHub Actions 로그만으로 아래 "자동 감지 후보"에 잠정 기록한다. **후보는 확정 누적에 포함하지 않는다** — 이 세션(로컬)에서 운영 Supabase 읽기 전용 대조를 마친 뒤에만 확정 누적으로 승격한다.

  ### Q-08 자동 감지 후보 (확정 대기)

  (클라우드 루틴이 새 완전 거래일 후보를 발견하면 이 아래에 `- 기준일 / run id / 감지 시각`을 추가한다. 확정 후에는 위 확정 누적에 반영하고 이 목록에서 제거한다.)

  (현재 대기 중인 후보 없음 — 2026-10-06·10-07 기준일(run `37552295623`·`37708092789`)은 2026-10-08 DB 대조와 사용자 Telegram 실수신 확인 후 확정 누적으로 승격했다. 상세: `docs/jobs/2026-10-08-etf-signal-mvp-kr-daily-관측.md`.)
- [ ] `WAIT` Q-09 M5-A 순설정·환매 추정 설계·착수
  - 결정(2026-09-22): A안. M6의 완전 거래일 20일 관측 완료 뒤 근거를 모아 설계·착수
  - 해제: Q-08 완료 및 M6 관측 근거·수치 계약 확정
  - 완료 조건: 별도 구현 계획과 임계값 계약을 정본에 반영

## 완료

- [x] `DONE` Q-17 Vercel 배포·가입 차단·Telegram 링크 활성화 (Linear KOR-65)
  - 승인(2026-10-08 사용자): 가입 차단 확인 후 배포, 사용자 브라우저 UI 확인 후 링크 활성화.
  - 가입 차단: 사용자가 Supabase에서 새 가입을 껐다. `/auth/v1/settings` 조회로 `disable_signup` False → True 확인.
  - 배포: Vercel 프로젝트 `etf-signal`(`prj_JhJPxGjeFag4dOejMd59Ay8cTqZo`), Production, 빌드 Node 22.x, URL `https://etf-signal-azure.vercel.app`. 환경 변수는 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 2개만. 인터넷 미인증 smoke는 신호 경로 3개 모두 307 → `/auth/login`, 본문 데이터 0건. 사용자가 인증 후 브라우저 UI를 확인했다.
  - **링크 활성화(M6 증거 경계): 2026-10-08 16:57:37 KST.** `kr-daily.yml` job `env:`에 `ETF_WEB_BASE_URL` 매핑 추가(커밋 `3661504`, 변경은 주석 1줄·env 1줄), `production` environment 변수 `ETF_WEB_BASE_URL=https://etf-signal-azure.vercel.app` 설정. 이 시각 이후 첫 KR timer 실행의 Telegram 보고부터 헤더 끝에 `상세: <url>/signals/kr/<기준일>` 한 줄이 붙는다. 이 한 줄 외 본문·분할은 변경 전과 같다(발송 없는 렌더링 비교로 확인: 활성/비활성 모두 1메시지, 나머지 4줄 동일).
  - M6 관측 영향: 링크 활성화 전 기준일(2026-09-28~10-07, 확정 7일)의 보고는 링크가 없다. 이후 기준일의 보고는 링크 한 줄이 포함되지만 완전성 판정은 `signal_run`·`signal_daily` 대조라 영향이 없다. **첫 링크 포함 보고 확인은 Q-08 대조 때 함께 한다**(헤더 링크 존재, 링크가 보고 기준일과 일치, 링크 클릭 시 해당 기준일 화면).
  - 자동 배포(2026-10-08 사용자 결정: **유지**): `vercel link`가 GitHub 저장소를 자동 연결해 이후 `main` 푸시마다 Production 빌드가 실행된다(문서만 바뀌어도, 클라우드 루틴 커밋 포함). 최근 푸시 `3661504`·`f85b638`·`72c040b`가 각각 Production READY임을 Vercel API 조회로 확인했다. 해제하려면 `vercel git disconnect`.
  - Supabase Auth Redirect URL: 사용자가 배포 도메인을 추가하고(2026-10-08) 비밀번호를 변경해 재설정 경로를 직접 확인했다. 저장소에서는 Redirect URL 설정값을 읽을 수 없어 사용자 보고 기준이다. 알려진 한계: 미인증으로 Telegram 링크를 열면 로그인 후 원래 기준일 대신 최신 기준일로 이동.

- [x] `DONE` Q-16 KR 신호 웹 열람 경로 구현 (Q-15 사양서 승인 후, Linear KOR-64)
  - 승인(2026-10-08 사용자): 사양서 `docs/plans/implementation/kr-signal-web-view-design.md` 승인 후 구현 계획 `docs/plans/implementation/kr-signal-web-view-plan.md`로 전개·실행.
  - 구현: 기준일 라우트 `app/signals/kr/[basDd]/page.tsx`(상승 적색 ▲·하락 청색 ▼ 대비, 기간·스크린 세그먼트, 전·후 거래일 이동, 가변 신호 섹션), `/protected`는 최신 기준일 리다이렉트, Telegram 헤더에 `상세: <url>` 한 줄(`ETF_WEB_BASE_URL` 미설정 시 생략). 커밋 `de1a2f4`..`e5b01b6` 10개.
  - 검증(2026-10-08, Node 22.23.2): `npm test` 37파일·159테스트, `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과. 미구현 흔적 0건. 태스크별 독립 리뷰 5회와 전체 브랜치 최종 리뷰(`Approved with required fixes`) 후 필수 수정 8건 반영·재리뷰 통과.
  - 불변성 증거: 변경 전후 `formatTelegramReport` 출력이 maxLength 4096·1000·300에서 바이트 동일. 불변성 테스트가 구 헤더 리터럴을 직접 단정하며 변이 2종(링크 상시 부착, 헤더 줄 순서 변경)에서 실패함을 확인. 운영 DB(기준일 2026-10-07, 81행) 읽기 전용 실행에서 `ETF_WEB_BASE_URL` 미설정·빈 값·공백·설정 4경우 모두 `messageCount:1`.
  - 인증 smoke: `next start` 미인증 요청이 `/signals/kr/2026-10-07`·`/signals/kr/latest`·`/protected` 모두 307 → `/auth/login`, 응답 본문에 신호 데이터 0건.
  - 남은 한계: ① 라우트·컴포넌트는 문자열 계약 테스트와 빌드로만 검증(Vitest `node` 환경, RTL 없음). 실제 렌더링과 360px 무가로스크롤은 Q-17 배포 후 브라우저 UI smoke로 확인한다. ② 이월한 Minor(인접 거래일 조회 `.error` 무시, 가변 섹션 행 줄바꿈 일관성, 전 종목 상승일 하락 블록에 양수 표시, `SECTION_TITLES` 중복 등)는 후속 정리 대상이다. 상세: `docs/jobs/2026-10-08-etf-signal-mvp-kr-daily-관측.md`.

- [x] `DONE` Q-14 KR 관측 검증 GitHub Actions 자동화 및 자동 연결 첫 실측
  - 구현(2026-10-01): `.github/workflows/kr-verify.yml` — KR daily 성공 직후(`workflow_run`)와 수동 실행 시 `npm run verify:kr-candidate -- latest`로 운영 DB를 읽기 전용 대조하고 job 요약에 판정을 남긴다. 판정이 실패면 job이 실패한다. 호스팅 runner에서 `production` 환경의 `SUPABASE_SERVICE_ROLE_KEY`와 URL만 쓴다(KRX·Kiwoom·Telegram 시크릿 미전달). 검증: TDD, `npm test` 31파일·113테스트, `tsc`·`lint`·`build`·`continuity:check` 통과, 수동 실행 run `36799258625` 성공.
  - 자동 연결 실측(2026-10-02): KR daily run `36946389398`(09:31 KST) 종료 직후 `kr-verify` run `36946604837`이 `event=workflow_run`으로 자동 실행돼 성공했다(09:33 KST). 같은 기준일(2026-10-01)을 로컬 `verify:kr-candidate -- latest`로도 대조해 `ok:true`를 확인했다.
  - 남은 한계: ① 판정 실패 시 GitHub 알림이 실제로 도착하는지는 실패를 만들어 보지 않았고 알림 설정(Settings → Notifications → Actions)도 사용자 확인 전이다. ② Telegram **실수신**은 사람만 확인할 수 있어 누적 승격에는 사용자 확인을 계속 쓴다. ③ `production` 환경에 브랜치 제한이 없다(기존 상태) — `main`으로 제한하는 설정 변경을 별도로 검토한다.

- [x] `DONE` Q-13 웹 현황판에 자동 감지 후보·20일 진행 그리드 추가 (M6 대기 중 작업)
  - 배경: 현황판 DB의 `candidates` 컬렉션은 클라우드 루틴이 쓰고 있었지만 화면에 렌더링되지 않아 사람이 직접 확인할 방법이 없었다.
  - 구현: Artifact 페이지에 "자동 감지 후보 (DB 대조 대기)" 섹션(`candidates` 컬렉션 구독)과 M6 카드에 20칸 진행 그리드(확정/대조 대기/미관측 구분)를 추가했다. `https://claude.ai/artifact/JKXpxdQzbryYcVLWWztTdB` version 2로 재게시.
  - 검증: `candidates` 컬렉션 목록 읽기로 데이터 연결 확인(현재 0건, 정상). 다음 클라우드 루틴 발화나 신규 대기 항목 발생 시 화면 반영을 재확인한다.

- [x] `DONE` Q-12 KR 완전 거래일 검증 스크립트 자동화 (M6 대기 중 작업)
  - 배경: Q-11·Q-08 승격 때마다 임시 Node 스크립트를 손으로 작성해 운영 DB를 대조했다. 실수 위험을 줄이고 재사용 가능하게 정식 스크립트로 만들었다.
  - 구현: `scripts/verify-kr-daily-candidate.ts`(`verifyKrDailyCandidate(basDd, runId?)`) — `signal_run`·`signal_daily`·`trading_calendar_kr`을 읽기 전용으로 대조해 판정 JSON을 반환한다. 고정 P0 8유형(각 10건) 완전성과 `new_listing`·`turnover_surge`(가변 신호) 분리, 중복 run·중복 Telegram 마커 감지를 포함한다. `npm run verify:kr-candidate -- <bas_dd> [runId]`로 CLI 실행 가능.
  - 검증: TDD로 테스트 6개(`test/scripts/verify-kr-daily-candidate.test.ts`)를 먼저 작성(RED) 후 구현(GREEN). `npm test` 30개 파일·105개 테스트, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run continuity:check` 통과. 실제 운영 DB로 2026-09-29 기준일을 재실행해 이전 수동 대조와 동일한 결과(`ok:true`, 86행, `new_listing:raw` 6건)를 확인했다.

- [x] `DONE` Q-11 KR timer 완전 보고 경로의 첫 운영 실행 확인 (KOR-58)
  - 실행 증거(2026-09-29): 09:31 KST timer dispatch의 GitHub run `36503490288` 성공. 로그는 `completed=["20260922","20260923","20260928"]`, `nonTrading=["20260924","20260925"]`, `blocked=null`, `report.reported=true`, 기준일 `20260928`, Kiwoom `COMPLETE`, run ID `fcbf9621-…`를 기록했다.
  - DB 대조(2026-09-29, 운영 Supabase 읽기 전용): `signal_run` id `fcbf9621-…` = `COMPLETED`·`kr_full_signal_complete=true`·`telegram_reported_at` 존재. `signal_daily` 80행이 P0 8개 유형×10건과 정확히 일치. `bas_dd=2026-09-28` KR run·리포트 마커 각 1건으로 중복 없음. `trading_calendar_kr`도 workflow 로그와 일치.
  - 실수신 확인(2026-09-29 사용자): 운영 Telegram 채팅에서 KR 보고 메시지 수신을 직접 확인했다("텔레그램을 통해 받았습니다").
  - 완료 판정: M6 완전 거래일 1/20(2026-09-28 기준일)로 기록. 같은 기준일 재실행은 `already_reported`로 처리되어야 하며 아직 검증 대상은 아니다. 상세: `docs/jobs/2026-09-29-etf-signal-mvp-m6-관측기록.md`

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
  - 한계: US의 동일 콘텐츠 `PENDING` 재사용 경로는 운영에서 재현되지 않았고 단위 테스트로만 보장된다. 고아 `PENDING` run `80e23559-…`(신호 0행)은 2026-09-23 사용자 승인 후 상태·행 수를 재확인하고 삭제했다. 원천 snapshot `1d65db7f-…`은 원본 보존을 위해 남겼다.
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
