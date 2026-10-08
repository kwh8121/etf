# 개발 흐름 설계: Spec Kit + Superpowers — R1 (레포 직접 검증 반영)

*   검증 방식: git clone을 쓸 수 없는 환경이었다. 그래서 GitHub 웹 페이지와 raw 파일을 fetch로 직접 읽었다. 실행 검증은 하지 않았다.
    
*   조회 시각: 2026-09-23 14:13 KST
    
*   spec-kit: main HEAD `67ab049` (2026-09-23), 최신 릴리스 v1.0.10 `b5d97b4` (2026-09-22)
    
*   superpowers: main HEAD `5bf4e78` = v6.4.1 (2026-09-19)
    
*   직접 읽은 파일
    *   superpowers: `skills/subagent-driven-development/SKILL.md`, `skills/subagent-driven-development/scripts/task-brief`, `skills/writing-plans/SKILL.md`, `skills/brainstorming/SKILL.md`, `hooks/hooks.json`, `README.md`
        
    *   spec-kit: `README.md`, `templates/commands/` 목록, `templates/commands/converge.md`, `templates/tasks-template.md`, 릴리스 페이지, 커밋 로그
        
*   읽지 못한 파일: spec-kit `implement.md`, `tasks.md`(command), `plan.md` 본문, superpowers TDD·verification SKILL.md 본문. 이 파일들에 기댄 판단은 R0(가이드 문서 기준) 그대로 두었다.
    

* * *

## 0. R0 대비 변경 사항

| # | R0 내용 | 레포에서 확인한 내용 | 조치 |
| --- | --- | --- | --- |
| 1 | Superpowers의 진행 상태는 TodoWrite에만 남는다 | **틀렸다.** v6.4.1 SDD는 plan별 ledger `.superpowers/sdd/<plan>/progress.md`에 `Task N: complete`를 기록한다. 재개할 때 이 ledger를 먼저 읽는다 (SDD SKILL.md Setup). 다만 git-ignored 파일이고, 최종 리뷰를 통과하면 삭제된다 | 상태 지속성 점수를 2→4로 올렸다. 통합안의 핵심 근거가 약해졌으므로 결론을 바꿨다 |
| 2 | SDD의 입력은 `tasks.md` | **이대로는 동작하지 않는다.** `scripts/task-brief`는 awk로 `^#+ Task N` 헤딩만 추출한다. `tasks.md`는 `- [ ] T001` 형식이라 스크립트가 exit 3 "task N not found"로 끝난다 (코드를 읽고 판단했고, 실행해 보지는 않았다) | writing-plans를 "브리지"로 다시 켠다 (§3-1의 9단계) |
| 3 | writing-plans는 끈다 | 브리지로 필요하다. 게다가 plan 헤더에 `Spec:` 포인터와 Global Constraints 섹션이 있어서 spec.md와 constitution을 그대로 실어 나를 수 있다. 저장 위치는 사용자 설정으로 바꿀 수 있다 | 켜되, 입력과 출력 위치를 고정한다 |
| 4 | brainstorming이 끝나면 설계 문서를 쓰지 않고 specify로 넘어간다 | architectural 경로는 설계 문서 작성, 사용자 리뷰, writing-plans 호출로 이어진다. 원문은 "the ONLY skill you invoke after brainstorming is writing-plans"다. 설계 문서 위치는 바꿀 수 있다고 적혀 있다 | 설계 문서는 쓰게 두고 위치만 `specs/_intake/`로 바꾼다. 그 파일을 specify 인자로 넘긴다. 전환이 규칙대로 되는지는 pilot에서 확인한다 |
| 5 | 소규모 작업: brainstorming → writing-plans → SDD | brainstorming에 spike / bounded / architectural 세 경로가 생겼다. bounded는 채팅으로 설계를 제시하고 승인을 받은 뒤 plan 문서 없이 바로 구현한다 | 소규모 경로를 bounded 경로로 바꿨다 |
| 6 | SDD가 3회 실패하면 멈추고 사람에게 에스컬레이션한다 | SDD는 수정 라운드를 최대 5회 돌린다(breaker). 그 뒤에는 controller가 직접 판정(`Ruling:`)을 내리고 계속 진행한다. 멈추는 경우는 4가지뿐이다: 파괴적 작업, 보안 민감 작업, worktree 밖 부작용, 계획 전체 붕괴 | 규칙을 교체했다. Ruling 기록은 workspace와 함께 삭제되므로 `specs/NNN/rulings.md`로 옮겨 커밋하는 단계를 추가했다 |
| 7 | converge가 SDD 실행 후에도 통과하는지 모른다 [추측] | converge.md에 "implement가 현재 tasks.md에 대해 실행된 뒤에만 실행한다"고 명시돼 있다. 체크박스 상태와 무관하게 코드를 직접 평가한다 | "SDD로 실행 완료"를 인자로 넘기는 방식은 유지한다. converge가 추가한 task는 새 브리지 plan 파일로 처리한다 |
| 8 | tasks 단계의 게이트: 테스트 task가 구현 task보다 앞선다 | tasks-template에 "Tests are OPTIONAL — only include them if explicitly requested in the feature specification"이라고 되어 있다 | specify 인자와 constitution 양쪽에 테스트를 요청한다고 명시한다 |
| 9 | 버전 v1.0.9 / v5.1.0, `taskstoissues`는 extension으로 옮겨질 예정 | 실제로는 v1.0.10 / v6.4.1이다. `templates/commands/`에는 `taskstoissues`를 포함한 10개가 그대로 있다. first-party `bugfix` 번들이 새로 생겼다 | 설치할 때 버전을 고정한다. bugfix 번들은 설치하지 않는다 |
| 10 | Superpowers는 superpowers-marketplace에서 설치한다 | 공식 마켓 `superpowers@claude-plugins-official`이 생겼다 | 설치 명령을 바꿨다 |
| 11 | SessionStart 훅 | `hooks.json`에서 SessionStart의 matcher가 `startup|clear|compact`임을 확인했다. compact 후에도 다시 주입된다 | 그대로 둔다 |
| 12 | verification 후 requesting-code-review를 한 번 더 한다 | SDD가 끝날 때 가장 성능 좋은 모델로 브랜치 전체를 최종 리뷰한다 | 중복되는 리뷰 단계를 없앴다 |

* * *

## 1. 결론 (수정)

**기본값: Superpowers 단독 + 훅 2개.** 프로젝트 제약은 writing-plans의 Global Constraints에 넣는다.  
**Spec Kit 통합은 조건부로만 쓴다.** 요구사항 ID(FR/SC) 추적과 converge 감사가 필요한 기능, 그리고 2세션 이상 걸리면서 User Story가 여러 개인 기능이 대상이다.

*   이유: v6.4.1부터 Superpowers가 ledger로 진행 상태를 남긴다. 그래서 R0에서 통합을 권한 주된 근거(상태 유실)가 대부분 사라졌다. Spec Kit에만 있는 이득은 네 가지가 남는다: FR/SC 추적, analyze의 문서 간 일관성 검사, converge의 코드 대 명세 감사, constitution 게이트.
    
*   점수: 통합안 84점, Superpowers+훅 83점이다 [추측]. 차이가 10점 이내이므로 §7 pilot으로 판정한다.
    
*   ETF-signal MVP의 "키움·KRX 데이터만 사용" 제약은 두 방식 모두에 넣을 수 있다. 통합안이면 constitution MUST 원칙에, 단독이면 plan의 Global Constraints에 넣는다. 이 제약 하나만으로는 통합할 이유가 되지 않는다.
    

## 2. 점수 [레포 문서 기준, 실행 검증 없음]

| 기준 (가중치) | Spec Kit | Superpowers v6.4.1 | Superpowers + 훅 | 통합안 | 근거 |
| --- | --- | --- | --- | --- | --- |
| 강제력 (20%) | 2 | 3 | 4 | 4 | Spec Kit 게이트는 모두 프롬프트다. Superpowers는 SessionStart 훅(`hooks/hooks.json`)과 `review-package`의 빈 범위 거부(exit 3) 정도다. 훅 2개를 더하면 4 |
| 검증 루프 (20%) | 2 | 5 | 5 | 5 | tasks-template에서 테스트가 OPTIONAL이다. SDD는 task별 리뷰, 5라운드 수정 루프, 스코프 한정 재리뷰를 둔다 |
| 상태 지속성 (15%) | 4 | 4 | 4 | 5 | tasks.md `[X]` / SDD ledger(git-ignored, 끝나면 삭제) / 통합안은 두 가지에 T-ID 커밋까지 더한다 |
| 작업 분해 (15%) | 4 | 5 | 5 | 5 | writing-plans의 Task Right-Sizing, 2~5분 단위 step, Interfaces 블록 |
| 완료 판정 (10%) | 4 | 4 | 4 | 5 | converge.md는 "completion claims are not evidence"로 본다. SDD 최종 리뷰와 "Rulings I made" 보고. 통합안은 converge까지 거친다 |
| 컨텍스트 비용 (10%) | 3 | 2 | 2 | 2 | SDD SKILL.md가 길다. 줄 수는 측정하지 않았다 [추측] |
| 도입 비용 (10%) | 3 | 4 | 4 | 2 | 통합안은 두 도구와 브리지, 규칙까지 필요하다 |
| **합계 (100점)** | **60** | **79** | **83** | **84** |  |

## 3. 워크플로

### 3-0. 라우팅 (CLAUDE.md 규칙)

| 작업 유형 | 흐름 |
| --- | --- |
| 버그, 테스트 실패 | systematic-debugging → TDD → verification-before-completion → finishing |
| bounded (이 레포에 이미 있는 흐름을 바꾸는 작업, 파일 1~2개) | brainstorming(bounded: 채팅으로 짧은 설계 → 명시적 승인) → TDD → verification → requesting-code-review → finishing |
| architectural, 추적성 불필요 (**기본값**) | brainstorming(architectural) → using-git-worktrees → writing-plans → SDD(최종 리뷰 포함) → verification → finishing |
| architectural이면서 FR/SC 추적이 필요하거나, 2세션 이상 + User Story 2개 이상 | §3-1 통합 흐름 |

### 3-1. 통합 흐름 (단계 / 담당 / 입력 → 출력 / 넘어가는 조건)

0.  **프로젝트 1회 —** `/speckit-constitution` (main)
    *   출력: `.specify/memory/constitution.md`
        
    *   조건: 플레이스홀더 0개
        
1.  **brainstorming (architectural 경로)**
    *   출력: `specs/_intake/YYYY-MM-DD-<topic>-design.md`. 사용자가 이 파일을 리뷰한다. main에서 커밋해도 된다(훅 허용 경로).
        
    *   조건: 섹션별 승인과 문서 리뷰 승인
        
2.  **using-git-worktrees**
    *   조건: baseline 테스트 통과
        
    *   specify보다 먼저 한다. `.specify/feature.json`이 로컬 파일이라는 추정 때문이다 [추측]
        
3.  `/speckit-specify` — 인자: "`specs/_intake/…-design.md` 기준. TDD 필수: 모든 User Story에 테스트 task를 요청한다."
    *   조건: User Story, P1~P3 우선순위, 측정 가능한 Success Criteria가 있다
        
4.  `/speckit-clarify` — `[NEEDS CLARIFICATION]`이 1개 이상일 때만 한다
    
5.  `/speckit-plan`
    *   조건: 설계 전후 Constitution Check 모두 ERROR 0
        
6.  `/speckit-tasks`
    *   조건: 각 User Story Phase에서 테스트 task가 구현 task보다 앞에 있다
        
7.  `/speckit-analyze`
    *   조건: CRITICAL 0, HIGH 0. 이 단계가 끝나면 `specs/NNN-*/`를 커밋한다
        
8.  **브리지 — writing-plans**
    *   입력: spec.md, plan.md, tasks.md
        
    *   출력: `specs/NNN-*/sp-plan.md`
        
    *   헤더 `Spec:`에는 `specs/NNN-*/spec.md`를 적는다
        
    *   Global Constraints에는 constitution의 MUST 줄과 plan.md의 기술 제약을 원문 그대로 넣는다
        
    *   헤딩은 `### Task K: <이름> [T010, T012]` 형식으로 쓴다. tasks.md의 Phase 순서를 지킨다
        
    *   조건: `bridge-check.sh` 통과(모든 T-ID가 헤딩에 있음). 통과하면 커밋한다
        
9.  **subagent-driven-development** — `PLAN_FILE=specs/NNN-*/sp-plan.md`
    *   task가 완료되면(리뷰 clean이거나, breaker 후 parked-with-ruling이면) 오케스트레이터가 tasks.md의 해당 T-ID를 `[X]`로 바꾸고 `T010,T012: <설명>`으로 커밋한다
        
    *   SDD Finish에서 workspace를 삭제하기 **전에** ledger의 `Ruling:` 줄을 `specs/NNN-*/rulings.md`에 append하고 커밋한다
        
10.  `/speckit-converge` — 인자: "tasks.md는 superpowers SDD로 실행 완료됨. implement 대신 SDD를 썼다."
     *   결과가 `tasks_appended`이면: 새 Phase의 T-ID만 담은 브리지 plan `sp-plan-conv1.md`를 만들고 10단계로 돌아간다. 새 파일이므로 ledger가 따로 생긴다
         
     *   결과가 `converged`이면 12단계로 간다
         
11.  **verification-before-completion**
     *   전체 테스트, 린터, 빌드를 새로 실행한다
         
     *   spec.md의 SC-###를 한 줄씩 대조한다
         
12.  **finishing-a-development-branch**
     *   최종 리뷰는 10단계 SDD 안에서 이미 했으므로 여기서 다시 하지 않는다
         

### 3-2. 재개

*   SDD 실행 중이면 ledger `.superpowers/sdd/<plan>/progress.md`가 1차 기준이다. SDD가 알아서 읽는다.
    
*   ledger가 사라졌으면(`git clean -fdx` 등) tasks.md의 `[X]`와 git log의 `T###` 커밋으로 복원한다.
    

```bash
F=$(ls -d specs/*/ | tail -1)tasks.md; echo "완료 $(grep -c '^- \[X\]' "$F") / 전체 $(grep -cE '^- \[[ X]\]' "$F")"
git log --oneline | grep -E '^[0-9a-f]+ T[0-9]{3}' | head -20
```

## 4. 장단점, 공백, 보완책

**장점**

1.  요구사항 추적. FR/SC → T-ID → 커밋 → converge가 한 줄로 이어진다 (converge.md Step 3~7).
    
2.  드리프트 검사가 3겹이다. analyze(문서 간), SDD task 리뷰(task 단위), converge(코드 전체)가 각각 다른 범위를 본다.
    
3.  복구 지점이 3개다. ledger, tasks.md `[X]`, T-ID 커밋.
    
4.  판단 기록이 남는다. SDD의 Ruling을 rulings.md로 커밋하므로 workspace가 삭제된 뒤에도 기록이 남는다.
    
5.  브리지를 쓰면 task가 2~5분 단위로 쪼개지고 테스트 코드 전문이 들어간다. R0 단점 2("task 단위가 거칠다")가 해소된다.
    

**단점**

1.  task 목록이 두 벌이 된다(tasks.md와 sp-plan.md).
    *   완화: sp-plan은 tasks.md에서만 생성한다. tasks.md를 수정하면 sp-plan을 다시 만든다. bridge-check를 필수로 돌린다.
        
2.  brainstorming의 종착지가 writing-plans로 고정돼 있어서, specify를 중간에 끼워 넣는 CLAUDE.md 규칙이 스킬보다 우선하는지 확인되지 않았다 [추측].
    
3.  절차 비용이 크다. 도입 비용 2점이고, Superpowers+훅보다 1점 높을 뿐이다 [추측].
    
4.  converge는 전제 조건으로 implement 실행을 요구한다. 이 조건을 인자로 우회하는 방식이다.
    
5.  상시 로드되는 컨텍스트 양을 측정하지 않았다. §8의 2단계로 측정한다.
    

**4대 실패 패턴**
| 패턴 | Spec Kit 단독 | Superpowers v6.4.1 단독 | 통합안 | 막는 장치 |
| --- | --- | --- | --- | --- |
| one-shot 시도 | 부분 차단 | 차단 | 차단 | writing-plans task 분해, task 1개당 서브에이전트 1개 |
| 조기 완료 선언 | 부분 차단 | 차단 | 차단 | verification, SDD 최종 리뷰, converge |
| state 유실 | 차단 | **부분 차단** (ledger가 git-ignored이고 완료 후 삭제됨) | 차단 | ledger, tasks.md `[X]`, T-ID 커밋 |
| 미검증 기능 출하 | **방치** | 차단 | 차단 | task 리뷰, Stop 훅 |

**보완 우선순위**

1.  최소 수정: 훅 2개와 `bridge-check.sh`를 추가한다.
    
2.  조합: 이 문서의 조건부 통합안.
    
3.  교체: 필요 없다.
    

## 5. 충돌 점검과 해결

| 충돌 | 내용 | 해결 |
| --- | --- | --- |
| 자동 발동 | brainstorming architectural 경로는 writing-plans로만 넘어간다. 구현 단계에서는 `/speckit-implement`와 SDD가 겹친다 | CLAUDE.md 라우팅으로 덮어쓴다. `/speckit-implement`는 쓰지 않는다 |
| 산출물 경로 | `docs/superpowers/specs`, `docs/superpowers/plans`와 `specs/NNN-*/`가 따로 논다 | 두 스킬 모두 위치 override를 허용한다. 설계 문서는 `specs/_intake/`, plan은 `specs/NNN-*/sp-plan.md`에 둔다 |
| 진행 추적 | ledger, tasks.md, TodoWrite가 세 벌로 존재한다 | ledger는 작업 중 1차 기준, tasks.md `[X]`는 커밋된 정본, TodoWrite는 캐시로만 쓴다 |
| 훅 이벤트 | Superpowers는 SessionStart만 쓴다. Spec Kit은 `extensions.yml`이 없다 | 새로 넣을 PreToolUse, Stop 훅과 겹치지 않는다 |
| main 편집 차단 vs 설계 문서 커밋 | brainstorming은 worktree 전에 main에서 설계 문서를 쓴다 | 훅 허용 경로에 `specs/_intake/`와 `docs/superpowers/`를 넣는다 |
| 멈춤 정책 | SDD는 "Rulings, not stalls"(판정하고 계속 진행)이고, analyze는 수정 전에 사용자 승인을 받는다 | 두 규칙이 서로 다른 단계에 걸려 있어 충돌하지 않는다 |
| 버그 흐름 | Spec Kit bug extension과 bugfix 번들이 systematic-debugging과 겹친다 | 설치하지 않는다 |

## 6. 훅과 스크립트

`.claude/hooks/block-main-edit.sh` — PreToolUse. main/master에서 코드 편집을 막는다.

```bash
#!/usr/bin/env bash
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
case "$branch" in
  main|master)
    input=$(cat)
    if echo "$input" | grep -qE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*(\.specify/|CLAUDE\.md|\.claude/|specs/_intake/|docs/superpowers/)'; then exit 0; fi
    echo "main/master에서 코드 편집 금지. superpowers:using-git-worktrees로 격리 후 진행하라." >&2
    exit 2 ;;
esac
exit 0
```

`.claude/hooks/stop-gate.sh` — Stop. 코드 변경이 있는데 테스트가 실패하면 세션 종료를 막는다. R0와 같다.

```bash
#!/usr/bin/env bash
input=$(cat)
echo "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && exit 0
git diff --quiet HEAD -- . ':!specs' ':!.specify' ':!docs' 2>/dev/null && exit 0
TEST_CMD="${TEST_CMD:-pytest -q}"
if ! out=$($TEST_CMD 2>&1); then
  echo "커밋되지 않은 코드 변경 + 테스트 실패 상태. verification-before-completion 위반. systematic-debugging을 적용하라." >&2
  echo "$out" | tail -n 30 >&2
  exit 2
fi
exit 0
```

`scripts/bridge-check.sh` — 브리지 plan이 모든 T-ID를 포함하는지 검사한다.

```bash
#!/usr/bin/env bash
d=${1:?usage: bridge-check.sh specs/NNN-feature}
heads=$(grep -hE '^#+[[:space:]]+Task[[:space:]]+[0-9]+' "$d"/sp-plan*.md)
missing=""
for t in $(grep -oE '^- \[[ X]\] T[0-9]{3}' "$d/tasks.md" | grep -oE 'T[0-9]{3}' | sort -u); do
  echo "$heads" | grep -q "$t" || missing="$missing $t"
done
if [ -z "$missing" ]; then echo "OK: 모든 T-ID가 브리지 plan 헤딩에 있음"; else echo "누락:$missing" >&2; exit 1; fi
```

`.claude/settings.json`

```json
{
  "hooks": {
    "PreToolUse": [{"matcher": "Edit|Write|MultiEdit", "hooks": [{"type": "command", "command": "bash .claude/hooks/block-main-edit.sh"}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "bash .claude/hooks/stop-gate.sh"}]}]
  }
}
```

한계

*   추적되지 않는(untracked) 새 파일은 `git diff`에 잡히지 않는다.
    
*   Stop 훅은 메인 세션에만 걸린다. 서브에이전트 종료는 SubagentStop 이벤트라 이 훅이 적용되지 않는다 [추측].
    

## 7. Pilot (필수: 점수 차 1점)

*   과제: REST 엔드포인트 1개와 테스트 3개. 수용 기준 체크리스트 10개를 미리 고정한다. 중간에 세션을 1회 강제로 끊는다.
    
*   A: Superpowers v6.4.1 + 훅 2개
    
*   B: 통합안(§3-1)
    
*   비교 항목: 완료까지 턴 수, 작성된 테스트 수, 첫 실행 테스트 통과율, 사람 개입 횟수, 생성된 산출물 파일 수, 세션 재개 후 올바른 task에서 이어갔는지, 수용 기준 충족 수(0~10), brainstorming이 끝난 뒤 specify로 전환됐는지(B만)
    
*   판정: 다음 두 조건이 모두 맞으면 A를 기본값으로 확정하고 통합안은 폐기한다.
    *   B의 턴 수가 A의 1.5배 이상이다
        
    *   B의 수용 기준 충족 수가 A보다 2개 이상 많지 않다
        

## 8. 바로 적용할 최소 단계

1.  **설치** (버전 고정)
    
    ```bash
    uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@v1.0.10
    specify init --here --integration claude
    specify check
    echo ".superpowers/" >> .gitignore
    ```
    
    Claude Code 안에서 실행한 뒤 재시작한다.
    
    ```
    /plugin install superpowers@claude-plugins-official
    ```
    
2.  **상시 로드 컨텍스트 측정** (경로는 [추측]이다. 설치 위치에 맞게 조정한다)
    
    ```bash
    wc -l .claude/skills/speckit-*/SKILL.md | tail -1
    find ~/.claude/plugins -path '*superpowers*' -name SKILL.md -exec wc -l {} + | tail -1
    ```
    
3.  **constitution 작성** (main에서 실행하고 커밋)
    
    ```
    /speckit-constitution 다음을 MUST 원칙으로 포함하라. (1) 모든 feature spec은 테스트를 명시적으로 요청하며, 모든 User Story Phase는 테스트 task가 구현 task보다 앞선다. 실패하는 테스트를 먼저 작성하고 실패를 확인한 뒤에만 프로덕션 코드를 쓴다. (2) 완료 주장은 같은 메시지에서 새로 실행한 테스트·린터·빌드 출력으로만 한다. (3) 모든 구현은 main이 아닌 격리 브랜치/worktree에서 한다. (4) task 완료마다 커밋을 남기고 커밋 메시지에 task ID(T###)를 포함한다.
    ```
    
    ETF-signal MVP에 적용할 때는 "투자·시장 데이터는 키움·KRX 제공분만 사용한다"를 MUST로 추가한다. Superpowers 단독 흐름에서는 같은 문장을 writing-plans의 Global Constraints에 넣는다.
    
4.  **CLAUDE.md 라우팅 규칙**
    
    ```
    ## 개발 흐름 라우팅 (Superpowers 기본, Spec Kit 조건부)
    - 버그: systematic-debugging → TDD → verification-before-completion → finishing. Spec Kit 흐름을 타지 않는다.
    - bounded(이 레포의 기존 흐름 변경, 1~2 파일): brainstorming bounded 경로 → 승인 → TDD → verification → requesting-code-review → finishing. plan 문서를 만들지 않는다.
    - architectural 기본: brainstorming → using-git-worktrees → writing-plans → subagent-driven-development → verification → finishing.
    - architectural + FR/SC 추적 필요 또는 2세션 이상·User Story 2개 이상: 통합 흐름.
      - brainstorming 설계 문서는 specs/_intake/YYYY-MM-DD-<topic>-design.md에 저장하고, 사용자 리뷰 후 writing-plans가 아니라 using-git-worktrees → /speckit-specify(인자=설계 문서 경로 + "TDD 필수: 테스트 task 요청")로 간다.
      - /speckit-clarify(필요 시) → /speckit-plan → /speckit-tasks → /speckit-analyze(CRITICAL·HIGH 0) → 커밋.
      - 그다음 writing-plans를 브리지로 실행한다: 입력=spec.md·plan.md·tasks.md, 출력=specs/NNN-*/sp-plan.md, 헤더 Spec:=specs/NNN-*/spec.md, Global Constraints=constitution MUST 원문, 헤딩=### Task K: <이름> [T###, ...]. scripts/bridge-check.sh 통과 후 커밋.
      - subagent-driven-development(PLAN_FILE=sp-plan.md). task 완료 시 tasks.md 해당 T-ID를 [X]로 바꾸고 "T###: <설명>" 커밋. SDD Finish에서 workspace 삭제 전에 ledger의 "Ruling:" 줄을 specs/NNN-*/rulings.md에 append·커밋.
      - /speckit-converge(인자: "SDD로 실행 완료"). 추가 task가 있으면 sp-plan-convN.md 브리지를 만들어 SDD 반복.
    - /speckit-implement, executing-plans는 사용하지 않는다(서브에이전트 불가 환경 제외).
    - 진행 상태: 작업 중에는 SDD ledger, 커밋된 정본은 tasks.md [X], TodoWrite는 캐시.
    ```
    
5.  **§6의 훅 2개,** `bridge-check.sh`**, settings.json을 추가한다.** `TEST_CMD`는 프로젝트 테스트 명령으로 바꾼다.
    
6.  **§7 pilot으로 A/B를 1회씩 돌린다.** 다음 4가지를 확인한다.
    *   B에서 brainstorming이 끝난 뒤 specify로 전환되는지
        
    *   B에서 `task-brief`가 sp-plan.md의 Task를 추출하는지
        
    *   task마다 `[X]`와 커밋이 1:1로 남는지
        
    *   세션을 끊고 재개했을 때 올바른 task에서 이어가는지