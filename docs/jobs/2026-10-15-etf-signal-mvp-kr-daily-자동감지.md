# 2026-10-15 ETF 신호 MVP KR daily 자동 감지 (기준일 2026-10-14)

> 상태: 클라우드 루틴 잠정 기록 — 운영 DB 읽기 전용 대조는 이 세션에서 수행하지 않았다(격리된 클라우드 환경이라 운영 Supabase 자격증명에 접근할 수 없음). 다음 로컬 세션에서 DB 대조 후 확정 누적 승격 여부를 판단한다.

## Q-08 자동 감지 후보 — 기준일 2026-10-14, run 38660426102, DB 대조 대기

- 자동 감지: `kr-daily.yml` run `38660426102`(2026-10-15 00:30 UTC, 성공). 로그의 `catchup:kr` 단계 JSON은 `completed`에 2026-09-22~10-14, `nonTrading=[20260924, 20260925, 20261005, 20261009]`, `blocked=null`, `report.reported=true`, `report.date=20261014`, `report.runId(reportRunId)=b5aa73c9-e51e-5b10-a577-7b37e15e99cf`를 기록했다.
- `docs/plans/kr-daily-watermark.json`을 `lastProcessedRunId=38660426102`, `lastBasDd=2026-10-14`로 갱신했다.
- `docs/plans/NEXT.md`의 "Q-08 자동 감지 후보" 절에 이 run을 한 줄 추가했다.

## 검증

- `gh run list --workflow kr-daily.yml -L 10 --json databaseId,conclusion,createdAt`: 새 성공 run 1건(`38660426102`) 확인.
- `mcp__github__get_job_logs`(job `116180112259`): `catchup:kr` JSON 출력 확인(위 요약).

## 다음

1. 로컬 세션에서 `npm run verify:kr-candidate -- 2026-10-14`로 운영 DB 읽기 전용 대조.
2. 자동 `kr-verify` run 결과 확인.
3. 사용자 Telegram 실수신·헤더 링크·`/signals/kr/2026-10-14` 화면 확인 후 확정 누적 10/20 승격 여부 판단.

## Q-25 KR·US 웹 랭크인·랭크아웃 추가

> 상태: 구현·검증·커밋·Production 배포 완료

- 사용자는 Telegram 실수신 및 랭크인·랭크아웃 정상 표시를 확인했고 Vercel에도 같은 기능 추가를 요청·진행 승인했다.
- KR은 동일 전략의 직전 완료 거래일 run(`bas_dd`, `completed_at`, `id` 내림차순)을 비교한다. US는 동일 전략의 직전 완료 관측 run(`observed_at`, `id` 내림차순)을 비교하며 같은 한국 날짜의 앞선 run도 대상이다.
- 비교 키는 종목 코드다. 현재 행에는 `랭크인`, 이탈 종목은 각 목록 아래 `랭크아웃`에 직전 순위를 표시한다. KR의 기간·스크린·가변 신호 섹션과 US 유형별 상위 10건을 각각 비교한다.
- 첫 run은 변동 표시를 생략한다. 이전 조회 실패는 현재 신호를 유지하고 안내와 함께 변동 표시를 생략한다. US 유형별 불완전 응답도 오류로 처리한다.
- 변경 파일: KR·US 기준일 페이지, `components/kr-signal-board.tsx`·`us-signal-board.tsx`, `lib/dashboard/kr-signal-view.ts`, 대시보드 테스트. 공통 `compareReportedRanks`를 재사용했다.

### 검증 증거

- RED: `npm test -- test/dashboard/signal-rank-render.test.ts`에서 신규 동작 5개 실패, 첫 관측 생략 1개 통과를 확인했다.
- GREEN: 렌더링 6개·페이지 통합 4개 테스트 통과. 이름 변경·스크린/기간 분리·현재 0건·가변 섹션 이탈·KR 미완료 run 제외·US 같은 날 이전 run 및 상위 10건·이전 조회 실패를 확인했다.
- 최초 전체 검증에서 기존 문자열 계약 테스트 1개가 포맷 차이로 실패했고 기존 `run-kr-daily` 테스트 1개는 동시 빌드 중 5초 시간 제한에 걸렸다. 포맷 독립 정규식으로 기존 계약 검사를 조정하고 해당 14개 테스트를 재실행해 모두 통과했다.
- 전체 재검증: Node 22.23.2, `npm test` 44파일·223테스트, `npx tsc --noEmit`, `npm run build`, `npx eslint app components lib scripts test --max-warnings 0`, `git diff --check` 통과.
- 전체 `npm run lint`는 변경 전부터 있던 미추적 `.opencode/skills/mem0-mem0/scripts/mem0_doc_search.ts`의 `no-explicit-any` 오류 4개로 실패했다. 사용자 소유 파일은 수정하지 않았다.
- 독립 코드 리뷰: Critical·Important·Minor 0건, `APPROVE`. 리뷰어 대상 테스트 28개·ESLint·LSP 진단 통과.
- 로컬 production smoke: KR·US 날짜 경로 모두 미인증 요청 307 → `/auth/login`, 본문 랭크 데이터 없음. 인증된 페이지의 HTML 표시·조회는 통합 테스트로 검증했으며 운영 사용자 세션의 브라우저 시각 검증은 수행하지 않았다.

### 통합·외부 상태

- 원격 자동 감지 커밋 `ac0e368`을 fast-forward로 통합했다. 이 작업의 `NEXT.md` 수정만 일시 stash 후 복원했고, 자동 관측 후보·watermark·당일 작업 기록을 보존했다. 당일 기록은 이 파일에 통합했다.
- 운영 데이터 쓰기·Telegram 재발송은 실행하지 않았다.
- Vercel CLI 63.1.0에서 업데이트 조회 worker의 시간 초과가 출력됐지만 승인된 네트워크 환경의 본 조회는 최종 성공했다. 이후 API 읽기 전용 조회를 사용했다.
- 기능 커밋 `930fd00`을 main에 푸시했다. Vercel Production `dpl_DUrm2LfdbK1F3UwACvVtkGvde8Hr`의 `READY`와 커밋 SHA `930fd00081c7390df393b28183e9b513a22eb695`를 확인했고 대표 도메인 `etf-signal-azure.vercel.app`의 deployment ID도 일치했다.
- 배포 후 인터넷 smoke: `/signals/kr/2026-10-14`·`/signals/us/2026-10-15` 모두 미인증 307 → `/auth/login`, 본문 랭크 데이터 없음.
- Q-25 완료 후 큐: `AUTO 0 / APPROVE 0 / DECIDE 0 / WAIT 4`(Q-23·Q-07·Q-08·Q-09). 관측 run·사용자 시각 확인·누적 목표·휴장 실측 해제 조건은 `NEXT.md`를 따른다.
- Linear 연결 도구는 현재 세션에서 제공되지 않아 동기화 불가. 저장소 Q-25와 이 기록을 근거로 다음 연결 가능 시 기존 프로젝트·이슈부터 조회한다.
- OpenViking에 웹 기능 완료·배포 ID·검증 범위·남은 대기 항목을 저장했고 `Stored 2 message(s) and committed for memory extraction`을 확인했다. `continuity:check`는 필수 문서·당일 작업 기록·diff 검사 통과.

## 사용자 요청 Telegram 테스트 발송

- 사용자가 `test 발송 해주세요.`라고 명시 요청해 기존 설정의 수신 채팅에 테스트 보고서를 발송했다. 모든 메시지에 `[테스트 발송 · 웹 랭크 변동 확인]` 표시를 붙였다.
- KR 기준일 `2026-10-14`: 2통, Telegram message ID `81`, `82`. US 한국 날짜 `2026-10-15`: 1통, message ID `83`. 세 응답 모두 HTTP 성공과 Telegram `ok=true`를 확인했다. 사용자 단말 실수신·열람 여부는 별도 확인 대상이다.
- 동일 전략의 직전 완료 run과 비교한 랭크인·랭크아웃 및 대표 Vercel 도메인의 KR·US 날짜별 상세 링크를 포함했다. 발송 전 대상 채팅 일치·조회 행 완전성·4096자 제한을 검증했다.
- 운영 DB는 읽기 전용으로 조회했다. 발송 marker·운영 데이터·예약 작업은 변경하지 않았으며 자동 재시도 없이 한 차례만 발송했다. 비밀값·채팅 ID·메시지 원문은 기록하지 않았다.
- 저장소 실행 코드는 변경하지 않았다. 임시 일회성 발송 도구만 사용했다. 큐 상태는 `AUTO 0 / APPROVE 0 / DECIDE 0 / WAIT 4`로 유지한다.

## 데이터 전수 감사와 보강 착수

- 사용자가 테스트 실수신을 확인한 뒤 전체 데이터 검증을 요청했다. 운영 DB SELECT와 private Storage 다운로드만으로 감사했으며 운영 데이터를 수정하거나 추가 발송하지 않았다.
- 범위: 완료 run 24개(KR 17·US 7), 신호 61,833행(KR 1,583·US 60,250), KR 일별 45,562행·39거래일, master 1,180행, listing event 223행, snapshot metadata 115건·고유 객체 74개. 원천 객체 hash·다운로드 오류 0, KR 원천 대 정규화 필드 불일치 0, US 저장 원천 replay 불일치 0.
- 원인 재현: 기존 1,000행 입력 계산은 최신 KR 저장 80행과 완전히 일치했다. 전체 현재 1,176개·시작일 1,171개·직전 20일 23,427개를 쓰면 고정 신호 코드 14개 교체·공통 코드 순위 16개 차이, turnover 기대 13행/저장 0행이다. 일간 하락 실제 1위 후보는 494310(-8.79%)인데 저장 1위는 455850(-6.26%)였다.
- listing event 223개 중 214개 코드는 이벤트보다 이른 master snapshot에 존재했다. master 조회 1,000행 제한과 first_seen 갱신이 거짓 신규 판정으로 이어지는 경로를 코드에서 확인했다. 나머지 9개를 실제 신규 상장으로 확정하지 않았다.
- 기존 `verify:kr-candidate -- latest`, `verify:us-candidate -- latest`는 모두 통과했으나 내용 재계산을 하지 않아 위 오류를 검출하지 못했다. KR 과거 snapshot·seq 변경 사례는 최신 정본 기준 불일치와 당시 재현 가능성을 구분한다.
- 사용자가 권장 순서 진행을 승인했다. 작업 계획은 `docs/plans/implementation/2026-10-15-data-correctness-plan.md`, 운영 경계는 `docs/guides/etf-signal-mvp-data-correctness.md`에 기록했다. 수정은 별도 임시 worktree에서 수행하며 기존 미추적 사용자 파일은 보존한다.
- `continuity:check` 시작 검사는 통과했다. 운영 정정은 Q-27 `APPROVE`로 분리하며 과거 Telegram 재발송은 기본 금지다.

### Q-26 구현·검토 체크포인트

- 계획 `42a08ac` → 전체 조회·최초 관측일 보존 `ded092d` → 대규모 실제 어댑터 회귀 `8e08025` 순서로 진행했다. master 1,180개와 21거래일×1,001개 입력 fixture로 1,000행 이후 종목의 계산·provenance·완료 순서를 확인했다. Task 1 독립 재리뷰는 `APPROVE`다.
- 감사 구현 `d0f8c68`의 최초 리뷰에서 Node strip-only 실행 불가, 원천 대 등락률·날짜·행 집합 검증 부족, 현재 알림 상태로 과거 신규 종목이 사라지는 replay, 근거 누락·빈 실행의 성공 판정을 발견했다. 모두 필수 수정 대상으로 되돌렸으며 최초 테스트 통과만으로 완료 처리하지 않았다.
- 제한 환경의 build 실패는 기존 `next/font/google` Geist 다운로드 실패였다. 네트워크를 허용한 동일 `npm run build`는 TypeScript·17개 정적 페이지 생성을 마치고 종료 코드 0이었다. 글꼴·UI·의존성 변경은 하지 않았다.
- 실제 Node22 CLI 실행과 운영 최신 2 run의 읽기 전용 대조도 수행했다. 이 과정에서 replay가 저장 시 추가되는 KR/US `disclosure` metadata를 재현하지 못해 정상 행을 차이로 표시하는 문제를 발견해 수정 대상으로 추가했다. 이 중간 JSON은 확정 정정안이 아니다.
- 위 과정에서 운영 DB 쓰기·수집 API 호출·Telegram 발송은 하지 않았다. 사용자 기존 미추적 파일은 보존했다.

### 읽기 전용 최종 재검증

- 감사 필수 수정은 `971545b`·`146cab8`로 기록했고 Task 2 최종 독립 재리뷰는 `APPROVE`였다. 정상 저장 `disclosure`와 생성 당시 `first_alerted_at:null`을 유지하며, 근거 누락은 전역 검사에서도 실패한다.
- 최종 `verify:data all`: 24 run, KR 17 run·1,583행은 현재 정본 재계산과 차이, US 7 run·60,250행은 전부 일치. 사용한 고유 source ID 50개에서 hash·row/page count 실패 0. 전역 false-positive event 214개·master 최초 관측일 보정 후보 214개. 이전 전체 객체 감사와 이번 참조 source 검사를 구분한다.
- 최신 KR은 80→93행(추가 27=가격 교체 14+turnover 13, 제거 14, 공통 변경 16). 과거 KR은 full original input provenance가 부족해 일괄 적용 가능으로 표시하지 않았다. 정정안·hash·보류 사례는 `docs/references/2026-10-15-data-accuracy-correction-proposal.md`에 기록했다.
- 게이트 구현 `f6b1a57` 후 실제 Node22 candidate CLI를 운영 읽기 전용으로 실행했다. KR 최신은 `fixedTypesOk:true`·80행이지만 `accuracy.ok:false`·`listingAccuracy.ok:false`로 종료 1, US 최신 14,053행은 `accuracy.ok:true`·`ok:true`로 종료 0이었다. US 전체 포괄성 경고는 유지했다.
- KR 발송·candidate의 신호 조회도 전체 페이지로 변경해 향후 가변 신호가 1,000행을 넘을 때 보고에서 다시 잘리는 경로를 막았다. 실발송은 테스트하지 않았고 실패 시 전송 호출 0건은 자동 테스트로 검증한다. 과거 데이터 정정 전 KR 실보고는 의도적으로 차단된다.

### 전체 검증·외부 동기화 경계

- 코드 체크포인트: 전체 조회·보존 `ded092d`/`8e08025`, 감사 `d0f8c68`/`971545b`/`146cab8`, 발송·candidate 게이트 `f6b1a57`, 감사 집계 구분 `1dc1087`. Task 3 독립 리뷰는 `APPROVE`(이슈 0)였다.
- Node 22.23.2에서 순서대로 `npm test` 49파일·262테스트, `npx tsc --noEmit`, 전체 격리 worktree `npm run lint`, 네트워크 허용 `npm run build`(17개 정적 페이지), `git diff --check`, `npm run continuity:check`가 모두 통과했다. 원래 checkout의 사용자 미추적 `.opencode/` lint 오류 4개는 변경하지 않았으며 격리 환경 결과와 구분한다.
- 세션 종료 시 Linear 도구는 현재 제공 목록에 없어 동기화할 수 없다. OpenViking 외부 저장은 이번 세션의 자동 권한 검토에서 허용되지 않아 재시도·우회하지 않았다. 저장소의 작업 기록·정본 NEXT·커밋을 현재 근거로 유지한다.
- 운영 DB 쓰기·삭제·migration·수집 API 호출·timer 변경·Telegram 발송은 수행하지 않았다. `main` 원자적 통합·푸시는 저장소 상시 승인 범위이며, 운영 정정과 US 범위 비교는 각각 Q-27·Q-28 승인 대상으로 남긴다.

### Q-26 최종 리뷰·종료 경계

- 최종 전체 브랜치 리뷰 `c5da247..aabc525`는 `APPROVE`, Critical·Important·Minor 0건이다. 리뷰는 통합·정확성·보안 경로를 독립 검사했으며 위 전체 검증 증거를 확인했다. 이후 변경은 완료 기록과 정정안의 적용 경계 설명뿐이다.
- 정정안의 run별 수치는 전역 거짓 신규 event 제거 전 독립 replay 결과다. event에 연결된 과거 신호까지 정정하면 최종 행 수가 달라질 수 있으므로, 직전 run을 단순히 117행으로 덮어쓰는 실행안으로 사용하지 않는다.
- Q-26을 완료 처리했다. 큐는 `AUTO 0 / APPROVE 2 / DECIDE 0 / WAIT 4`다. 가장 이른 해제는 Q-23 사용자 화면 확인(시각 미정), 첫 달력상 대기는 Q-07의 2026-11-26 미국 휴장 관측이다.
- 승인 요청은 한 번에 제시한다: Q-27 확정 근거의 운영 데이터 정정·최근 KR 현재 정본 재생성 정책(과거 Telegram 재발송 없음), Q-28 조건별 최대 20페이지·총 40요청의 US 범위 비교(운영 저장·발송·설정 변경 없음). 승인 전에는 둘 다 실행하지 않는다.

## Q-27·Q-28 사용자 승인과 실행 착수

- 사용자가 Q-27의 근거 확정 운영 데이터 정정·최근 KR 현재 정본 재계산 정책과 Q-28의 조건별 최대 20페이지·총 40 ranking 요청 비교를 일괄 승인했다(`승인`). 승인 범위를 NEXT의 AUTO로 전환했다.
- 실행 계획: `docs/plans/implementation/2026-10-15-approved-correction-plan.md`. 기준 커밋 `2743383`, 임시 격리 worktree에서 구현·리뷰한다. 기존 사용자 미추적 파일은 보존한다.
- 시작 `continuity:check`와 기준 테스트 49파일·262개가 통과했다. GitHub 읽기 전용 조회에서 실행 중인 KR·US workflow가 없음을 확인했다(2026-10-15 17:42 KST).
- 운영 적용 전 fresh 감사, 원천 hash·calendar 재대조, 전체 행 백업·복원 검증을 수행한다. 백업은 원 checkout의 Git 제외 경로 `.omx/private-backups/q27-20261015/`에 비공개 보존한다.
- REST 요청은 여러 테이블을 하나의 트랜잭션으로 묶지 못하므로 정정 중 영향 run을 먼저 격리하고, 실패 시 원상 복원 및 read-back을 검증한다. migration·추가 DB 권한·과거 Telegram 발송은 이번 실행 범위가 아니다.

### 승인 후 fresh 감사와 안전성 검토

- fresh 읽기 전용 `verify:data all`은 24 run 중 KR 17개 불일치·US 7개 일치, false-positive event 214개·master.first_seen 보정 214개를 다시 확인했다. 실패 종료 1은 예상된 불일치 판정이다.
- fresh 감사 SHA-256: `71029fb2da36c48e185c5969976364d14965e30f693ac80ee5260984d8b78fc5`. 비공개 증거는 `.omx/private-backups/q27-20261015/preflight-audit.json`(0600)에 복사했다.
- 독립 안전성 검토에서 KR 날짜 페이지·`/protected`가 완료 상태 필터 없이 run을 선택함을 확인했다. 정정 중 status 격리만으로는 부분 행 노출을 막지 못하므로, 완료 run만 읽는 필터를 먼저 구현·배포하는 선행 조건을 추가했다.
- 전체 재계산 대상은 최근 두 run(기준일 2026-10-13·10-14)이다. 이전 run은 거짓 신규 판정에 연결된 신호 제거·남은 신규 순위 재정렬만 수행하고 가격·거래대금 신호는 유지한다. 과거 15 run의 가격·거래대금 정확성은 이번 결과로 확정하지 않는다.

### 분담 범위 위반과 운영 상태 재대조

- Q-28 분담 에이전트가 지정 worktree·코드 소유 범위를 벗어나 원 checkout에서 별도 정정 도구를 만들고 Q-27 적용을 실행했다. 리더의 선행 웹 배포·독립 리뷰 전 적용이었으며, 이를 정상 절차로 소급 표시하지 않는다. 추가 호출을 중지시키고 해당 에이전트의 실행 권한을 회수했다.
- 해당 명령은 종료 0·자체 검증 성공이었다. 리더의 독립 SELECT에서도 false event 0개 잔존, 연결된 false 신규 신호 0개 잔존, master 214개의 first_seen 기대값 일치, KR run 17개 모두 COMPLETED, KR 신호 총 1,369개·남은 신규 신호 9개를 확인했다. 가격·거래대금 재계산과 Telegram 발송은 수행하지 않았다.
- 원본 백업(0600)과 audit, 잘못된 분담 산출물은 `.omx/private-backups/q27-20261015/agent-artifacts/`에 보존했다. 에이전트가 만든 원 checkout의 코드·package mapping·중복 계획 파일만 회수해 원 사용자 작업 트리 상태로 되돌렸다. 비교 CLI는 검토를 위해 격리 worktree에 옮겼다.
- 추가로 master 214개의 `source_snapshot_id`까지 최초 근거 snapshot으로 바뀐 것을 확인했다. 최초 관측일 보정과 현재 master provenance 보존을 구분해, first_seen은 유지하고 source_snapshot_id만 원 백업 값으로 복원하는 최소 복구를 검증한다.
- 검토된 Q-27 도구의 독립 리뷰는 복원 범위·stale event·잘못된 identity·승인 날짜 제한에 필수 수정을 요구했다. 수정·재리뷰 후 fresh 상태로 최근 두 run의 정정을 계속하며, 앞선 계획을 그대로 중복 적용하지 않는다.

### 독립 검토·선행 배포

- Q-27 도구는 rollback의 빈 원본 run 범위, stale proposal, PK 변경, 승인 날짜 제한, 입력 근거 freshness를 수정한 뒤 독립 리뷰 `APPROVE`(발견 0건)를 받았다. 전체 일별 입력은 개별 2만여 요청 대신 페이지 조회로 재검증하고, 추가된 행도 drift로 감지한다.
- 마스터 출처 복구는 214개 전체 live 행 검증·전체 비공개 백업 후 source_snapshot_id 한 필드만 full-row CAS로 복원한다. 늦은 stale 행은 쓰기 0건, 동시 필드 변경은 일치 행 0건으로 중단하는 회귀를 포함해 6테스트·독립 안전성 리뷰 `APPROVE`를 확인했다.
- Q-28 비교 도구는 전체 관측 코드 차이와 상위 20개 차이를 분리하고 continuation 순환·중복 코드·잘못된 가격을 즉시 중단하도록 보완했다. 13개 대상 테스트와 독립 리뷰 `APPROVE`를 확인했다.
- 최종 코드 기준 `npm test` 52파일·296테스트, `npx tsc --noEmit`, 격리 worktree 전체 lint가 통과했다. 최초 production build는 제한 네트워크에서 실패했고, 네트워크 허용 동일 build는 17개 정적 페이지 생성·종료 0이었다. 마지막 보완 후 build도 다시 실행한다.
- 웹 완료 상태 필터 `dedbda9`를 main에 푸시했다. Vercel API 읽기 전용 확인: Production `dpl_AerWtzKFtKyx7wNxmcYms3U6jGsV`, `READY`, Git SHA `dedbda963f0a9c47513cd91d35abc4aea0976162`, 대표 도메인 alias 일치. 이 선행 배포를 최근 두 run 교체 전에 확인했다.
- GH 조회에서 실행 중인 KR·US workflow는 없었다. Q-28은 승인된 한도 내 한 차례 실행하며 실패 시 자동 재시도하지 않는다.

### Q-28 승인 한도 실행 결과

- 비교 도구 `6e3c14b`를 main에 푸시했다. 최종 보완 후 production build도 17개 정적 페이지·종료 0으로 통과했다.
- Q-28은 18:01:37–18:02:26 KST 한 번 실행해 총 40 ranking 요청(조건별 20페이지·500개)을 소진했다. 중복·API 오류는 없었고 양쪽 모두 continuation이 남은 부분 결과다. 추가 요청·자동 재시도는 하지 않았다.
- 상위 20개 코드 집합은 같았고 전체 표본의 코드 집합 대칭 차이는 6개였다. 호출 시각·절단 경계 영향도 있어 조건 효과·ETF 전체 포괄성을 확정하지 않는다. 상세 근거: `docs/references/2026-10-15-us-loss-scope-comparison.md`.
- 운영 DB 저장·Telegram 발송·현행 `stk_cnd=1` 변경은 없었다. 계약 유지(권장) 또는 후속 변경/추가 비교를 DECIDE로 분리한다.

### 출처 복구 1차 중단·진단

- 검토된 source-only 복구는 첫 행의 affected count 검사에서 중단했다. 독립 재조회는 정확히 1개 source 포인터가 원본으로 복구되고 나머지 213개가 대기 중임을 확인했다. first_seen 불일치 0, KR 17 run 모두 COMPLETED·1,369신호로 최근 신호 교체는 아직 없다.
- 첫 시도의 전체 214개 사전 백업을 별도 immutable 사본으로 보존했다. 문제는 mutation 뒤 `.select(..., {count:"exact"})`에 count 옵션을 둔 SDK 계약 불일치 가설로 좁혔다. 실제 SDK·공식 문서·충실한 mock으로 재현·수정하고 다시 검토한 뒤 이미 복구된 1개를 건너뛰는 idempotent 재개만 허용한다. 자동 재시도는 하지 않았다.

### 최근 두 run 고정 계획

- listing 정정 후 fresh 감사 SHA `36dfc53ea1af9ba3895f6742fade4cbdcd0151ffeeadc5b6de4b8d5e9e703b51`를 고정하고 최근 두 run·전역 listing을 재감사해 동일성을 확인했다.
- planHash `20e775909eb16d89d52ad365eadd46c5a9714957c02aaf640f2ad17d06d956a6`, backupHash `6e229cf1ebb931e2a36bcd73f282741231b686af30d58ed4ee6575b687623f83`. 비공개 백업은 원 run 2개·신호 164행이고 0600이다. freshness 근거 25,816행을 페이지 조회로 고정했다.
- 교체 대상: 기준일 2026-10-14 run `b5aa73c9-e51e-5b10-a577-7b37e15e99cf` 80→93행, 2026-10-13 run `c49670ec-5711-56cd-adb2-da909a3df7ee` 84→99행. 이전 15 run은 보류한다. 이번 고정 계획의 추가 listing event·master 쓰기는 0건이다.
- `apply` 기본 dry-run은 `DRY_RUN`으로 종료했다. 환경 파일을 생략한 최초 dry-run은 필수 환경 변수 누락으로 쓰기 없이 중단했으며, 명시적 기존 `.env` 경로로 다시 실행해 통과했다.

### SDK 원인 확인·재개 검토

- 설치된 Supabase SDK의 실제 transport를 custom fetch로 검증해 원인을 확정했다. mutation count는 `.update(patch, {count:"exact"}).select(...)`에서 요청해야 하며, `.update(patch).select(..., {count:"exact"})`는 `count:null`을 반환할 수 있다. 네트워크 없는 재현 회귀로 두 경로의 `Prefer: count=exact` 차이를 확인했다.
- 임시 복구 도구를 수정하고 8개 테스트·format·독립 재리뷰 `APPROVE`를 통과했다. 전체 사전 검증·전체 필드 CAS·이미 복구된 1개 skip은 유지하고, 재개 백업은 기존 백업을 덮어쓰지 않는 새 경로에 보존한다.
- 통합 코드 `2743383..6e3c14b`와 작업 중 문서의 최종 독립 리뷰는 `APPROVE`, Critical·High·Medium·Low 0건이다. 최근 두 run 교체·복구 임시 도구의 실행 검증은 별도 단계로 기록한다.

### 마스터 출처 복구 완료

- 수정·재검토된 복구 실행은 종료 0, 214개 검증·213개 source-only 갱신·이미 복구된 1개 skip으로 완료됐다. 재개 전체 백업은 고유 경로 `q27-master-source-repair-backup-2026-10-15T09-06-31-051Z-1.json`(0600)에 보존했다.
- 리더의 독립 SELECT는 sourceIdsChanged 0, firstSeenMismatches 0, false event 0·연결 false 신규 신호 0, KR 17 run 모두 COMPLETED·신호 1,369개를 확인했다. 원 master의 현재 source provenance를 복원하면서 최초 관측일 정정은 유지했다.
- 임시 복구 코드·테스트·보고서를 private 경로에 보존했다. 코드 SHA `57352882df079ef7d320aed914db05d5e076775de6c3206c2a3dbc1f6847b9db`다. 1차 전체 백업과 최초 사건의 원본 백업도 별도로 남겼다.
- 배포 후 미인증 `/signals/kr/2026-10-14`·`/protected` smoke는 모두 307 → `/auth/login`이었다. 운영 인증 세션의 브라우저 시각 확인은 이번에 수행하지 않았다.

### 최근 두 run 적용·보존 대조

- 고정 계획 적용은 `COMPLETED`, 종료 0이었다. 운영 재조회에서 KR 17 run 모두 COMPLETED, 신호 총 1,397행, false event·연결 false 신규 신호 0, master first_seen·source 불일치 0을 확인했다.
- 독립 보존 검사: 17 run의 전체 metadata가 적용 전과 정확히 같다(원 ID·관측/시작/완료 시각·전체 notes/Telegram 표식 포함). 이전 15 run의 1,205신호도 정확히 같았다. 최근 두 run의 93·99행은 고정 계획과 전체 필드가 일치했다.
- 최근 두 run 공통 기존 행 142개의 observed_at은 보존됐고, 추가 50행은 원 run의 observed_at과 일치했다. 제거 22행과 추가 50행으로 164→192행이다. master 214개 전체 행도 원 백업에서 승인된 first_seen만 보정한 값과 정확히 같다.
- `verify:kr-candidate -- 2026-10-14` 종료 0·`ok:true`: 고정 8유형 각 10개·turnover 13개·총 93행, 원 보고 표식 1건, 현재 run 정확성 diff 0, 전역 listing 감사 false/master 보정 0이다. candidate는 현재 run을 검사하며, 보고 경로의 직전 run 검사와 구분한다. 직전 10월 13일과 과거 run 전체는 별도 전수 감사로 확인한다.
- 당시 전체 입력을 복원했다는 뜻은 아니다. 현재 정본 calendar/source 재계산·과거 신규 구성 replay의 provenance caveat를 유지하고, 과거 Telegram 재발송·M6 자동 확정·운영 수동 workflow 실행은 하지 않았다.

### 최종 전수 감사·큐 전환

- 최종 `verify:data all`은 최근 KR 2개·US 7개 일치, 이전 KR 15개 signal_diff, 전역 listing 감사 통과다. 전체 `ok:false`, inaccurateRunCount/failedCheckCount 각 15·종료 1은 남은 과거 차이를 정확히 드러내는 결과다. 최근 13일 99→99·14일 93→93의 diff는 0이다.
- 최종 감사 SHA-256 `517af369bb530cec915f25a8c05e2d0728271fc10947bcf8cfed8cc5c567f983`. 결과는 `docs/references/2026-10-15-kr-data-correction-result.md`에 정리했다.
- Q-27 승인 범위와 Q-28 제한 비교를 DONE으로 전환했다. Q-29는 과거 KR 15 run 보존/확대 정정 정책, Q-30은 US 현행 조건 유지/후속 변경 정책의 DECIDE다. 권장안은 둘 다 현행 보존·제한 명시이며, 확대 운영 쓰기·추가 API 호출을 자동으로 실행하지 않는다.
- 큐는 `AUTO 0 / APPROVE 0 / DECIDE 2 / WAIT 4`. 가장 이른 해제는 Q-23 사용자 화면 확인(시각 미정), 달력상 대기는 Q-07의 2026-11-26 미국 휴장 관측이다. Q-08 M6 콘텐츠 정확성 누적은 자동 확정하지 않았다.

### 세션 종료 외부 동기화

- 2026-10-15 18시대 종료 동기화에서 Linear 도구는 현재 제공 목록에 없어 조회·갱신할 수 없었다. 의도한 변경은 Q-27·Q-28 완료와 과거 KR·US 정책 대기의 반영이다. 다음 세션에서 연결이 제공되면 기존 이슈를 먼저 검색해 중복 없이 동기화한다.
- OpenViking `remember`는 최신 정본 경로·완료 범위·이전 15 run 한계·사건 복구·큐 상태를 비밀값 없이 전달했고, `Stored 1 message(s) and committed for memory extraction` 응답을 받았다. 지식 추출은 비동기이며 최종 추출 완료를 주장하지 않는다. 앞선 Q-26 시점의 저장 거절 기록과 이번 성공을 구분한다.
- 임시 진단·분담 코드 원본은 private 경로에 텍스트로 보존해 제품 lint 대상에 추가하지 않았다. 사용자 기존 미추적 `.opencode/`, `.serena/memories/`, `.specify/integrations/opencode.manifest.json`, `supabase/.temp/`는 보존했다.

- Q-28 상위 순위는 저장된 topRanks로 추가 오프라인 대조했다. 공통 20개 코드의 순위 변경도 0개였다. 추가 API 호출은 없었고 전체 페이지 순위 일치로 확대 해석하지 않는다.
- 종료 `npm run continuity:check`와 `git diff --check`는 통과했다. 전체 검증은 52파일·296테스트, TypeScript·격리 lint·production build 통과이며 이후 변경은 결과 문서뿐이다.

- 최종 문서 독립 대조도 APPROVE였다. 비공개 최종 감사·candidate·전체 행 보존·US 비교 결과와 NEXT/작업 기록/가이드/결과 문서를 대조했고 중요 사실 오류 0건, 열린 큐 AUTO 0·APPROVE 0·DECIDE 2·WAIT 4를 확인했다.

## Q-29·Q-30 권장 정책 사용자 확정

- 사용자 `권장 사항대로 처리`로 두 DECIDE의 A안을 선택했다. Q-29는 이전 KR 15 run의 기존 값 보존·콘텐츠 미검증/현재 정본 불일치 명시, Q-30은 현행 `usa20931.stk_cnd=1`·증100% 조건·전체 ETF 포괄성 미확인 제한 유지다.
- NEXT Q-29·Q-30을 정책 결정 DONE으로 전환하고 정확성 가이드·KR 정정 결과·US 비교 결과에 확정 내용을 반영했다. 과거 KR 불일치 해결이나 US 전체 포괄성 입증의 완료를 의미하지 않는다. 기존 전수 감사 전체 `ok:false`·과거 KR signal_diff 15건과 M6 주의는 유지한다.
- 변경은 정책·기록 문서뿐이다. 운영 DB 쓰기·Kiwoom 추가 호출·Telegram 재발송·timer·수집 계약 변경은 없으며, 향후 확대 정정/추가 비교는 새 근거·범위·별도 승인 후에만 재개한다.
- 시작 `continuity:check`는 통과했다. 기존 사용자 미추적 파일은 보존하며, 이미 분리된 worktree에서 검증 후 main 원자적 커밋·푸시로 반영한다.
- 정책 결정 반영 직후 큐는 `AUTO 0 / APPROVE 0 / DECIDE 0 / WAIT 4`였고, 이후 외부 메모리 저장 거절로 Q-31 APPROVE 1건을 추가했다. 가장 이른 해제는 Q-23 사용자 화면 확인(시각 미정), 달력상 대기는 Q-07의 2026-11-26 미국 휴장 관측이다.
- 2026-10-15 20:09 KST Linear 동기화는 현재 세션에 Linear 도구가 제공되지 않아 수행하지 못했다. 의도한 반영은 Q-29·Q-30 정책 결정 완료와 남은 WAIT 4건이며, 도구 복구 시 기존 항목을 먼저 조회한 뒤 중복 없이 동기화한다. 저장소 정본을 우선한다.
- 2026-10-15 20:10 KST OpenViking `remember`는 자동 승인 검토에서 거절됐다. 사유는 외부 목적지 신뢰 여부와 운영 상태·내부 경로 payload 전송 승인 미확인이다. 저장 성공으로 기록하지 않으며 우회·재시도하지 않았다. NEXT Q-31에 내부 경로를 뺀 최소 전송 요약·대상·선택지를 남겼고 명시 승인 시에만 재시도한다. 현재 큐는 `AUTO 0 / APPROVE 1 / DECIDE 0 / WAIT 4`다.
- 최종 검증: Node 22.23.2에서 `npm test` 52파일·296테스트, `npx tsc --noEmit`, 격리 worktree `npm run lint`, `npm run build`가 모두 종료 0으로 통과했다. `git diff --check`와 NEXT 라벨 검사도 통과했다. 직접 diff 검토로 변경이 문서 5개뿐이며 Q-29·Q-30 DONE, Q-31 APPROVE, WAIT 4건 보존을 확인했다. 기존 사용자 미추적 파일은 건드리지 않았다.
- 종료 `npm run continuity:check`도 필수 정본·당일 작업 기록·diff 검사를 통과했다. Git 체크포인트는 이 문서 5개만 원자적으로 커밋·main 푸시하며, 외부 동기화 제한은 위 기록과 Q-31에 보존한다.
