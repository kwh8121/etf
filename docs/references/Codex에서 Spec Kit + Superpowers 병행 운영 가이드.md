# Codex에서 Spec Kit + Superpowers 병행 운영 가이드

## 목적

아직 주제가 확정되지 않은 개발 프로젝트를 탐색·선정·명세화·구현·검증하는 데 두 스킬을 함께 쓴다.

*   **Spec Kit**: 무엇을 만들지, 왜 만드는지, 무엇을 완료로 볼지를 저장소 안의 추적 가능한 명세로 고정한다.

*   **Superpowers**: 탐색 대화, 설계 승인, TDD 구현, 격리 작업공간, 코드 리뷰와 완료 검증을 강제한다.

*   **핵심 원칙**: 두 도구가 같은 문서를 각자 작성하지 않게 역할을 분리한다. 제품·요구사항의 정본은 `specs/<번호>-<기능명>/`의 Spec Kit 문서, 구현 작업의 실행 통제는 Superpowers로 둔다.


## 최적 조합: “발견은 Superpowers, 의사결정·명세는 Spec Kit, 실행 품질은 Superpowers, 추적·수렴은 Spec Kit”

| 단계 | 주관 스킬 | 산출물·행동 | 병행 원칙 |
| --- | --- | --- | --- |
| 0. 프로젝트 후보 탐색 | Superpowers `brainstorming` 또는 Spec Kit `assess` | 문제, 사용자, 선택지, 조사, Go/Kill | 아이디어가 매우 불확실하면 `assess`를 먼저 사용하고, 인터랙티브한 요구 발굴은 `brainstorming`을 사용한다. 둘을 같은 아이디어에 중복 실행하지 않는다. |
| 1. 프로젝트 원칙 확정 | Spec Kit `constitution` | `.specify/memory/constitution.md` | 데이터 출처, 보안, 테스트, 배포, 코드리뷰, 비용 등 비협상 제약을 여기에 단일 정본으로 둔다. |
| 2. 기능 정의 | Spec Kit `specify` → `clarify` | `spec.md`, 요구사항 체크리스트 | WHAT/WHY와 사용자 성공 기준은 Spec Kit가 소유한다. Superpowers의 brainstorming은 이 단계 전에 끝낸다. |
| 3. 기술 설계 | Spec Kit `plan` | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` | 기술 선택과 인터페이스 결정은 plan에 기록한다. 불확실한 기술 항목은 research에서 Decision/Rationale/Alternatives로 닫는다. |
| 4. 구현계획 변환 | Superpowers `writing-plans` | `docs/superpowers/plans/<날짜>-<기능>.md` | Spec Kit의 `plan.md`를 입력 정본으로 삼아, 파일·인터페이스·실패 테스트·검증 명령·커밋 단위의 실행 계획으로 바꾼다. `tasks.md`를 그대로 복제하지 않는다. |
| 5. 구현 | Superpowers `using-git-worktrees` → `subagent-driven-development` 또는 `executing-plans` + `test-driven-development` | 격리 worktree, 테스트 우선 코드, 태스크별 리뷰 | 기본값은 SDD. 단순·독립 작업은 inline 실행을 선택할 수 있다. 구현 상태 추적은 `tasks.md`에도 반영한다. |
| 6. 명세-코드 수렴 | Spec Kit `converge` | 누락·부분구현·모순·불필요 구현 분류, 추가 태스크 | Superpowers가 코드 품질을 검토한 뒤, Spec Kit가 제품 명세 대비 공백을 판정한다. `converge`는 기존 태스크를 고치지 않고 후속 태스크만 append한다. |
| 7. 종료·통합 | Superpowers `verification-before-completion` → `requesting-code-review` → `finishing-a-development-branch` | 최신 검증 증거, 리뷰, merge/PR/브랜치 유지 선택 | 테스트·린트·빌드 결과 없이 완료를 선언하지 않는다. 병합 전에는 독립 코드리뷰를 둔다. [1] |

## 프로젝트가 특정되지 않았을 때의 권장 진입 경로

### A. 아이디어만 있는 경우: 가장 권장

1.  `speckit-assess-intake`: 아이디어를 중립적으로 정리하고 미지 항목을 수집한다.

2.  `speckit-assess-research`: 근거·반증·가정을 분리한다.

3.  `speckit-assess-define`: 사용자, 문제, 목표·비목표, 지표를 정한다.

4.  `speckit-assess-shape`: 최소안, 대안, 구매/현상유지까지 비교한다.

5.  `speckit-assess-decide`: `go / needs-clarification / kill`을 결정한다.

6.  `go`일 때만 `speckit-constitution`과 `speckit-specify`로 넘어간다.


이 경로는 ‘무엇을 만들지’가 불명확한 상황에 특히 적합하다. 아이디어 검증과 구현 약속을 분리해 성급한 스캐폴딩을 막는다.

### B. 개발 요청이 들어왔지만 요구가 모호한 경우

1.  Superpowers `brainstorming`으로 작업을 Spike / Bounded / Architectural로 분류한다.

2.  **Spike**: 구현하지 않고 최소 조사 후 권고안만 낸다.

3.  **Bounded**: 기존 흐름의 작은 변경이면 짧은 채팅 설계와 명시적 승인을 받은 뒤 TDD로 구현한다.

4.  **Architectural**: 새 프로젝트·서브시스템·인터페이스 변경이면 설계 옵션과 사용자 승인을 거친다. 그 뒤 Spec Kit `specify`로 제품 명세를 정본화한다.


Superpowers는 구현 전 사용자 승인 게이트와 경로 분류를 둔다. 새 프로젝트나 아키텍처 변경은 architectural 경로로 다루고, 그 뒤 구현계획으로 넘기는 방식이 적합하다. [1]

## 표준 운영 절차 (Go 결정 이후)

```text
[발견]
Spec Kit assess  또는  Superpowers brainstorming
        ↓ (Go / 승인)
[거버넌스]
/speckit-constitution
        ↓
[제품 명세]
/speckit-specify → /speckit-clarify → /speckit-checklist
        ↓
[기술 설계]
/speckit-plan → /speckit-checklist → /speckit-tasks → /speckit-analyze
        ↓
[실행 계획]
Superpowers writing-plans
        ↓
[구현]
using-git-worktrees → SDD(권장) 또는 executing-plans
  └─ 모든 동작 변경: test-driven-development
  └─ 독립 조사·파일 작업만: dispatching-parallel-agents
        ↓
[검증·수렴]
verification-before-completion → requesting-code-review
→ /speckit-converge → (추가 태스크가 있으면 구현 루프 반복)
        ↓
[통합]
finishing-a-development-branch
```

## 문서와 상태의 단일 책임

### Spec Kit가 정본인 것

*   프로젝트 헌장 및 전역 제약

*   사용자 문제, 범위, 비목표, 사용자 스토리, 측정 가능한 성공 기준

*   기술 설계 결정과 근거, 데이터 모델, 계약, 퀵스타트

*   제품 요구사항 점검표

*   구현 범위 태스크와 구현 후 명세 대비 공백


### Superpowers가 정본인 것

*   브레인스토밍 과정과 사용자 승인

*   세분화된 실행 계획: 정확한 파일, 인터페이스, Red-Green 검증, 커밋 절차

*   worktree 격리 상태, SDD ledger, 태스크별 리뷰 패키지와 판정

*   최신 테스트·린트·빌드·리뷰 증거

*   브랜치 종료·PR·병합 선택


### 중복을 피하는 규칙

*   요구사항은 `spec.md`에만 확정한다. Superpowers 설계 문서는 해당 spec 경로를 참조한다.

*   기술 결정은 `research.md`와 `plan.md`에만 확정한다. 실행 계획에는 이를 재해석하지 말고 제약으로 인용한다.

*   Spec Kit `tasks.md`는 제품 범위와 추적용, Superpowers plan은 2~5분 단위의 실행용으로 쓴다.

*   구현 완료 표시는 Spec Kit `implement`가 `tasks.md`의 `[X]`로 기록한다. Superpowers SDD ledger는 실행·리뷰 이력용으로 유지한다.

*   모순이 보이면 우선순위는 `constitution → spec.md → plan.md/research.md → tasks.md → Superpowers 실행계획 → 코드`로 둔다. 코드가 상위 문서와 다르면 `converge`에서 공백으로 처리한다.


## Codex용 실무 프롬프트 템플릿

### 1) 탐색 시작

```text
이 아이디어는 아직 프로젝트로 확정되지 않았다.
먼저 문제·사용자·성공 지표·핵심 가정·반증 근거를 정리하고,
최소안/대안/구매 또는 현상유지 옵션을 비교해 Go, needs-clarification, kill 중 하나를 권고하라.
구현이나 스캐폴딩은 승인 전까지 하지 마라.
```

### 2) Spec Kit 명세화

```text
Go 결정된 아이디어를 Spec Kit 방식으로 명세화하라.
헌장의 전역 제약을 먼저 확인하고, spec에는 WHAT/WHY와 사용자 관점의 측정 가능한 성공 기준만 적어라.
기술 스택 선택은 plan 단계로 미루고, 불명확한 요구는 우선순위가 높은 항목만 질문하라.
```

### 3) 구현계획 전환

```text
`specs/<feature>/spec.md`와 `plan.md`를 정본으로 읽어라.
새 요구사항을 만들지 말고, 이를 구현 가능한 작업계획으로 변환하라.
각 작업에는 수정 파일, 인터페이스, failing test, 실패 확인, 최소 구현, 통과 확인, 커밋 단계를 포함하라.
```

### 4) 구현·검증

```text
격리된 worktree에서 구현하라. 모든 동작 변경은 failing test를 먼저 작성하고 실제 실패를 확인한 뒤 최소 구현으로 통과시켜라.
각 작업 후 스펙 준수와 코드 품질을 독립적으로 검토하라.
완료라고 말하기 전 전체 테스트·린트·빌드를 새로 실행하고 결과를 제시하라.
구현 후에는 Spec Kit 문서 대비 missing/partial/contradicts/unrequested 항목을 점검하라.
```

## 선택 기준

*   **작고 명확한 수정**: Superpowers `brainstorming` Bounded → TDD → 검증. 별도 Spec Kit 피처는 생략 가능.

*   **새 기능이지만 제품 범위가 명확**: Spec Kit `specify → clarify → plan → tasks → analyze` 후 Superpowers로 실행.

*   **프로젝트 자체의 타당성이 불명확**: Spec Kit `assess`를 우선하고 Go 이전에는 구현하지 않는다.

*   **새 시스템·복수 서브시스템·외부 인터페이스 변경**: Superpowers Architectural brainstorming으로 옵션·승인을 선행한 뒤 Spec Kit 명세와 설계를 고정한다.

*   **버그**: 제품 기능 흐름과 분리해 Spec Kit `bug-assess → bug-fix → bug-test`를 사용하고, Superpowers `systematic-debugging` 및 TDD를 함께 적용한다.


## 품질 게이트

다음 조건을 모두 만족해야 구현을 종료한다.

1.  헌장 위반이 없거나, 예외와 정당화가 문서화돼 있다.

2.  `spec.md`의 각 성공 기준이 테스트·검증 수단과 연결돼 있다.

3.  요구사항 체크리스트의 미해결 항목 처리 여부가 명확하다.

4.  실패 테스트를 먼저 확인한 구현이라는 증거가 있다.

5.  전체 테스트, 린트, 빌드를 해당 시점에 새로 실행했다.

6.  코드리뷰의 Critical/Important 항목을 처리했거나 보류 근거가 있다.

7.  `speckit-converge`에서 남은 명세 공백을 후속 태스크로 추가했거나 공백이 없음을 확인했다.


Superpowers는 최신 검증 증거 없이 완료를 주장하지 않도록 하고, 작업·기능 완료 및 병합 전 코드리뷰를 요구한다. [1]

## 운영상 주의점

*   두 스킬의 질문 절차를 동시에 돌리지 않는다. 탐색/승인 질문은 Superpowers, 명세의 빈칸 질문은 Spec Kit가 맡는다.

*   Superpowers가 만든 설계 문서와 Spec Kit `spec.md`가 충돌하면 구현을 멈추고 Spec Kit 명세를 먼저 정정한다.

*   `tasks.md`와 Superpowers 계획의 태스크 번호를 억지로 일치시키지 않는다. 상호 참조 링크만 둔다.

*   병렬 에이전트는 공유 파일·공유 인터페이스·순서 의존성이 없는 작업에만 쓴다. SDD의 구현 태스크는 순차 실행을 기본으로 한다. [1]

*   TDD는 throwaway spike나 설정 변경처럼 예외가 될 수 있으므로, 예외는 사전에 명시하고 프로덕션 코드에 섞이지 않게 한다.

*   Codex 환경에서 실제 명령명·플러그인 경로·서브에이전트 기능은 Claude Code와 다를 수 있다. 이 문서의 핵심은 명령어 이식이 아니라 단계별 책임 분리와 품질 게이트다.


## 최소 운영 규약

프로젝트마다 아래 한 줄을 작업 지시의 상단에 둔다.

> 제품 요구사항과 수용 기준은 Spec Kit 문서를 정본으로 하고, 구현은 Superpowers의 승인·TDD·격리·리뷰·최신 검증 절차를 따른다. 문서와 코드가 충돌하면 구현을 멈추고 명세를 먼저 갱신한다.

## 다음 행동

특정 프로젝트가 생기면, 먼저 30분짜리 `assess-intake → assess-define`으로 Go/보류/Kill을 결정한 뒤에만 기능 명세와 구현 계획을 시작한다.