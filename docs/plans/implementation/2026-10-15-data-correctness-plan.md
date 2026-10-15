# 데이터 정확성 보강 실행 계획

**Goal:** 전체 종목·거래일을 계산에 사용하고, 기존 최초 관측일을 보존하며, 저장 신호를 재계산해 읽기 전용 정정안을 제공한다.
**Architecture:** 기존 Supabase 저장소와 순수 계산기를 유지한다. 공통 페이지 조회 → 완전 입력 검증 → 기존 계산 → 전체 저장 완료 순서를 강제한다. 별도 감사 CLI는 조회·Storage 다운로드만 사용한다.
**Tech Stack:** Node 22.23.2, TypeScript, Supabase JS, Vitest. 신규 의존성 없음.
**Spec:** `docs/plans/ETF-signal-MVP-plan-v2.2.md`, 2026-10-15 사용자가 승인한 권장 순서(조회 누락 방지 → 신규 판정 보존 → 정확성 검증 → 읽기 전용 정정안 → US 범위 확인).

## Global Constraints

- 운영 DB 쓰기·삭제·migration·수동 수집·Telegram 발송은 실행하지 않는다. 코드와 테스트 수정, 운영 읽기 전용 검증만 실행한다.
- 기존 순위·유동성·거래대금 계산 계약을 바꾸지 않는다. US `stk_cnd=1`을 임의로 변경하지 않는다.
- 비밀값·원천 응답을 출력하거나 문서에 저장하지 않는다. 정정안은 run/source ID와 차이만 기록한다.
- 오류·조기 종료·행 수 불일치·중복 페이지는 부분 데이터를 성공으로 반환하지 않는다.
- 과거 재계산은 현재 정본과 당시 provenance 차이를 구분한다. 불확실한 과거 run은 자동 정정 대상으로 표시하지 않는다.
- 새 UI·스키마·의존성은 추가하지 않는다. 관련 없는 사용자 파일은 보존한다.
- TDD RED/GREEN 증거와 변경 파일을 각 작업 보고에 기록한다. Git commit은 리더가 수행한다.

## Task 1: 전체 조회와 최초 관측일 보존

**Ownership:** `lib/supabase/read-all-rows.ts`(신규), `lib/market-data/repository.ts`, `scripts/generate-kr-price-signals.ts`, `lib/signals/kr-signal-repository.ts`, 관련 `test/` 파일.

1. 1,000행을 넘는 결과, 정확히 페이지 크기인 결과, 빈 결과, 중간 오류·누락·중복·count 변경을 검증하는 테스트를 먼저 작성하고 실패를 확인한다.
2. 공통 `readAllRows<T>`를 만든다. 호출자가 fresh query callback을 제공하고 `.select(...,{count:"exact"})`, 안정적인 고유 정렬, inclusive `.range(from,to)`를 사용한다. exact count와 고유 key를 검증하고 서버가 더 짧은 페이지를 반환해도 실제 행 수로 진행하거나 명확히 실패한다. 성공 시 완전한 배열만 반환한다. 반환 API와 사용법을 보고서에 명시한다.
3. KR current/start/prior daily, listing/master, master 기존 행, calendar 재정렬에 적용한다. 복합 키 정렬은 날짜+종목 코드다. 현재/과거 각 날짜의 건수를 calendar가 가리키는 source_snapshot.row_count와 대조한다. 필요한 전체 입력을 읽고 계산하기 전에는 signal_run을 쓰지 않는다.
4. 1,180개 master 중 1,001번째 이후 코드도 기존으로 인식하고 first_seen을 보존하며 신규 event를 만들지 않는 회귀 테스트를 추가한다. 기존 행 first_seen을 일반 master 업데이트가 덮어쓰지 않도록 저장 경계도 보강한다(스키마 변경 없음).
5. 전체 가격·가변 신호가 저장되기 전 run이 COMPLETED로 노출되지 않게 한다. 기존 보고 표식은 보존한다. 기존 호출 계약은 가능한 유지한다.
6. 대상 테스트와 tsc를 실행하고 자체 검토한다. 변경을 commit하지 말고 보고서 경로에 기록한다.

## Task 2: 읽기 전용 재계산 감사와 정정안

**Ownership:** 신규 `lib/signals/data-accuracy.ts` 및 필요한 작은 읽기 전용 loader, 신규 `scripts/verify-data-accuracy.ts`, `package.json`의 `verify:data` script, 관련 `test/` 파일. Task 1 helper를 소비한다. 기존 계산기 export가 꼭 필요하면 최소 변경만 한다.

1. 잘못된 코드·순위·수치·종목 수, 1,000행 초과, 잘못된 Storage hash, 과거 snapshot에서 이미 존재한 신규 상장 event를 탐지하는 literal fixture 테스트를 먼저 작성한다.
2. `npm run verify:data -- latest|all` CLI를 만든다. service-role client를 쓰지만 모든 경로가 SELECT와 private Storage download뿐이어야 하며 apply 옵션은 없다. `latest`는 KR/US 각 최신 완료 run, `all`은 전체 완료 run이다. 결과 JSON은 오류와 정정 제안이며 부정확하면 종료 코드가 실패여야 한다.
3. KR 정본 daily를 완전히 읽어 기존 가격·turnover 계산기로 재계산하고 저장된 행의 code/name/type/screen/rank/value/unit를 대조한다. 기준일·5일·20일 입력 snapshot/count/hash와 날짜를 검증한다. 과거 seq 재정렬/다른 input snapshot 때문에 재현 불확실하면 정정 가능 판정과 분리한다.
4. ka10099 snapshot 시간순 코드 이력으로 이전 snapshot에 이미 존재한 event를 false-positive 후보로 찾는다. master.first_seen의 이른 관측일 후보를 제시하되 최초 snapshot의 종목을 신규 상장으로 단정하지 않는다.
5. US raw payload를 기존 파서/계산 계약으로 replay하고 전체 저장 행을 대조한다. ETN·중복·page_count·row_count·hash를 검증한다. `usa20931` request의 `stk_cnd=1` 범위 제한을 명시하되 계약 변경과 API 실호출은 하지 않는다.
6. 정정안에 run/source IDs, added/removed/changed 세부 차이, before/after count, provenance caveat, 보고 표식 보존·과거 Telegram 재발송 금지 정책을 포함한다. 부족한 증거가 있으면 approval-ready로 표시하지 않는다. 큰 결과는 CLI JSON만 사용하고 원천 payload는 출력하지 않는다.
7. 쓰기 메서드가 호출되면 실패하는 fake로 CLI read-only 경계를 검증한다. 대상 테스트와 tsc를 실행하고 보고한다. Git commit은 하지 않는다.

## Task 3: 정확성 게이트 연결과 운영 경계

**Ownership:** 기존 `scripts/verify-kr-daily-candidate.ts`, `scripts/verify-us-candidate.ts`, `scripts/report-kr-signals.ts`, 필요한 보고 진입점·workflow, 해당 테스트. Task 2 감사 API를 사용한다.

1. 행 수만 같은 잘못된 순위·값이 기존 candidate 검증을 통과하지 않도록 실패 테스트를 먼저 작성한다.
2. 기존 candidate verifier에 콘텐츠 정확성 검사를 연결한다. 기존 성공 JSON 계약은 유지하되 정확성 결과를 추가하고 불일치/조회 실패는 ok:false로 판정한다. 기존 자동 workflow가 이 경로를 실행하는지 확인한다.
3. KR 실발송 전 현재 run의 재계산 정확성을 검사해 오류이면 Telegram 호출 전에 중단한다. 과거 비교 run 오류를 숨기지 않는다. dry-run과 테스트 fixtures를 불필요하게 외부 DB에 연결하지 않는다.
4. 새 코드만으로 과거 운영 데이터가 고쳐졌다고 표시하지 않는다. 대상 테스트·tsc를 실행하고 보고한다. Git commit은 하지 않는다.

## 통합 검증 및 승인 경계 (리더)

- 매 작업 독립 spec/quality 리뷰, 마지막 전체 리뷰. 수정 요구는 원 구현자에게 전달한다.
- 전체 `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `continuity:check`, `git diff --check` 실행. 기존 미추적 `.opencode` lint 오류는 별도로 기록한다.
- 운영 읽기 전용 `verify:data -- all`을 실행해 정정안을 확보한다. 현재 불일치는 예상된 감사 실패이며 숨기지 않는다.
- 오늘 작업 기록·정본 NEXT에 결과를 기록한다. 운영 정정은 APPROVE, US 범위 계약이 필요한 경우 DECIDE로 분리한다. 기존 WAIT 항목은 보존한다.
- 검증된 수정만 main에 원자적으로 통합·푸시한다(상시 승인). 운영 DB 정정·과거 발송은 하지 않는다.
