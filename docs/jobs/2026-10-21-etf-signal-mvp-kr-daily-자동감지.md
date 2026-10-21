# 2026-10-21 KR daily 자동 감지 (클라우드 루틴)

- 자동 감지 확인 — 기준일 2026-10-20, run 39521755861. DB 대조 `ok:true`, Kiwoom `COMPLETE`, Telegram 실수신 확인으로 정확성 기준 관측일에 산입했다. 2026-10-19도 DB 대조 `ok:true`와 Telegram 실수신 확인을 마쳐 확정했다. 사용자는 2026-10-21에도 최신 보고(기준일 10-20)를 정상 수신했고 매일 수신 중이라고 확인했다. 기준일 10-20은 이미 누적에 포함되어 중복 산입하지 않는다.

## 로컬 세션 대조·수신 확인 (2026-10-21)

- 저장소의 `origin/main` 자동 기록을 fast-forward로 반영했다. KR daily run `39521755861`은 2026-10-21 00:30:42Z에 생성되어 00:30:47Z에 job을 시작하고 성공했다. job 로그는 `completed`에 2026-10-19·20, `blocked=null`, 기준일 2026-10-20 보고 `reported=true`, `kiwoomStatus=COMPLETE`를 기록했다. 이번 세션에서는 runner journal을 조회하지 않아 timer 정시 실행과 다음 기동 따라잡기는 판정하지 않았다.
- 운영 DB 읽기 전용 `npm run verify:kr-candidate -- 20261020` (Node 22.23.2): `ok:true`, run `4a155f32-bc6e-52fd-aaa7-5096cd70ca95` `COMPLETED`, 고정 8유형 각 10행과 가변 신호 12행(신규 상장 7·거래대금 급증 5), 총 92행, 보고 표식 1건·중복 run 없음, KRX `TRADING_COMPLETE`, 원천 재계산·상장 이력 감사 통과. 사용자 Telegram 실수신 확인으로 정확성 기준 확정 관측일에 산입했다. 메시지 헤더 링크 날짜와 360px 표시는 별도 확인하지 않았다.
- 같은 방식으로 기준일 2026-10-19도 읽기 전용 검증했다: `ok:true`, run `20dc68cc-2886-52fa-a86d-19c316cb0aa5`, 95행, 보고 표식 1건·중복 run 없음, 원천 재계산·상장 이력 감사 통과. 사용자가 Telegram 실수신과 매일 수신 중임을 2026-10-21 확인해 정확성 기준 관측일로 승격했다.
- `docs/plans/NEXT.md` Q-08을 정확성 기준 확정 관측일 4일(10-15·16·19·20)로 갱신했다. 16거래일이 남았고, 추가 휴장·runner 정지 없이 매 거래일 실행된다는 가정에서 20번째 기준일은 2026-11-11, 처리는 2026-11-12다. `docs/plans/kr-daily-watermark.json`은 클라우드 기록의 최신 run `39521755861`·기준일 2026-10-20을 반영한다.

## 검증

- `npm run verify:kr-candidate -- 20261019`: `ok:true` (Node 22.23.2, 운영 DB 읽기 전용)
- `npm run verify:kr-candidate -- 20261020`: `ok:true` (Node 22.23.2, 운영 DB 읽기 전용)
- `gh run list --workflow kr-daily.yml -L 8`: 최신 run `39521755861` 성공 확인; job `118966998493` 로그에서 보고·Kiwoom 상태 확인
- 운영 DB 쓰기·Telegram 발송·workflow dispatch·timer 변경 없음

## 다음

1. 다음 KR 거래일 자동 실행의 보고를 사용자 확인 후 읽기 전용 대조한다.

## KR ETF 지수 대비 수익률 표시 (2026-10-21)

- Linear 실행 항목: [KOR-69](https://linear.app/koreatimes/issue/KOR-69/q-34-완료-kr-etf-지수-대비-수익률-표시-웹telegram).
- 사용자 승인 범위: KR 웹 상세와 Telegram 보고에 1일·5거래일 ETF 가격수익률에서 ETF별 추적지수 가격수익률을 뺀 차이를 표시한다. 기존 순위·저장 신호·ETF 수익률은 변경하지 않는다.
- 1일 지수 수익률은 동일 기준일 `etf_daily_kr.idx_fluc_rt`; 5거래일은 `trading_calendar_kr`의 연속된 6개 완료 거래일 사이 동일 `idx_nm`의 `idx_close` 변화율을 사용한다. 데이터 부족·지수 변경·조회 실패는 비교 불가로 표기하고 ETF 행은 유지한다. Telegram 지수명은 HTML escape하며 기존 최대 길이 검증을 유지한다.
- 표시 문구는 가격수익률 차이이며 총수익률·비용·위험을 보정한 알파나 미래 성과의 증명이 아니라는 한계를 웹·Telegram에 함께 고지한다.

### 검증

- Node 22.23.2 `npm test`: 55개 파일·325개 테스트 통과; `npx tsc --noEmit`, 변경 파일 ESLint, `git diff --check` 통과.
- 프로덕션 빌드는 네트워크 제한으로 `app/layout.tsx`가 Google Fonts의 Geist 글꼴을 가져오지 못해 실패(`getaddrinfo EAI_AGAIN fonts.googleapis.com`). 빌드 진단 중 워커를 끈 재현으로 원격 폰트 요청 오류를 확인했고 진단용 설정은 되돌렸다.
- 전체 lint는 이전 기준선에서 미추적 `.opencode/skills/mem0-mem0/scripts/mem0_doc_search.ts`의 기존 `no-explicit-any` 4건이 확인되어 있고, 이번 변경 파일 ESLint는 통과했다.
- 운영 데이터 쓰기·Telegram 실발송·workflow dispatch·runner 설정 변경 없음.
