# One Fact, One Home — stock-market 개발·리뷰·배포 하네스

> **적용 저장소:** `stock-market`  
> **현행 제품 기준:** `docs/ETF_Price_Signal_MVP_PRD_v1_7_Final.md`  
> **갱신:** 2026-09-14

## 작성 목적과 권위 경계

이 문서는 ETF Price Signal MVP의 계획 → 검토 → 개발 → Gate 검증 → 배포(또는 다음 Gate 승인) 흐름을 한 파일에서 이해하기 위한 **운영 하네스의 색인 겸 개괄**이며, 정보 배치 규칙의 정본이다.

이 문서는 제품 요구사항, 개별 Linear 이슈의 본문, Gate 판정, 코드 변경을 복제하지 않는다. 각 사실은 아래 표의 정본에 한 번만 기록하고, 다른 장소에는 URL·경로·SHA와 필요한 최소 요약만 둔다. 충돌 시 PRD와 헌법의 우선순위는 `AGENTS.md`의 Authoritative Development Inputs를 따른다.

## 1. One Fact, One Home

| 사실 유형                                         | 유일한 정본                                   | 다른 도구·문서에 둘 내용                                  |
| ------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| 제품 범위, 정책값, 인수 기준                      | `docs/ETF_Price_Signal_MVP_PRD_v1_7_Final.md` | 경로와 적용 범위만                                        |
| 전역 제약, 사람 전용 결정                         | `docs/constitution.md`                        | 관련 Article 링크만                                       |
| DG 수준의 승인된 순서, 의존성, 프로그램 현황      | `docs/ROADMAP-v1.7.md`                        | DG 링크와 짧은 상태만                                     |
| 진행 중 이슈의 담당, 작업 상태, 검토 요청, 블로커 | **Linear**                                    | 정본 문서·PR·Gate 링크와 짧은 결과만                      |
| 승인된 구현·리뷰 계획                             | `docs/plan/`                                  | Linear에 파일 링크와 승인 상태만                          |
| Gate 판정일, 실제 증거, 사람 판정                 | `docs/plan/gates/`                            | Linear·ROADMAP에는 Gate 링크와 상태만                     |
| 기술 경계, 구현됨/계획됨, 승인된 기술 결정        | `docs/architecture-v1.7.md`                   | 결정 링크와 영향만                                        |
| 코드, 브랜치, 커밋, PR, 태그                      | Git / GitHub                                  | Linear·jobs에는 URL·SHA·짧은 결과만                       |
| Preview·Production 배포 실행과 롤백               | Vercel                                        | Linear·jobs에는 deployment URL·commit SHA·짧은 결과만     |
| 운영 DB·인증·private Storage의 실제 상태          | Supabase                                      | Gate·Linear에는 migration/manifest/run 링크와 짧은 결과만 |
| 외부 조사·벤더/API 참고                           | `docs/references/`                            | 정본 경로·링크만                                          |
| 세션에서 실제 수행한 작업                         | `docs/jobs/YYYY-MM-DD-*.md`                   | 재개 포인터와 외부 링크만                                 |
| 장기 검색·다음 세션 컨텍스트                      | OpenViking                                    | 정본 문서 경로를 가리키는 비권위 요약만                   |
| 개인 선호·응답 스타일                             | 사용자 프로필 메모리                          | 프로젝트 사실을 저장하지 않음                             |

### 계층을 혼동하지 않는 규칙

- **Linear와 ROADMAP은 경쟁하지 않는다.** Linear는 아직 승인·완료되지 않은 개별 작업의 실시간 운영 표면이고, `ROADMAP-v1.7.md`는 DG 단위의 승인된 순서와 프로그램 기준선이다.
- Linear의 상태·라벨 변경만으로 PRD 변경, Gate 통과, `CALC_APPROVED`, `DRAFT → PUBLISHED`를 확정할 수 없다. 이들은 관련 정본과 `docs/constitution.md`가 요구하는 사람 판정이 필요하다.
- `docs/plan/`은 승인 후의 불변 스냅샷이다. `docs/superpowers/plans/`는 작업 중인 실행 계획 공간이며, 승인 계획을 복사하지 않고 정본 링크·차이·상태만 남긴다.
- 과거 PRD·ROADMAP·architecture·Gate 리포트는 역사적 스냅샷이다. 중복 제거를 이유로 고치지 않으며, 정정은 새 문서·새 버전·원문 링크로 기록한다.
- OpenViking, Mem0, 도구 출력, 세션 요약은 검색·리마인더 캐시다. 정본을 확인하지 않은 채 승인 상태나 제품 사실로 인용하지 않는다.

## 2. 5단계 운영 흐름

```text
[1] 계획 초안 (Linear)                 plan-draft
        ↓ 계획 검토 요청
[2] 계획 검토·승인 (Linear + docs/plan) needs-review ↔ plan-approved
        ↓ 승인된 작업만 구현
[3] 개발 (Git / GitHub)                feature/<issue> → PR
        ↓ 검증 재료 연결
[4] 구현·Gate 검증 (Linear + gates)    verify-request ↔ verify-passed
        ↓ DG 사람 판정 또는 릴리스 준비
[5] 배포·다음 DG 승인 (GitHub + Vercel + Supabase + 사람)  배포 증거 / 다음 Gate
```

### Stage 1 — 계획 초안

- Planner는 Linear Project/Parent Issue/Sub-issue에 배경, 목표, 비목표, 범위, DoD, 의존성, 관련 PRD·헌법·ROADMAP 링크를 기록한다.
- 새 작업은 `plan-draft`로 시작하며, `blockedBy` 또는 동등한 관계로 선행 DG와 이슈 의존성을 표현한다.
- 계획은 PRD v1.7을 재설계하거나 재서술하지 않는다. PRD와 코드·기존 증거의 차이는 DG0 차이표와 해당 Gate 문서에 링크한다.

### Stage 2 — 계획 검토와 승인

- Verifier는 `needs-review` 이슈를 검토하고, 범위·의존성·DoD·정본 링크·사람 전용 결정 경계를 확인한 결과를 Linear 코멘트에 남긴다.
- 승인된 계획만 `docs/plan/<slug>.md`로 승격한다. 파일에는 승인 근거와 Linear 이슈 URL을, Linear에는 파일의 리포지터리 URL을 첨부한다.
- 승인 시 `plan-approved`, 반려 시 `plan-draft`로 되돌린다. 반려 사유의 본문은 Linear에, 제품 계약 변경은 PRD/헌법 변경 절차에 둔다.

### Stage 3 — 개발

- Dev는 `plan-approved`이면서 선행 이슈가 해제된 작업만 시작한다. Linear가 제공하는 `gitBranchName`이 있으면 이를 사용하고, 없으면 `feature/<linear-issue-id>-<slug>` 형식으로 만든다.
- 코드 진실은 Git이다. 커밋 SHA, PR URL, 검사 결과의 짧은 요약만 Linear에 연결한다.
- PRD §12.2의 해당 회귀 테스트를 RED로 먼저 추가하고, 구현 후 GREEN과 `npm run check-all`, `npm run build` 결과를 남긴다. 빌드 불가 시 원인과 검증 공백을 사실대로 기록한다.

### Stage 4 — 구현·Gate 검증

- Dev가 PR·실행 결과·Gate 증거 링크를 연결한 뒤 `verify-request`로 전환한다.
- Verifier는 diff, 실행 결과, Gate 문서의 PRD §11 체크리스트·§15 추적 표, analyze/converge 보조 보고와 `docs/plan/gates/`의 증거를 대조한다.
- 통과한 구현 검토는 `verify-passed`로 표시할 수 있다. 그러나 DG0~DG4의 통과 판정은 사람만 내리며, 실제 판정과 근거는 Gate 문서에 기록한다.
- 재작업은 `verify-request`를 유지하거나 작업을 `plan-draft`로 되돌린다. 정책·계약 문제는 `/speckit-converge`와 사람 승인 후 새 `rule_version` 작업으로 분리한다.

### Stage 5 — 배포 또는 다음 DG 승인

- 배포 가능한 변경은 GitHub의 코드/PR 기록과 Vercel deployment 기록을 함께 사용한다. 배포 실행·결과·롤백은 Vercel에, 코드 변화는 GitHub에 두고, Linear에는 링크와 짧은 결과만 남긴다.
- 비공개 운영 알파는 GitHub 연동 Vercel의 Preview/Production 배포와 Supabase의 데이터·인증 경계를 사용한다. 환경변수, 복구, 수집 Cron의 도입 조건은 `docs/manual/vercel-supabase-deployment.md`를 따른다.
- 다음 DG는 선행 Gate 문서의 증거와 사람 판정 후에만 시작한다. Linear는 인계 상태를 표시하고, Gate 문서는 판정을 기록한다.
- 현재 MVP는 DG4 사람 판정 전 운영 알파나 성과 주장으로 승격하지 않는다.

## 3. Linear 운영 계약

다음 라벨은 stock-market 워크스페이스에 존재할 때 사용한다. 아직 대상 팀·프로젝트·라벨이 확인되지 않은 세션에서는 생성·수정 전에 조회로 확인하고, 존재하지 않는 라벨을 사실처럼 표기하지 않는다.

| 라벨             | 의미                                | 허용 전이                           |
| ---------------- | ----------------------------------- | ----------------------------------- |
| `plan-draft`     | 계획 작성 또는 반려 후 수정 중      | → `needs-review`                    |
| `needs-review`   | 계획 검토 대기                      | → `plan-approved` 또는 `plan-draft` |
| `plan-approved`  | 계획 검토 통과, 개발 시작 가능      | → `verify-request`                  |
| `verify-request` | 구현 완료, 검증 대기                | → `verify-passed` 또는 재작업       |
| `verify-passed`  | 구현 검토 통과, Gate/배포 인계 준비 | → 배포 또는 다음 DG 인계            |

- Linear 이슈에는 정본 본문을 복사하지 않는다. PRD·헌법·계획·Gate·PR의 링크와 상태 전이, 검토 결과 요약만 기록한다.
- 승인된 `docs/plan/` 파일, PR URL, Gate 문서, GitHub 배포 기록은 Linear attachment로 연결해 감사 경로를 닫는다.
- Linear 접근 실패, 인증 만료, 도구 미노출은 작업 상태가 아니다. `docs/jobs/`에 진단 결과와 다음 확인 지점만 남기며 Gate 상태를 추측해 바꾸지 않는다.

## 4. 도구와 환경의 책임

| 도구           | 역할                                            | 운영 확인                                                      |
| -------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| Linear MCP     | Stage 1·2·4의 이슈, 검토, 상태 전이, attachment | 세션 시작 시 도구 노출·인증·대상 팀/라벨을 읽기 전용 조회      |
| Git / GitHub   | 코드·브랜치·커밋·PR·배포/릴리스 증거            | 개발 시작 전 remote와 `gh auth status` 확인                    |
| Vercel         | Git 연동 Preview/Production 배포·롤백           | Production Branch·Deployment Protection·환경변수 범위를 확인   |
| Supabase       | Postgres·Auth·private Storage                   | 프로젝트 연결, RLS, private bucket, migration 상태를 확인      |
| OpenViking MCP | 장기 검색 및 재개 컨텍스트                      | 정본 링크만 저장·인용하고, 제품 사실을 독립 권위로 만들지 않음 |
| Context7 MCP   | 외부 라이브러리·SDK 공식 문서                   | 구현 전에 해당 라이브러리의 최신 공식 문서 확인                |
| Playwright     | 필요한 smoke/E2E 검증                           | UI·브라우저 흐름 검증이 필요한 변경에만 사용                   |
| Serena         | 코드 심볼·관계 탐색                             | 읽기 전용 구현 맥락 탐색에 사용                                |

### 설정·비밀 관리

- 저장소의 `.mcp.json`은 비밀 없는 프로젝트 공통 도구 설정만 둔다. OAuth 세션, 토큰, API 키는 전역 보안 저장소 또는 환경 변수로 관리하고 커밋하지 않는다.
- Codex 전역 MCP 등록은 한 개발 환경에서의 가용성을 뜻할 뿐, 저장소의 재현 가능한 구성이나 실제 인증 성공을 증명하지 않는다.
- 새 외부 도구를 하네스에 추가하려면 책임, 정본 영향, 인증 경계, 실패 시 대체 절차를 이 문서에 먼저 추가한다.

## 5. 세션·PR·Gate 체크리스트

### 세션 시작

- [ ] 현행 PRD, 헌법, ROADMAP, architecture, 관련 Gate 문서를 열었다.
- [ ] 현재 DG와 사람 판정 여부를 Gate 문서에서 확인했다.
- [ ] Linear 도구·인증·팀·라벨을 읽기 전용으로 확인했거나, 미확인 상태를 기록했다.
- [ ] Git remote와 GitHub 인증 상태를 확인했다.
- [ ] 새 세션에서는 Stage 1~5의 정본 링크·도구 가용성·Gate 차단 규칙을 전체 점검하고, 미검증 외부 연동을 통과로 간주하지 않았다.

### PR 또는 검증 요청 전

- [ ] 테스트 RED→GREEN 근거와 `npm run check-all`·`npm run build` 결과를 확보했다.
- [ ] Linear에는 PR·SHA·검증 요약과 정본 링크만 연결했다.
- [ ] Gate 판정 또는 사람 전용 결정을 Linear 상태로 대체하지 않았다.

### DG Gate 전

- [ ] 관련 `docs/plan/gates/` 문서에 실행 결과·input manifest·§11 체크리스트·§15 추적 표와 analyze/converge 보고 링크가 있다.
- [ ] PRD §11 및 §15를 대조했다.
- [ ] 사람 판정 전에는 후속 DG를 시작하거나 통과를 선언하지 않았다.

## 6. 재사용·개정 규칙

- 이 문서는 stock-market의 운영정책이다. 다른 저장소에 복사할 때는 Linear 팀·라벨, GitHub 배포 절차, OpenViking 리소스, 정본 문서 경로를 새 저장소에서 재결정한다.
- 문서 정책의 변경은 이 문서에서 제안하고, 영향받는 정본(`AGENTS.md`, `docs/ROADMAP-v1.7.md`, Gate/계획 문서)을 링크로 정합화한다. 제품 요구사항 자체를 이 문서에서 바꾸지 않는다.
- 현실의 도구 구성과 이 문서가 다르면, 도구 상태를 문서 사실로 덮어쓰지 않는다. 차이·영향·결정 필요 사항을 Linear 또는 `docs/jobs/`에 기록하고, 승인 뒤 새 버전으로 고친다.

## 참조

- 루트 작업 규약과 정본 우선순위: `AGENTS.md`
- 제품 스펙: `docs/ETF_Price_Signal_MVP_PRD_v1_7_Final.md`
- 전역 제약 및 사람 전용 결정: `docs/constitution.md`
- 프로그램 기준선: `docs/ROADMAP-v1.7.md`
- 기술 경계: `docs/architecture-v1.7.md`
- Gate 증거와 판정: `docs/plan/gates/`
- v1.7 개발 방법론: `docs/ETF Price Signal MVP_Spec Kit + Superpowers.md`
