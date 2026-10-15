# 승인된 데이터 정정·US 범위 비교 실행 계획

**목표:** Q-27의 확정 근거 데이터와 최근 KR run을 현재 정본 기준으로 정정하고, Q-28의 제한 비교 결과를 남긴다.
**승인:** 2026-10-15 사용자 `승인` — 직전 응답의 Q-27 권장 정정과 Q-28 최대 40회 비교를 일괄 승인했다.
**기준 커밋:** `2743383`. 격리 작업 경로 `/tmp/investment-approved-correction-20261015`.

## Global Constraints

- 운영 정정은 fresh proposal·전체 백업·복원 검증·적용 직전 동일성 확인 뒤 수행한다. 백업은 저장소 밖 비공개 파일(0600)에 둔다.
- false-positive event와 master.first_seen의 확정 근거만 적용한다. 연결된 과거 신규 신호를 함께 검토한다.
- 최근 KR run은 현재 정본 재계산 정책이다. 초기 seq·교체 source가 불확실한 run은 보류한다. 당시 전체 입력의 완전 복원이라고 표현하지 않는다.
- run ID, 관측 시각, 완료 시각, Telegram 보고 표식·과거 관측 사실을 보존하고 Telegram은 발송하지 않는다.
- REST 쓰기는 원자적 트랜잭션이 아니다. 부분 신호를 COMPLETED로 노출하지 않도록 먼저 상태를 격리하고, 실패 복원과 최종 재검증을 테스트한다. 새 migration·권한 변경은 하지 않는다.
- Q-28은 usa20931의 stk_cnd=0과 1만 비교한다. 조건별 최대 20페이지, 총 40 ranking 요청, 최소 1250ms 간격, 자동 재시도 없음, 오류 즉시 중단. 기존 자격 증명만 사용한다.
- 비교 결과에는 관측 창·페이지 제한·부분 결과·종목 차이·상위 순위·소요시간을 명시한다. 저장·발송·현행 요청 계약 변경은 하지 않는다.
- 비밀값·원천 응답은 로그·Git 문서에 남기지 않는다. 새 의존성과 관련 없는 파일 변경은 금지한다.

## Task 1: Q-27 정정·복원 도구

담당 파일: 신규 `lib/signals/kr-data-correction.ts`, `scripts/correct-kr-data.ts`, 해당 테스트. 기존 감사 export의 최소 확장은 허용한다.

1. 기존 감사와 스키마를 읽고 plan/backup/apply/restore 경계를 정한다.
2. 변경된 제안 거부, 표식·시각 보존, false listing 참조 제거, master 날짜 보정, 부분 실패 복원·격리, 불확실 run 보류 테스트를 먼저 RED로 확인한다.
3. 전체 행 백업과 sha256 고정 계획을 만들고, dry-run을 기본으로 한다. 쓰기는 명시된 고정 파일·hash와 일치할 때만 실행한다.
4. 적용과 복원 후 전체 행·metadata read-back으로 동일성을 확인한다. TDD 결과와 실행 방법을 `/tmp/q27-implementation-report.md`에 기록한다. 운영 호출과 Git 커밋은 리더가 수행한다.

## Task 2: Q-28 제한 비교 도구

담당 파일: 신규 `scripts/compare-us-loss-scope.ts`, 해당 테스트. 기존 Kiwoom 수집 계약은 수정하지 않는다.

1. 순차 요청·페이지 상한·조건별 continuation·최소 간격·오류 시 중단·중복/오류 응답·부분 결과 표시를 TDD로 검증한다.
2. 기존 usa20931 요청과 파서 규약에 맞춰 조건만 바꾼 독립 비교 CLI를 만든다. token은 한 번 발급하고 raw 응답은 출력하지 않는다.
3. 실행 방법과 안전한 요약 출력 계약을 `/tmp/q28-implementation-report.md`에 기록한다. 실호출·커밋은 리더가 수행한다.

## Task 3: KR 웹 조회의 완료 상태 경계

담당 파일: `app/signals/kr/[basDd]/page.tsx`, `app/protected/page.tsx`, 관련 대시보드 테스트.

1. 기존 화면의 기준일·latest·인접일 조회가 `COMPLETED` run만 선택하는지 실패 테스트로 고정한다.
2. 누락된 완료 상태 필터를 추가한다. 신호 화면 디자인·데이터 계약은 바꾸지 않는다.
3. 독립 리뷰·검증 후 main에 먼저 푸시하고 Production READY를 확인한다. 이 선행 배포 전에는 Q-27 DB 쓰기를 실행하지 않는다.

## Task 4: 리더 통합·운영 검증

1. 각 태스크 diff와 보고서로 독립 spec/quality 리뷰를 수행하고 필수 지적을 수정한다.
2. Node 22.23.2에서 전체 test·tsc·lint·build·continuity·diff 검사를 실행한다.
3. 실행 중인 KR/US workflow와 fresh DB 상태를 확인한 뒤 비공개 계획·백업을 고정한다. 복원 round-trip은 fake/local에서 검증하고 운영에는 불필요한 시험 쓰기를 하지 않는다.
4. 승인된 정정만 적용하고 listing 감사·현재 및 직전 run 감사·candidate·시각/표식 보존을 확인한다. 과거 보고 재발송과 M6 자동 승격은 금지한다.
5. Q-28을 한 번 실행하고 결과에 따라 실제 계약 변경은 DECIDE로 남긴다.
6. 당일 작업 기록→NEXT→가능한 Linear/OpenViking→continuity 순으로 기록하고 main에 원자적 커밋·푸시한다.
