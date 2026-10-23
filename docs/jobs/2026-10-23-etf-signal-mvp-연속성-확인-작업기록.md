# 2026-10-23 ETF 신호 MVP 연속성 확인 작업기록

> 작업일: 2026-10-23
> 상태: 진행 중

## 결과

- `docs/plans/NEXT.md` 기준 남은 큐는 `WAIT` 5건이며 `AUTO`는 없다. 2026-10-23 확인 결과 M6 정확성 기준 누적은 6/20이다.
- 기준일 2026-10-22 KR daily run `39878559645`와 자동 `kr-verify` run `39879327636`이 모두 성공했다. 실행 로그는 마지막 보충 `completed=20261022`, `nonTrading=20260924,20260925,20261005,20261009`, `blocked=null`, `reported=true`, Kiwoom `COMPLETE`를 기록했다.
- 운영 DB 읽기 전용 `verify:kr-candidate -- 20261022` 결과 `ok:true`: `COMPLETED`, `krFullSignalComplete=true`, KRX `TRADING_COMPLETE`, 고정 8유형 각 10행, `turnover_surge:raw` 4행, 총 84행, 보고 표식 1건·중복 run 없음. 원천 재계산은 84행 전후 일치(추가·삭제·변경 0), listing accuracy `ok:true`·`approvalReady:true`였다. 과거 신규상장 원천 상태 복원 제한 경고 1건과 provenance caveat 1건, listing caveat 3건은 기록에 보존한다.
- 사용자가 2026-10-23 Telegram 정상 수신을 확인해 기준일 10-22를 정확성 기준 관측일로 승격했다. Linear KOR-58·프로젝트·M6 설명과 health update를 6/20 근거로 동기화했다. issue와 project는 `In Progress`, 프로젝트 health는 `onTrack`이다.
- GitHub CLI와 운영 DB 조회는 기본 네트워크 제한에서 실패했으나, 승인된 읽기 전용 권한 확장으로 확인을 마쳤다. 데이터 쓰기·Telegram 발송·timer 변경은 하지 않았다.
- 운영 데이터 쓰기, Telegram 발송, timer 변경은 하지 않았다.
- 사용자 요청으로 `docs/plans/2026-10-23-etf-market-outperformance-recommendation-draft.md`에 시장 초과수익 목표 ETF 추천 기능 개발 계획 초안 v0.1을 작성했다. 기존 MVP v2.2의 총수익률·백테스트·추천 제외 범위와 분리했고, Q-35 `DECIDE` 항목으로 범위 결정을 연결했다. 구현·운영 전환은 수행하지 않았다.

## 검증

- Node 22.23.2로 `scripts/verify-kr-daily-candidate.ts 20261022`: exit 0, `ok:true`.
- `gh run view 39878559645` 및 `gh run view 39879327636`: 두 workflow success; KR daily 로그에서 `blocked=null`, `reported=true`, `kiwoomStatus=COMPLETE` 확인.
- `npm run continuity:check`: 정본·최신 작업 기록·`git diff --check` 통과.
- 계획 초안 문서 검토: 기존 참조 파일 존재 확인, `git diff --check` 통과, SEC Investor.gov 분배금 안내 페이지의 2026-08-19판 확인.

## 다음 작업

1. 다음 KR 거래일에도 daily run·자동 검증·운영 DB 읽기 전용 결과와 Telegram 수신을 확인해 Q-08을 갱신한다.
2. M6 정확성 기준 누적은 6/20이다. 14거래일 추가 관측이 필요하며 Q-09는 20/20 뒤에 진행한다.
3. Q-35는 `DECIDE` 상태다. 초안 14절 D1~D4의 대상 시장, 목표기간·갱신 주기, 데이터·성과 검증 계약, 위험·비용·운영 경계를 사용자 결정 후 다음 단계로 넘긴다.

## 추가 작업 — 시장 초과수익 목표 ETF 추천 계획 초안

### 요청과 결과

- 사용자가 관련 계획을 세워 `docs/plans/` 아래 초안을 작성하도록 요청했다.
- `docs/plans/2026-10-23-etf-market-outperformance-recommendation-draft.md`를 작성했다. 기존 v2.2의 추천·백테스트 제외 범위와 새 확장의 관계, 데이터·시점·총수익·당시 종목군, 후보 선정 가설, 가상 체결·포트폴리오, 검증 게이트와 개발 단계를 포함한다.
- 제안 범위는 국내 주식형 일반 ETF부터, 6~12개월 목표·주간 최대 3후보·월간 가상 리밸런싱이다. 수치·산식·비용·성과 게이트는 검토할 제안값이며 확정 투자조건이나 검증된 초과수익을 뜻하지 않는다.
- `NEXT.md` Q-35에 범위·검증 계약을 `DECIDE`로 연결했다. 기존 Q-08·Q-09 해제 조건과 이 작업 전의 미커밋 관측 기록은 보존했다.
- 앱 코드·운영 DB·migration·발송·timer는 변경하지 않았다. 이번 범위는 검토용 로컬 문서 작성이다.

### 문서 검증

- 로컬 참조 링크 7개 존재, 코드 블록 닫힘, 자리표시자·행 끝 공백 없음 확인.
- Q-35 추가 부분을 제외한 `NEXT.md` 내용이 작업 시작 시 복사본과 일치함을 확인했다. 이후 Q-36 외부 동기화 승인 항목도 분리해 추가했다.
- 문서 전용 변경이므로 애플리케이션 테스트·타입 검사·lint·build는 새로 실행하지 않았다. 초안 12절의 명령은 향후 구현 검증 계획이며 이번 작업의 통과 증거가 아니다.

### 외부 추적과 승인 차단

- Linear 기존 프로젝트·M6 이슈는 읽기 전용 조회로 로컬 관측 상태와 대조했다. 초과수익·추천 관련 기존 이슈 검색은 0건이었다.
- 초안 검토용 Linear 신규 Backlog 이슈 생성은 자동 승인 검토에서 거절됐다. 이유는 사용자 요청이 로컬 초안 작성이며 해당 계획 요약의 외부 SaaS 전송을 명시적으로 승인하지 않았다는 것이다. 이슈 생성 성공으로 기록하지 않으며 다른 도구로 우회하지 않는다.
- `NEXT.md` Q-36을 `APPROVE`로 기록했다. 권장안은 초안 검토 뒤 등록 승인이고, 대안은 즉시 최소 요약 등록 승인 또는 로컬 추적 유지다.
- OpenViking Experience 검색은 홈 URI 별칭 오류 뒤 세션에 확인된 사용자 URI로 한 차례 재시도해 완료했다. 새 초안의 수동 외부 저장은 수행하지 않았고 자동 메모리 추출 완료도 주장하지 않는다.

### 다음 행동

1. 초안 14절 D1~D4의 범위·주기·성과 기준·위험·비용을 검토한다(Q-35).
2. 외부 등록 승인 시 중복 검색 뒤 Linear 이슈를 생성하고 read-back한다(Q-36). 승인 전에는 로컬 문서를 정본으로 유지한다.
3. 기존 M6의 실제 다음 거래일 관측을 계속한다. 초안 작성으로 M6 완료나 Q-09 착수를 선언하지 않는다.
