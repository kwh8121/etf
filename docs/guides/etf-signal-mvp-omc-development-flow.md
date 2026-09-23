# ETF 신호 MVP — OMC 활용 개발 흐름

> 기준: 2026-09-23, oh-my-claudecode(OMC) 5.5.0, Spec Kit 1.0.10
> 성격: 기존 하네스의 단계에 OMC 도구를 대응시키는 운영 지침. 규칙의 정본을 복제하지 않는다.

## 1. 권위 경계

이 문서는 "어느 단계에서 어떤 OMC 워크플로·에이전트를 쓰는가"만 정한다. 아래 사실은 각 정본을 따르며 여기서 다시 정의하지 않는다.

| 사실 | 정본 |
| --- | --- |
| 다음 작업·순서·완료 상태, `AUTO`/`APPROVE`/`WAIT`/`DECIDE` 라벨 | `docs/plans/NEXT.md` |
| 턴 종료 규칙, 상시 승인 범위, 기본 실행 루프 | `AGENTS.md` "턴 종료 규칙과 상시 승인" |
| 착수·명세·구현·리뷰·배포 단계와 리뷰 판정 | `docs/guides/etf-signal-mvp-development-review-deployment-harness.md` |
| 세션 시작·종료 기록 순서, 중단 기준 | `docs/guides/etf-signal-mvp-continuity-harness.md` |
| 정보 배치 원칙 | `docs/guides/one-fact-one-home.md` |

OMC의 `.omc/` 상태, notepad, 세션 요약은 재개용 캐시다. 작업 완료·승인 상태의 근거로 인용하지 않는다.

## 2. 전체 흐름

```
┌──────────────────────── 세션 시작 ────────────────────────┐
│ npm run continuity:check · git status --short --branch    │
│ NEXT.md 읽기 · .omc/state 확인 (OMC 연속성 가드)          │
└───────────────────────────┬───────────────────────────────┘
                            ▼
                  NEXT.md 항목 라벨 분기
     ┌──────────────┬───────┴──────┬──────────────┐
     ▼              ▼              ▼              ▼
   AUTO          APPROVE         DECIDE          WAIT
     │         (운영 부작용)   (선택지 필요)   (시간·이벤트)
     │              └──────┬───────┘              │
     │                     ▼                      ▼
     │          AskUserQuestion으로 일괄 요청   해제 조건 기록
     │          (승인·결정 후 AUTO로 전환)      후 대기
     ▼
 작업 유형·규모 판단 ──► 3절 레인 선택
     ▼
┌──────────────────── 공통 품질 게이트 ────────────────────┐
│ npm test · npx tsc --noEmit · npm run lint · npm run build│
│ 자기 승인 금지 → code-reviewer / verifier 별도 레인 통과  │
└───────────────────────────┬───────────────────────────────┘
                            ▼
      체크포인트: main 원자적 커밋·푸시 → NEXT.md DONE 기록
                            ▼
              AUTO 남음? ── 예 ──► 다음 AUTO로 (턴 유지)
                  │
                  아니오
                  ▼
 세션 종료: 작업 기록 → Linear → OpenViking → continuity:check
 보고: 완료+증거 / 큐 상태 / APPROVE·DECIDE 일괄 요청
```

## 3. 작업 유형별 레인

```
[A] 소규모 수정 (파일 1~2개, 문서, 명확한 버그)
    직접 TDD ──► verifier(haiku/sonnet) ──► 게이트

[B] 중규모 기능·다파일 변경  ← 기본 레인
    plan ─────────► execute ──────────► review ─────────► verify
    (writing-plans  (executor, sonnet;   (code-reviewer,   (verifier,
     → docs/plans/   복잡하면 opus,      별도 레인)        증거 수집)
     implementation) TDD 필수)
          ▲                                  │
          └──── 차단급 지적이면 execute로 복귀 ┘

[C] 요구사항이 불명확한 새 기능 (예: Q-09 M5-A 순설정·환매 추정)
    deep-interview ──► ralplan ──► (선택) Spec Kit ──► [B] 레인
    (요구 구체화)     (계획 합의)    constitution→specify→
                                     plan→tasks

[D] 장애·원인 불명 버그
    trace / debug ──► 재현 테스트(RED) ──► 수정 ──► [B]의 review·verify

[E] 조사 (API 계약, SDK 사용법)
    document-specialist / research ──► docs/references/에 기록
```

레인 선택 기준:

- 변경 파일 수와 관계없이 운영 데이터 계약(`signal_run`·`signal_daily`·`trading_calendar_kr` 등)이나 Telegram 발송 조건을 바꾸면 최소 [B]로 처리한다.
- 요구가 둘 이상으로 해석되면 구현 전에 [C]로 올리고, 선택지는 `NEXT.md`에 `DECIDE`로 기록한다.
- 같은 원인으로 2회 실패하면 [D]로 전환하고, 그래도 원인을 규명하지 못하면 턴 종료 조건에 따라 보고한다.

## 4. 계획 도구의 역할 분담

OMC `plan`, Superpowers `writing-plans`, Spec Kit이 모두 계획 기능을 가지므로 역할을 나눈다.

| 목적 | 도구 | 산출물 위치 |
| --- | --- | --- |
| 무엇을·왜 만드는지(새 기능 명세) | Spec Kit `/speckit-specify` 등 | `specs/` (constitution 확정 후) |
| 요구가 흐릴 때의 합의 | OMC `deep-interview` / `ralplan` | 결정은 `NEXT.md` `DECIDE`→`DONE` |
| 실행 계획(파일·테스트·단계) | Superpowers `writing-plans` | `docs/plans/implementation/` |
| 실행·리뷰·검증 | OMC `executor` / `code-reviewer` / `verifier` | Git 커밋, `NEXT.md` 증거 |

Spec Kit은 `.specify/memory/constitution.md`가 템플릿인 동안 명세 단계에만 선택적으로 쓴다. constitution에는 `AGENTS.md`와 하네스에 이미 있는 규칙만 옮기고, 새 규칙을 만들어 채우지 않는다.

## 5. 역할과 모델 배치

| 역할 | 에이전트 | 모델 |
| --- | --- | --- |
| 코드 탐색 | `explore` | haiku |
| 구현 | `executor` | sonnet (복잡하면 opus) |
| 설계·원인 분석 | `architect`, `tracer` | opus |
| 리뷰 | `code-reviewer` | sonnet |
| 보안 리뷰 | `security-reviewer` | opus (Secret·권한·서비스 역할 키 경로 변경 시) |
| 완료 검증 | `verifier` | 규모에 따라 haiku → opus |

## 6. 자동 모드의 경계

| 구분 | OMC 사용 | 경계 |
| --- | --- | --- |
| 코드·테스트·문서 | `autopilot`·`ralph`로 끝까지 반복 가능 | 로컬 작업과 `main` 푸시까지 |
| 운영 DB 읽기, `gh` 조회 | 자동 진행 | 값·비밀 미출력 |
| `AGENTS.md`가 `APPROVE`로 정한 외부 부작용 | 자동 모드에서 실행 금지 | 도달하면 멈추고 `NEXT.md`에 `APPROVE` 기록 |
| 병렬 처리 | `/team`은 독립 작업이 2개 이상일 때만 | 같은 파일 동시 수정 금지 |

- `ralph`·`autopilot`을 시작할 때 "APPROVE 대상에 닿으면 멈춤"을 명시한다.
- `main`에 푸시한 코드는 다음 timer 실행에서 운영 workflow가 그대로 checkout한다. 운영 동작(발송 여부·대상·빈도)을 바꾸는 코드는 푸시 전 보고에 "운영 영향"을 명시한다.
- 리뷰는 작성과 다른 레인에서 수행한다. 2026-09-23 Q-10 구현에서 별도 리뷰가 Telegram 중복 발송 위험 2건을 찾아 반영했다.

## 7. 첫 적용 대상

`NEXT.md`의 Q-09(M5-A 순설정·환매 추정)는 요구·임계값 계약이 정해지지 않은 새 기능이므로 [C] 레인의 첫 적용 대상이다. Q-08(M6 20일 관측) 완료 전에는 착수하지 않는다.
