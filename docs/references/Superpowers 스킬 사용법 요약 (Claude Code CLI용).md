# Superpowers (obra/superpowers v6.3.0) — 스킬 사용법 요약

> 대상: Claude Code CLI. 출처: `repomix-output-obra-superpowers.md` (skills/*/SKILL.md, hooks/, .claude-plugin/).

## 0. 공통 사항

**설치 / 로딩**

*   `/plugin marketplace add obra/superpowers-marketplace` → `/plugin install superpowers@superpowers-marketplace` (또는 `/plugin install superpowers@claude-plugins-official`).
    
*   `hooks/hooks.json`의 `SessionStart`(startup|clear|compact) 훅이 `skills/using-superpowers/SKILL.md` 전문을 컨텍스트에 주입. **그 외 스킬은** `Skill` **툴로 호출**. 스킬 참조 표기: `superpowers:<skill-name>` (예: `superpowers:test-driven-development`).
    
*   개인 스킬 위치: `~/.claude/skills/`.
    

**호출 규칙 (using-superpowers)**

*   스킬이 적용될 가능성이 1%라도 있으면 **어떤 응답·행동(명확화 질문, 코드베이스 탐색, 파일 확인 포함) 전에** 먼저 스킬을 호출.
    
*   호출 후 "Using [skill] to [purpose]"라고 알리고 스킬을 그대로 따름. 체크리스트가 있으면 항목별 todo 생성.
    
*   여러 스킬이 겹치면 **프로세스 스킬 우선**(brainstorming, systematic-debugging 등) → 구현 스킬. 예: "Let's build X" → brainstorming 먼저. "Fix this bug" → systematic-debugging 먼저.
    
*   plan mode 진입 전 brainstorming 미실행이면 먼저 실행.
    
*   우선순위: 사용자 지시(CLAUDE.md, AGENTS.md, 직접 요청) > 스킬 > 기본 동작. 사용자가 명시적으로 건너뛰라고 할 때만 스킬 생략.
    
*   서브에이전트로 디스패치된 경우 using-superpowers는 무시(`<SUBAGENT-STOP>`).
    

**공통 산출물 경로**

*   설계 스펙: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
    
*   구현 계획: `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
    
*   SDD 작업 공간(git-ignored): `<repo-root>/.superpowers/sdd/<plan-basename>/` (ledger `progress.md`, briefs, reports, review packages)
    
*   워크트리 기본: `.worktrees/<branch>` (반드시 .gitignore 확인)
    
*   (사용자 선호 경로가 있으면 위 기본값을 덮어씀)
    

**전체 워크플로우**

```
brainstorming ──(architectural)──▶ writing-plans ──▶ subagent-driven-development (권장)
      │                                                 또는 executing-plans
      │(bounded)──▶ 바로 구현(TDD)                              │
      │(spike)────▶ 권고안 보고                                 ▼
                                              finishing-a-development-branch
가로 적용: using-git-worktrees(시작 시) · test-driven-development · systematic-debugging ·
          requesting/receiving-code-review · verification-before-completion(완료 주장 전) ·
          dispatching-parallel-agents(독립 작업 2+개)
```

* * *

## 1. 스킬별 요약 (14개)

### 1.1 `brainstorming`

*   **트리거**: 모든 창작 작업 전(기능 추가, 컴포넌트 제작, 동작 변경). 구현 전에 의도·요구사항·설계를 탐색.
    
*   **HARD-GATE**: 사용자에게 의도를 말하고 **승인을 받기 전까지** 구현 스킬 호출·코드 작성·스캐폴딩 금지. 작업이 단순해도 승인 게이트는 그대로.
    
*   **절차**: 먼저 요청을 3가지 경로 중 하나로 분류하고 소리내어 선언(사용자가 뒤집을 수 있게).
    *   **Spike** (실현 가능성 질문, 산출물은 코드가 아닌 답): 질문+탐색 계획 2~3문장 → 승인 → 최저 비용으로 조사 → 권고안 보고. 만든 코드는 throwaway 표시.
        
    *   **Bounded** (이 저장소에 이미 있는 흐름의 소규모 변경: 플래그, 작은 엔드포인트, 1파일 수정): 컨텍스트 탐색 → 핵심 질문(한 번에 하나) → **채팅 안에서** 짧은 설계 제시(접근, 건드릴 파일, 테스트) → **STOP, 명시적 yes 대기** → 일반 워크플로우로 구현(TDD). 스펙/계획 문서 없음.
        
    *   **Architectural** (새 프로젝트, 새 서브시스템, 인터페이스 변경): 컨텍스트 탐색 → 명확화 질문(한 메시지에 하나, 가능하면 선택형) → 2~3개 접근안+트레이드오프+권고 → 섹션별 설계 제시(각 섹션마다 확인) → `docs/superpowers/specs/…-design.md` 작성·커밋 → 자체 검토(placeholder/TBD, 내부 모순, 범위, 모호성) → 사용자 스펙 검토 요청·대기 → **writing-plans 스킬만** 호출.
        
*   **규칙**: 애매하면 더 무거운 경로. 진행 중 숨은 복잡성 발견 시 경로 업그레이드만 가능(다운그레이드 불가). 다수의 독립 서브시스템 요청이면 먼저 분해 제안. YAGNI. 기존 코드베이스는 기존 패턴 따르되 무관한 리팩터링 제안 금지.
    
*   **Visual Companion**: 브라우저 목업/다이어그램 도구. 미리 제안하지 말고 시각적으로 보여주는 게 확실히 나은 질문이 처음 나올 때 **단독 메시지**로 제안. 수락 시 `--open`으로 서버 시작. 질문마다 브라우저/터미널을 따로 판단(텍스트 질문은 터미널). 상세: `skills/brainstorming/visual-companion.md`.
    

### 1.2 `writing-plans`

*   **트리거**: 스펙/요구사항이 있는 다단계 작업, 코드 건드리기 전.
    
*   **선언**: "I'm using the writing-plans skill to create the implementation plan."
    
*   **전제**: 코드베이스를 전혀 모르고 테스트 설계 감각이 부족한 숙련 개발자가 읽는다고 가정. DRY, YAGNI, TDD, 잦은 커밋.
    
*   **절차**: 범위 점검(다중 서브시스템이면 계획 분리 제안) → 파일 구조 설계(파일당 하나의 책임, 작은 파일 선호) → 태스크 분할(각 태스크 = 독립 테스트 가능한 산출물, 리뷰어가 개별 승인/거절 가능한 단위) → 단계는 2~5분짜리 하나의 행동("failing test 작성", "실패 확인", "최소 구현", "통과 확인", "커밋") → 자체 검토(스펙 커버리지, placeholder 스캔, 타입/시그니처 일관성) → 실행 방식 선택 제안.
    
*   **필수 헤더**:
    
    ```
    # [Feature] Implementation Plan
    > **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans …
    **Goal:** / **Architecture:** / **Tech Stack:** / **Spec:** <spec 경로>
    ## Global Constraints  (스펙의 프로젝트 전역 요구사항, 정확한 값 그대로 한 줄씩)
    ```
    
*   **태스크 구조**: `### Task N: [Component]` → **Files:** (Create/Modify(`path:123-145`)/Test 정확한 경로) → **Interfaces:** (Consumes/Produces — 정확한 시그니처) → `- [ ] **Step 1: Write the failing test**`(코드 블록) → Step 2 실패 확인(`Run:`/`Expected:`) → Step 3 최소 구현(코드) → Step 4 통과 확인 → Step 5 Commit(명령).
    
*   **금지(plan failure)**: "TBD/TODO/implement later", "add appropriate error handling", 코드 없는 "write tests", "Similar to Task N"(코드 반복해서 써야 함), 어느 태스크에도 정의 안 된 타입/함수 참조.
    
*   **핸드오프**: "Plan complete and saved to … Two execution options: 1. Subagent-Driven (recommended) 2. Inline Execution — Which approach?" → 선택에 따라 `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`.
    
*   보조: `plan-document-reviewer-prompt.md` (계획 리뷰 서브에이전트 템플릿; Status Approved|Issues Found).
    

### 1.3 `subagent-driven-development` (SDD)

*   **트리거**: 독립 태스크로 구성된 구현 계획을 **현재 세션에서** 실행.
    
*   **핵심**: 태스크마다 새 implementer 서브에이전트 → 태스크 리뷰(스펙 준수+품질) → 마지막에 브랜치 전체 리뷰. 컨트롤러(본인)는 코드를 직접 고치지 않음.
    
*   **연속 실행**: 태스크 사이에 사용자에게 확인하지 않음. 멈추는 경우는 4가지만: 비가역/파괴적 작업, 보안 민감 작업, 워크트리 밖 부작용(merge, 공유 브랜치 push, publish), 모든 경로가 추측인 망가진 계획. 그 외 충돌·모호성은 스스로 판정하고 ledger에 `Ruling: <결정> — <이유> — <틀렸을 때 비용>` 기록.
    
*   **Setup**: `using-git-worktrees`로 격리 확인(main/master에서 직접 구현 금지) → `scripts/sdd-workspace PLAN_FILE`로 작업공간 경로 획득 → `<workspace>/progress.md` ledger 확인(첫 줄 `# SDD ledger — plan: <plan path>`; `Task <N>: complete` 있는 태스크는 재디스패치 금지, 컴팩션 후엔 ledger와 `git log`를 기억보다 신뢰) → 계획을 한 번 읽고 태스크별 todo 생성, Spec도 읽음(스펙이 최종 권위) → 사전 충돌 스캔 표(파일/인터페이스 공유 태스크 쌍별, 태스크 자체 일관성)를 ledger에 기록하고 판정.
    
*   **모델 선택**: 항상 명시. 기계적 구현(1~2파일, 완전한 스펙/코드 포함) → 최저가 모델; 통합·판단 → 표준; 아키텍처·최종 리뷰 → 최고 성능. 리뷰어·산문 기반 implementer는 mid-tier 이상. fix round 4~5는 한 단계 위 모델.
    
*   **태스크 루프**:
    1.  BASE=`git rev-parse HEAD` 기록 → `scripts/task-brief PLAN_FILE N`으로 brief 파일 생성 → implementer 디스패치(`implementer-prompt.md`). 디스패치 내용: 프로젝트 내 위치 1줄, brief 경로("read this first"), 이전 태스크의 인터페이스/결정, 모호성 해소, report 파일 경로(`task-N-report.md`)+보고 계약. 전체 plan 읽게 하지 않음, 이전 태스크 요약 붙이지 않음. implementer는 서브에이전트 생성 금지. **구현 서브에이전트 병렬 디스패치 금지.** 같은 종류의 소규모 편집 여러 개는 하나의 디스패치로 묶음.
        
    2.  보고 처리: `DONE` → review package 생성 후 리뷰; `DONE_WITH_CONCERNS` → 우려 검토 후 진행; `NEEDS_CONTEXT` → 컨텍스트 제공 후 재디스패치; `BLOCKED` → 원인별 대응(컨텍스트/상위 모델/분할/계획 수정 ruling). 같은 조건으로 재시도 금지.
        
    3.  태스크 리뷰: `scripts/review-package PLAN_FILE BASE HEAD`(BASE는 기록해둔 값, `HEAD~1` 금지) → `task-reviewer-prompt.md`로 리뷰어 디스패치(brief, report, package 경로 + Global Constraints 원문). 리뷰어에게 "do not flag" 등 사전 판단 지시 금지. `⚠️ Cannot verify from diff` 항목은 컨트롤러가 직접 해소.
        
    4.  Fix loop(스펙 ❌, Critical/Important, 확인된 ⚠️ 시): 최대 5라운드. R1~3은 원래 implementer 재개, R4~5는 상위 모델의 새 implementer. 매 라운드 = 수정 1회 + 스코프 재리뷰 1회(`review-package PLAN_FILE FIX_BASE HEAD` + `re-review-prompt.md`, 판정 ADDRESSED/NOT ADDRESSED). ledger: `Task <N>: fix round <R>/5 (<X> addressed, <Y> open — …; commits <a>..<b>)`. Minor는 `Task <N>: minor (deferred): …`로만 기록. 5라운드 후에도 남으면 breaker: 각 finding을 park(`Task <N>: parked — <finding> — Ruling: …`) 또는 load-bearing이면 최소 변경 ruling.
        
    5.  완료: `Task <N>: complete (commits <base7>..<head7>, review clean)` (또는 `<K> parked`) → todo 완료.
        
*   **Final review**: `review-package PLAN_FILE MERGE_BASE HEAD` → 최고 성능 모델로 `requesting-code-review/code-reviewer.md` 디스패치, ledger의 deferred/parked 항목 가리킴. finding이 있으면 **fix 디스패치 1회 + 스코프 재리뷰 1회**만. 두 번째 fix wave 없음.
    
*   **Finish**: 최종 메시지에 ledger의 모든 `Ruling:` 줄을 "Rulings I made"로 모두 나열 → `rm -rf <workspace>` → `superpowers:finishing-a-development-branch`.
    
*   보조: `implementer-prompt.md`, `task-reviewer-prompt.md`, `re-review-prompt.md`, `scripts/{sdd-workspace,task-brief,review-package}`.
    

### 1.4 `executing-plans`

*   **트리거**: 작성된 계획을 **별도 세션**에서 리뷰 체크포인트와 함께 실행. 서브에이전트가 가능하면 대신 SDD 사용을 권고.
    
*   **선언**: "I'm using the executing-plans skill to implement this plan."
    
*   **절차**: `using-git-worktrees`로 격리 → 계획 읽고 비판적 검토(우려 있으면 시작 전 제기) → 태스크별 todo → 각 태스크: in_progress → 단계 그대로 수행 → 검증 → completed → 전부 끝나면 `superpowers:finishing-a-development-branch`.
    
*   **중단 조건**: 블로커(의존성 누락, 테스트 실패, 지시 불명확), 계획의 치명적 공백, 검증 반복 실패 → 추측 대신 질문. main/master에서 명시적 동의 없이 구현 금지.
    

### 1.5 `test-driven-development`

*   **트리거**: 모든 기능·버그 수정·리팩터링·동작 변경, 구현 코드 작성 전. 예외(throwaway 프로토타입, 생성 코드, 설정 파일)는 사용자에게 물어봄.
    
*   **Iron Law**: `NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`. 테스트 전에 쓴 코드는 삭제(참고용 보관·adapt 금지).
    
*   **사이클**: RED(한 가지 동작, 명확한 이름, 실제 코드—mock 최소) → **Verify RED 필수**(실패 확인: 에러가 아닌 실패, 기능 부재가 이유) → GREEN(테스트 통과 최소 코드, YAGNI) → **Verify GREEN 필수**(전체 통과, 출력 깨끗) → REFACTOR(green 유지, 동작 추가 없음) → 반복.
    
*   **검증 체크리스트**: 새 함수마다 테스트 / 각 테스트 실패 목격 / 기대 이유로 실패 / 최소 코드 / 전부 통과 / 출력 깨끗 / mock 최소 / 엣지·에러 커버. 하나라도 못 체크하면 TDD 생략 → 다시.
    
*   버그 수정도 재현 failing test부터. 규칙: `Production code → test exists and failed first`. 사용자 허가 없는 예외 없음.
    
*   보조: `writing-good-tests.md` (테스트 작성/변경 시 필독: 실패시킬 프로덕션 변경을 먼저 명명, mock 동작 아닌 실제 동작 단언, 테스트 전용 코드는 테스트 유틸에, 의존성 부작용 이해 후 mock).
    

### 1.6 `systematic-debugging`

*   **트리거**: 모든 버그·테스트 실패·예기치 않은 동작, 수정안 제시 전. 시간 압박, "빠른 수정"이 보일 때, 이미 여러 번 수정 실패했을 때 특히.
    
*   **Iron Law**: `NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST`.
    
*   **4단계(순서 강제)**:
    1.  **Root Cause**: 에러 메시지·스택 완독 → 일관 재현(안 되면 데이터 더 수집) → 최근 변경 확인(git diff, 의존성, 설정) → 다중 컴포넌트면 경계마다 입출력 로그 계측 후 1회 실행해 실패 지점 특정 → 데이터 흐름 역추적(`root-cause-tracing.md`).
        
    2.  **Pattern**: 동작하는 유사 코드 찾기 → 참조 구현 완독 → 차이 전부 나열 → 의존성/설정 파악.
        
    3.  **Hypothesis**: 단일 가설 명시("X가 원인, 이유 Y") → 최소 변경으로 검증(한 변수씩) → 실패면 새 가설(덧대기 금지) → 모르면 "모른다"고 말하기.
        
    4.  **Implementation**: 실패 테스트 먼저(TDD 스킬) → 단일 수정(부수 개선 금지) → 검증(`verification-before-completion`) → 실패 시 STOP; 시도 <3이면 Phase 1로, **≥3이면 아키텍처 의심**하고 사용자와 논의.
        
*   **Red flags**: "일단 고치고 나중에 조사", "X 바꿔보자", "여러 개 동시에", "테스트 건너뛰고 수동 확인", "아마 X일 것" → 모두 Phase 1로 복귀. 사용자 신호("Is that not happening?", "Stop guessing", "We're stuck?")도 동일.
    
*   보조: `root-cause-tracing.md`, `defense-in-depth.md`, `condition-based-waiting.md`(+`.ts` 예제), `find-polluter.sh`.
    

### 1.7 `verification-before-completion`

*   **트리거**: 완료·수정·통과를 주장하기 전, 커밋·PR 전.
    
*   **Iron Law**: `NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE` — 이 메시지에서 검증 명령을 실행하지 않았으면 통과라고 말할 수 없음.
    
*   **게이트**: (1) 주장을 증명하는 명령 식별 → (2) 전체 명령을 새로 실행 → (3) 출력 전체·exit code·실패 수 읽기 → (4) 출력이 주장을 확인하는지 판단 → (5) 그때만 증거와 함께 주장.
    
*   **대응표**: 테스트 통과=테스트 출력 0 failures / 린트=0 errors / 빌드=exit 0 / 버그 수정=원 증상 테스트 통과 / 회귀 테스트=red-green 확인(수정 되돌리면 실패해야) / 에이전트 완료=VCS diff 확인 / 요구사항 충족=항목별 체크리스트.
    
*   **금지 표현**: "should", "probably", "seems to", 검증 전 "Great!/Perfect!/Done!". 에이전트의 성공 보고를 그대로 신뢰 금지.
    

### 1.8 `requesting-code-review`

*   **트리거**: 태스크 완료 후, 주요 기능 완료 후, main 병합 전(필수). 막혔을 때, 리팩터링 전, 복잡한 버그 수정 후(선택).
    
*   **절차**: `BASE_SHA=$(git rev-parse HEAD~1)`(또는 origin/main), `HEAD_SHA=$(git rev-parse HEAD)` → `general-purpose` 서브에이전트에 `code-reviewer.md` 템플릿 채워 디스패치 (`{DESCRIPTION}`, `{PLAN_OR_REQUIREMENTS}`, `{BASE_SHA}`, `{HEAD_SHA}`) → Critical 즉시 수정, Important 진행 전 수정, Minor 기록, 리뷰어가 틀리면 근거로 반박.
    
*   **규칙**: diff를 본인이 인라인으로 리뷰하지 말고 서브에이전트 디스패치(컨텍스트 보존). 세션 히스토리 넘기지 않고 정제된 컨텍스트만. "단순해서" 생략 금지.
    

### 1.9 `receiving-code-review`

*   **트리거**: 리뷰 피드백을 받아 반영하기 전, 특히 불명확하거나 기술적으로 의심스러울 때.
    
*   **패턴**: READ(반응 없이 완독) → UNDERSTAND(요구를 자기 말로 재진술) → VERIFY(코드베이스 실제와 대조) → EVALUATE(이 코드베이스에 타당한가) → RESPOND(기술적 확인 또는 근거 있는 반박) → IMPLEMENT(한 항목씩, 각각 테스트).
    
*   **금지**: "You're absolutely right!", "Great point!", 검증 전 "Let me implement that now", 모든 감사 표현. 대신 요구 재진술·질문·반박·바로 실행. 맞는 피드백엔 "Fixed. [무엇이 바뀌었는지]".
    
*   **불명확 항목**: 하나라도 불명확하면 전부 STOP하고 먼저 질문(부분 구현 금지).
    
*   **외부 리뷰어**: 이 코드베이스에 맞는지, 기존 기능 깨는지, 현 구현 이유, 플랫폼/버전, 리뷰어의 컨텍스트를 확인. 사용자의 이전 결정과 충돌하면 사용자와 먼저 논의. "제대로 구현하라"는 제안엔 grep으로 실제 사용 여부 확인(YAGNI).
    
*   **구현 순서**: 불명확 해소 → Blocking(보안·파손) → 단순 수정 → 복잡 수정, 각각 개별 테스트.
    
*   GitHub 인라인 코멘트 답변은 스레드에(`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`).
    

### 1.10 `dispatching-parallel-agents`

*   **트리거**: 공유 상태·순서 의존이 없는 독립 작업 2개 이상(예: 원인이 다른 3개+ 테스트 파일 실패).
    
*   **사용 금지**: 실패가 연관됨, 전체 시스템 이해 필요, 탐색적 디버깅, 에이전트가 같은 파일/자원을 건드림.
    
*   **패턴**: 독립 도메인 식별 → 에이전트별 과제(특정 범위, 명확한 목표, 제약 "다른 코드 변경 금지", 기대 출력 "원인과 수정 요약") → **같은 응답에서 여러 디스패치 = 병렬** → 반환 후 요약 검토, 충돌 확인, 전체 테스트, 통합, 스팟 체크.
    
*   프롬프트는 집중적·자기완결적·출력 명시. "Fix all the tests" 같은 광범위 지시 금지. 타임아웃 늘리기 금지(진짜 원인 찾기).
    

### 1.11 `using-git-worktrees`

*   **트리거**: 격리가 필요한 기능 작업 시작, 계획 실행 전.
    
*   **선언**: "I'm using the using-git-worktrees skill to set up an isolated workspace."
    
*   **Step 0 기존 격리 감지**: `GIT_DIR`(`git rev-parse --git-dir`) vs `GIT_COMMON`(`--git-common-dir`). 다르면 이미 linked worktree(단, `git rev-parse --show-superproject-working-tree`가 경로를 반환하면 서브모듈 → 일반 저장소 취급) → Step 2로. 같으면 일반 저장소 → 사용자 선호가 없으면 동의 질문("Would you like me to set up an isolated worktree?"); 거절 시 현 위치에서 작업.
    
*   **Step 1**: (1a) 네이티브 워크트리 도구(`EnterWorktree`, `WorktreeCreate`, `/worktree`, `--worktree`) 우선. (1b) 없을 때만 git fallback: 위치 우선순위 = 사용자 지정 > 기존 `.worktrees/` > 기존 `worktrees/` > 기본 `.worktrees/`; `git check-ignore`**로 ignore 확인 필수**(아니면 .gitignore 추가·커밋) → `git worktree add "$path" -b "$BRANCH_NAME"` → `cd`. 권한 오류면 sandbox fallback(현 위치 작업 알림).
    
*   **Step 2** 프로젝트 셋업 자동 감지(npm install / cargo build / pip / poetry / go mod download) → **Step 3** 베이스라인 테스트(실패 시 보고·질문) → 보고 "Worktree ready at / Tests passing () / Ready to implement ".
    

### 1.12 `finishing-a-development-branch`

*   **트리거**: 구현 완료·테스트 통과 후 통합 방식 결정.
    
*   **선언**: "I'm using the finishing-a-development-branch skill to complete this work."
    
*   **절차**: (1) 전체 테스트 실행, 실패면 보고 후 정지 → (2) 환경 감지(`GIT_DIR`, `GIT_COMMON`, `WORKTREE_PATH=$(git rev-parse --show-toplevel)` 지금 캡처) → (3) base 브랜치 확정(모르면 "This branch split from <추정> - is that correct?") → (4) 메뉴 **정확히 그대로** 제시:
    *   일반/named-branch worktree: `1. Merge back to <base-branch> locally / 2. Push and create a Pull Request / 3. Keep the branch as-is`
        
    *   detached HEAD: `1. Push as new branch and create a Pull Request / 2. Keep as-is`
        
    *   Discard는 메뉴에 없음. 사용자가 명시적으로 요청할 때만, 삭제 대상 목록 보여주고 **정확히** `discard` **입력** 받은 후 실행.
        
*   **실행**: Option 1 = main root로 `cd` → `git checkout <base> && git pull && git merge <feature>` → 병합 결과 테스트(실패면 중단·유지) → 워크트리 정리 → `git branch -d`. Option 2 = `git push -u origin <feature>` → forge CLI/URL로 PR 생성, 워크트리 유지. Option 3 = 유지 보고.
    
*   **정리(Step 6)**: Option 1과 confirmed discard만. `.worktrees/`/`worktrees/` 아래 워크트리만 `git worktree remove` + `git worktree prune`. 제거 거부(미커밋 파일)면 `--force` **금지**, `git -C "$WORKTREE_PATH" status --porcelain -uall` 보여주고 커밋/이동/삭제 선택 요청. 그 외 워크트리는 호스트 소유 → 그대로 둠. push 거부 시 force-push는 명시 요청 시만.
    

### 1.13 `writing-skills`

*   **트리거**: 스킬 신규 작성·수정·배포 전 검증.
    
*   **핵심**: 스킬 작성 = 프로세스 문서에 적용한 TDD. `NO SKILL WITHOUT A FAILING TEST FIRST` — 서브에이전트 압박 시나리오로 스킬 없는 baseline 실패(합리화 문구 기록) → 스킬 작성 → 준수 확인 → 루프홀 봉쇄. 편집에도 동일 적용.
    
*   **구조**: `skills/<skill-name>/SKILL.md` (+필요시 보조 파일; 100줄+ 참고자료·재사용 스크립트만 분리). YAML frontmatter `name`(문자·숫자·하이픈), `description`(3인칭, **"Use when…"으로 트리거 조건만**, 워크플로우 요약 금지—요약하면 에이전트가 본문을 안 읽음; 1024자 이내, 500자 이하 권장). 본문: Overview / When to Use / Core Pattern / Quick Reference / Implementation / Common Mistakes.
    
*   **작성 원칙**: 검색 키워드 포함, 동사형 gerund 이름(`creating-skills`), 토큰 절약(자주 로드되는 스킬 <200단어, 기타 <500), 다른 스킬 참조는 `**REQUIRED SUB-SKILL:** Use superpowers:<name>` 형식(`@` 링크 금지), 플로차트는 비자명한 결정 지점에만, 예제는 하나만 훌륭하게.
    
*   **실패 유형별 형식**: 규칙 위반 → 금지+합리화 표+red flags; 출력 형태 오류 → 긍정적 레시피; 필수 요소 누락 → 템플릿의 REQUIRED 슬롯; 조건부 동작 → 관측 가능한 조건문. 뉘앙스 절("unless it matters") 금지.
    
*   보조: `anthropic-best-practices.md`, `persuasion-principles.md`, `graphviz-conventions.dot`, `render-graphs.js`, `examples/CLAUDE_MD_TESTING.md`.
    

### 1.14 `using-superpowers`

*   세션 시작 시 훅으로 자동 주입되는 메타 스킬. 위 "0. 공통 사항 — 호출 규칙" 참조.
    
*   Red flags(모두 "STOP, 스킬 확인"): "단순한 질문이다", "컨텍스트 먼저", "코드베이스 먼저 보자", "이 스킬 기억난다"(스킬은 진화함—현재 버전 읽기), "스킬은 과하다".
    
*   플랫폼별 참조: `references/{codex,pi,antigravity,hermes,gemini}-tools.md` (Claude Code는 해당 없음).
    

* * *

## 2. 스킬 간 핸드오프 요약

| 현재 스킬 | 다음 스킬 |
| --- | --- |
| brainstorming (architectural) | writing-plans **만** |
| brainstorming (bounded) | 일반 구현 (test-driven-development) |
| writing-plans | subagent-driven-development (권장) 또는 executing-plans |
| subagent-driven-development / executing-plans | (시작 시) using-git-worktrees → (종료 시) finishing-a-development-branch |
| systematic-debugging Phase 4 | test-driven-development → verification-before-completion |
| 모든 완료 주장·커밋·PR 전 | verification-before-completion |
| 태스크/기능 완료, 병합 전 | requesting-code-review → receiving-code-review |
| writing-skills | test-driven-development (필수 배경) |