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

> 상태: 구현·검증 완료, 커밋·배포 확인 진행 중

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
- Vercel CLI 63.1.0에서 업데이트 조회 worker의 시간 초과가 출력됐지만 승인된 네트워크 환경의 본 조회는 최종 성공했다. API 읽기 전용 조회도 성공해 기존 Production `ac0e368`의 `READY`를 확인했다. 이번 변경의 배포 증거는 완료 후 덧붙인다.
- Linear 연결 도구는 현재 세션에서 제공되지 않아 동기화 불가. 저장소 Q-25와 이 기록을 근거로 다음 연결 가능 시 기존 프로젝트·이슈부터 조회한다.
