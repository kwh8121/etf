# ETF 신호 MVP v2.2 — R1 품질 게이트 작업 기록

> 작업일: 2026-09-21 KST
> 상태: 완료

## 결과

- GitHub Actions의 국내 일일 작업을 production 단일 대기열로 직렬화했다. 실행 중인 작업을 취소하지 않아 예약 실행과 수동 실행이 겹쳐도 순서대로 처리한다.
- 일일 실행기는 생성 직후의 정확한 `signal_run.id`를 Telegram 보고에 전달한다. 최신 기준일을 다시 조회해 다른 실행 결과를 전송할 수 있던 경로를 제거했다.
- 신규상장 신호는 Telegram 보고가 성공한 뒤에만 `listing_event_kr.first_alerted_at`을 갱신한다. 갱신 대상은 `code`가 아닌 신호 meta의 `event_key`로 한정해 같은 코드의 다른 이벤트를 잘못 제외하지 않는다.
- Telegram과 `/protected`에 5거래일 값이 KRX 종가 기준 가격수익률이며 분배금·기업행동 조정 총수익률이 아니라는 고지를 표시했다.
- 대시보드는 `m3-price-movers-v1` 실행만 선택하고, 기준일·완료 시각·ID 순으로 결정적으로 정렬한다. 실행 상태 또는 빈 신호 결과를 데이터 품질 경고로 표시한다.

## 검증

- 대상 회귀 테스트: 대시보드 계약, Telegram 고지, 생성 run ID 보고, 신규상장 event_key 갱신, Telegram 보고 실패 시 갱신 방지
- 전체 품질 게이트: `npm test` 20개 파일·59개 테스트, `npx tsc --noEmit`, `npm run lint`, `npm run build`, Prettier, `git diff --check`, `npm run continuity:check` 통과
- 독립 코드 리뷰는 Critical/High/Medium/Low 0건으로 승인했고, 아키텍처 리뷰는 `WATCH`로 판정했다. `event_key`를 update 대상으로 사용해 현재 R1 경계를 닫았으며, 동일 코드의 복수 이벤트를 하나의 신호 행에 모두 표현해야 할 때의 계약 확장은 후속 hardening 항목이다.

## 외부 상태

- GitHub Actions `workflow_dispatch` 성공 실행: `35564162887`
- Linear 정합화: 프로젝트를 `In Progress`로 전환하고, 현행 ROADMAP 기준 M3·M4·M5·M6·R1·R2 마일스톤 명칭/설명을 재정렬했다. 완료 이슈 `KOR-52`(M3), `KOR-53`(M4), `KOR-54`(R1)를 연결하고 최신 project update를 기록했다.
- 불일치 원인: Linear 마일스톤은 초기 초안의 M3~M6 정의를 유지한 채, 이후 ROADMAP의 번호·범위 변경과 R1 완료가 이슈 댓글 수준에서만 반영됐다. 프로젝트 상태·마일스톤 연결·최신 update를 함께 read-back 검증하지 않아 드리프트가 남았다. 연속성 하네스에 마일스톤 대조와 갱신 후 read-back을 추가했다.
- OpenViking 장기 메모리는 재시도 후 저장 성공(`Stored 2 message(s)`)했다. 즉시 recall은 비동기 추출 인덱스 반영 전일 수 있으므로 다음 세션 시작 시 다시 조회한다.
- Telegram 및 Supabase 자격 증명·수신처·원문 응답은 기록하지 않는다.

## 다음 작업

1. M5 실험 어댑터를 기능 플래그 기본 `off`로 설계·구현하거나, M6 국내 P0 일별 관측 기록을 시작한다.
2. 동일 코드 복수 신규상장 이벤트를 개별 신호 행으로 표현해야 하는 요구가 생기면 `event_key`를 신호 행 계약으로 승격한다.
