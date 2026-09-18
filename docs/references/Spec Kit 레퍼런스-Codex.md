# Spec Kit (github/spec-kit) — Codex CLI 에이전트용 레퍼런스

> 출처: repomix-output-github-spec-kit.md (README.md, docs/quickstart.md, docs/reference/agentic-sdd.md, docs/reference/integrations.md, docs/concepts/complex-features.md, src/specify_cli/integrations/codex/**init**.py, extensions/agent-context/README.md)
> 대상: OpenAI Codex CLI에서 Spec Kit 스킬을 사용하는 개발 에이전트

* * *

## 1. Spec Kit이란

Spec Kit은 AI 코딩 에이전트에 **구조화된 프로세스, 재사용 가능한 템플릿, 문서화된 산출물**을 제공하는 GitHub의 오픈소스 툴킷(MIT)이다. 핵심은 **Spec-Driven Development(SDD, 명세 주도 개발)**: 코드보다 명세(spec)를 먼저 만들고, 그 명세가 계획 → 태스크 → 구현을 직접 이끌도록 한다.
세 가지 독립적인 프로세스 진입점을 제공한다(순차 단계가 아님):
| 필요한 것 | 프로세스 | 결과물 |
| --- | --- | --- |
| 기능/애플리케이션 구축 | SDD (코어 내장) | 명세 → 계획 → 구현 → 수렴(converge) |
| 버그 진단·수정 | Bug fixing (확장, `bug`) | 원인 평가, 범위 한정 수정, 검증 기록 |
| 아이디어 투자 여부 판단 | Idea assessment (확장, `assess`) | 근거 기반 go / needs-clarification / kill 결정 |

* * *

## 2. 사용 목적

*   **의도(what/why)를 구현(how)보다 먼저 확정**: 기술 스택은 `plan` 단계에서만 다룬다. 명세 단계에서는 사용자 행동과 목표에만 집중.

*   **원샷 코드 생성이 아닌 다단계 정제**: specify → clarify → plan → checklist → tasks → analyze → implement → converge 로 나눠 각 단계 결과를 사람이 검토한다.

*   **가드레일(constitution) 기반 일관성**: 프로젝트 원칙을 한 번 정의하고 이후 모든 단계가 그 원칙에 맞춰 평가된다.

*   **적용 범위**: 신규(greenfield) 개발, 여러 기술 스택 병렬 탐색, 기존 시스템(brownfield) 점진 개선/현대화 모두 지원.


* * *

## 3. 장점

1.  **에이전트 컨텍스트 붕괴 방지** — 단계별 산출물(`spec.md`, `plan.md`, `tasks.md`)이 파일로 남아, 긴 세션에서도 에이전트가 계획을 잃지 않는다. 완료된 태스크는 `tasks.md`에 `[X]`로 표시되어 다음 실행이 이어서 진행된다.

2.  **품질 게이트 내장** — `clarify`(모호성 해소), `checklist`(요구사항 단위테스트), `analyze`(읽기 전용 일관성 검사), `converge`(구현 vs 명세 갭 탐지, append-only)로 구현 전·후 품질을 검증한다.

3.  **의존성 순서가 있는 태스크** — `tasks.md`는 Setup → Foundational → 사용자 스토리별 → Polish 단계로 정리되고 병렬 가능 태스크 `[P]`가 표시된다.

4.  **에이전트 중립** — 40개 이상의 코딩 에이전트를 지원. 같은 프로세스를 Codex, Claude Code, Copilot 등에서 동일하게 쓸 수 있고, 한 프로젝트에 여러 통합을 동시 설치 가능(multi-install safe).

5.  **Git 불필요** — 활성 기능(feature)은 `.specify/feature.json`이 추적한다. Git 브랜치 워크플로우는 `git` 확장으로 선택 설치.

6.  **확장성** — Extensions(기능 추가), Presets(기존 동작 조정), Workflows(단계 자동화), Bundles(역할 기반 세트), 프로젝트 로컬 오버라이드(`.specify/templates/overrides/`).

7.  **기존 프로젝트에 즉시 적용** — `specify init --here --force`로 기존 코드베이스에 그대로 도입. 기존 시스템 전체를 명세화할 필요 없이 다음 변경 한 건부터 시작.


* * *

## 4. Codex CLI 통합 특성 (중요)

| 항목 | 값 |
| --- | --- |
| 통합 키 | `codex` |
| 설치 형태 | 스킬 기반 (`--skills` 기본값 `True`, commands 방식은 deprecated) |
| 스킬 설치 경로 | `.agents/skills/speckit-<name>/SKILL.md` |
| **스킬 호출 문법** | `$speckit-<name>` (예: `$speckit-specify`) — 슬래시(`/`)가 아닌 달러(`$`) 접두사 |
| 인수 전달 | `$ARGUMENTS` 치환 |
| 이벤트/훅 설정 파일 | `.codex/config.toml` (TOML 형식) |
| 지원 이벤트 | SessionStart, PreToolUse, PostToolUse, SessionEnd, UserPromptSubmit, Stop |
| 비대화형 실행 | `codex exec "<prompt>"` (+ `--model`, `--json`). 실행 파일은 환경변수 `SPECKIT_INTEGRATION_CODEX_EXECUTABLE`로 오버라이드 가능 |
| 컨텍스트 파일 | `AGENTS.md` (opt-in `agent-context` 확장 설치 시 관리) |
| 요구사항 | Codex CLI 설치 필요 (`requires_cli: True`) |
| multi-install safe | 예 |

**주의**: `.agents/skills/` 디렉터리는 Zed, Muse Code, Docker Agent 통합과 공유된다. 같은 프로젝트에 이들을 함께 설치하면 경로 충돌에 유의.

* * *

## 5. 사용법

### 5.1 설치 및 초기화 (터미널)

전제: Python 3.11+, uv, Codex CLI.

```bash
# CLI 설치
uv tool install specify-cli

# 새 프로젝트
specify init my-project --integration codex
cd my-project

# 기존 프로젝트에 도입 (먼저 커밋/브랜치로 리뷰 가능한 기준선 확보)
specify init --here --force --integration codex

# CI/자동화: 대화형 프롬프트 없이
specify init my-project --integration codex --non-interactive --script sh
```

스크립트 변형은 `--script sh|ps|py`로 선택. Git 브랜치 워크플로우가 필요하면 `specify extension add git`.

### 5.2 SDD 워크플로우 (Codex 채팅 안에서 `$speckit-*` 스킬 호출)

스킬은 **터미널 명령이 아니라 에이전트 채팅에서 하나씩 호출**하고, 결과를 검토한 뒤 다음 단계로 넘어간다.
**짧은 경로(소규모 기능)**

```text
$speckit-constitution <프로젝트 원칙>        # 프로젝트당 1회
$speckit-specify <기능 설명: what/why, 기술 스택 제외>
$speckit-plan <기술 스택·아키텍처·제약>
$speckit-tasks
$speckit-implement
$speckit-converge
```

**전체 경로(프로덕션 기능, 품질 게이트 포함)**

1.  `$speckit-constitution` — 프로젝트 원칙 수립 (1회)

2.  `$speckit-specify` — 자연어 설명으로 `spec.md` 생성. `checklists/requirements.md` 내장 체크리스트도 함께 관리

3.  `$speckit-clarify [포커스 영역]` — 최대 5개 질문으로 모호성 해소, 답변을 spec에 반영. 여러 번 실행 가능

4.  `$speckit-plan <기술 스택>` — 설계 산출물(`plan.md` 등) 생성

5.  `$speckit-checklist [포커스]` — 요구사항 품질 체크리스트("요구사항의 단위 테스트"). 리뷰어가 소유하며 `[x]`는 요구사항 품질 승인 의미(구현 완료 아님)

6.  `$speckit-tasks` — 의존성 순서의 `tasks.md` 생성

7.  `$speckit-analyze` — spec/plan/tasks 간 충돌·갭·모호성 리포트(읽기 전용). 문제가 있으면 소유 단계로 돌아가 수정 후 재실행

8.  `$speckit-implement [범위 지시]` — `tasks.md` 실행. 시작 전 체크리스트 미체크 항목이 있으면 진행 여부를 묻는다(체크리스트 파일은 수정하지 않음)

9.  `$speckit-converge` — 코드베이스를 spec/plan/tasks와 대조. 갭이 있으면 `tasks.md`에 Convergence 섹션으로 태스크 추가 → `$speckit-implement` 재실행 → `Converged` 나올 때까지 반복


선택: `$speckit-taskstoissues` — `tasks.md`를 GitHub 이슈로 변환(GitHub origin 리모트 + GitHub MCP 도구 필요).

### 5.3 예시 프롬프트

```text
$speckit-constitution Create principles focused on code quality, testing, and maintainability.
$speckit-specify Build a photo organizer with albums grouped by date and a tile preview of each album.
$speckit-plan Use Vite with vanilla JavaScript. Keep images local and store metadata in SQLite.
$speckit-tasks
$speckit-implement
$speckit-converge
```

### 5.4 대규모 기능 처리 (컨텍스트 윈도우 보호)

`$speckit-implement`는 자유 형식 입력을 받으므로 실행 범위를 제한할 수 있다.

```text
$speckit-implement only execute tasks T001-T010, then stop and report progress
$speckit-implement only execute the Setup phase, then stop
$speckit-implement Implement only the Setup and Foundational phases. Stop before the user-story features.
```

*   옵션 1: 태스크 수/페이즈 제한 (가장 단순, 권장 기본값)

*   옵션 2: 서브에이전트 지원 시 `[P]` 태스크 위임

*   옵션 3: 둘 결합

*   옵션 4: "spec of specs" — 한 페이즈조차 너무 크면 `roadmap.md`로 하위 기능을 분해해 각각 specify/plan/tasks/implement 사이클 실행 (오버헤드 최대, 최후 수단)


### 5.5 버그 수정 / 아이디어 평가 확장

```bash
specify extension add bug
specify extension add assess
```

```text
$speckit-bug-assess "Submitting an empty password crashes the login form." slug=login-crash
$speckit-bug-fix slug=login-crash
$speckit-bug-test slug=login-crash          # 결과: verified / partial / failed

$speckit-assess-intake "Let users work offline and sync when they reconnect." slug=offline-mode
$speckit-assess-research slug=offline-mode
$speckit-assess-define slug=offline-mode
$speckit-assess-shape slug=offline-mode
$speckit-assess-decide slug=offline-mode    # 결과: go / needs-clarification / kill
```

산출물 위치: `.specify/bugs/<slug>/`, `.specify/assessments/<slug>/`.

### 5.6 AGENTS.md 자동 관리 (agent-context 확장)

```bash
specify extension add agent-context
```

*   `AGENTS.md` 안의 `<!-- SPECKIT START -->` ~ `<!-- SPECKIT END -->` 블록만 관리하며 그 외 내용은 건드리지 않는다.

*   `after_specify`, `after_plan` 훅으로 자동 갱신. 수동 갱신: `$speckit-agent-context-update`.

*   `.specify/extensions/agent-context/agent-context-config.yml`에서 마커, `context_files`(예: AGENTS.md와 CLAUDE.md 동시 동기화) 설정.

*   미설치/비활성 시 Spec Kit은 컨텍스트 파일을 절대 수정하지 않는다.


### 5.7 자주 쓰는 CLI 명령 (터미널)

```bash
specify check                          # 에이전트 CLI 설치 확인
specify version --features --json      # CLI 기능 확인 (에이전트/스크립트용)
specify integration list               # 설치된/사용 가능한 통합
specify integration status --json      # 통합 상태(CI/에이전트용)
specify integration upgrade codex      # Spec Kit 업그레이드 후 스킬 갱신
specify integration use codex          # 기본 통합 전환(확장/프리셋 재등록)
specify extension list / add / remove / update
specify artifact list --json           # 커맨드/템플릿/스크립트 인벤토리
```

* * *

## 6. 에이전트 운영 시 유의사항

*   **활성 기능 추적**: `.specify/feature.json`(또는 `SPECIFY_FEATURE_DIRECTORY` 환경변수)이 기준. `git checkout`만으로는 활성 기능이 바뀌지 않는다.

*   **모노레포**: 가장 가까운 `.specify/`가 프로젝트 루트. 루트에서 멤버 프로젝트를 겨냥하려면 `SPECIFY_INIT_DIR` 설정.

*   **확장/프리셋은 기본(default) 통합에만 등록**된다. Codex가 기본이 아니면 `specify integration use codex`로 재스캐폴딩.

*   **체크리스트** `[x]`**는 리뷰어 판단**. 구현 에이전트가 임의로 체크하면 안 된다.

*   `analyze`는 읽기 전용, `converge`는 `tasks.md` 추가만 가능(코드 수정·삭제 없음). 이 계약을 어기지 않는다.

*   커뮤니티 카탈로그는 discovery-only. 설치는 `specify extension add <name> --from <archive-url>`로 검토 후 개별 설치.

*   스펙 유지 모델(flow-back / flow-forward / spec-as-source)은 팀이 선택. Spec Kit은 강제하지 않는다.


* * *

## 7. 산출물 구조 요약

```text
.specify/
  feature.json                 # 활성 기능 포인터 (gitignore됨)
  memory/constitution.md       # 프로젝트 원칙
  templates/ scripts/ extensions/
  bugs/<slug>/  assessments/<slug>/
specs/<NNN-feature>/
  spec.md  plan.md  tasks.md  checklists/requirements.md  (research.md, data-model.md, contracts/ 등)
.agents/skills/speckit-*/SKILL.md   # Codex 스킬
.codex/config.toml                  # 이벤트 훅
AGENTS.md                            # 컨텍스트 파일 (agent-context 확장 시 관리)
```