# ETF 신호 MVP — 운영시간·문서 정합 작업 기록

> 작업일: 2026-09-22 KST
> 상태: 문서 정정·읽기 전용 운영 사전 검증 완료, 예약 시각 재결정 대기

## 정정한 사실

- KR 신호 저장 코드는 이미 `PENDING` 기록 → 신호 4종 저장 → `COMPLETED` 전환으로 보완됐다. 동일 입력은 결정적 `runId`로 재시도한다. 단, DB 트랜잭션이 아니므로 부분 행과 `PENDING` 실행은 남을 수 있으며 실제 실패·복구 E2E는 미검증이다.
- US 보고 분량은 유형별 상위 10건으로 구현했고, 최신 실제 데이터의 발송 없는 dry-run은 메시지 1건이었다. 새 형식의 staging 실발송은 미검증이다.
- 과거 핸드오프·작업 기록은 작성 당시 상태의 시간순 증거로 보존한다. 최신 상태는 이 기록과 정본 계획·운영 가이드를 따른다.

## 회사 PC 운영 제약과 검증

- 사용자 확정 제약: Kiwoom 허용 IP가 등록된 회사 PC는 근무시간에만 운영할 수 있다. 상시 가동이나 고정 IP 서버 이전은 현 운영안이 아니다.
- 설치된 systemd timer를 읽기 전용으로 확인했다. KR은 월~금 19:15 KST, US는 화~토 07:30 KST이며 모두 `Persistent=true`다. 두 시각에 PC가 꺼져 있으면 정시 발화하지 않고 다음 기동에 최대 한 번 따라잡는다. 여러 슬롯을 놓치면 일부 기준일은 자동 보충되지 않는다.
- 2026-09-22 14:40 KST 현재 KR timer의 마지막 실행 기록은 없고, `etf-kr-daily-dispatch.service` journal에도 항목이 없다. GitHub KR 최근 성공 run `35669324094`는 수동 실행이므로 첫 timer 검증 증거가 아니다. M6 관측은 0/20이다.
- `npx vitest run test/scripts/dispatch-scheduled-workflow.test.ts`: 기준일 계산·디스패치 인수 9개 테스트 통과. 실제 timer 발화·GitHub 실행의 대체 증거는 아니다.
- timer 시각·설치본·기능 플래그·운영 DB·Telegram은 변경하지 않았다.

## 품질·상태 동기화

- `npm test`: 28개 파일·91개 테스트 통과. `npx tsc --noEmit`, `npm run lint`, `npm run build`, Prettier, `npm run continuity:check` 통과.
- Linear KOR-58의 시작 게이트를 정시 또는 다음 근무일 따라잡기 검증으로 정정하고, KOR-53과 프로젝트 상태 업데이트에 정시 실행 위험을 기록했다. KOR-58은 Todo, 프로젝트 건강 상태는 `atRisk`를 유지한다.
- OpenViking에 회사 PC 운영 제약과 첫 timer 미검증 상태를 저장했다.

## 다음 작업과 결정

1. 실제 근무시간과 KR·US 기준일별 목표 발송 시각을 확정한다. 그 전에는 timer 시각을 임의 변경하지 않는다.
2. 회사 PC가 정시 또는 다음 근무일에 켜진 뒤 KR timer journal → GitHub run → 저장 행 → Telegram 결과를 대조한다. 지연 따라잡기이면 별도로 표시한다.
3. timer 경로와 완전 거래일 자료가 모두 확인된 날부터 M6 관측에 포함한다. 확인 전에는 0/20을 유지한다.
