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
