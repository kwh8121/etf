# ETF 신호 MVP v2.2 — M5-B 미국 ETF P1 기반 작업 기록

> 작업일: 2026-09-21 KST
> 상태: 진행 중

## 결과

- 정본 ADR에 따라 M5의 우선 구현 경로를 순설정 추정(M5-A)이 아닌 격리된 미국 ETF 등락 어댑터(M5-B)로 확정했다.
- `ENABLE_US_ETF_P1`은 명시적으로 `true`일 때만 활성화되며 기본값은 `off`다.
- ETN을 제외하고, 부호가 붙은 미국 가격은 절댓값으로 정규화한다. 5일 수익률은 원천 표시값 대신 정규화된 시작·종료 가격으로 재계산한다.
- 잘못된 가격·수익률·순위·식별자는 실험 신호로 만들지 않는다.

## 검증

- 대상 테스트: `npm test -- test/signals/us-etf-movers.test.ts` — 3개 통과
- 전체 품질 게이트: `npm test` 21개 파일·62개 테스트, `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과

## 외부 상태

- Linear `KOR-55`를 M5 마일스톤의 `In Progress`로 생성했다.
- 비밀값·token·원문 API 응답은 기록하지 않는다.

## 남은 작업

1. Kiwoom 미국 ETF API의 인증·연속조회 클라이언트와 응답 계약을 구현한다.
2. 미국 전용 snapshot·중복 관측·US 신호 저장 경로를 추가한다.
3. 별도 workflow, Telegram·대시보드 P1 섹션과 국내 P0 비간섭 E2E를 구현·검증한다.
