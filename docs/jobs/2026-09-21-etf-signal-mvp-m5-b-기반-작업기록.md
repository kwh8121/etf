# ETF 신호 MVP v2.2 — M5-B 미국 ETF P1 기반 작업 기록

> 작업일: 2026-09-21 KST
> 상태: 구현 완료 · staging 운영 E2E 대기

## 결과

- 정본 ADR에 따라 M5의 우선 구현 경로를 순설정 추정(M5-A)이 아닌 격리된 미국 ETF 등락 어댑터(M5-B)로 확정했다.
- `ENABLE_US_ETF_P1`은 명시적으로 `true`일 때만 활성화되며 기본값은 `off`다.
- ETN을 제외하고, 부호가 붙은 미국 가격은 절댓값으로 정규화한다. 5일 수익률은 원천 표시값 대신 정규화된 시작·종료 가격으로 재계산한다.
- 잘못된 가격·수익률·순위·식별자는 실험 신호로 만들지 않는다.
- Kiwoom 네 미국 API의 연속조회·429 재시도·응답 계약을 별도 클라이언트로 구현했다. 국내 클라이언트와 실행 스크립트는 변경하지 않았다.
- 네 API 응답을 한 복합 원본 관측으로 저장한다. 같은 콘텐츠의 재실행은 `duplicate_observation`만 추가하고 US 신호 실행·행을 다시 만들지 않는다.
- 리뷰에서 확인된 중복 Telegram 재전송 가능성을 보완했다. workflow는 새 `run_id`가 있을 때만 보고를 실행하므로 동일 콘텐츠 재관측은 알림도 만들지 않는다.
- `scripts/ingest-us-movers.ts`, `scripts/report-us-movers.ts`, 미국장 종료 후 별도 GitHub Actions workflow, P1 전용 Telegram·인증 대시보드 섹션을 추가했다.

## 검증

- 대상 테스트: Kiwoom 계약·US 저장·US workflow·Telegram 보고·대시보드 계약 테스트 통과 (리뷰 보완 후 총 73개 테스트)
- 기능 플래그 off 스모크: Node `22.23.2`에서 `npm run ingest:us-movers`, `npm run report:us-movers` 모두 `DISABLED`
- 전체 품질 게이트: 아래 마감 검증 명령 결과를 갱신한다.

## 외부 상태

- Linear `KOR-55`는 M5 마일스톤의 `In Progress`로 유지하고, 구현 경계·검증·staging E2E 다음 행동을 댓글 `bdbe6b9e-be9a-43b2-a67e-aac4e1bbbd6b`에 기록했다.
- OpenViking에 M5-B 구현 상태와 staging E2E 재개 조건을 저장했다.
- 비밀값·token·원문 API 응답은 기록하지 않는다.

## 운영 E2E 전제와 다음 작업

1. staging GitHub Environment에서만 `ENABLE_US_ETF_P1=true`로 설정해 수동 workflow를 2회 실행한다.
2. API 성공·복합 snapshot 중복 관측·US 신호 단일 생성·P1 Telegram 수신을 비밀 없이 기록한다.
3. 완료 뒤 플래그를 `false`로 되돌리고, 운영 관측을 시작할지 결정한다.
