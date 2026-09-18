# Superpowers 스킬 요약 (Codex CLI / Codex App용)

> 출처: obra/superpowers v6.3.0 (repomix 패키징 파일 기준). 개발 에이전트가 세션 중 참조하는 용도로 정리. Codex 특화 내용은 `skills/using-superpowers/references/codex-tools.md`와 릴리스 노트에서 발췌.

* * *

## 1. 한 줄 정의

Superpowers는 코딩 에이전트를 위한 **소프트웨어 개발 방법론 플러그인**이다. 조합 가능한 스킬(SKILL.md) 묶음과, 에이전트가 그 스킬을 반드시 사용하게 만드는 부트스트랩 지시문(`using-superpowers`)으로 구성된다. 브레인스토밍 → 계획 → TDD 구현 → 리뷰 → 브랜치 마무리까지 전 과정을 강제한다. Codex 플러그인 매니페스트의 설명: "planning, TDD, debugging, and collaboration workflows."

* * *

## 2. 사용 목적

*   코드를 바로 쓰지 않고 **먼저 의도·요구사항을 파악**하고 설계를 승인받게 한다.

*   "맥락 없고 취향도 나쁜 열정적인 주니어"가 따라갈 수 있을 만큼 구체적인 **구현 계획(2~5분 단위 태스크)**을 만든다.

*   **RED-GREEN-REFACTOR TDD**를 강제하고, 테스트 전에 쓴 코드는 삭제한다.

*   태스크마다 **새 서브에이전트 + 2단계 리뷰(스펙 준수 → 코드 품질)**로 실행해 컨텍스트 오염을 막고 장시간 자율 작업을 가능하게 한다.

*   "됐다"고 주장하기 전에 **검증 명령을 실제로 실행**하도록 강제한다(Evidence over claims).


### 철학 4가지

1.  Test-Driven Development — 항상 테스트 먼저

2.  Systematic over ad-hoc — 추측 대신 절차

3.  Complexity reduction — 단순함이 최우선 목표

4.  Evidence over claims — 성공 선언 전에 검증


* * *

## 3. 장점 (Codex 관점)

| 장점 | 설명 |
| --- | --- |
| 공식 마켓플레이스 | OpenAI 공식 플러그인 마켓플레이스(openai/plugins)에서 Codex App·CLI 모두 설치 가능 |
| 네이티브 스킬 디스커버리 | Codex는 `skills: "./skills/"`를 직접 읽음. SessionStart 훅 없음(`hooks: {}`) → 설치 시 신뢰 프롬프트 없이 동작 |
| 멀티에이전트 최적화 | v6.3.0에서 `wait_agent`를 이벤트 기반으로 전환, spawn 시 model/reasoning_effort 명시, 멀티에이전트 레퍼런스를 Codex 소스 기준으로 교정 |
| 컨텍스트 위생 | `spawn_agent {fork_turns: "none"}`로 자식에게 빈 컨텍스트 제공, 산출물은 파일로 전달 |
| 복구 가능성 | SDD 원장(ledger) 파일이 compaction 이후에도 진행 상태를 복원 |
| Codex App 샌드박스 대응 | detached HEAD 등 브랜치 작업이 막힌 환경에서도 커밋 후 App 네이티브 컨트롤로 인계하는 절차 내장 |
| 제로 의존성 | 외부 도구·서비스 의존 없음 |

* * *

## 4. 설치 및 필수 설정

### Codex App

1.  사이드바 **Plugins** 클릭

2.  Coding 섹션에서 `Superpowers` 찾기

3.  `+` 클릭 후 안내에 따라 설치


### Codex CLI

```
/plugins        # 플러그인 검색 UI 열기
superpowers     # 검색
→ Install Plugin 선택
```

### 필수: 멀티에이전트 활성화 (`~/.codex/config.toml`)

```toml
[features]
multi_agent = true
```

`dispatching-parallel-agents`, `subagent-driven-development`가 사용하는 서브에이전트 도구를 켠다. 모델 프리셋에 따라 V2(현행) 또는 V1(구형) 도구 세트가 제공되며, **표보다 실제 도구 목록을 신뢰**한다.

### 권장: 서브에이전트 모델 백스톱 (`~/.codex/config.toml`)

```toml
[agents]
default_subagent_model = "<spawn 허용 목록의 중급 모델>"
default_subagent_reasoning_effort = "medium"
```

모델 지정이 빠진 spawn이 세션의 최고가 모델을 조용히 상속하는 일을 막는다. 사용자(human partner)에게 추가를 요청할 것.

*   하네스를 여러 개 쓰면 하네스별로 각각 설치해야 함.

*   유지자용 `scripts/package-codex-plugin.sh`는 결정적(deterministic) portal 아카이브를 만들고 모든 스킬의 OpenAI 메타데이터를 검증함(일반 사용자는 불필요).


* * *

## 5. 스킬 사용법 — 핵심 규칙 (`using-superpowers`)

1.  **스킬이 적용될 가능성이 1%라도 있으면 반드시 호출한다.** 협상 불가.

2.  **응답·행동 전에 먼저 호출한다.** 명확화 질문, 코드베이스 탐색, 파일 확인보다 스킬 체크가 앞선다.

3.  **plan mode 진입 전** 브레인스토밍을 안 했으면 `brainstorming`을 먼저 호출한다.

4.  호출 후 "Using [skill] to [purpose]"라고 선언하고 스킬을 그대로 따른다. 체크리스트가 있으면 항목별 todo 생성.

5.  **우선순위**: 프로세스 스킬(brainstorming, systematic-debugging 등)이 먼저, 구현 스킬은 그 다음.
    *   "X 만들자" → `superpowers:brainstorming` 먼저

    *   "이 버그 고쳐" → `superpowers:systematic-debugging` 먼저

6.  **Platform Adaptation**: Codex에서는 `references/codex-tools.md`를 읽고 특수 지시를 따른다.

7.  **사용자 지시(AGENTS.md, 직접 요청) > 스킬 > 기본 동작.** 사용자가 명시적으로 건너뛰라고 한 경우에만 생략.

8.  서브에이전트로 특정 태스크를 실행하도록 디스패치된 경우 `using-superpowers`는 무시한다.


### 대표 Red Flags (이런 생각이 들면 멈추고 스킬 체크)

*   "이건 간단한 질문일 뿐" → 질문도 태스크다

*   "먼저 컨텍스트가 필요해" → 스킬 체크가 질문보다 먼저

*   "이 스킬 기억나" → 스킬은 진화한다. 현재 버전을 읽어라

*   "스킬은 과하다" → 단순한 일이 복잡해진다


* * *

## 6. 기본 워크플로우 (순서대로 자동 발동)

| 순서 | 스킬 | 발동 시점 | 하는 일 |
| --- | --- | --- | --- |
| 1 | `brainstorming` | 코드 작성 전 | 요청을 spike / bounded / architectural로 분류 → 질문 → 설계 제시 → **승인 게이트**. architectural이면 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` 저장 후 writing-plans로 이동 |
| 2 | `using-git-worktrees` | 설계 승인 후 | 격리 워크스페이스 확보. Step 0에서 git 명령으로 이미 워크트리인지 감지(아래 7절). 네이티브 도구 우선, 없으면 git worktree 폴백 |
| 3 | `writing-plans` | 스펙 확보 후 | 2~5분 단위 태스크로 분해. 파일 경로·코드·검증 단계 명시. `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`에 저장. 헤더에 `Spec:` 포인터와 Global Constraints 포함 |
| 4 | `subagent-driven-development` (권장) 또는 `executing-plans` | 계획 확보 후 | 태스크별 새 implementer 서브에이전트 → task reviewer(스펙+품질) → 최종 전체 브랜치 리뷰. 사용자 확인 없이 연속 실행 |
| 5 | `test-driven-development` | 구현 중 | RED(실패 테스트) → 실패 확인 → GREEN(최소 코드) → 통과 확인 → REFACTOR → 커밋. 테스트 전 코드는 삭제 |
| 6 | `requesting-code-review` | 태스크 사이 | `code-reviewer.md` 템플릿으로 리뷰어 서브에이전트 디스패치. Critical은 즉시 수정 |
| 7 | `finishing-a-development-branch` | 완료 시 | 전체 테스트 → 환경 감지 → 옵션 제시(merge / PR / keep) → 워크트리 정리. Codex App 샌드박스면 아래 7절 절차 |

### 그 외 스킬

*   `systematic-debugging` — 버그·테스트 실패 시. **Iron Law: 근본 원인 조사 없이 수정 금지.** 4단계(근본원인 조사 → 패턴 분석 → 가설 검증 → 구현). 다층 시스템은 경계마다 계측 로그 추가

*   `verification-before-completion` — 완료·통과 주장 전. **Iron Law: 신선한 검증 증거 없이 완료 선언 금지.** 명령 실행 → 출력 전체 읽기 → exit code 확인 → 그다음 주장. 서브에이전트의 "성공" 보고도 VCS diff로 독립 검증

*   `dispatching-parallel-agents` — 독립적인 실패/작업 2개 이상. 문제 도메인당 에이전트 1개, **같은 응답에 여러 spawn = 병렬**

*   `receiving-code-review` — 리뷰 피드백 수신 시. "You're absolutely right!" 금지. 읽기 → 이해 → 코드베이스 대조 → 평가 → 기술적 응답. 불명확한 항목이 있으면 구현 전 전부 질문

*   `writing-skills` — 새 스킬 작성·테스트. 코어 기여 시 필수


* * *

## 7. Codex 특화 운영 규칙 (`references/codex-tools.md`)

### 서브에이전트 spawn

*   자식에게 깨끗한 컨텍스트: `spawn_agent {fork_turns: "none"}`. 기본값 `"all"`은 내 전체 트랜스크립트를 복사한다.

*   Codex 0.145+: `~/.codex/agents/`의 role 파일을 `agent_type`으로 isolated fork에 붙일 수 있음.

*   Full-history fork도 `model`, `reasoning_effort` 오버라이드는 허용(`agent_type`만 거부). isolated fork가 SDD 기본인 이유는 컨텍스트 위생 때문.

*   **모든 spawn에** `model`**과** `reasoning_effort`**를 함께 명시.** `model`만 지정하면 effort가 그 모델의 기본값으로 조용히 리셋된다. 자신이 spawn된 자식으로서 fan-out할 때도 동일.

*   모델 이름을 스킬·표·옛 세션에서 그대로 복사하지 말 것. V2는 V2 호환 프리셋만 허용하고 나머지는 하드 에러.


### Fix 라운드

*   implementer 재개는 `followup_task`. 메시지 전달 + 턴 트리거 + 하네스가 evict한 자식도 투명하게 재로드.

*   "spawn된 에이전트에는 다시 메시지를 못 보낸다"는 가정으로 새 implementer를 띄우지 말 것. V2에서는 항상 가능.


### 라이프사이클

*   V2에는 `close_agent`가 없음. 완료된 자식은 슬롯 필요 시 자동 evict, 안 닫아도 비용 없음.

*   V1에서만 `close_agent` 존재 → 리뷰 반환 시 리뷰어 닫기, 태스크 리뷰 통과 후 implementer 닫기.


### 대기 (`wait_agent`)

*   **이벤트 구독이지 폴링이 아님.** 긴 대기도 자식의 메일박스 활동 즉시 깨어난다. 짧은 타임아웃 폴링은 툴콜·컨텍스트 재청구만 낭비(측정 세션에서 wait 호출의 약 2/3이 짧은 폴 타임아웃).

*   로컬 작업(원장 갱신, 다음 리뷰 패키징, 리포트 읽기)이 남아 있으면 **대기하지 말고 일한다.** 완료 결과는 다음 턴에 메일박스로 도착.

*   진짜로 idle일 때만 `timeout_ms` 300000~600000(5~10분) 단위로 대기. 매 구간 후 상태 한 줄 → `list_agents` → 보고 없이 끝난 자식 추적. **5분 미만 폴을 연속으로 쌓지 말 것.**

*   완료 메일은 idle 컨트롤러를 깨우지 못하므로 그 공백을 덮는 것이 `wait_agent`의 유일한 역할. 타임아웃은 다음 구간을 줄이라는 신호가 아니라 reconcile하라는 신호.


### 환경 감지 (워크트리 생성·브랜치 마무리 전, 읽기 전용 git)

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

*   `GIT_DIR != GIT_COMMON` → 이미 linked worktree(생성 생략). 단, 서브모듈 여부는 `git rev-parse --show-superproject-working-tree`로 별도 확인.

*   `BRANCH` 비어 있음 → detached HEAD(샌드박스에서 branch/push/PR 불가).


### Codex App에서 마무리

샌드박스가 브랜치/푸시를 막으면(외부 관리 워크트리의 detached HEAD): 모든 작업을 커밋하고 사용자에게 App 네이티브 컨트롤을 안내한다.

*   **"Create branch"** — 브랜치 이름 지정 후 App UI로 commit/push/PR

*   **"Hand off to local"** — 사용자의 로컬 체크아웃으로 작업 이전


에이전트는 테스트 실행, 스테이징, 추천 브랜치명·커밋 메시지·PR 설명 출력까지는 가능.

* * *

## 8. Subagent-Driven Development 실무 포인트

*   **Setup**: 워크트리 확보 → `scripts/sdd-workspace PLAN_FILE`로 플랜별 디렉터리(`.superpowers/sdd/<plan-basename>/`) 확인 → `progress.md` 원장 확인(첫 줄이 내 플랜을 가리키면 `Task N: complete` 항목은 재디스패치 금지) → 플랜과 Spec 읽기 → 태스크 간 충돌 사전 스캔(표 형태로 원장에 기록)

*   **디스패치**: `scripts/task-brief PLAN_FILE N`으로 브리프 파일 생성. 프롬프트에는 (1) 프로젝트 내 위치 한 줄 (2) 브리프 경로 (3) 이전 태스크의 인터페이스 (4) 모호성 해결 (5) 리포트 파일 경로만. **플랜 전체를 서브에이전트에게 읽히지 않는다.** 이전 태스크 요약을 누적해 붙이지 않는다.

*   **모델 선택**: 기계적 구현(1~2파일, 완전한 스펙) → 저가 모델 / 통합·판단 → 표준 모델 / 설계·최종 리뷰 → 최고 성능 모델. 리뷰어와 산문 기반 구현자는 중급 모델이 하한(저가 모델은 턴 수가 2~3배로 늘어 총비용이 더 클 수 있음). fix 4~5라운드는 한 단계 위 모델.

*   **Fix 루프**: 최대 5라운드. R≤3은 `followup_task`로 implementer 재개, R≥4는 새 implementer + 상위 모델. `re-review-prompt.md`로 범위 한정 재리뷰. 5회 초과 시 컨트롤러가 각 finding을 판정.

*   **Ruling, not stall**: 플랜 충돌·모호성은 스스로 판정하고 원장에 `Ruling: <결정> — <이유> — <틀렸을 때 비용>` 기록 후 계속. **멈추는 경우는 4가지만**: 비가역·파괴적 작업 / 보안 민감 작업 / 워크트리 밖 부작용(merge, 공유 브랜치 push, publish) / 모든 경로가 추측인 망가진 플랜.

*   **소형 동형 태스크는 배치**: 같은 종류의 한 줄 수정이 여러 파일에 반복되면 서브에이전트 하나에 묶어 디스패치.

*   Implementer/Reviewer는 자체 서브에이전트를 생성하지 않는다(중복 리뷰 방지).

*   최종 리뷰가 깨끗하면 워크스페이스 삭제 → `finishing-a-development-branch`.


* * *

## 9. Codex에서 자주 하는 실수

*   `multi_agent = true` 없이 SDD 시도 → 서브에이전트 도구가 없음. 도구가 없으면 없는 도구 호출을 지어내지 말고 `executing-plans`로 대체하거나 인라인 실행

*   `spawn_agent`에 `model`만 지정 → `reasoning_effort` 누락으로 비용·품질 어긋남

*   `fork_turns` 기본값(`"all"`)으로 spawn → 자식에 컨텍스트 오염

*   짧은 `wait_agent` 폴링 반복 → 툴콜 낭비. 5~10분 단위 + 사이사이 `list_agents`

*   fix 라운드에 새 implementer 디스패치 → `followup_task`로 재개할 것

*   main/master에서 사용자 동의 없이 구현 시작 → 금지

*   서브에이전트 성공 보고를 그대로 신뢰 → `git diff`로 검증

*   "Should pass", "Looks correct" 같은 표현 → 검증 명령 실행 후에만 주장

*   리뷰 피드백에 "You're absolutely right" → 기술적 재진술 또는 반박


* * *

## 10. 이 저장소에 기여할 때 (CLAUDE.md 요약 — Codex 에이전트에도 동일 적용)

*   PR 거절률 94%. `.github/PULL_REQUEST_TEMPLATE.md` 전 항목을 실제 내용으로 채울 것

*   기존 PR(open+closed) 검색 필수, 중복이면 중단

*   실제로 경험한 문제만. "리뷰 에이전트가 지적함"은 문제 진술이 아님

*   모델·하네스·버전·설치 플러그인을 PR에 공개

*   사람이 전체 diff를 검토·승인한 뒤 제출. 타깃 브랜치는 `dev`

*   스킬 내용 변경은 eval 전후 증거 필요(eval 하네스 drill은 Claude Code / Codex / Gemini CLI tmux 세션을 구동)

*   제3자 의존성·도메인 특화 스킬·포크 동기화 PR은 거절


* * *

## 11. 기타

*   브레인스토밍의 visual companion은 Prime Radiant 로고 로드로 버전 텔레메트리를 보냄. 끄려면 `SUPERPOWERS_DISABLE_TELEMETRY=1`.

*   커뮤니티: Discord, GitHub Issues(obra/superpowers). 라이선스 MIT.