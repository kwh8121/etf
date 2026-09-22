# ETF 신호 MVP v2.2 Spec Kit + Superpowers 개발 흐름 활용계획

> 작성일: 2026-09-17 KST
> 제품 기준선: `docs/plans/ETF-signal-MVP-plan-v2.2.md`
> 참고 자료: `docs/references/Spec Kit 레퍼런스-Codex.md`, `docs/references/Superpowers 스킬 요약-Codex.md`, `docs/references/Codex에서 Spec Kit + Superpowers 병행 운영 가이드.md`
> 목적: 승인된 MVP v2.2를 요구사항 추적성, 테스트 우선 구현, 독립 검토, 최신 검증 증거가 끊기지 않는 흐름으로 개발한다.
> 적용 범위: 구현 착수 준비부터 국내 P0, 예약 실행·대시보드, 격리된 P1 관측, 완전 거래일 20일 후 판정까지.

> **2026-09-22 개정 — 실행 원장 공식화(사용자 결정):** Spec Kit 작업 공간(`.specify/`, `specs/`, `tasks.md`)은 생성되지 않았고, M0–M5는 ROADMAP과 `docs/plans/implementation/` 계획서로 진행했다. 따라서 **다음 작업·순서·완료 상태의 정본(실행 원장)은 `docs/plans/NEXT.md`**로 하고, Superpowers는 품질 게이트로 유지한다. 현재 규정은 2.1~2.2절이다. 이 문서의 Spec Kit 전제(1장의 Spec Kit 목표·종료 조건 1·2·5, 4장 Gate R0·R1의 Spec Kit 항목, 5~6장, 7.2의 `/speckit-implement`, 9장 Gate V3)는 새 기능 개발을 재개할 때 도입 여부를 다시 판단할 때까지 **보류**한다.

## 1. 목표 결과와 종료 조건

이 계획의 목표는 두 도구 체계를 중복 없이 결합해 다음 결과를 만드는 것이다.

- Spec Kit이 제품 요구사항, 기술 설계, 실행 태스크와 요구사항 추적의 정본을 관리한다.
- Superpowers가 격리된 작업 공간, TDD, 체계적 디버깅, 코드 리뷰, 완료 검증을 강제한다.
- 국내 P0 파이프라인은 미국 P1 어댑터와 실패·시간·저장 경계가 분리된다.
- 모든 구현은 MVP v2.2의 수용 기준과 연결되고 최신 명령 출력으로 검증된다.
- 완전 거래일 20일 전에는 P1 승격, 임계값 조정, 포트폴리오·백테스트 확장을 시작하지 않는다.

개발 흐름의 최종 종료 조건은 다음과 같다.

1. Spec Kit의 `spec.md`, `plan.md`, `tasks.md`와 구현 코드 사이에 CRITICAL/HIGH 공백이 없다.
2. 모든 필수 태스크가 `tasks.md`에서 `[X]`이고, 미완료 체크리스트가 없다.
3. 관련 테스트, `npm run lint`, `npm run build`를 새로 실행해 모두 통과했다.
4. 독립 코드 리뷰의 Critical·Important 지적이 모두 해소되었다.
5. `/speckit-converge`가 추가한 수렴 태스크까지 구현·재검증되었거나, 추가 태스크 없이 `✅ Converged`가 확인되었다.
6. P0 운영 준비 증거와 P1의 비차단 경계가 기록되었다. 20거래일 관측과 유지·폐기 판정은 후속 운영 단계로 명시적으로 인계되었다.

## 2. 핵심 운영 결정

### 2.1 실행 원장은 `NEXT.md`, 품질 게이트는 Superpowers (2026-09-22 개정)

| 사실 또는 활동 | 유일한 정본/도구 | 다른 문서에 허용하는 내용 |
| --- | --- | --- |
| 승인된 MVP 범위·정책값·수용 기준 | `docs/plans/ETF-signal-MVP-plan-v2.2.md` | 경로와 요구사항 ID |
| 마일스톤·종료 기준 | `docs/plans/ETF-signal-MVP-v2.2-ROADMAP.md` | 마일스톤 ID와 링크 |
| 마일스톤별 기술 설계·데이터 계약 | `docs/plans/implementation/<마일스톤>-*.md` | 결정과 링크 |
| **다음 작업·순서·완료 상태(실행 원장)** | **`docs/plans/NEXT.md`** | Q-ID, 라벨, 검증 요약 |
| 실행 규칙(턴 종료·상시 승인·중단 기준) | `AGENTS.md`, `docs/guides/etf-signal-mvp-continuity-harness.md` | 해당 절 링크 |
| 코드와 변경 이력 | Git | commit SHA와 PR 링크 |
| 큰 구현 항목의 작업 계획·리뷰 패키지 | Superpowers 산출물(해당 Q 항목의 작업용) | `NEXT.md` Q-ID와 결과만 |
| 외부 API 조사 근거 | `docs/references/` | 경로와 결론 요약 |

`NEXT.md` 외의 문서는 큐의 라벨·순서를 복제하지 않고 기준 시각과 `NEXT.md` 링크만 둔다. Linear는 실행 상태 추적 표면이며 완료 원장이 아니다.

### 2.2 실행 원장은 하나만 사용 (2026-09-22 개정)

다음 작업과 완료 상태는 `NEXT.md` 하나가 관리한다. Superpowers `subagent-driven-development`·`executing-plans`의 작업 원장, OMX `$team`, Linear를 두 번째 완료 원장으로 쓰지 않는다.

- **기본 실행:** `AGENTS.md`의 "턴 종료 규칙과 상시 승인"에 따라 `NEXT.md`의 `AUTO` 항목을 위에서부터 실행한다. 여러 턴에 걸친 지속은 Codex `/goal`을 쓴다.
- **작은 `AUTO` 항목:** 기본 개발 루프(TDD → 구현 → 포맷 → 테스트 → lint/build → 리뷰 → 기록 → 원자적 커밋·푸시)로 처리하고 `NEXT.md`에서 `DONE`으로 옮긴다.
- **큰 `AUTO` 구현 항목**(여러 파일·여러 단계): Superpowers `writing-plans`로 해당 항목의 작업 계획을 `docs/plans/implementation/`에 쓰고 `NEXT.md` 항목에서 링크한다. 이어서 `subagent-driven-development`로 태스크 사이에 멈추지 않고 실행한 뒤 `requesting-code-review`·`verification-before-completion`으로 마감한다. 작업 계획의 체크박스는 작업 메모이며, 완료 판정과 상태는 `NEXT.md`에만 기록한다.
- **`finishing-a-development-branch`:** 브랜치·PR 흐름을 쓸 때만 적용한다. 상시 승인된 `main` 원자적 커밋·푸시 흐름에서는 병합 선택지를 제시하고 기다리지 않는다.
- **병렬 보조:** 읽기 전용 조사, 독립 리뷰, 서로 다른 테스트 실패 분석에만 native subagent 또는 `dispatching-parallel-agents`를 사용한다. 구현을 병렬로 나눌 때도 한 리더가 `NEXT.md` 상태 갱신과 통합 검증을 소유한다.
- tmux 기반 OMX `$team`은 Codex App 외부의 attached-tmux OMX CLI에서 별도로 선택한 경우에만 사용한다. 현재 App 환경의 기본 경로로 가정하지 않는다.
- **Spec Kit 재판단 조건:** M5-A 같은 새 기능 개발을 재개하면서 요구사항 추적성(spec → plan → tasks)이 필요해질 때 도입 여부를 다시 결정한다. 도입하더라도 실행 원장은 하나만 둔다.

### 2.3 이미 승인된 기획을 다시 설계하지 않음

MVP v2.2는 기획자 작성, 아키텍트 승인, 비평가 승인을 통과했다. 따라서 제품 아이디어를 처음부터 `brainstorming`으로 되돌리지 않는다. Spec Kit의 `specify`는 v2.2의 WHAT/WHY를 정규화하고 추적 ID를 부여하는 작업이며, 범위를 재협상하는 단계가 아니다.

다만 다음 항목은 구현 전 `clarify` 또는 `plan`에서 정확한 계약으로 잠근다.

- 비공개 원본 객체 저장 위치와 접근 정책
- 테스트 러너, `npm test` 또는 동등한 단일 검증 명령
- 미국 어댑터 기능 플래그 이름과 기본값 `off`
- Telegram 메시지 분할·요약 규칙
- GitHub Actions에서 KRX 통신이 차단될 때 사용할 대체 실행 위치

## 3. 권장 전체 흐름

```text
[준비]
도구 가용성 확인 → constitution 1회 → 피처 분해
  ↓
[피처별 명세]
specify → clarify → plan → checklist → tasks → analyze
  ↓                                     ↑ 문제 수정 후 재검사
[피처별 구현]
worktree 확인 → speckit-implement
                  ├─ 기능/수정: TDD RED → GREEN → REFACTOR
                  ├─ 실패: systematic-debugging → TDD
                  └─ [P]: 비경합 태스크만 병렬화
  ↓
[피처별 검증]
targeted tests → lint → build → converge
                   ↑ 공백 태스크 추가 시 implement 재실행
  ↓
독립 code review → 지적 반영 → fresh verification
  ↓
finishing-a-development-branch
  ↓
[운영 관측]
P0 운영 → 완전 거래일 20일 관측 → P1 유지·폐기·조정 판정
```

## 4. 착수 전 준비 게이트

현재 저장소에는 `.specify/`가 없고 `package.json`에도 자동 테스트 명령이 없다. 소스는 Next.js 16·React 19·Supabase SSR 시작 템플릿 상태이며, 계획된 시장 데이터 파이프라인은 아직 구현되지 않았다. 따라서 다음 준비가 완료되기 전 제품 코드를 작성하지 않는다.

### Gate R0 — 도구와 저장소 상태 확인

- [ ] Spec Kit 명령 또는 동등한 설치 표면이 실제 환경에서 호출 가능한지 확인한다.
- [ ] `.specify/feature.json`의 활성 피처가 git 브랜치와 별개라는 점을 실행자에게 명시한다.
- [ ] Superpowers 스킬 이름과 현재 Codex 도구 표면을 확인한다. 참고 문서의 Claude Code CLI 문법을 그대로 사용할 수 있다고 가정하지 않는다.
- [ ] `git status`, 현재 브랜치/워크트리, 기준 커밋을 기록한다.
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, publishable key 외의 비밀정보가 브라우저 코드에 들어가지 않는지 현재 경계를 확인한다.
- [ ] 테스트 러너와 단일 실행 명령을 `plan.md`에 확정하고, 첫 Foundational 태스크에서 `package.json`에 연결한다.

**중단 조건:** Spec Kit 활성 피처를 판별할 수 없거나 테스트 명령이 확정되지 않으면 구현 태스크를 시작하지 않는다.

### Gate R1 — 헌장 생성

최초 한 번 `/speckit-constitution`을 실행해 다음 MUST 원칙을 고정한다.

1. 시장 데이터 원천은 Kiwoom과 KRX로 제한한다.
2. `TRADING_COMPLETE`가 아닌 국내 스냅샷은 신호 계산을 차단한다.
3. 국내 P0와 미국 P1은 시간 의미, 워크플로, 실패 영향, 저장 경계를 분리한다.
4. 모든 관측은 `observation_key`, API ID, 행 수, 페이지 수, SHA-256, 변환 버전과 날짜·시각으로 재현 가능해야 한다.
5. 서비스 역할 키는 수집 작업 전용이며 대시보드는 인증된 Supabase SSR 클라이언트와 RLS `SELECT`만 사용한다.
6. 비밀정보와 전체 원본 응답은 Git·로그·클라이언트 번들에 저장하지 않는다.
7. 기능·버그 수정은 실패 테스트를 먼저 확인하는 TDD를 따른다.
8. 완료 주장은 새로 실행한 테스트·lint·build 증거가 있을 때만 한다.
9. P1 결과는 실험 항목이며 자동매매·매수 추천으로 표현하지 않는다.

**검증:** 헌장에 미치환 자리표시자가 없고 SemVer, 채택일·수정일, Sync Impact Report가 완전해야 한다.

## 5. 피처 분해와 의존성

하나의 거대한 피처로 만들지 않고 다음 네 피처로 분리한다. `/speckit-specify`는 호출 한 번에 피처 하나만 생성한다.

| 순서 | 권장 short-name | MVP v2.2 범위 | 선행 조건 | 독립 완료 결과 |
| --- | --- | --- | --- | --- |
| F1 | `market-data-foundation` | 0단계와 1단계 | R0, R1 | 계약 검증, 스키마, 국내 수집, 25일 backfill |
| F2 | `kr-p0-signals` | 2단계 | F1의 `TRADING_COMPLETE` 데이터 25일 | 국내 P0 신호와 Telegram 보고서 |
| F3 | `operations-dashboard` | 3단계 | F2 저장 결과 | 예약 실행, RLS, 인증 읽기 전용 대시보드 |
| F4 | `experimental-adapters` | 4단계와 5단계 | F3의 국내 P0 독립 운영 | 순설정·미국 어댑터, 20거래일 관측과 판정 자료 |

F4는 F1~F3의 완료를 막지 않는다. 미국 API 계약 probe는 F1에서 기능 플래그가 켜진 경우 수행할 수 있지만, 미국 신호 저장·워크플로 구현은 F4에 둔다.

## 6. 각 피처의 Spec Kit 명세 절차

다음 절차는 F1~F4마다 한 번씩 순차 실행한다. 한 스킬의 산출물을 검토한 뒤 다음 스킬로 이동한다.

### 6.1 `/speckit-specify` — WHAT/WHY 정규화

- v2.2에서 해당 피처의 포함 범위, 제외 범위, 사용자 가치, 기술 중립 성공 기준만 옮긴다.
- Next.js, Supabase, 테이블명, API 구현 방식은 `spec.md`에 넣지 않고 `plan.md`에서 다룬다.
- 성공 기준에는 측정 가능한 결과를 사용한다. 예: “모든 유효 행의 날짜가 요청일과 일치한다”, “중복 키 수가 0이다”, “P1 실패가 국내 실행 상태를 바꾸지 않는다.”
- TDD가 선택 사항으로 빠지지 않도록 “기능·버그 수정에는 자동 회귀 검증이 필요하다”를 요구사항으로 포함한다.
- `checklists/requirements.md` 검증을 최대 3회 수행하고 남은 모호성은 숨기지 않는다.

**산출물:** `spec.md`, `checklists/requirements.md`, 갱신된 `.specify/feature.json`.

### 6.2 `/speckit-clarify` — 구현을 바꾸는 모호성만 해소

질문은 최대 5개이며 한 번에 하나씩 처리한다. 피처별 우선 질문은 다음과 같다.

- F1: 원본 객체 저장소와 보존·접근 정책, 스케줄러 대체 위치의 허용 범위.
- F2: Telegram 길이 초과 시 분할 순서와 필수 메타데이터 유지 규칙.
- F3: 대시보드 사용자 범위와 RLS 읽기 정책의 최소 권한.
- F4: 기능 플래그 이름·기본값 `off`, 20거래일 유용성 판정 기록 방식.

각 답은 `## Clarifications`에 기록하고 관련 요구사항을 즉시 갱신한다. 답이 없는 항목을 구현자가 임의로 결정하지 않는다.

### 6.3 `/speckit-plan` — 기술 설계 확정

`plan.md`에는 다음을 정확히 고정한다.

- Next.js 16 App Router, TypeScript strict, Supabase SSR/Postgres/RLS.
- KRX `etf_bydd_trd`와 Kiwoom API별 요청·응답 계약.
- 국내 상태 `TRADING_COMPLETE`, `NON_TRADING`, `PUBLISH_PENDING`, `PARTIAL`, `FETCH_FAIL`.
- 미국 `duplicate_observation`, `observation_key`, `duplicate_of_snapshot_id`, `observed_at`, `asof_at`, 선택적 `market_date` 계약.
- `signal_daily.screen = 'raw' | 'liquid'`를 포함한 키와 인터페이스.
- 테스트 러너, fixture 위치, 외부 통신 없는 단위 테스트, 자격 증명 마스킹 방식.
- 기능 플래그와 국내·미국 워크플로 분리.
- 최신 Next.js·Supabase·외부 API 동작이 구현에 영향을 주면 Context7 또는 공식 문서 조사를 `research.md`에 출처와 함께 기록한다.

Phase 0의 모든 기술 미확정을 `research.md`에서 해소한 뒤 `data-model.md`, `contracts/`, 실행 가능한 `quickstart.md`를 생성한다. 설계 후 Constitution Check를 다시 통과해야 한다.

### 6.4 `/speckit-checklist` — 요구사항 품질 게이트

최소 체크리스트는 피처에 맞춰 다음 도메인으로 만든다.

- `data-contract`: 날짜, 필수 필드, 키, 완전성, 상태 전이, 해시 중복 제거.
- `security`: 자격 증명 범위, 로그 마스킹, RLS, 비공개 원본 접근.
- `operations`: 재시도, 429 커서 재개, 상태 알림, 스케줄러 실패 격리.
- `experiment`: P1 표기, 기능 플래그, 20거래일 전 조정 금지, 유지·폐기 기준.

체크리스트는 구현 동작 테스트가 아니라 요구사항의 완전성·명확성·일관성을 검사한다. 미완료 항목이 하나라도 있으면 `/speckit-implement`의 “그대로 진행” 예외를 사용하지 않고 명세를 고친다.

### 6.5 `/speckit-tasks` — 추적 가능한 실행 단위 생성

호출 인자에 다음 제약을 명시한다.

```text
TDD 필수. 각 기능 태스크는 실패 테스트 작성과 실패 확인을 구현보다 앞에 둔다.
모든 태스크에 정확한 파일 경로와 대응 요구사항 ID를 기록한다.
같은 파일, migration 순서, 공유 인터페이스를 건드리는 태스크에는 [P]를 붙이지 않는다.
국내 P0를 먼저 완성하고 미국 P1은 별도 단계와 파일 경계로 둔다.
각 사용자 스토리는 독립적으로 검증 가능한 결과로 끝낸다.
```

태스크 단계는 Setup → Foundational → 우선순위별 사용자 스토리 → Final Polish 순서를 지킨다. 테스트 러너 설정은 별도 장식 태스크가 아니라 첫 검증 가능 산출물을 만드는 Foundational 태스크에 포함한다.

### 6.6 `/speckit-analyze` — 구현 전 교차 점검

다음 지표가 충족될 때까지 spec/plan/tasks를 수정하고 analyze를 다시 실행한다.

- CRITICAL = 0, HIGH = 0.
- 모든 MUST 요구사항에 하나 이상의 태스크가 있다.
- 모든 태스크가 요구사항 또는 명시된 운영 필요와 연결된다.
- 국내 `bas_dd`와 미국 시간 필드가 섞이지 않는다.
- F4 실패가 F1~F3 상태를 변경하는 태스크가 없다.
- 테스트, 비밀정보 경계, 중복 관측, 초기 신규 상장 억제, 20거래일 판정에 커버리지 공백이 없다.

## 7. 피처별 구현 흐름

### 7.1 격리된 작업 공간

각 피처 구현 전 `using-git-worktrees` 절차로 현재 환경을 확인한다.

1. `git rev-parse --git-dir`와 `git rev-parse --git-common-dir`로 기존 linked worktree 여부를 확인한다.
2. 격리되지 않았다면 `git check-ignore .worktrees/example`로 `.worktrees/`의 ignore 상태를 확인한다. 현재처럼 ignore되지 않은 경우 `.gitignore`에 `.worktrees/`를 추가하고 그 변경을 별도 커밋한 뒤 피처별 브랜치와 작업 공간을 만든다.
3. 생성한 worktree 경로가 저장소 내부의 `.worktrees/<branch>`인지 확인하고 다른 사용자 소유 경로를 재사용하지 않는다.
4. 의존성을 설치하고 변경 전 기준선에서 `npm run lint`, `npm run build`를 실행한다.
5. 기준선 실패가 있으면 제품 변경과 분리해 기록하고 원인을 확정한 뒤 진행한다.

### 7.2 `/speckit-implement` + `test-driven-development`

각 기능 태스크는 Superpowers의 `test-driven-development`를 적용해 다음 순서를 지킨다.

1. 대응 요구사항과 정확한 실패 조건을 읽는다.
2. 한 가지 동작을 증명하는 테스트를 작성한다.
3. 테스트를 실행해 기능 부재 때문에 실패하는지 확인한다. 구문 오류나 fixture 오류는 RED 증거가 아니다.
4. 테스트를 통과시키는 최소 구현만 작성한다.
5. 대상 테스트와 관련 전체 테스트를 실행해 GREEN과 깨끗한 출력을 확인한다.
6. 동작을 바꾸지 않는 범위에서만 리팩터링하고 다시 테스트한다.
7. 태스크의 검증 명령과 결과를 기록하고 `tasks.md`를 `[X]`로 갱신한다.

마이그레이션과 GitHub Actions처럼 단위 테스트만으로 충분하지 않은 변경은 정적 검사, 임시 로컬 DB 검증, workflow 문법 검사, 모의 실행을 태스크에 명시한다. 검증 수단 없이 완료 처리하지 않는다.

### 7.3 실패 시 `systematic-debugging`

버그, 테스트 실패, 예상 밖 API 응답에는 바로 수정안을 덧대지 않는다.

1. 오류·스택·응답 메타데이터를 완독하고 재현한다.
2. 정상 동작하는 유사 경로와 차이를 모두 나열한다.
3. 단일 원인 가설을 세우고 한 변수만 바꿔 검증한다.
4. 원인을 재현하는 실패 테스트를 만든 뒤 최소 수정한다.
5. 세 번 이상 서로 다른 수정 시도가 실패하면 태스크를 멈추고 데이터 계약이나 아키텍처를 재검토한다.

### 7.4 병렬 실행 규칙

다음 조건을 모두 만족할 때만 병렬화한다.

- `tasks.md`에 `[P]`가 있다.
- 같은 파일, migration, DB 스키마, 타입, fixture, 환경 변수를 공유하지 않는다.
- 한 태스크의 출력이 다른 태스크의 입력이 아니다.
- 각 작업자의 범위, 금지 파일, 기대 결과가 명확하다.

권장 병렬 작업은 공식 문서 조사, 서로 다른 fixture 제작, 독립 읽기 전용 리뷰, 원인이 독립된 테스트 실패 분석이다. 스키마와 타입 경계가 확정되기 전의 수집기·신호·대시보드 동시 구현은 금지한다.

## 8. MVP 단계별 적용표

| MVP 단계 | Spec Kit 중심 산출물 | Superpowers 적용 | 통과 증거 |
| --- | --- | --- | --- |
| 0. 계약 검증 | F1 contracts, quickstart, probe 태스크 | TDD, systematic-debugging | 유효 거래일 2개, 비거래일 1개, `20260230` 무호출 거부, `ka10099` 검증 |
| 1. 국내 수집·저장 | F1 data-model, migration·parser·ingest 태스크 | TDD, 독립 schema/security review | `TRADING_COMPLETE` 계약, 25일 적재, 중복 0, 필수 필드 100% |
| 2. 국내 P0 | F2 signal contracts, formatter 태스크 | TDD, fixture 병렬 제작, code review | 일간·5일·거래대금·신규 상장 테스트와 필수 문구 |
| 3. 예약·대시보드 | F3 workflow, RLS, UI 태스크 | TDD 가능한 경계, 보안 리뷰, browser smoke | 수동 workflow, Telegram, RLS 인증 읽기, 서비스 역할 키 미노출 |
| 4. P1 관측 | F4 feature flag, US contracts, experiment checklist | 국내와 분리된 TDD·리뷰 | 미국 실패 비차단, 해시 중복 제거, `bas_dd=null`, 실험 표기 |
| 5. 유지·폐기 판정 | F4 관측·판정 태스크 | verification-before-completion | 완전 거래일 20일 기록과 유지/제거/조정 근거 |

## 9. 검증·리뷰·수렴 순서

피처마다 다음 순서를 고정한다.

### Gate V1 — 대상 검증

- 변경한 parser, 계산, 저장 계약, formatter의 대상 테스트.
- 외부 통신 없는 날짜·누락·중복·경계 fixture 테스트.
- 마이그레이션 또는 RLS 변경의 로컬 검증.

### Gate V2 — 저장소 검증

```bash
npm test
npm run lint
npm run build
```

`npm test`의 정확한 스크립트는 F1의 기술 계획에서 확정한다. 명령 일부만 실행하고 전체 통과를 주장하지 않는다.

### Gate V3 — `/speckit-converge`

코드를 diff만으로 보지 않고 spec/plan/tasks 전체와 대조한다.

- `missing`: 요구사항은 있으나 구현이 없음.
- `partial`: 일부 조건만 구현됨.
- `contradicts`: 구현이 계약과 반대임.
- `unrequested`: 승인되지 않은 범위가 추가됨.

공백이 있으면 `tasks.md` 끝의 새 Convergence 단계만 추가하고 기존 태스크를 재작성하지 않는다. 추가 태스크는 `/speckit-implement`로 실행한 뒤 V1~V3을 반복한다.

### Gate V4 — 독립 코드 리뷰

`requesting-code-review` 절차로 정제된 요구사항, 기준 SHA, 현재 SHA를 리뷰어에게 제공한다. 리뷰 범위는 구현 품질, 보안, 회귀, 데이터 경계이며 Spec Kit 정본을 재작성하지 않는다.

- Critical: 즉시 수정 후 전체 재검증.
- Important: 피처 종료 전 수정 후 관련·전체 검증.
- Minor: 명시적으로 기록하고 범위를 늘리지 않는 선에서 처리.
- 기술적으로 맞지 않는 피드백: `receiving-code-review` 순서로 코드와 계약을 대조하고 근거를 남겨 반박한다.

### Gate V5 — 완료 검증

완료 메시지를 쓰기 직전에 V1·V2의 전체 명령을 새로 실행하고 exit code와 실패 수를 읽는다. 서브에이전트의 “완료” 보고만으로 통과를 선언하지 않는다. `git diff`와 `tasks.md` 상태를 직접 대조한다.

## 10. 피처별 상세 통과 기준

### F1 `market-data-foundation`

- 잘못된 달력 날짜는 HTTP 요청 전에 거부된다.
- KRX 유효 거래일 2개와 달력상 유효한 비거래일 1개가 구분된다.
- 날짜 일치, 중복 0, 필수 필드 100%, 직전 유효 행 수 대비 98% 포괄 범위를 통과한 경우만 `TRADING_COMPLETE`이다.
- `ka10099(mrkt_tp=8)`의 `regDay`와 `first_seen`이 분리된다.
- 최초 운영 스냅샷은 기존 전 종목을 신규 상장 이벤트로 만들지 않는다.
- `ka40004`는 `cont-yn=N`까지 조회하고 429 후 같은 커서에서 재개한다.
- `source_snapshot`의 출처 추적 필드가 완전하다.
- 강한 항등 감시는 `LIST_SHRS * TDD_CLSPRC ~= MKTCAP`이며 1% 오차 이내 통과율이 99% 미만이면 경고한다.
- 보조 분포 감시는 `LIST_SHRS * NAV ~= INVSTASST_NETASST_TOTAMT`의 1%·2%·3%·5% 오차별 통과율을 기록하고, 3% 이내가 95% 미만이거나 5% 이내가 98% 미만일 때 경고한다. 이 보조 감시는 `TRADING_COMPLETE`를 차단하는 강한 관문으로 사용하지 않는다.
- 거래량이 0이 아닌 행의 `ACC_TRDVAL / ACC_TRDVOL`이 문서화된 이상치를 제외하고 `TDD_LWPRC..TDD_HGPRC` 범위에 있는지 감시한다.
- KRX/Kiwoom 종목 코드 교집합의 개수와 불일치 코드를 매일 기록하며 숫자형 코드만으로 대응 관계를 추론하지 않는다.

### F2 `kr-p0-signals`

- 일간 상승·하락은 KRX `FLUC_RT` 기준이다.
- 5거래일 수익률은 연속 `seq`와 양 끝점이 있을 때만 계산한다.
- 직전 20일 거래대금 평균에 현재일이 포함되지 않는다.
- `raw`와 `liquid` 결과가 같은 실행에서 공존한다.
- 신규 상장은 `reg_day`, `first_seen`, `new_in_snapshot`, `first_alerted_at`을 구분한다.
- 가격수익률 결과에 총수익률이 아니라는 필수 문구가 있다.
- Telegram 길이 제한에서도 상태와 재현 메타데이터가 유실되지 않는다.

### F3 `operations-dashboard`

- 평일 예약 실행과 `workflow_dispatch`가 모두 있다.
- 모든 예약 실행이 상태 알림 또는 명시적 실패 메시지를 보낸다.
- 대시보드는 인증 사용자의 JWT와 RLS `SELECT`로만 읽는다.
- 서비스 역할 키가 프런트엔드 코드, 번들, 로그에 없다.
- 최근 실행, 국내 등락, 거래대금 급증, 신규 상장, 검증 경고가 표시된다.
- GitHub Actions에서 KRX 통신이 불가능하면 실행 위치만 교체되고 스키마·신호·대시보드 계약은 유지된다.

### F4 `experimental-adapters`

- 순설정은 “추정 순설정·환매, 실험 항목이며 LP 보유분이 포함될 수 있음”으로 표시된다.
- 미국 어댑터 기본값은 꺼짐이며 국내 실행을 차단하지 않는다.
- 미국 가격의 방향 표시 부호는 `abs(value)`로 정규화된다.
- `usa20911`, `usa20511(tm=5)`, `usa20931(flu_tp=2, tm_tp=3, tm=2)`, `usa10104`의 역할이 뒤섞이지 않는다.
- 공식 시장일이 없으면 `market_date=null`이고 국내 `bas_dd`를 사용하지 않는다.
- 동일 콘텐츠의 두 번째 관측은 `duplicate_observation`이며 새 신호를 만들지 않는다.
- 관측 기간에 일간 신호 수, 검증 경고 수, KRX/Kiwoom 불일치 코드 수를 거래일별로 기록한다.
- 사용자가 열어 본 조사 건수를 안정적으로 계측할 수 있으면 함께 기록하고, 계측하지 못한 날은 0으로 추정하지 않고 미수집 상태로 구분한다.
- 완전 거래일 20일 이전에는 임계값과 P1 지위를 조정하지 않는다.

## 11. 커밋과 브랜치 종료

태스크는 독립 검증 가능한 단위로 커밋한다. 제목은 저장소 규칙에 따라 `feat:`, `fix:`, `test:`, `docs:`, `chore:` 중 하나를 사용한다. 하나의 커밋에 서로 다른 피처나 국내·미국 경계를 섞지 않는다.

피처의 V1~V5가 통과하면 `finishing-a-development-branch` 절차로 다음 중 하나를 선택한다.

1. 기준 브랜치에 로컬 병합 후 병합 결과 전체 검증.
2. 원격 브랜치 push와 Pull Request 생성.
3. 후속 작업을 위해 브랜치 유지.

삭제·discard는 사용자가 명시적으로 요청한 경우에만 수행한다. 병합이나 PR 전에도 테스트·lint·build를 다시 실행한다.

## 12. 권장 실행 체크리스트

### 최초 한 번

- [ ] Spec Kit 설치·호출 표면과 Superpowers 스킬 가용성을 확인했다.
- [ ] `.specify/memory/constitution.md`를 만들고 MVP MUST 원칙을 고정했다.
- [ ] 테스트 러너와 단일 검증 명령을 F1 `plan.md`에 확정했다.

### 각 피처 시작

- [ ] v2.2의 해당 범위와 비목표를 확인했다.
- [ ] 활성 `.specify/feature.json`이 의도한 피처를 가리킨다.
- [ ] `specify → clarify → plan → checklist → tasks → analyze`가 순서대로 통과했다.
- [ ] CRITICAL/HIGH 분석 항목과 미완료 체크리스트가 없다.
- [ ] worktree와 기준선 검증 결과를 확인했다.

### 각 태스크 완료

- [ ] 요구사항 ID와 정확한 파일 경로가 연결되어 있다.
- [ ] RED 실패를 예상한 이유로 직접 확인했다.
- [ ] 최소 구현으로 GREEN을 확인했다.
- [ ] 관련 전체 테스트가 깨끗하게 통과했다.
- [ ] `tasks.md` 상태와 Git 변경이 일치한다.

### 각 피처 종료

- [ ] 대상 테스트, `npm test`, `npm run lint`, `npm run build`를 새로 실행했다.
- [ ] `/speckit-converge` 공백이 없다.
- [ ] 독립 코드 리뷰의 Critical·Important 지적이 없다.
- [ ] 최신 diff와 수용 기준을 직접 대조했다.
- [ ] 브랜치 통합 또는 유지 상태와 후속 피처 의존성을 기록했다.

## 13. 최종 권고

이 MVP에는 “Spec Kit 전체 경로 + Superpowers 가로 품질 게이트”가 가장 적합하다.

```text
constitution
  → 피처별 specify → clarify → plan → checklist → tasks → analyze
  → worktree
  → speckit-implement + TDD
  → 실패 시 systematic-debugging
  → targeted tests + lint + build
  → speckit-converge
  → requesting/receiving-code-review
  → fresh verification
  → finishing-a-development-branch
```

핵심은 도구를 많이 호출하는 것이 아니라 책임을 겹치지 않는 것이다. Spec Kit은 추적 가능한 정본과 완료 상태를 소유하고, Superpowers는 구현 방법과 증거 품질을 소유한다. 국내 P0를 F1~F3으로 먼저 닫은 뒤 F4를 비차단 실험으로 여는 순서를 지키면 MVP v2.2의 범위, 보안, 재현성, 관측 후 판정 원칙을 가장 적은 운영 혼선으로 유지할 수 있다.
