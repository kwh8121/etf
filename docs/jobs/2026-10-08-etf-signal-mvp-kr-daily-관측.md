# 2026-10-08 KR daily 관측

> 작업일: 2026-10-08 KST
> 상태: 완료(확정 누적 7/20)

## 결과

- 2026-10-07 09:30 KST KR daily run `37552295623`(기준일 2026-10-06)과 2026-10-08 09:30 KST run `37708092789`(기준일 2026-10-07)이 모두 성공했고, 자동 검증 `kr-verify` run `37552563962`·`37708430380`도 성공했다.
- 운영 DB 읽기 전용 대조(`npm run verify:kr-candidate`, Node 22.23.2): 두 기준일 모두 `ok:true`, `COMPLETED`, `kr_full_signal_complete=true`, 고정 P0 8유형 각 10건, run·보고 표식 각 1건, `TRADING_COMPLETE`.
  - 2026-10-06: run `181dab56-…`, 80행.
  - 2026-10-07: run `97182674-…`, 81행(`new_listing:raw` 1건은 가변 신호).
- Telegram 실수신은 사용자가 확인했다.

## 검증

- `npm run continuity:check`: 통과(세션 시작 시점).
- 로컬 기본 Node 24는 실행 옵션 불일치로 실패하므로 `nvm use`(22.23.2)로 실행해야 한다.

## 다음 작업

- 사용자(2026-10-08)가 두 기준일의 운영 Telegram 실수신을 확인했다("수신함"). 확정 누적을 **7/20**으로 승격했다.

1. 다음 KR timer 실행(2026-10-09는 휴장일, 10-12 이후) 뒤 기준일 2026-10-08의 run·검증·DB·Telegram 실수신을 대조한다.

## KR 신호 웹 열람 경로 구현 (Q-15 승인 · Q-16 완료)

> 상태: 구현 완료·검증 통과. 배포(Q-17)는 승인 대기.

- 배경: Telegram 평문 보고는 섹션 제목이 한두 글자만 달라 구분이 안 되고 상승·하락 표시가 부호뿐이며 80행이 메시지 2개 이상으로 나뉜다. 웹 대시보드는 M4에서 이미 구현돼 있었으나 배포·링크·방향 색이 없었다.
- 결정(사용자): Vercel 배포 + Supabase 로그인, Telegram은 링크 한 줄만(M6 7/20 진행 중이라 본문 불변), 기준일 라우트 + 방향 대비(A안), 상승 적색·하락 청색, 날짜 피커 대신 전·후 거래일 이동.
- 산출: 사양서 `docs/plans/implementation/kr-signal-web-view-design.md`, 구현 계획 `docs/plans/implementation/kr-signal-web-view-plan.md`, 구현 커밋 `de1a2f4`..`e5b01b6`.
- 최종 리뷰에서 나온 중요 발견(코드가 아니라 배포·승인 범위): ① `.github/workflows/kr-daily.yml` job `env:`에 `ETF_WEB_BASE_URL` 매핑이 없어 사양서대로 GitHub 변수만 만들면 링크가 영원히 붙지 않고 오류도 없다 → Q-17 승인 범위 ④로 추가. ② `/auth/sign-up`이 열려 있고 RLS가 `authenticated using (true)`라 가입자 누구나 신호를 읽을 수 있다 → 배포 전 가입 차단이 Q-17 승인 범위 ③. 호스팅 Supabase의 가입 설정값은 저장소에서 확인할 수 없다.
- 운영 영향 없음 확인: `ETF_WEB_BASE_URL`이 없으면 Telegram 출력이 변경 전과 바이트 동일하다(변경 전후 비교, 구 헤더 리터럴 테스트, 변이 2종 실패 확인, 운영 DB 기준일 2026-10-07 읽기 전용 실행에서 4경우 모두 1메시지). `.github/workflows/`와 `lib/notifications/telegram.ts` 본문은 이번 작업에서 바꾸지 않았다.

### 검증

- `npm test` 37파일·159테스트, `npx tsc --noEmit`, `npm run lint`, `npm run build`: 통과(Node 22.23.2).
- 미인증 `next start` smoke: 세 경로 모두 307 → `/auth/login`, 본문 데이터 0건.
- 독립 리뷰: 태스크 묶음별 5회, 전체 브랜치 최종 리뷰 1회(`Approved with required fixes`) 후 필수 수정 8건 반영, 재리뷰 통과(`merge-ready: yes`).
- 작업 중 `pkill -f "next start"`가 명령 문자열에 같은 문구가 있는 자기 셸을 종료했다(exit 144). 서버는 포트로 PID를 찾아 정리했고 서버 잔존 없음을 확인했다.

### 다음 작업

1. Q-17(`APPROVE`): Vercel 배포·가입 차단·워크플로 env 매핑·`ETF_WEB_BASE_URL` 설정. 순서와 주의는 `docs/plans/NEXT.md` Q-17.
2. Q-08: 다음 KR 거래일 결과를 대조해 확정 누적(7/20)을 이어간다.

### 세션 종료 동기화 (Linear · OpenViking)

- Linear(프로젝트 `ETF 일일 신호 시스템 MVP v2.2`): KOR-58 본문을 7/20 기준으로 보정, M6 마일스톤 설명과 프로젝트 요약·본문 보정, KOR-64(M4 후속, Done, 웹 열람 경로 구현) 생성, KOR-65(Todo, 마일스톤 없음, Q-17 배포 승인 대기) 생성, 프로젝트 update 게시(health `onTrack`). read-back으로 M6 진행률 62.5%, M4 100% 유지, 이슈 상태를 확인했다.
- 실수 두 건을 바로잡았다. ① KOR-64를 처음 M6에 연결해 M6 진행률이 63%에서 75%로 부풀었다 → M4로 이동해 62.5%로 복구했다(M6는 20일 관측 지표라 관측과 무관한 이슈를 넣지 않는다). ② 이슈 본문에 `\n` 이스케이프를 그대로 보내 리터럴 문자로 저장됐다 → 실제 개행으로 재저장했다. KOR-58에서는 `replace_range` 경계 문구가 중복되어 정정했다.
- OpenViking: 첫 저장(2026-10-08 05:54Z)은 추출·회수되지만 긴 메시지가 "완료" 절만 남고 "다음 작업"·"교훈"이 잘렸고, `case_name`이 `openwebui-service`로 오분류됐다. 기존 2026-09-21~22 메모리(예: "M6 0/20")는 낡았지만 삭제하지 않았다. 재저장 결과는 아래 "OpenViking 재저장 실패" 절을 따른다.

### Q-17 부분 실행: 가입 차단 확인과 Vercel 배포 (사용자 승인)

- 가입 차단: 사용자가 Supabase에서 "Allow new users to sign up"을 껐다. 배포 전 `GET /auth/v1/settings`(publishable key, 읽기 전용)로 확인했다. 차단 전 `disable_signup=False`, 차단 후 `True`. `mailer_autoconfirm=False`(이메일 인증 켜짐)는 그대로다.
- 배포: `vercel link --yes --project etf-signal` → 환경 변수 2개 Production 등록 → `vercel deploy --prod --yes`. 프로젝트 `prj_JhJPxGjeFag4dOejMd59Ay8cTqZo`, 배포 `dpl_777hwNR6ddq4ynXG1dA1UCqKp1Mk`, 빌드 약 1분, 빌드 Node 22.x(저장소 `engines` `>=22.23.2 <23`이 프로젝트 설정 24.x보다 우선). 프로덕션 URL `https://etf-signal-azure.vercel.app`. 배포의 `githubCommitSha`는 `c639da9`.
- 환경 변수 범위: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만. `SUPABASE_SERVICE_ROLE_KEY`, Telegram, KRX, Kiwoom 값은 넣지 않았다.
- 미인증 smoke(인터넷, 프로덕션 별칭): `/signals/kr/2026-10-07`, `/signals/kr/latest`, `/protected` → 307 `/auth/login`, 본문 신호 데이터 0건. `/auth/login` → 200. 프로덕션 별칭은 Vercel 로그인 보호 없이 공개이고 앱 자체 인증이 막는다.
- 계획 밖 부작용 세 건을 바로잡거나 기록했다.
  1. `vercel link`가 GitHub 저장소를 자동 연결했다. 의도한 `main` 푸시 배포 트리거이지만 환경 변수보다 먼저 연결돼, 변수 등록 전 푸시가 있었다면 빌드가 실패했을 것이다(실제 푸시 없었음). 이후 모든 `main` 푸시가 배포를 유발한다.
  2. `.gitignore`에 `.env*`가 추가됐다. 추적 중인 `.env.example`까지 무시하게 되므로 `git checkout`으로 되돌렸다.
  3. `.env.local`이 생기고 `VERCEL_OIDC_TOKEN`이 들어갔다. 배포에 불필요해 삭제했다.
- 아직 안 한 것: ② Supabase Redirect URL 추가(사용자), ④ 인증 후 브라우저 UI smoke(사용자 로그인 필요), ⑤ `kr-daily.yml` env 매핑, ⑥ `ETF_WEB_BASE_URL` 설정. ⑤⑥ 전까지 Telegram 출력은 변경 전과 동일하다.

### Q-17 완료: Telegram 링크 활성화 (사용자 승인)

- 사용자가 인증 후 브라우저 UI를 확인하고 링크 활성화를 승인했다.
- ⑤ `.github/workflows/kr-daily.yml` job `env:`에 `ETF_WEB_BASE_URL: ${{ vars.ETF_WEB_BASE_URL }}` 추가, 커밋 `3661504`. YAML 유효성과 변경 범위(주석 1줄·env 1줄, 기존 키 불변)를 확인하고 푸시했다. 변수 미정의 시 빈 값이라 이 커밋만으로는 출력이 바뀌지 않는다.
- ⑥ `gh variable set ETF_WEB_BASE_URL --env production`으로 `https://etf-signal-azure.vercel.app` 설정. **설정 시각 2026-10-08 16:57:37 KST.** 기존 공개 변수와 같은 `production` environment에 두었다.
- 발송 없는 렌더링 비교: 활성 시 헤더에 `상세: https://etf-signal-azure.vercel.app/signals/kr/<기준일>` 한 줄만 추가되고 나머지 4줄과 메시지 수(1건)는 동일하다.
- 운영 워크플로를 수동 dispatch하지 않았다(운영 DB 쓰기·Telegram 발송 부작용). 첫 링크 포함 보고는 다음 KR timer 실행에서 나온다.
- 실수: 변수 목록을 확인하려고 출력하다 `NEXT_PUBLIC_SUPABASE_URL`·`PUBLISHABLE_KEY` 값이 화면에 찍혔다. 두 값은 브라우저에 공개되도록 설계된 값이라 비밀 노출은 아니지만 불필요한 출력이었다. 이후 변수는 이름만 확인한다.

### 다음 작업

1. 다음 KR timer 실행(10-09 휴장 예정, 10-12 이후)의 결과를 Q-08 방식으로 대조하되, **첫 링크 포함 보고를 함께 확인**한다: Telegram 헤더에 링크가 있고, 링크의 기준일이 보고 기준일과 같고, 링크가 해당 기준일 화면을 연다.
2. 링크가 붙지 않았다면 워크플로가 변수를 받았는지(`production` environment 변수, 매핑)를 먼저 의심한다.

### OpenViking 재저장 실패 (정정, 2026-10-08 17:20 KST)

- 의도: 첫 저장이 "완료" 절만 남기고 "다음 작업"을 잃어, 주제별 짧은 메시지 3건(완료 상태 / 다음 작업·미완료 / 교훈)으로 나눠 `remember`했다(KST 17:00 전후).
- 결과: **3건 모두 추출 실패.** 각 세션(`mcp-store-185f8b7c5ab4`, `mcp-store-4c4912ff8717`, `mcp-store-66ea396b7ff0`)의 `history/archive_001/.failed.json`에 `stage: memory_extraction`, `Error code: 400 context_length_exceeded — 최대 128000 토큰인데 284268 토큰`, `failed_at 2026-10-08T08:05:32Z`, `skipped: true`가 기록돼 있다. 세 건이 같은 토큰 수로 실패해, 메시지 길이(각 1~2KB)가 아니라 추출기가 함께 싣는 기존 메모리 컨텍스트가 원인으로 보인다. 같은 방식의 재시도는 같은 오류로 실패할 것이다.
- 원본은 보존됨: 위 세션의 `messages.jsonl`에 원문이 남아 있으나 검색으로는 회수되지 않는다. 검색되는 ETF 관련 항목은 `trajectories/ETF 신호 MVP 기록 저장_20261008055415.md`(낡은 "KOR-65 Todo" 포함, 다음 작업 없음)와 자동 캡처된 `trajectories/Q-17 완료 기록_20261008055506.md`(KOR-65 Done 본문, 링크 활성화 시각 포함)이다. `experiences/etf_signal_mvp_storage.md`는 버전 4에서 내용 없는 문장으로 덮어써졌고 `trajectories/ETF 신호 MVP 저장_20261008055415.md`는 본문이 비었으며 `case_name`이 `fix_playwright_browser`로 오분류돼 무관한 항목과 링크됐다.
- 영향: 낮음. 정본은 이 저장소(`docs/plans/NEXT.md`, 이 파일)와 Linear이고 세션 시작 절차가 정본 문서를 먼저 읽는다. OpenViking은 요약 보조다.
- 재시도 조건: 추출기 컨텍스트 문제(모델의 컨텍스트 한도 또는 추출 시 싣는 기존 메모리 양)가 해결된 뒤에만 다시 `remember`한다. 저장 후에는 문자열 검색이 아니라 세션의 `history/archive_001/` 아래 `.done`과 `memory_diff.json` 존재, 또는 `.failed.json` 부재로 성공을 판정한다(추출은 요약이라 리터럴이 사라질 수 있다). 서버 설정(`~/.openviking/ov.conf`)은 변경하지 않았다.
