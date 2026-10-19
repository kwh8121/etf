# ETF 신호 MVP 다음 작업 큐

> 기준: 2026-10-16 KST. 실행 상태의 정본은 이 파일이며 제품·데이터 계약은 v2.2 계획서와 ROADMAP을 따른다.
> 완료 항목은 검증 증거와 커밋을 기록한다. 새 사실을 확인하면 라벨·해제 조건을 갱신한다.
> 웹 현황판(읽기 전용 보조 화면): `docs/guides/etf-signal-mvp-status-dashboard.md` 참조.

## 큐 (위에서부터 실행)

- [x] `DONE` Q-33 Telegram ETF별 웹 상세 링크 구현 (KOR-68, 2026-10-16)
  - 사용자 요청으로 키움 기본 방침·공유 URL 제공 대기를 철회했다. 앞서 제안한 국내 네이버·미국 Yahoo Finance 조합을 적용했다. 미국 네이버는 거래소 구분을 기존 티커만으로 확정하지 못해 임의 주소를 만들지 않는다. 추가 상세 데이터 수집·DB 변경은 없다.
  - 현재 순위·랭크아웃 이름 모두 HTML 링크로 표시한다. 메타데이터·이름 escape, 잘못된 코드의 텍스트 처리, 완전한 행 단위 분할과 단일 행 초과 차단을 구현했다. 일반 상태 알림은 기본 텍스트 모드를 유지한다.
  - 검증(Node 22.23.2): TDD RED/GREEN, 전체 53파일·313테스트, `tsc --noEmit`, `.opencode/**` 제외 lint, production build(17개 정적 페이지), 독립 리뷰 APPROVE·지적 0건. 전체 lint는 기존 사용자 미추적 `.opencode/` 파일의 `no-explicit-any` 4건으로 실패했다.
  - 브라우저: 네이버 069500·Yahoo VOO는 360px·1440px에서 상세 종목 식별 성공. 네이버 가로 넘침 없음, Yahoo 360px은 4px 넘침. 실제 iOS·Android·Telegram 클릭은 미검증이다. 시험 발송·운영 수동 실행·과거 메시지 수정은 수행하지 않았다.
  - 사용 안내: `docs/guides/etf-signal-mvp-etf-detail-links.md`. 이전 키움 검토는 `docs/references/2026-10-16-kiwoom-etf-detail-links.md`에 이력으로 보존한다. 이 항목의 코드·테스트·문서는 동일 원자적 기능 커밋으로 main에 반영한다.
  - 후속 시험 발송(사용자 명시 요청, 2026-10-16 12:29:57–12:30:00 KST): 오늘 보고된 KR(기준일 10-15) 4개·US(오늘 관측) 2개를 기존 채팅으로 전송했다. API 성공 6건·`text_link` 213개 확인, 운영 run notes 해시 전후 일치. 실제 수신·클릭은 사용자 확인 전이며 임의 추가 발송은 하지 않는다.

- [x] `DONE` Q-26 데이터 정확성 보강 (2026-10-15 사용자 권장 순서 진행 승인)
  - 순서: 전체 페이지 조회·입력 완전성 → master 최초 관측일 보존 → 저장 내용 재계산 감사 → 발송·후속 검증 게이트 → 운영 읽기 전용 정정안·US 범위 검토.
  - 계획: `docs/plans/implementation/2026-10-15-data-correctness-plan.md`. 과거 운영 DB 수정·migration·과거 Telegram 재발송은 포함하지 않는다.
  - 감사 근거: 기본 조회 제한 때문에 KR 기준일 2026-10-14 현재 1,176개·시작일 1,171개·직전 20일 23,427개가 각 1,000개만 계산에 사용됐다. 전체 재계산 시 고정 신호 코드 14개 교체·공통 종목 순위 16개 차이, turnover 13개(저장 0개). listing event 223개 중 214개는 더 이른 snapshot에 코드가 존재했다. US 7 run·60,250개 저장 신호는 원천 replay와 일치했지만 usa20931의 범위 제한은 별도 확인이 필요하다.
  - 주의: 기존 candidate 검증 성공·과거 M6 누적은 콘텐츠 정확성 증명이 아니었다. 정정·검증 결과 없이 과거 누적을 정확한 데이터 관측으로 확정하지 않는다.
  - 구현: `ded092d`·`8e08025` 전체 조회·최초 관측일 보존, `d0f8c68`·`971545b`·`146cab8` 읽기 전용 재계산 감사, `f6b1a57` candidate·KR 실발송 전 게이트, `1dc1087` run 실패와 전역 검사 집계 분리. 운영 정정안은 아래 Q-27로 분리했다.
  - 검증: Node 22.23.2, 49파일·262테스트, `tsc --noEmit`, 격리 worktree 전체 lint, production build(17개 정적 페이지), `continuity:check` 통과. 최종 전체 브랜치 독립 리뷰 `APPROVE`, Critical·Important·Minor 0건. 원 checkout의 기존 미추적 `.opencode/` lint 오류 4개는 수정하지 않았다.
  - 운영 읽기 전용 대조: KR 17 run은 현재 정본과 차이가 있어 차단, US 7 run은 저장 원천 replay와 일치. 운영 DB·수집 API·Telegram·timer는 변경하지 않았다. 웹의 과거 데이터가 정정된 것은 아니다.

- [x] `DONE` Q-27 승인된 KR 운영 데이터 정정 (2026-10-15, `dedbda9`·`6e3c14b`)
  - false listing event·연결 false 신규 신호 각 214개 제거, master.first_seen 214개 보정. 분담 실행이 바꾼 master.source_snapshot_id 214개는 원본으로 복구해 현재 provenance를 보존했다. 절차 위반·중단·복구 근거를 당일 작업 기록에 남겼다.
  - 최근 기준일 2026-10-14 run은 80→93행, 2026-10-13 run은 false 신규 제거 후 84→99행으로 현재 정본 재계산 결과를 적용했다. KR 17 run의 전체 metadata·Telegram 표식, 기존 행 observed_at을 보존했고 추가 행은 원 run 시각을 썼다. 과거 Telegram 재발송·M6 자동 승격은 없다.
  - 검증: 52파일·296테스트, tsc·격리 전체 lint·production build·통합 독립 리뷰 APPROVE(지적 0). 웹 완료 상태 보호는 Production READY 확인 후 최근 두 run 교체에 사용했다. 최신 candidate는 `ok:true`, 전수 감사는 최근 KR 2·US 7 run 일치, 전역 listing 감사 통과다.
  - **남은 한계:** 과거 KR 15 run은 signal_diff가 남아 전수 감사 전체 `ok:false`/종료 1이다. 이를 성공으로 숨기지 않으며 Q-29에서 확정한 보존·미검증 명시 정책을 따른다. 당시 전체 원본 입력 복원·잔존 9개 이벤트의 실제 신규 상장 사실을 보증하지 않는다.
  - 정본 근거: `docs/references/2026-10-15-kr-data-correction-result.md`, 비공개 전체 백업·고정 plan/hash·최종 감사. 계획: `docs/plans/implementation/2026-10-15-approved-correction-plan.md`.

- [x] `DONE` Q-29 이전 KR 15 run 보존·미검증 명시 정책 확정 (2026-10-15 사용자 권장안 선택)
  - 사용자 `권장 사항대로 처리`로 A안을 확정했다. 기존 값을 보존하고 콘텐츠 정확성 미검증·현재 정본 불일치 상태로 보류한다. 추가 운영 정정·과거 Telegram 재발송은 수행하지 않는다.
  - 과거 15 run의 signal_diff와 전수 감사 전체 `ok:false`는 유지한다. 웹의 오래된 날짜·과거 Telegram을 정확한 콘텐츠로 간주하거나 M6 과거 누적을 정상화하지 않는다.
  - 확대 정정은 새로운 근거·대상·백업/복원 계획을 마련하고 별도 승인받은 경우에만 재개한다. 초기 seq·교체 source의 불확실성을 보존한다.

- [x] `DONE` Q-28 US 5일 하락 요청 범위 제한 비교 (2026-10-15 사용자 승인, `6e3c14b`)
  - 승인된 한 차례 실행에서 조건별 20페이지·500개, 합계 40 ranking 요청으로 종료했다(18:01:37–18:02:26 KST). 양 조건 모두 continuation이 남아 부분 결과다. 오류·중복·자동 재시도·추가 호출은 없었다.
  - 상위 20개 코드 집합 차이 0개, 전체 관측 코드 집합 대칭 차이 6개. 시각 차이·절단 경계 영향이 있어 조건 효과와 전체 ETF 포괄성은 확정하지 않는다.
  - 근거: `docs/references/2026-10-15-us-loss-scope-comparison.md`. 운영 저장·발송·현행 요청 변경 없음. Q-30에서 현행 계약·범위 제한 유지를 확정했다.

- [x] `DONE` Q-30 US 현행 요청 조건·범위 제한 유지 확정 (2026-10-15 사용자 권장안 선택)
  - 사용자 `권장 사항대로 처리`로 A안을 확정했다. 현행 `usa20931.stk_cnd=1`을 유지하고 증100% 조건·전체 ETF 포괄성 미확인 제한을 명시한다.
  - Q-28의 조건별 500개 부분 표본은 전체 포괄성 개선을 입증하지 못했다. 추가 비교 호출·운영 수집/저장/보고 계약 변경은 수행하지 않는다.
  - `stk_cnd=0` 변경이나 더 큰 비교는 새 범위·별도 승인 후에만 재개한다. 근거는 `docs/references/2026-10-15-us-loss-scope-comparison.md`를 따른다.

- [x] `DONE` Q-25 KR·US 웹 랭크인·랭크아웃 표시 (2026-10-15 사용자 요청·진행 승인, 기능 커밋 `930fd00`)
  - 범위: `/signals/kr/<기준일>`·`/signals/us/<한국 관측일>`에 Telegram과 같은 종목 코드·직전 완료 run 비교를 연결한다. 진입은 현재 행에 `랭크인`, 이탈은 섹션 아래 `랭크아웃`과 직전 순위를 표시한다. KR 가변 신호와 현재 0건인 이탈 전용 섹션도 포함한다.
  - 경계: 비교할 이전 run이 없으면 변동을 생략한다. 이전 조회 오류 때 현재 신호는 유지하고 변동 생략 안내를 표시한다. US는 같은 한국 날짜의 직전 run도 비교하고 유형별 상위 10건만 조회한다.
  - 검증: Node 22.23.2, `npm test` 44파일·223테스트, `npx tsc --noEmit`, 앱·도메인·스크립트·테스트 ESLint, production build, 독립 리뷰(Critical·Important·Minor 0건), `continuity:check` 통과. 전체 lint는 작업 전부터 있던 미추적 `.opencode/`의 `any` 오류 4개로 실패했다.
  - 배포: `930fd00`을 main에 푸시했고 Vercel Production `dpl_DUrm2LfdbK1F3UwACvVtkGvde8Hr`가 `READY`, 대표 도메인 `etf-signal-azure.vercel.app`이 해당 배포를 가리킴을 API로 확인했다. KR·US 미인증 인터넷 smoke는 307 → `/auth/login`, 본문 랭크 데이터 없음. 인증 화면의 표시·조회는 실제 페이지 렌더링 통합 테스트로 검증했고, 운영 사용자 세션의 브라우저 시각 검증은 미실행이다.

- [x] `DONE` Q-18 US 관측 검증 자동화 (커밋 `9173894`, 검증: `npm test` 183개·`tsc`·`lint`·`build` 통과) (KR Q-12·Q-14와 동일 방식, 사용자 요청 2026-10-12)
  - 배경: US는 `ENABLE_US_ETF_P1=false`(staging)로 꺼져 있고 운영 DB 대조 수단이 없다. KR과 달리 시장일이 없어(`bas_dd`·`market_date`=null) 관측 단위는 `signal_run` 1건이다. Telegram 보고 표식(`notes.telegram_reported_at`)도 US에는 없다.
  - 구현 범위(코드만, 외부 부작용 없음): ① `report:us-movers`가 발송 성공 뒤 `notes.telegram_reported_at`을 기록(KR `markKrReportSent`와 같은 방식). ② `verify:us-candidate -- <runId|latest>` 읽기 전용 대조 스크립트(COMPLETED, 4유형 상위 10건 순위 1..10 연속, 표식, PENDING 잔존 감지). ③ `.github/workflows/us-verify.yml`(US 워크플로 성공 직후 자동 실행, 플래그가 `true`가 아니면 대조 단계를 건너뜀). ④ 계약 테스트.
  - 완료 조건: `npm test`·`tsc`·`lint`·`build` 통과, 변경은 커밋·푸시.
  - 구현 결과(2026-10-12): 위 ①~④ 구현, 독립 리뷰 반영(us-verify environment를 US 실행과 같게 맞춤, 이미 보고한 run 재발송 가드, 표식 기록 실패 별도 오류, 순위는 양수 오름차순만 확인, 상수 공유). 알려진 한계: 표식 도입 전 run(2026-09-23 등)은 `telegram_reported_at`이 없어 대조가 실패한다(정상). 표식 기록만 실패해 남은 run은 자동 복구 경로가 없고 수동 확인이 필요하다. 같은 한국 날짜에 서로 다른 미국 거래일 보고가 두 번 나가면 중복 발송 의심으로 잡힌다(PC 장기 정지 뒤 따라잡기+수동 실행 시).
- [x] `DONE` Q-19 US 관측 기준·운영 전환 조건 결정 (2026-10-12 사용자가 권장안으로 모두 승인)
  - ① "US 완전 관측일": 한국 시간 하루에 `COMPLETED`이고 보고 표식(`telegram_reported_at`)이 있으며 `verify:us-candidate`를 통과한 run이 1건 이상이다. 같은 한국 날짜에 표식이 2건 이상이면 중복 발송 의심으로 확정에서 제외한다.
  - ② 누적 목표: KR과 같은 20일(Q-22).
  - ③ 운영 Telegram chat: KR과 같은 production chat(`production` environment의 `TELEGRAM_CHAT_ID`), 제목의 `P1 실험` 문구 유지.
  - ④ 웹 열람 키: 한국 관측일 라우트 `/signals/us/<YYYY-MM-DD>` + `latest` 리다이렉트.
- [x] `DONE` Q-20 US 신호 웹 열람 경로 구현 (사양서 `docs/plans/implementation/us-signal-web-view-design.md`, 2026-10-12 사용자 승인)
  - 구현: `/signals/us/<한국 관측일>`·`/signals/us/latest`, 유형별 상위 10건+전체 건수, 전·후 관측일 이동, US 보고 헤더 링크(`ETF_WEB_BASE_URL` 미설정 시 출력 불변), `us-etf-movers.yml` 매핑. 독립 리뷰 반영(유형별 부분 오류, 한국 시간 관측 시각, 보고와 같은 run 선택 기준, 고지 상시 표시, 순수 상수 모듈 분리).
  - 검증(2026-10-12, Node 22.23.2): `npm test` 41파일·207테스트, `tsc`, `lint`, `build` 통과. 로컬 `next start` 미인증 요청이 `/signals/us/<날짜>`·`latest` 모두 307 → `/auth/login`, 본문 데이터 0건.
  - 링크는 아직 꺼져 있다: `ETF_WEB_BASE_URL`은 `production` environment에만 있고 US는 `staging`에서 실행되므로 Q-21 전환 때 켜진다. 배포 후 인증된 브라우저 UI 확인은 사용자가 하며(US 데이터가 필요해 Q-21 첫 실행 뒤), 360px 무가로스크롤도 그때 본다.
  - 남은 한계: 라우트·컴포넌트는 문자열 계약 테스트와 빌드로만 검증. `YYYYMMDD` 요청은 정본 URL로 리다이렉트하지 않는다(KR과 같은 동작).
- [x] `DONE` Q-21 US 운영 전환 (2026-10-12 사용자 승인: 권장안 일괄 승인 + 첫 실행은 timer 대기 선택)
  - 변경: GitHub `production` environment에 `ENABLE_US_ETF_P1=true` 설정(변수 목록으로 확인), `us-etf-movers.yml`·`us-verify.yml`의 `environment: staging`→`production`. `staging`의 `ENABLE_US_ETF_P1=false`는 그대로다. `ETF_SIGNAL_TEST_FAIL_AFTER_PENDING`은 어느 environment에도 없다.
  - 효과: 다음 US timer 실행부터 production Kiwoom·Supabase·Telegram chat을 쓰고, `production`의 `ETF_WEB_BASE_URL`로 Telegram 헤더에 `상세: …/signals/us/<한국 관측일>` 링크가 붙는다. 수동 dispatch는 하지 않았다(발송 없음).
  - 되돌리기: `gh variable set ENABLE_US_ETF_P1 --env production --body false`. 이후 US 실행은 `DISABLED`로 끝나고 발송·쓰기가 없다.
- [ ] `WAIT` Q-32 Codex Playwright MCP 재연결 확인 (2026-10-16 사용자 failed 재보고)
  - 기존 기본 Chrome 부재·프로필 충돌은 기존 Chromium 실행 경로 지정·`--isolated`로 우회했고 독립 실행을 검증했다.
  - 후속 직접 원인: 2026-10-16 09:22 KST Codex 시작 로그에서 `timed out handshaking with MCP server after 14.9999986s` 확인. 전역 `mcp_servers.playwright.startup_timeout_sec`만 15→60초로 변경했다. 초기화 지연의 근본 원인은 확정하지 않았다.
  - 저장 설정으로 독립 초기화 5.05초·도구 25개 조회·`about:blank` 열기/닫기 성공. 현재 Codex 세션의 Playwright 도구는 미노출이며 연결 복구 완료로 보지 않는다.
  - 해제: 다음 Codex 연결에서 60초 설정 반영·Playwright 도구 노출·실제 브라우저 호출 성공 확인. 현재 세션 재연결 시각은 미정이다.
  - 제약: Chromium 캐시 경로가 사라지면 재설정이 필요하며 isolated 세션은 로그인 상태를 실행 간 보존하지 않는다. 근거는 당일 작업 기록이다.

- [x] `DONE` Q-31 Q-29·Q-30 결정의 OpenViking 외부 메모리 동기화 (2026-10-16 사용자 저장 승인)
  - 사용자 `저장 승인`으로 아래 최소 요약의 한 차례 전송을 승인했다. OpenViking `remember`는 `Stored 1 message(s) and committed for memory extraction.`을 반환했다. 저장·추출 접수 성공이며 비동기 장기 메모리 추출 완료를 뜻하지 않는다.
  - 전송 요약: “ETF 신호 MVP: 사용자가 과거 KR 15 run 보존·콘텐츠 미검증/현재 정본 불일치 명시와 US 현행 `stk_cnd=1`·증100% 조건·전체 ETF 포괄성 미확인 제한 유지를 확정했다. 두 정책 결정은 완료이며 정확성 검증 완료를 뜻하지 않는다. 추가 운영 정정·API 비교·계약 변경은 새 범위와 별도 승인이 필요하다.” 비밀값·원천 응답·내부 파일 경로는 전송하지 않았다.
  - 이력: 2026-10-15 자동 승인 검토는 외부 목적지 신뢰 여부와 구체적 payload 전송 승인 미확인으로 최초 저장을 거절했다. 이번 사용자 명시 승인 후 최소 요약만 한 차례 재시도했다. 운영 DB·API·발송·계약 변경은 없다.

- [ ] `WAIT` Q-23 첫 US 운영 실행 확인 (Q-21 이후)
  - 해제: US timer(설치본 기준 평일 09:40 KST, 회사 PC 기동 시 `Persistent=true` 따라잡기)의 첫 실행. 2026-10-12 09:40 실행은 전환 전이라 `DISABLED`였고, 가장 이른 기회는 2026-10-13(화) 09:40이며 정시 실행은 보장되지 않는다.
  - 첫 실행 결과(2026-10-13): run `38328413680`(09:40 dispatch)이 수집 13분 20초 뒤 09:55:32에 보고(`messageCount:1`)를 보냈으나 `timeout-minutes: 15`에 걸려 `cancelled`로 끝났다. 그래서 자동 `us-verify`는 실행되지 않았다. `verify:us-candidate`는 run `ee72ce74-…`에서 `ok:true`(4유형 2033·2876·5680·2578행, 표식 1건, 같은 날 run 1건). 원인 수정: `timeout-minutes`를 40으로 상향(계약 테스트 추가). 사용자가 2026-10-13 Telegram 1통 수신과 Vercel 링크 열림을 확인했다(링크 날짜 일치와 360px 무가로스크롤은 별도 언급 없음).
  - 정상 재실행 결과(2026-10-14): run `38491518500`이 `success`로 완료되고 연계 자동 `us-verify` run `38492927972`도 성공했다. 로컬 운영 DB 읽기 전용 `verify:us-candidate -- latest`는 run `8cb67a9d-…`에 대해 `COMPLETED`, 4유형 2528·2370·5676·3120행, 보고 표식 1건, 같은 한국 날짜 run·표식 각 1건, `ok:true`를 확인했다. 따라서 timeout 수정과 자동 검증 연결의 기술적 확인은 완료다. **Telegram 헤더 링크 날짜 일치와 360px 무가로스크롤의 사용자 확인이 아직 명시되지 않아 Q-23은 유지한다.**
  - 확인 순서: ① `gh run list --workflow "US ETF movers (P1 experimental)"`로 run 시각·`status=COMPLETE`·`duplicate` 확인, ② 자동 `us-verify` run 결과(요약에 `통과`), ③ `nvm use` 후 `npm run verify:us-candidate -- latest` 읽기 전용 대조, ④ 사용자 Telegram 실수신: production chat에 `[ETF 신호][US][P1 실험]` 메시지 1통, 헤더 끝 `상세:` 링크가 한국 관측일과 일치, 링크가 `/signals/us/<날짜>` 화면을 열고 유형별 상위 10건·전체 건수·한국 시간 관측 표기가 보임(360px 무가로스크롤 포함).
  - 실패 시: 같은 원인 2회 실패 또는 의도치 않은 발송이면 위 되돌리기를 먼저 하고 보고한다. 링크가 없으면 `production` 변수 `ETF_WEB_BASE_URL`과 `us-etf-movers.yml` 매핑을 확인한다.
- [ ] `WAIT` Q-07 US 휴장 시간 동일 콘텐츠 중복 관측 실측 (KOR-56)
  - 해제: 다음 미국 시장 완전 휴장일 2026-11-26(추수감사절, 가장 이른 기회) 또는 2026-12-25(크리스마스). 실행은 기능 플래그 전환을 포함한 외부 부작용이라 매번 사용자 승인 필요
  - 완료 조건: 관측 행 2개·기준 콘텐츠 1개·중복 신호 없음 확인
  - 사전 준비(2026-09-30): 코드의 중복 감지 경로(`persistUsEtfMoverSnapshot`)는 이미 구현·테스트돼 있어 추가 구현이 필요 없음을 확인했다. 실행 절차·승인 체크포인트·증거 수집 방법은 `docs/guides/etf-signal-mvp-q07-us-holiday-observation-runbook.md`에 정리했다.
- [ ] `WAIT` Q-08 M6 완전 거래일 20일 관측 (KOR-58)
  - **2026-10-16 읽기 전용 재점검 완료:** 전수 26 run 중 KR 최근 3개·US 8개 일치, 과거 KR 15개 `signal_diff`로 전체 `ok:false`/종료 1. 최근 기준일 10-13·14·15의 후보 검증은 모두 통과(99·93·95행), 원천 hash·상장 이력 감사·중복 검사도 통과했다. 상세: `docs/references/2026-10-16-m6-readonly-verification.md`.
  - **일수 분류:** 10-13·14는 사후 정정된 현재 DB 검증일이며 당시 보고 정확성 증거가 아니다. 10-15는 timer journal→GitHub daily/verify 성공→Kiwoom COMPLETE→DB 재계산 일치를 확인한 신규 정상 운영 **기술 후보 1일**이다. 사용자 오늘 링크 시험 재전송 수신 확인은 기록하되 정규 원문 전체·자체 웹 헤더 날짜·360px 표시 확인으로 확대하지 않는다. 최종 관측일 자동 승격·M6 종료·Q-09 착수는 보류한다.
  - 해제: Q-03 게이트 통과 후 각 KR 거래일의 실제 운영 결과 확인
  - **2026-10-15 정확성 감사 주의:** 아래 기존 9/20은 당시 행 수·보고 표식·실수신 기준의 기록이다. 해당 기간 KR 신호에서 전체 입력 재계산 차이가 확인됐으므로 콘텐츠 정확성이 확인된 누적으로 해석하지 않는다. Q-27로 최근 두 run의 현재 정본 정정은 완료했지만 이전 15 run이 남아 있다. 콘텐츠 정확성 기준의 누적을 별도 재확정하기 전에는 M6 종료·Q-09 착수를 진행하지 않는다. 기존 관측 사실은 삭제하지 않는다.
  - 완료 조건: `docs/guides/etf-signal-mvp-m6-observation-runbook.md` 기준 20/20; **과거 운영 관측 9/20(콘텐츠 정확성 누적 미확정)**; **정확성 기준 확정 관측일: 2026-10-16 기준일 1일(2026-10-19 승격, 위 과거 9일과 합산하지 않음)**(2026-09-28·09-29·09-30·10-01·10-02·10-06·10-07·10-08·10-12 기준일, Q-11 및 `docs/jobs/2026-09-30-…`·`2026-10-01-…`·`2026-10-02-…`·`2026-10-06-…`·`2026-10-08-etf-signal-mvp-kr-daily-관측.md`·`2026-10-12-etf-signal-mvp-kr-daily-관측.md`·`2026-10-13-etf-signal-mvp-kr-daily-관측.md` 참조).
  - **링크 활성화 후 첫 보고 확인(완료 2026-10-12):** run `38188274629`(기준일 2026-10-08)의 Telegram 보고에서 헤더 링크 존재·기준일 일치·링크가 해당 기준일 화면을 여는 것을 사용자가 실수신으로 확인했다. 아래는 확인 기준 원문이다. Telegram 헤더에 `상세: https://etf-signal-azure.vercel.app/signals/kr/<기준일>` 한 줄이 있는지, 기준일이 보고 기준일과 같은지, 링크가 해당 기준일 화면을 여는지. 링크가 없으면 `production` environment 변수와 `kr-daily.yml` 매핑을 먼저 확인한다. 상세: Q-17.
  - 휴장(2026-09-24·25 추석 연휴): 거래일이 아니므로 누적 대상이 아니다. 다음 보충은 KRX 빈 응답을 과거일 `NON_TRADING`으로 기록하고 건너뛴다. runner PC가 꺼져 있으면 다음 기동 후 근무시간 09:30 timer가 2026-09-23 수집과 함께 휴장일을 따라잡는다.
  - 휴장: 2026-10-05는 운영 DB에서 `NON_TRADING` 확인. 2026-10-09(금)는 휴장 예정(2026-10-01 사용자 확인, KRX 공식 캘린더 미대조)이며 실제 기록을 확인한 뒤 제외한다. 휴장일은 누적 대상이 아니다.
  - **기준일 2026-10-13 관측(2026-10-14):** KR daily `38490681521`과 자동 `kr-verify` `38491349024`은 성공했다. 당시 정정 전 DB 대조 102행(고정 80·신규 22)은 현재 정확성 증거로 사용하지 않는다. 2026-10-16 현재 DB 재점검은 사후 정정된 99행(고정 80·신규 4·거래대금 급증 15)으로 통과했다. 당시 보고 정확성·자체 웹 날짜·360px 표시를 입증한 것은 아니며 최종 관측일 승격은 보류한다. 이전 기록: `docs/jobs/2026-10-14-etf-signal-mvp-kr-daily-자동감지.md`. 현재 근거: `docs/references/2026-10-16-m6-readonly-verification.md`.
  - 이전 예상 종료 일정(기준일 2026-10-27·처리 10-28)은 정확성 기준 누적 재확정 전에는 사용하지 않는다. 서로 다른 기준일을 20일 채워야 하며 시험 재전송·사후 정정은 새 관측일을 만들지 않는다.
  - 신호 행 수 방법론 정정(2026-09-30): P0 고정 8유형(`daily`/`5-day` × `gain`/`loss` × `raw`/`liquid`) 각 10건=80건은 고정이지만, `new_listing`(신규 상장)·`turnover_surge`(거래대금 급증)는 그날 실제 이벤트 수에 따라 0건 이상으로 달라지는 가변 신호다. 완전성 확인은 "고정 8유형 각 10건 정확히 일치"를 기준으로 하며, 총 행 수가 80을 넘는 것은 정상이다.
  - 자동 감지(2026-09-29부터): 클라우드 루틴이 평일 09:45 KST에 `kr-daily.yml`의 새 run을 감지해 `docs/plans/kr-daily-watermark.json`을 갱신하고, 운영 DB 접근 없이 GitHub Actions 로그만으로 아래 "자동 감지 후보"에 잠정 기록한다. **후보는 확정 누적에 포함하지 않는다** — 이 세션(로컬)에서 운영 Supabase 읽기 전용 대조를 마친 뒤에만 확정 누적으로 승격한다.

  ### Q-08 자동 감지 후보 (확정 대기)

  (클라우드 루틴이 새 완전 거래일 후보를 발견하면 이 아래에 `- 기준일 / run id / 감지 시각`을 추가한다. 확정 후에는 위 확정 누적에 반영하고 이 목록에서 제거한다.)

  (2026-10-06·10-07 기준일은 2026-10-08, 10-08 기준일(run `38188274629`)은 2026-10-12, 10-12 기준일(run `38327594265`)은 2026-10-13 DB 대조와 사용자 Telegram 실수신 확인 후 확정 누적으로 승격했다. 상세: `docs/jobs/2026-10-08-etf-signal-mvp-kr-daily-관측.md`·`2026-10-12-etf-signal-mvp-kr-daily-관측.md`.)

  - 기준일 2026-10-12 / run `38327594265`(https://github.com/kwh8121/etf/actions/runs/38327594265) / 감지 2026-10-13T00:47:47Z(클라우드 루틴) / catchup: completed=[20260922,20260923,20260928,20260929,20260930,20261001,20261002,20261006,20261007,20261008,20261012] nonTrading=[20260924,20260925,20261005,20261009] blocked=null / report: reported=true, reportRunId=23a2a0bf-ce28-5c6c-a8c3-f5d45d1e03b1
  - 기준일 2026-10-13 / run `38490681521`(https://github.com/kwh8121/etf/actions/runs/38490681521) / 감지 2026-10-14T00:46:19Z(클라우드 루틴) / 자동 `kr-verify` run `38491349024` 성공 / 당시 정정 전 DB 대조 102행(고정 80+신규 22)은 현재 정확성 증거로 사용하지 않음 / 2026-10-16 현재 DB 재점검 `ok:true`, 정정된 99행(고정 80+신규 4+거래대금 급증 15), 보고 표식 1건·중복 없음 / **사후 정정 검증일, 당시 보고 정확성·자체 웹 확인은 미확정** / catchup: completed=[20260922,20260923,20260928,20260929,20260930,20261001,20261002,20261006,20261007,20261008,20261012,20261013] nonTrading=[20260924,20260925,20261005,20261009] blocked=null / report: reported=true, reportRunId=c49670ec-5711-56cd-adb2-da909a3df7ee
  - 기준일 2026-10-14 / run `38660426102`(https://github.com/kwh8121/etf/actions/runs/38660426102) / 감지 2026-10-15T00:47:43Z(클라우드 루틴) / catchup: completed=[20260922,20260923,20260928,20260929,20260930,20261001,20261002,20261006,20261007,20261008,20261012,20261013,20261014] nonTrading=[20260924,20260925,20261005,20261009] blocked=null / report: reported=true, reportRunId=b5aa73c9-e51e-5b10-a577-7b37e15e99cf
  - 기준일 2026-10-15 / run `38829898321`(https://github.com/kwh8121/etf/actions/runs/38829898321) / 감지 2026-10-16T00:47:03Z(클라우드 루틴) / catchup: completed=[20260922,20260923,20260928,20260929,20260930,20261001,20261002,20261006,20261007,20261008,20261012,20261013,20261014,20261015] nonTrading=[20260924,20260925,20261005,20261009] blocked=null / report: reported=true, reportRunId=be5bb10a-dba7-5a1d-a25c-ee00384a239e
  - 기준일 2026-10-16 / run `39181105208`(https://github.com/kwh8121/etf/actions/runs/39181105208) / 감지 2026-10-19T00:47:09Z(클라우드 루틴) / catchup: completed=[20260922,20260923,20260928,20260929,20260930,20261001,20261002,20261006,20261007,20261008,20261012,20261013,20261014,20261015,20261016] nonTrading=[20260924,20260925,20261005,20261009] blocked=null / report: reported=true, reportRunId=b67a8ff5-ed52-5c25-a722-60c1221b0c2f / 2026-10-19 로컬 운영 DB 읽기 전용 `verify:kr-candidate -- 20261016` `ok:true`(93행: 고정 80+거래대금 급증 13, 보고 표식 1건·중복 run 없음, 원천 hash·상장 이력 감사 통과, 보고 표식 시각 2026-10-19T00:35:24Z) / **사용자 확인(2026-10-19): Telegram 실수신·헤더 링크 기준일 일치. 360px 표시는 별도 언급 없어 미확인. 정확성 기준 확정 관측일로 승격(신규 정상 운영 1일)**
- [ ] `WAIT` Q-09 M5-A 순설정·환매 추정 설계·착수
  - 결정(2026-09-22): A안. M6의 완전 거래일 20일 관측 완료 뒤 근거를 모아 설계·착수
  - 해제: Q-08 완료 및 M6 관측 근거·수치 계약 확정
  - 완료 조건: 별도 구현 계획과 임계값 계약을 정본에 반영

## 완료

- [x] `DONE` Q-24 KR·US Telegram 랭크인·랭크아웃 표시 (2026-10-14 사용자 요청)
  - 구현: 현재 Telegram 표시 순위권을 같은 전략의 직전 완료 run과 종목 코드로 비교한다. 새 진입 종목은 현재 줄 끝에 `랭크인`, 이탈 종목은 각 섹션 끝 `랭크아웃` 아래 직전 순위로 표시한다. KR은 기준일이 더 이른 run, US는 관측 시각이 더 이른 run을 사용한다.
  - 경계: 이전 완료 run이 없으면 순위 변동 표시는 생략한다. US에서 현재 0건이지만 이전 표시 종목이 있으면 랭크아웃 전용 섹션을 유지한다. 이전 조회 오류는 오정보 발송을 막기 위해 보고 실패로 처리한다.
  - 검증: `npm test` 42파일·213테스트, `npx tsc --noEmit`, 변경 대상 ESLint, `npm run build`, 독립 코드 리뷰 통과. 전체 `npm run lint`는 작업 전부터 존재한 미추적 `.opencode/` 내부 4개 `any` 오류로만 실패했다.

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
