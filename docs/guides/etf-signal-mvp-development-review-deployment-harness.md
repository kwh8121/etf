# One Fact, One Home — ETF 일일 신호 MVP 개발·리뷰·배포 하네스

> 적용 저장소: `investment`
> 제품 기준선: `docs/plans/ETF-signal-MVP-plan-v2.2.md`
> 개발 흐름 기준: `docs/plans/ETF-signal-MVP-v2.2-Spec-Kit-Superpowers-개발흐름-활용계획.md`
> 작성일: 2026-09-17 KST
> 상태: 구현 전 운영 계약. 외부 서비스 연결과 Production 배포 상태는 아직 검증되지 않았다.
>
> **2026-09-22 개정 — 실행 원장 공식화(사용자 결정):** Spec Kit 작업 공간(`.specify/`, `specs/`, `tasks.md`)은 생성되지 않았다. 다음 작업·순서·완료 상태의 정본은 `docs/plans/NEXT.md`다. 이 문서의 Spec Kit 전제(Stage 1·2의 Spec Kit 항목, `speckit-*` 명령, `tasks.md` 체크, 헌장)는 새 기능 개발 재개 시 도입 여부를 다시 판단할 때까지 보류한다. 규정은 `docs/plans/ETF-signal-MVP-v2.2-Spec-Kit-Superpowers-개발흐름-활용계획.md` 2.1~2.2절을 따른다.

## 1. 목적과 적용 원칙

이 문서는 ETF 일일 신호 MVP의 계획, 개발, 리뷰, 배포, 운영 관측 흐름을 한 곳에서 찾게 하는 운영 색인이다. 제품 요구사항이나 구현 상세를 다시 쓰지 않고, 각 사실의 정본과 다음 Gate로 이동하는 조건을 연결한다.

이 하네스의 성공 기준은 다음과 같다.

- 실행자는 현재 피처, 요구사항, 구현 태스크, 검증 증거의 정본을 바로 찾을 수 있다.
- 승인되지 않은 범위가 코드, PR, 배포 설정에서 제품 요구사항으로 승격되지 않는다.
- 국내 P0와 미국 P1의 데이터·시간·실패·배포 경계가 섞이지 않는다.
- 코드 리뷰 통과와 운영 데이터 적격성 통과를 구분한다.
- 웹, 수집 workflow, 데이터베이스를 각각 배포하고 각각 복구할 수 있다.
- 완료 주장은 최신 테스트·lint·build·실행 증거가 있을 때만 한다.

다음은 이 문서의 비목표다.

- MVP v2.2의 신호 정의, 임계값, 데이터 계약을 수정하지 않는다.
- GitHub, Supabase, 웹 호스팅, Telegram의 연결 완료를 추정하지 않는다.
- 자동매매, 포트폴리오, 백테스트, 투자 추천 절차를 추가하지 않는다.
- 다른 프로젝트의 Linear 라벨, ROADMAP, DG Gate를 이 저장소의 사실로 복사하지 않는다.

## 2. 현재 확인된 저장소 상태

| 항목 | 상태 | 근거와 영향 |
| --- | --- | --- |
| 소스 저장소 | 확인됨 | GitHub 원격 `https://github.com/kwh8121/etf.git`, 기본 작업 브랜치 `main` |
| 웹 애플리케이션 | 확인됨 | Next.js 16.3.5, React 19, TypeScript strict 기반 시작 템플릿 |
| 인증 경계 | 확인됨 | `lib/supabase/server.ts`, `lib/supabase/proxy.ts`, `app/protected/page.tsx`가 publishable key와 사용자 claims를 사용 |
| Production build 기준선 | 확인됨 | Node `22.23.2`에서 Webpack 경로로 고정한 `npm run build`가 성공했다. |
| 테스트 러너 | 확인됨 | Vitest와 `npm test`를 구성했고 24개 테스트가 통과했다. |
| Spec Kit 작업 공간 | 미도입(보류) | `.specify/`, `specs/`가 없다. 2026-09-22부터 실행 원장은 `docs/plans/NEXT.md`이며 새 기능 개발 재개 시 도입을 재판단한다. |
| 시장 데이터 코드 | M2 일부 구현 | KRX 날짜·파싱·완전성 검증·read-only 클라이언트가 있으며, 영속화·Kiwoom 페이지 처리·backfill은 남아 있다. |
| 데이터베이스 migration | 확인됨 | 핵심 스키마·RLS·외래 키 인덱스 migration 3건을 원격 Supabase `ETF` 프로젝트에 적용하고 재검증했다. |
| 예약 수집 workflow | 미구현 | `.github/workflows/ingest.yml`이 없다. |
| 웹 배포 플랫폼 | 외부 확인 필요 | README의 Vercel 안내는 시작 템플릿 설명이지 이 프로젝트의 배포 완료 증거가 아니다. |
| Supabase 프로젝트·RLS | 확인됨 | 원격 `ETF` 프로젝트에 핵심 스키마와 RLS 정책을 적용하고 검증했다. private Storage는 M2 원본 객체 저장 설계 시 별도로 확인한다. |
| Kiwoom·KRX·Telegram 자격 증명 | 외부 확인 필요 | 계획상 필요하지만 로컬 파일이나 문서에 값을 기록하지 않는다. |

상태가 바뀌면 실제 코드, 설정, 외부 서비스 기록을 먼저 갱신한다. 이 표는 외부 현실을 대신하지 않으며, 확인되지 않은 상태를 `완료`로 바꾸는 근거가 될 수 없다.

## 3. One Fact, One Home

| 사실 유형 | 유일한 정본 | 다른 표면에 둘 내용 |
| --- | --- | --- |
| MVP 범위, 비범위, 정책값, 수용 기준 | `docs/plans/ETF-signal-MVP-plan-v2.2.md` | 경로, 적용 섹션, 요구사항 ID |
| 개발 방법과 피처 분해 | `docs/plans/ETF-signal-MVP-v2.2-Spec-Kit-Superpowers-개발흐름-활용계획.md` | 실행 단계와 Gate 이름 |
| 프로젝트 불변 원칙 | MVP v2.2 계획서와 `AGENTS.md` (Spec Kit 헌장 보류) | 관련 절 링크 |
| 마일스톤·종료 기준 | `docs/plans/ETF-signal-MVP-v2.2-ROADMAP.md` | 마일스톤 ID와 링크 |
| 마일스톤별 기술 설계·데이터 계약 | `docs/plans/implementation/<마일스톤>-*.md` | 결정과 링크 |
| 다음 작업·순서·완료 상태(실행 원장) | `docs/plans/NEXT.md` | Q-ID, 라벨, 검증 결과 요약 |
| 코드, 브랜치, commit, tag | Git | SHA와 저장소 링크 |
| PR 검토와 CI 실행 | GitHub PR·Checks | 정본 문서 링크, SHA, 짧은 판정 |
| KRX·Kiwoom 조사 근거 | `docs/references/` | 문서 경로와 필요한 결론만 |
| DB 스키마 변경 | `supabase/migrations/` | migration 이름과 적용 환경 |
| 실제 운영 DB·RLS·Auth 상태 | Supabase 프로젝트 | migration 버전, 정책명, 검증 결과 |
| 원본 관측 메타데이터 | Supabase `source_snapshot` | `source_snapshot.id`, 상태, 해시 |
| 신호 실행 상태 | Supabase `signal_run` | `signal_run.id`, 상태, 실행 링크 |
| 비공개 원본 객체 | 확정된 private Storage | `object_path`, 해시, 접근 정책. 원문 복사 금지 |
| 수집 예약·재실행 | GitHub Actions 또는 승인된 대체 스케줄러 | workflow run ID와 결과 |
| 웹 배포·웹 rollback | 실제 연결된 배포 플랫폼 | 배포 ID, URL, commit SHA |
| Telegram 전달 결과 | Telegram과 workflow 실행 로그 | 민감정보를 뺀 성공·실패 상태 |
| 20거래일 유지·폐기 결정 | `docs/plans/ETF-signal-MVP-20-trading-day-review.md` | 경로와 최종 판정만 |
| 이 하네스의 운영 규칙 | 이 문서 | 해당 섹션 링크 |

20거래일 판정 문서는 아직 생성되지 않았다. 판정 전에는 `docs/plans/NEXT.md`의 M6 관측 항목과 `docs/guides/etf-signal-mvp-m6-observation-runbook.md`가 관측 작업과 완료 상태를 추적하고, 20개 완전 거래일을 채운 시점에 해당 판정 문서를 생성해 근거와 결정을 고정한다.

### 정본 충돌 해결 순서

1. 제품 의미가 충돌하면 MVP v2.2 계획서를 따른다.
2. 프로젝트 MUST 원칙과 구현이 충돌하면 헌장을 따른다. 헌장이 MVP 기준선을 바꾸려면 별도 계획 개정이 필요하다.
3. 구현 상세가 충돌하면 ROADMAP → 해당 마일스톤의 `docs/plans/implementation/` 계획서 → `docs/plans/NEXT.md` 순서로 확인한다.
4. 문서와 실행 결과가 다르면 Git, Supabase, GitHub Actions, 배포 플랫폼의 실제 기록을 사실로 보고 문서를 개정한다.
5. 에이전트 보고, 세션 요약, 채팅 메시지는 독립 정본이 아니다.

## 4. 피처와 의존성

| 피처 | MVP 단계 | 결과 | 선행 Gate |
| --- | --- | --- | --- |
| F1 `market-data-foundation` | 0~1단계 | 계약 probe, schema, 국내 수집, 25일 backfill | R0, R1 |
| F2 `kr-p0-signals` | 2단계 | 국내 일간·5거래일·거래대금·신규 상장 신호, Telegram | F1 데이터 적격성 |
| F3 `operations-dashboard` | 3단계 | 예약 실행, RLS, 인증 읽기 전용 대시보드 | F2 저장·표시 계약 |
| F4 `experimental-adapters` | 4~5단계 | 순설정 추정, 미국 어댑터, 20거래일 관측 | F1~F3 국내 운영 독립성 |

F1 → F2 → F3은 순차 완료한다. F4는 기능 플래그 기본값 `off`인 비차단 실험이며 F1~F3의 배포와 운영 상태를 실패로 바꿀 수 없다.

## 5. 상태 전이

```text
PLANNED
  → SPECIFIED
  → READY
  → IMPLEMENTING
  → REVIEW_REQUESTED
  → VERIFIED
  → DEPLOY_READY
  → DEPLOYED
  → OBSERVING
  → ACCEPTED | ADJUST | RETIRED
```

| 상태 | 진입 조건 | 상태 정본 | 이탈 조건 |
| --- | --- | --- | --- |
| `PLANNED` | v2.2 범위와 피처가 연결됨 | 두 계획서 | `/speckit-specify` 시작 |
| `SPECIFIED` | specify, clarify, plan, checklist 완료 | 피처 문서 | tasks 생성·분석 |
| `READY` | `/speckit-analyze` CRITICAL/HIGH 0, checklist 미완료 0 | `tasks.md`, analyze 보고 | 구현 시작 |
| `IMPLEMENTING` | worktree와 기준선 확인 | Git, `tasks.md` | 모든 태스크 `[X]` |
| `REVIEW_REQUESTED` | 대상 검증·lint·build 증거 확보 | PR | converge와 독립 리뷰 통과 |
| `VERIFIED` | 공백 0, Critical/Important 0, fresh verification 통과 | PR Checks, 리뷰 결과 | 배포 manifest 작성 |
| `DEPLOY_READY` | 웹·DB·수집 Gate가 각각 준비됨 | release manifest | 승인된 배포 실행 |
| `DEPLOYED` | 세 런타임의 실제 배포 ID와 검증 증거 확보 | 외부 서비스 기록 | 운영 관측 시작 |
| `OBSERVING` | 국내 P0가 완전 거래일을 기록 | `source_snapshot`, `signal_run` | 20개 완전 거래일 충족 |
| `ACCEPTED/ADJUST/RETIRED` | 20거래일 판정 문서 승인 | 판정 문서 | 새 버전 계획 또는 종료 |

상태는 별도 라벨 시스템을 전제하지 않는다. 실제 진행 상태는 `docs/plans/NEXT.md`, Git, 외부 실행 기록에 남기고 이 표의 이름은 인계 언어로만 사용한다. 표의 Spec Kit 단계(`SPECIFIED`·`READY`의 speckit 조건)는 보류 중이다.

## 6. 계획·개발 하네스

### Stage 1 — 착수 준비

R0 Gate에서 다음을 확인한다.

- Spec Kit 명령과 현재 Codex의 Superpowers 스킬이 실제로 호출 가능하다.
- `.specify/feature.json`의 활성 피처와 git 브랜치를 각각 확인한다.
- 테스트 러너와 단일 `npm test` 명령을 F1 `plan.md`에서 확정한다.
- 현재 `git status`, 기준 commit, linked worktree 여부를 기록한다.
- `.worktrees/` 사용 전 `git check-ignore .worktrees/example`가 성공하는지 확인한다.
- 브라우저 코드에는 `NEXT_PUBLIC_SUPABASE_URL`과 publishable key만 들어간다.

R1 Gate에서 `.specify/memory/constitution.md`를 만들고 다음을 MUST로 고정한다.

- Kiwoom/KRX 외 시장 데이터 원천 금지.
- 국내 `TRADING_COMPLETE` 이전 신호 계산 금지.
- 국내 P0와 미국 P1의 시간·실패·저장 경계 분리.
- 서비스 역할 키의 수집 작업 전용 사용과 대시보드 RLS 읽기.
- 출처 추적, TDD, 최신 검증 증거, P1 실험 표기.

### Stage 2 — 피처 명세

> 2026-09-22 보류: Spec Kit을 도입하지 않았으므로 이 단계는 새 기능 개발 재개 시 재판단한다. 현재 큰 구현 항목은 활용계획 2.2절에 따라 Superpowers `writing-plans` → `subagent-driven-development`로 실행하고 상태는 `NEXT.md`에 기록한다.

피처마다 다음 순서를 한 번씩 실행한다.

```text
speckit-specify
  → speckit-clarify
  → speckit-plan
  → speckit-checklist
  → speckit-tasks
  → speckit-analyze
```

개발은 다음 조건이 모두 충족된 피처만 시작한다.

- requirements checklist와 도메인 checklist의 미완료 항목이 0개다.
- analyze 결과가 `CRITICAL = 0`, `HIGH = 0`이다.
- 모든 MUST 요구사항에 태스크가 있고 모든 태스크에 요구사항 근거가 있다.
- 같은 파일, migration, 공유 interface 태스크는 `[P]`가 아니다.
- 국내 `bas_dd`와 미국 `observed_at`, `asof_at`, 선택적 `market_date`가 혼합되지 않는다.

### Stage 3 — 구현

기능·버그 수정은 다음 TDD 순서를 지킨다.

1. 한 가지 동작을 증명하는 실패 테스트를 작성한다.
2. 기능 부재 때문에 실패하는 RED를 직접 확인한다.
3. 테스트를 통과시키는 최소 구현을 작성한다.
4. 대상 테스트와 관련 전체 테스트의 GREEN을 확인한다.
5. 동작을 바꾸지 않는 리팩터링 후 다시 검증한다.
6. 검증 결과를 기록하고 대응 태스크를 `[X]`로 바꾼다.

버그나 예상 밖 API 응답은 `systematic-debugging`으로 원인을 재현한 뒤 수정한다. 세 번 이상 서로 다른 수정 시도가 실패하면 계약·아키텍처 재검토로 되돌린다.

병렬 구현은 `tasks.md`의 `[P]`, 파일 비경합, 의존성 없음이 모두 성립할 때만 허용한다. 한 리더가 `tasks.md` 상태와 통합 검증을 소유한다.

## 7. 리뷰 하네스

### 리뷰 순서

```text
태스크 자체 검증
  → npm test
  → npm run lint
  → npm run build
  → speckit-converge
  → 독립 코드 리뷰
  → 지적 반영
  → fresh verification
```

현재 `npm test`는 아직 없으므로 F1 Foundational 태스크에서 추가하기 전에는 lint와 build 결과, 수동 검증 공백을 사실대로 기록한다. 테스트가 필요한 기능을 테스트 러너 없이 완료 처리할 수 있다는 뜻은 아니다.

### 리뷰 책임 분리

| 역할 | 책임 | 금지 |
| --- | --- | --- |
| 구현자 | TDD, 최소 구현, 태스크 증거 | 자신의 성공 보고를 최종 승인으로 사용 |
| 요구사항 검토자 | spec/plan/tasks 추적성과 범위 확인 | 코드 스타일만 보고 요구사항 충족 판정 |
| 코드 리뷰어 | 정확성, 보안, 회귀, 유지보수성 검토 | 제품 정책을 임의 변경 |
| 검증자 | 최신 명령 출력과 수용 기준 대조 | 이전 실행 결과나 에이전트 보고만 신뢰 |
| 배포 책임자 | manifest, 환경, rollout, rollback 확인 | DB·웹·수집을 한 번에 무검증 배포 |

### 필수 리뷰 항목

- 데이터 계약: 날짜, 필수 필드, 중복 키, 상태 전이, 해시, 출처 추적.
- 계산 계약: 5거래일 `seq`, 직전 20개 완전 거래일 구간, `raw|liquid`, 신규 상장 초기화.
- 국내·미국 경계: `bas_dd` 재사용 금지, P1 실패 비차단, 기능 플래그 기본 `off`.
- 보안: 자격 증명 로그·클라이언트·fixture 유출 금지, RLS `SELECT`, private Storage.
- 운영: 429 커서 재개, `PUBLISH_PENDING`, Telegram 상태 알림, 멱등 실행.
- 범위: 총수익률·자동매매·포트폴리오·백테스트·외부 데이터 원천 추가 금지.

### 리뷰 판정

- Critical: 즉시 수정하고 전체 검증을 다시 실행한다.
- Important: 피처 종료 전에 수정하고 관련·전체 검증을 다시 실행한다.
- Minor: 기록하되 수정이 범위를 넓히면 후속 태스크로 분리한다.
- 잘못된 피드백: 코드와 정본 문서를 근거로 반박한다.
- `/speckit-converge` 공백: 기존 태스크를 바꾸지 않고 새 Convergence 태스크를 추가한 뒤 구현·검증을 반복한다.

## 8. CI Gate 목표 계약

`.github/workflows/`가 아직 없으므로 아래 표는 구현해야 할 목표 계약이다. 실제 workflow 파일과 명령이 생기면 그 파일이 실행 정의의 정본이 된다.

| Gate | 실행 내용 | 통과 기준 | 차단 대상 |
| --- | --- | --- | --- |
| Q1 Unit/Integration | `npm test` | 실패 0, 오류 출력 0 | PR 병합 |
| Q2 Lint | `npm run lint` | exit 0, ESLint error 0 | PR 병합 |
| Q3 Build | `npm run build` | exit 0, TypeScript·Next build 성공 | PR 병합 |
| Q4 Data Contract | KRX·Kiwoom fixture와 무호출 날짜 테스트 | v2.2 수용 기준 전부 통과 | F1~F4 관련 PR |
| Q5 Security | secret·client bundle·RLS 경계 검사 | 서비스 역할·API 키 노출 0 | PR 병합·배포 |
| Q6 Migration | 임시 DB에 migration 적용과 계약 질의 | 적용 성공, 예상 schema·policy 일치 | DB 배포 |
| Q7 UI Smoke | 인증·비인증 보호 경로와 P0 화면 확인 | redirect·RLS·필수 섹션 정상 | 웹 배포 |

실제 자격 증명을 쓰는 Kiwoom/KRX live probe는 일반 PR Gate에 넣지 않는다. 수동 workflow와 승인된 보안 환경에서 실행하고, 민감정보를 뺀 결과만 배포 증거에 연결한다.

## 9. 배포 하네스

### 세 런타임을 분리

| 런타임 | 배포 단위 | 정본 | 독립 복구 수단 |
| --- | --- | --- | --- |
| 데이터베이스 | Supabase migration, RLS, private Storage policy | Supabase + `supabase/migrations/` | 예약 수집 중단, forward fix, 데이터 복원 계획 |
| 웹 대시보드 | Next.js build와 배포 artifact | 연결된 웹 배포 플랫폼 | 이전 검증 배포로 rollback |
| 수집 작업 | `.github/workflows/ingest.yml` 또는 승인된 스케줄러 | 스케줄러 실행 기록 | schedule 비활성화, 수동 재실행, 실행 위치 교체 |

웹 rollback은 DB rollback이나 수집 작업 rollback을 의미하지 않는다. 세 런타임의 상태를 각각 확인한다.

### Production 전제 조건

- 웹 배포 플랫폼, Supabase 프로젝트, GitHub Environment와 승인자가 확인되었다.
- 필요한 secret 이름과 사용 주체가 manifest에 있고 실제 값은 문서에 없다.
- migration은 임시 환경에서 검증되었고 파괴적 down migration에 의존하지 않는다.
- 국내 workflow를 `workflow_dispatch`로 한 번 실행할 수 있다.
- 미국 workflow는 별도이며 기능 플래그 기본값이 `off`다.
- rollback 또는 schedule 중단 권한과 실행 절차가 확인되었다.
- 첫 Production 배포와 파괴적 DB 변경은 사람의 명시적 승인을 받는다.

### 권장 배포 순서

1. 배포 대상 commit SHA와 피처 `tasks.md` 완료 상태를 고정한다.
2. Q1~Q7의 최신 결과로 release manifest를 작성한다.
3. Supabase migration과 RLS를 적용하고 schema·policy를 질의한다.
4. 웹 Preview에서 인증, P0 표시, 서비스 역할 키 비노출을 확인한다.
5. 검증된 웹 artifact를 Production으로 승격한다.
6. 국내 수집 workflow를 수동 실행한다.
7. `source_snapshot`, `signal_run`, Telegram, 대시보드가 같은 실행을 가리키는지 확인한다.
8. 국내 예약 schedule을 활성화한다.
9. 미국 P1은 별도 배포·수동 검증 후에도 기본 `off`를 유지하고 명시적 관측 시작 시점에만 켠다.

### Release manifest

배포마다 PR 또는 배포 기록에 다음을 남긴다.

```yaml
release:
  commit_sha: <40자 Git SHA>
  feature_directory: <specs 경로>
  tasks_complete: true
  checks:
    test: <GitHub Check URL 또는 로컬 증거>
    lint: <GitHub Check URL 또는 로컬 증거>
    build: <GitHub Check URL 또는 로컬 증거>
    migration: <검증 결과 링크>
  database:
    project: <비밀이 아닌 project 식별자>
    migrations: [<적용 migration 이름>]
  web:
    platform: <실제 플랫폼>
    deployment_id: <배포 ID>
    url: <배포 URL>
  ingestion:
    scheduler: <GitHub Actions 또는 승인된 대체>
    workflow_run_id: <실행 ID>
  evidence:
    source_snapshot_ids: [<UUID>]
    signal_run_ids: [<UUID>]
    telegram_status: <sent|failed>
  rollback:
    web_target: <직전 검증 배포 ID>
    ingestion_stop: <schedule 비활성화 절차>
    database_recovery: <승인된 복구 문서 링크>
```

manifest는 secret, 토큰, 전체 API 원본, Telegram 대화 내용을 포함하지 않는다.

## 10. Rollout과 rollback

### Rollout

- 국내 수집은 수동 1회 → 예약 활성화 순서로 연다.
- 첫 실행은 `ka10099` 초기 스냅샷이며 기존 모든 ETF를 신규 상장으로 알리지 않는다.
- 최근 30일 상장 종목은 초기 요약으로만 표시한다.
- 미국 P1과 순설정 추정은 P0 아래의 실험 섹션으로만 연다.
- 배포 직후 첫 완전 거래일에 데이터 적격성, 신호 수, Telegram, 대시보드를 확인한다.

### 장애별 rollback

| 장애 | 즉시 조치 | 보존해야 할 증거 | 복구 조건 |
| --- | --- | --- | --- |
| 웹 오류·인증 회귀 | 이전 검증 웹 배포로 rollback | 배포 ID, commit SHA, 오류 로그 | Q3·Q7 재통과 |
| 잘못된 migration·RLS | 수집 schedule 중단, 쓰기 최소화, forward fix 또는 승인된 복원 | migration 이름, 영향 행, 정책 상태 | Q5·Q6 재통과 |
| KRX `PARTIAL`·`FETCH_FAIL` | 신호 계산 차단, 상태 알림, 재시도 | `source_snapshot.id`, 상태, 오류 코드 | `TRADING_COMPLETE` 확보 |
| KRX `PUBLISH_PENDING` | 신호 계산 없이 지연 재시도 | 요청일, 관측 시각, 재시도 횟수 | 공표 완료·계약 통과 |
| Kiwoom 429 | 같은 커서부터 대기 후 재개 | cursor, page count, 재시도 정보 | `cont-yn=N` 완료 |
| Telegram 실패 | 데이터 결과를 유지하고 전달만 재시도 | `signal_run.id`, 실패 상태 | 메시지 전달 확인 |
| 미국 P1 오류 | 기능 플래그 `off`, 미국 workflow 중단 | 미국 observation과 오류 | 국내와 독립 검증 통과 |
| secret 노출 의심 | 관련 secret 폐기·재발급, workflow 중단 | 노출 경로와 대응 시간. 값 자체는 기록 금지 | Q5와 권한 감사 통과 |

원본 `source_snapshot`과 성공한 `signal_run`을 rollback 과정에서 임의 삭제하지 않는다. 감사 이력 정리가 필요하면 별도 승인된 보존 정책을 따른다.

## 11. 데이터 적격성 Gate

국내 신호 계산은 다음 조건을 모두 만족한 `TRADING_COMPLETE`만 사용한다.

- `(BAS_DD, ISU_CD)` 중복 수 0.
- `BAS_DD`, `ISU_CD`, `ISU_NM`, `TDD_CLSPRC`, `NAV`, `ACC_TRDVOL`, `ACC_TRDVAL` 완전성 100%.
- 예상 행 수가 직전 유효 KRX ETF 행 수의 98% 이상이거나 저장된 수동 예외가 종목군 변화를 설명함.
- 모든 `BAS_DD`가 요청 `basDd`와 일치함.
- 잘못된 달력 날짜는 외부 요청 전에 거부됨.

상태별 후속 동작은 고정한다.

| 상태 | 저장 | 신호 계산 | 알림 |
| --- | --- | --- | --- |
| `TRADING_COMPLETE` | 정규화 데이터와 메타데이터 | 허용 | 성공 또는 경고 포함 상태 |
| `NON_TRADING` | 달력·메타데이터 | 금지 | 비거래일 정책에 따른 상태 |
| `PUBLISH_PENDING` | 메타데이터 | 금지 | 보류와 재시도 예정 |
| `PARTIAL` | 메타데이터만 | 금지 | 데이터 불완전 경고 |
| `FETCH_FAIL` | 실패 메타데이터 | 금지 | 명시적 실패 |
| `duplicate_observation` | 관측 행과 기준 참조 | 새 신호 금지 | 중복 정책에 따른 상태 |

강한 항등 감시와 보조 감시는 구분한다.

- `LIST_SHRS * TDD_CLSPRC ~= MKTCAP`: 1% 오차 이내 통과율이 99% 미만이면 경고.
- `LIST_SHRS * NAV ~= INVSTASST_NETASST_TOTAMT`: 1%·2%·3%·5% 분포를 기록하고 3% 이내 95% 미만 또는 5% 이내 98% 미만이면 경고. `TRADING_COMPLETE` 차단용 강한 관문으로 쓰지 않는다.
- `ACC_TRDVAL / ACC_TRDVOL`: 거래량이 0이 아닌 행은 문서화된 이상치를 제외하고 `TDD_LWPRC..TDD_HGPRC` 범위인지 감시.

## 12. 세션·PR·배포 체크리스트

### 세션 시작

- [ ] 두 기준 계획서와 활성 피처의 spec/plan/tasks를 읽었다.
- [ ] `.specify/feature.json`과 현재 git 브랜치를 각각 확인했다.
- [ ] `git status`에서 사용자 변경과 이번 작업 범위를 구분했다.
- [ ] 현재 구현 단계의 선행 Gate와 외부 서비스 확인 상태를 확인했다.
- [ ] secret을 출력하거나 문서·fixture에 복사하지 않았다.

### PR 요청 전

- [ ] 모든 변경 태스크가 `[X]`이고 요구사항 ID와 연결된다.
- [ ] RED → GREEN 증거와 대상 테스트 결과가 있다.
- [ ] `npm test`, `npm run lint`, `npm run build` 최신 결과가 있다.
- [ ] `/speckit-converge`의 `missing|partial|contradicts|unrequested` 공백이 없다.
- [ ] migration, 환경 변수, workflow, UI 변경의 배포 영향을 PR에 썼다.
- [ ] UI 변경에는 인증·비인증 상태의 검증 이미지 또는 browser smoke 결과가 있다.

### 병합 전 독립 검증

- [ ] Critical과 Important 리뷰 항목이 0개다.
- [ ] 검증자가 diff, 수용 기준, 명령 전체 출력을 직접 확인했다.
- [ ] 국내·미국 경계와 서비스 역할 키 경계를 확인했다.
- [ ] PR의 commit SHA와 검증한 SHA가 같다.

### Production 전

- [ ] release manifest의 웹·DB·수집 항목이 모두 실제 ID를 가진다.
- [ ] rollback 대상과 schedule 중단 절차를 실행할 권한이 있다.
- [ ] Supabase migration·RLS와 웹 Preview를 각각 검증했다.
- [ ] 국내 `workflow_dispatch`의 live probe가 성공했다.
- [ ] 미국 기능 플래그는 기본 `off`다.
- [ ] 첫 Production 또는 파괴적 변경의 사람 승인이 기록되었다.

### 배포 직후

- [ ] 배포한 commit SHA와 웹 배포 SHA가 같다.
- [ ] 인증 사용자만 대시보드를 읽을 수 있다.
- [ ] 국내 수집이 `source_snapshot`과 `signal_run`을 만들었다.
- [ ] Telegram 상태와 대시보드 최신 실행이 같은 run을 가리킨다.
- [ ] secret, 원본 응답, 서비스 역할 키가 로그·클라이언트에 없다.
- [ ] 실패 시 schedule 중단 또는 웹 rollback을 실행할 수 있다.

### 완전 거래일 20일 후

- [ ] 일간 신호 수, 검증 경고 수, KRX/Kiwoom 불일치 코드 수를 집계했다.
- [ ] 가능한 경우 사용자가 열어 본 조사 건수를 집계했고 미수집을 0으로 추정하지 않았다.
- [ ] 거래대금 급증 결과가 반복해서 50개 초과 또는 항상 0인지 확인했다.
- [ ] 순설정 추정을 `승격|실험 유지|제거` 중 하나로 판정했다.
- [ ] 미국 어댑터의 대시보드 제공 여부를 판정했다.
- [ ] 판정을 `docs/plans/ETF-signal-MVP-20-trading-day-review.md`에 근거와 함께 기록했다.
- [ ] P0 유용성 입증 전 포트폴리오·백테스트를 시작하지 않았다.

## 13. 변경·개정 규칙

- MVP 범위나 정책값 변경은 새 계획 버전에서 승인한다. 이 하네스나 PR 설명에서 제품 계약을 바꾸지 않는다.
- `/speckit-converge`는 기존 요구사항을 덮어쓰지 않고 `tasks.md`에 수렴 태스크만 추가한다.
- 웹 배포 플랫폼, 스케줄러, private Storage가 확정되면 실제 이름·검증 명령·rollback 절차를 이 문서에 반영한다.
- 과거 release manifest와 실행 증거는 수정하지 않는다. 정정은 새 기록에서 이전 기록을 참조한다.
- 외부 서비스 접근 실패는 제품 상태가 아니다. `미확인` 또는 `검증 실패`로 기록하고 성공을 추정하지 않는다.
- 이 문서와 현실이 다르면 현실의 증거를 보존하고 하네스를 새 버전으로 개정한다.

## 14. 최초 활성화 순서

1. R0에서 Spec Kit, 테스트 러너, worktree, secret 경계를 확정한다.
2. R1 헌장을 생성한다.
3. F1~F4 피처 디렉터리를 순서대로 만들되 F1부터 명세·분석·구현한다.
4. 테스트와 CI Q1~Q6을 F1에서 먼저 구성한다.
5. F2 국내 P0를 구현하고 데이터 적격성 Gate로 닫는다.
6. F3에서 Q7, 웹 Preview, RLS, 수동 국내 workflow를 검증한다.
7. 첫 Production은 웹·DB·수집 세 Gate와 사람 승인을 모두 통과한 뒤 수행한다.
8. F4는 국내 운영과 분리해 배포하고 20개 완전 거래일을 관측한다.

## 15. Production build 검증 기록

2026-09-18 KST에 Node `22.23.2`와 공식 Webpack 경로로 production build를 검증했다.

- `.nvmrc`로 Node `22.23.2`를 고정하고 `package.json`의 build 명령을 `next build --webpack`으로 변경했다.
- `npm run build`, `npm test`(24개), `npx tsc --noEmit`, `npm run lint`가 모두 통과했다.
- Turbopack은 이 실행 환경에서 Google Fonts 네트워크 및 프로세스·포트 생성 권한 제약을 받으므로, 표준 품질 게이트는 Webpack build를 사용한다.

`typescript.ignoreBuildErrors`로 검사를 생략하거나 build 실패 상태에서 배포를 진행하지 않는다.

## 16. 관련 문서

- 제품 범위와 수용 기준: `docs/plans/ETF-signal-MVP-plan-v2.2.md`
- Spec Kit + Superpowers 실행 흐름: `docs/plans/ETF-signal-MVP-v2.2-Spec-Kit-Superpowers-개발흐름-활용계획.md`
- KRX 실측 근거: `docs/references/krx_api_report.md`
- Kiwoom 실측 근거: `docs/references/kiwoom_api_report.md`
- 저장소 작업 규칙: `AGENTS.md`
- 벤치마크 원본: `docs/guides/one-fact-one-home.md`
