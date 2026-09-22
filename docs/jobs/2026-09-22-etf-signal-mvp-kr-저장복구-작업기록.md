# ETF 신호 MVP — KR 신호 저장 복구 작업 기록

> 작업일: 2026-09-22
> 상태: 로컬 구현 완료, 운영 E2E 미검증

## 결과

- KOR-59: KR `signal_run`을 `PENDING`으로 먼저 저장하고 신호 행 저장이 모두 성공한 뒤 `COMPLETED`로 전환한다.
- 신호 행 저장 실패 시 완료된 빈 실행을 만들지 않는다. 동일 입력 재시도는 기존 결정적 `runId`에 행을 멱등 upsert한다.
- 실패 재현 테스트를 먼저 추가해 기존 동작에서 RED를 확인한 뒤 구현했다.

## 검증

- `npx vitest run test/signals/kr-signal-repository.test.ts`: 2개 통과
- `npm test`: 28개 파일·88개 테스트 통과
- `npx tsc --noEmit`, `npm run lint`, `npm run build`: 통과
- Supabase 읽기 전용 조회: 기존 KR `signal_run` 4건 모두 `COMPLETED`이며 각 실행에 신호 행이 있다. 새 코드의 운영 실행 또는 실패 복구 실측을 뜻하지 않는다.

## 경계·위험

- 애플리케이션의 `PENDING`→`COMPLETED` 순서는 DB 트랜잭션이 아니다. 중간 실패 시 부분 신호 행이 남을 수 있으나, 같은 입력 재시도는 동일 PK를 다시 upsert한다.
- 운영 DB에 강제 실패를 주입하거나 데이터를 수정하는 실험은 하지 않았다. 첫 KR 자동 timer 성공도 아직 확인 전이다.

## 다음 작업

1. KOR-58: 2026-09-22 19:15 KST 첫 자동 실행 결과와 운영 기록을 확인한다.
2. KOR-59: 안전한 별도 환경 또는 승인된 운영 절차에서 실제 실패·재시도 E2E를 검증하고 완료 처리한다.
3. KOR-56·57: US 휴장 중복·복구 실측과 보고 분량 정책을 계속 추적한다.

정본: `docs/plans/ETF-signal-MVP-v2.2-ROADMAP.md`, 이전 기록 `docs/jobs/2026-09-22-etf-signal-mvp-m5-b-저장복구-작업기록.md`.

## 10:00 KST 운영 준비 재확인

- 사용자 systemd의 `actions-runner-etf.service`는 실행 중이고 GitHub 연결 상태다.
- `etf-kr-daily-dispatch.timer`는 실행 대기 중이며 다음 트리거는 2026-09-22 19:15 KST다. 따라서 첫 자동 실행 성공은 아직 검증되지 않았다.
- 최근 KR run `35669324094`는 성공했지만 트리거가 수동 `workflow_dispatch`였다. US run `35670349188`도 성공했지만 자동 KR 검증 증거로 사용하지 않는다.
- M6 일별 기록 절차와 완전 거래일 판정 기준을 `docs/guides/etf-signal-mvp-m6-observation-runbook.md`에 준비했다. 현재 누적은 0/20이다.
