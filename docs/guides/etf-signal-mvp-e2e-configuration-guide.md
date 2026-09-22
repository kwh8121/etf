# ETF 신호 MVP E2E 환경·키 설정 가이드

> 적용 대상: `ETF-signal-MVP-plan-v2.2.md`의 M1~M6 및 R1 E2E 검증
>
> 마지막 확인: 2026-09-22 (KR systemd timer 첫 자동 실행 검증 대기)

## 1. 목적과 보안 원칙

이 문서는 로컬·CI·운영 환경에서 ETF 신호 MVP를 실제 데이터로 검증하기 위한 키, 권한, 실행 순서를 정한다. 키의 **값**은 이 문서, Git, Linear 이슈, 테스트 fixture, 브라우저 로그에 기록하지 않는다.

- `NEXT_PUBLIC_` 접두사가 붙은 값은 브라우저 번들에 노출될 수 있다. Supabase URL과 publishable key만 허용한다.
- `SUPABASE_SERVICE_ROLE_KEY`, KRX·Kiwoom·Telegram 키는 서버 프로세스, GitHub Actions Secret 또는 신뢰된 예약 작업에만 둔다.
- service role/secret key는 RLS를 우회할 수 있으므로 클라이언트 컴포넌트·Route 응답·에러 메시지로 전달하지 않는다.
- 키를 교체했으면 이전 키를 즉시 폐기하고, 이 문서의 검증 절차를 다시 수행한다.

Supabase의 권장 패턴도 서버 전용 모듈에서만 admin client를 만들고, `NEXT_PUBLIC_` 값에는 공개 가능한 키만 두는 것이다. [Supabase 환경 변수 안내](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)와 [관리자 키 보안 안내](https://supabase.com/docs/guides/api/api-keys)를 함께 따른다.

## 2. 환경 변수 계약

### 2.1 애플리케이션·수집 작업

| 변수                                   | 위치                                             | 필수 시점           | 용도                            | 공개 여부 |
| -------------------------------------- | ------------------------------------------------ | ------------------- | ------------------------------- | --------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | 로컬 `.env.local`, CI Variable/Secret, 배포 환경 | 웹·서버 공통        | Supabase 프로젝트 URL           | 공개 가능 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 동일                                             | 웹·서버 공통        | 브라우저 Supabase client        | 공개 가능 |
| `SUPABASE_SERVICE_ROLE_KEY`            | 서버·CI Secret·예약 작업                         | M2 영속화부터       | 원천 스냅샷/수집 결과 서버 저장 | 비밀      |
| `KRX_API_KEY`                          | 서버·CI Secret·예약 작업                         | M2 KRX 수집         | KRX Open API 인증               | 비밀      |
| `KIWOOM_APP_KEY`                       | 서버·CI Secret·예약 작업                         | M2 Kiwoom 수집      | Kiwoom OAuth app key            | 비밀      |
| `KIWOOM_SECRET_KEY`                    | 서버·CI Secret·예약 작업                         | M2 Kiwoom 수집      | Kiwoom OAuth secret key         | 비밀      |
| `TELEGRAM_BOT_TOKEN`                   | 서버·CI Secret·예약 작업                         | M3 Telegram E2E부터 | Telegram Bot API 인증           | 비밀      |
| `TELEGRAM_CHAT_ID`                     | 서버·CI Secret·예약 작업                         | M3 Telegram E2E부터 | 허용된 수신 대화 식별자         | 비밀 취급 |
| `ENABLE_US_ETF_P1`                     | 로컬 `.env`, GitHub Actions Variable, 배포 환경  | M5 미국 실험 실행   | `true`일 때만 미국 P1 활성화    | 공개 가능 |

현재 저장소에 이미 있을 수 있는 `APP_KEY`·`APP_SECRET` 같은 일반 이름은 자동으로 사용하지 않는다. Kiwoom에는 반드시 `KIWOOM_APP_KEY`, `KIWOOM_SECRET_KEY`라는 명시적 계약을 사용한다. 중복 키의 실제 값 비교·복사는 사람이 안전한 비밀 관리 화면에서만 한다.

### 2.2 로컬 파일 예시

`.env.local`은 Git에 추가하지 않는다. 아래는 **자리표시자만** 든 예시이며 실제 키를 이 문서에 붙여 넣지 않는다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-or-secret-key>

KRX_API_KEY=<krx-key>
KIWOOM_APP_KEY=<kiwoom-app-key>
KIWOOM_SECRET_KEY=<kiwoom-secret-key>

TELEGRAM_BOT_TOKEN=<telegram-bot-token>
TELEGRAM_CHAT_ID=<approved-chat-id>

# 기본값 off. staging 실측 E2E에서만 true로 바꾼다.
ENABLE_US_ETF_P1=false
```

로컬 확인은 값을 출력하지 않고 변수 존재 여부만 검사한다.

```bash
node --env-file=.env.local -e "for (const k of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','KRX_API_KEY','KIWOOM_APP_KEY','KIWOOM_SECRET_KEY','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID']) console.log(k + '=' + (process.env[k] ? 'set' : 'missing'))"
```

이 명령의 출력은 `set`/`missing`만 공유한다. 값, 길이, 앞·뒤 문자열도 공유하지 않는다.

### 2.3 Telegram staging 수신처 설정

1. BotFather에서 전용 봇을 만들고 발급 토큰을 `TELEGRAM_BOT_TOKEN`에만 저장한다.
2. 운영 대화가 아닌 private staging 대화 또는 그룹을 만들고, 봇을 추가한 뒤 대화를 한 번 시작한다.
3. Telegram의 공식 업데이트 조회 방식으로 해당 대화의 ID를 확인해 `TELEGRAM_CHAT_ID`에만 저장한다. 이 값은 수신 대상 정보이므로 토큰과 동일하게 Secret으로 취급한다.
4. 값은 출력하지 말고 존재 여부만 확인한다. 그 후 아래 명령을 한 번만 실행한다.

   ```bash
   npm run report:kr-signals -- --send
   ```

5. 성공 증거로는 `sent: true`, 실행 ID, 메시지 수만 남긴다. chat ID, 토큰, 메시지 전문, Telegram 응답 전체는 기록하지 않는다.

`--send` 없는 `npm run report:kr-signals`는 실제 전송을 하지 않는 포맷 스모크 테스트다. 발송 함수는 Telegram `sendMessage` API만 호출하며, 메시지가 길면 각 조각에 실행 추적 메타데이터를 반복한다.

## 3. Supabase 데이터베이스 연결과 마이그레이션

### 3.1 사전 조건

- 대상 Supabase 프로젝트의 관리자 권한 또는 DB migration 권한
- 대상 프로젝트의 `project-ref`
- 로컬에 Supabase CLI를 실행할 수 있는 Node 환경
- DB 비밀번호를 입력할 수 있는 안전한 터미널 세션

`SUPABASE_SERVICE_ROLE_KEY`는 애플리케이션 수집 작업용이다. CLI의 `supabase link`/`db push` 인증을 대신하지 않는다. DB 비밀번호, access token, connection string은 shell history·CI 로그에 남기지 않는다.

### 3.2 안전한 적용 순서

1. 현재 브랜치와 migration 파일을 확인한다.

   ```bash
   git status --short
   ls supabase/migrations/20260918080411_market_data_foundation.sql
   ```

2. CLI를 프로젝트에 연결한다. 프롬프트에서만 DB 비밀번호를 입력한다.

   ```bash
   npx supabase link --project-ref <project-ref>
   ```

3. 로컬·원격 migration 이력을 먼저 비교한다.

   ```bash
   npx supabase migration list
   npx supabase db push --dry-run
   ```

4. 출력에 `20260918080411_market_data_foundation.sql`과 보안 권한 회수 migration이 의도한 대로 포함되었는지 검토한 뒤 적용한다.

   ```bash
   npx supabase db push
   ```

5. 적용 직후 테이블과 RLS 정책을 확인한다. Supabase SQL Editor 또는 읽기 전용 DB 세션에서 아래 쿼리를 실행한다.

   ```sql
   select tablename, rowsecurity
   from pg_tables
   where schemaname = 'public'
     and tablename in (
       'source_snapshot', 'trading_calendar_kr', 'etf_daily_kr',
       'etf_master_kr', 'listing_event_kr', 'signal_run', 'signal_daily'
     )
   order by tablename;

   select tablename, policyname, roles, cmd
   from pg_policies
   where schemaname = 'public'
   order by tablename, policyname;
   ```

통과 기준은 일곱 테이블 모두 RLS가 활성화되고, `source_snapshot`에 공개 select 정책이 없으며, 사용자 조회가 필요한 테이블에 인증 사용자 select 정책이 존재하는 것이다. 결과의 값·토큰·연결 문자열은 기록하지 않는다.

Supabase CLI의 `link`, `migration list`, `db push --dry-run`, `db push` 동작은 [공식 CLI 레퍼런스](https://supabase.com/docs/reference/cli/supabase-db-push)를 기준으로 한다. `--dry-run`은 연결·읽기만 수행하고 migration을 적용하지 않는다.

## 4. GitHub Actions 및 배포 환경

### 4.1 저장 위치

| 저장소 설정                                            | 변수                                                                                                                        | 이유                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| GitHub Actions Variable 또는 배포 환경 변수            | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_REF`                                  | 값이 공개 가능하거나 식별자여서 로그 노출 위험이 낮음 |
| GitHub Actions Secret 또는 배포 환경 Secret            | `SUPABASE_SERVICE_ROLE_KEY`, `KRX_API_KEY`, `KIWOOM_APP_KEY`, `KIWOOM_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | 서버 전용 인증·수신자 정보                            |
| GitHub Actions Secret (migration workflow를 만들 때만) | `SUPABASE_ACCESS_TOKEN` 또는 DB 접근에 필요한 비밀정보                                                                      | CI가 Supabase CLI를 인증해야 할 때만 사용             |

`NEXT_PUBLIC_` 변수는 빌드 시점에 브라우저 JavaScript로 포함될 수 있다. 따라서 service role key나 공급자 키에 이 접두사를 붙이지 않는다. PR이 외부 기여자에서 온 경우에는 Secret이 주입되는 workflow를 실행하지 않고, 수집·알림·DB 적용은 보호된 브랜치 또는 승인된 환경에서만 실행한다.

### 4.2 권장 환경 분리

- **local:** 개발자 개인 `.env.local`; 실제 운영 Telegram chat으로 전송하지 않는다.
- **staging:** 별도 Telegram 테스트 chat·제한된 API 요청량. 미국 P1은 2026-09-21 결정에 따라 운영 Supabase를 `market='US'` 격리로 함께 쓴다(5.1 참조).
- **production:** 보호된 GitHub Environment, 승인자 지정, 운영 DB와 운영 Telegram chat만 사용.

staging과 production은 KRX·Kiwoom 키도 가능하면 분리한다. 공급자가 키 분리를 지원하지 않으면, 실행 주체·IP·호출량을 분리하여 audit log로 추적한다.

### 4.3 Kiwoom self-hosted runner 운영

Kiwoom을 호출하는 `kr-daily.yml`·`us-etf-movers.yml`은 Kiwoom 허용 IP로 등록된 PC의 self-hosted runner에서 실행한다(2026-09-21 전환).

| 항목             | 값                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------- |
| runner 이름·라벨 | `kohdekt-wsl` · `self-hosted, Linux, X64, kiwoom`                                   |
| 설치 위치        | WSL2 `~/actions-runner-etf` (디렉터리 권한 700, `.credentials` 600)                 |
| 실행 방식        | systemd 사용자 서비스 `actions-runner-etf.service` (linger 사용, 로그인 없이 유지)  |
| 저장소 보호      | fork PR workflow 실행은 모든 외부 기여자에게 승인 필요(`all_external_contributors`) |

- 상태·로그: `systemctl --user status actions-runner-etf`, `journalctl --user -u actions-runner-etf -n 50`
- 재시작: `systemctl --user restart actions-runner-etf`
- GitHub 쪽 상태: `gh api repos/kwh8121/etf/actions/runners --jq '.runners[] | "\(.name) \(.status)"'`
- 예약 실행은 4.4의 systemd timer가 담당하므로 PC와 WSL이 켜져 있어야 한다. Windows 작업 스케줄러의 `WSL Autostart (Ubuntu-24.04)`(로그온 시 `wsl.exe -d Ubuntu-24.04 --exec sleep infinity`를 창 없이 실행)가 WSL을 켜 둔다.
- 공인 IP가 바뀌면 Kiwoom 토큰 발급이 다시 실패한다. 이때는 Kiwoom 허용 IP를 갱신한다.
- self-hosted에서는 `setup-node`의 `cache: npm`을 쓰지 않는다. 사용자 계정 전체의 `~/.npm`(약 24GB)을 대상으로 해 후처리 단계가 멈췄다. npm 캐시는 runner 디스크에 유지된다.
- runner는 현재 사용자 계정 권한으로 실행되어 운영 `.env`, gh keyring, 다른 프로젝트에 접근할 수 있다. 비밀번호 없는 sudo가 없어 전용 Linux 사용자는 만들지 않았다. 분리가 필요하면 전용 사용자로 재설치한다.
- 이 저장소에 `pull_request` 계열 트리거로 self-hosted runner를 쓰는 workflow를 추가하지 않는다.

### 4.4 예약 실행 (runner PC systemd timer)

GitHub `schedule`은 2026-09-21 KR 19:15 예약이 6시간 늦게 실행되고 US 07:30 예약은 실행되지 않았다. 그래서 Kiwoom workflow는 `schedule` 트리거를 두지 않고, runner PC의 systemd 사용자 timer가 `gh workflow run`으로 실행한다.

| timer                          | 시각                                    | 실행                                                         |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------------ |
| `etf-kr-daily-dispatch.timer`  | 월~금 19:15 KST                         | `kr-daily.yml`, `market_date`=가장 최근 평일 19:15 슬롯 날짜 |
| `etf-us-movers-dispatch.timer` | 화~토 07:30 KST (미국 월~금 장 마감 후) | `us-etf-movers.yml`                                          |

- `Persistent=true`: PC·WSL이 꺼져 있어 놓친 실행은 다음 기동 때 한 번 따라잡는다. KR 기준일은 실행 시각이 아니라 놓친 슬롯의 날짜로 계산되므로 자정을 넘겨도 밀리지 않는다. 두 슬롯 이상을 놓치면 가장 최근 슬롯만 실행되므로, 이전 날짜는 `gh workflow run kr-daily.yml -R kwh8121/etf -f market_date=YYYYMMDD`로 보충한다.
- **회사 PC 근무시간 제약(2026-09-22 확정)**: PC·WSL은 근무시간에만 운영 가능하다. 따라서 현재 KR 19:15·US 07:30 시각은 PC가 꺼져 있으면 정시 발화하지 않으며, `Persistent=true`는 다음 기동의 한 번짜리 따라잡기일 뿐 상시 운영이나 일별 완료를 보장하지 않는다. PC 기동 전에 여러 슬롯을 놓치면 일부 기준일은 자동 복구되지 않는다. 정확한 근무시간과 KR·US의 목표 기준일을 확정하기 전에는 설치된 timer의 시각을 임의 변경하지 않는다. 첫 검증에서는 정시 실행과 따라잡기를 구분해 기록한다.
- 설치본: `scripts/dispatch-scheduled-workflow.ts`를 `~/.local/lib/etf-ops/`에 복사해 실행한다(작업 사본의 브랜치·수정 상태와 분리). unit 원본은 `ops/systemd/`에 있다. Node 경로는 `~/.nvm/versions/node/v22.23.2`로 고정되어 있어 `.nvmrc`를 바꾸면 unit도 고친다.
- 설치·갱신:

  ```bash
  install -D -m 644 scripts/dispatch-scheduled-workflow.ts ~/.local/lib/etf-ops/dispatch-scheduled-workflow.ts
  install -m 644 ops/systemd/etf-*.service ops/systemd/etf-*.timer ~/.config/systemd/user/
  systemctl --user daemon-reload
  systemctl --user enable --now etf-kr-daily-dispatch.timer etf-us-movers-dispatch.timer
  ```

- 상태: `systemctl --user list-timers 'etf-*'`, 로그: `journalctl --user -u etf-kr-daily-dispatch.service -n 20`
- 수동 디스패치: `systemctl --user start etf-us-movers-dispatch.service` (KR 서비스는 운영 chat 발송이 따르므로 필요할 때만 실행)
- `gh`는 systemd 사용자 서비스에서도 keyring 토큰을 사용한다(`systemd-run --user --wait --pipe gh auth status`로 확인).

## 5. E2E 실행 체크리스트

아래는 기능이 M2~M5에서 연결된 뒤 수행하는 순서다. 아직 구현되지 않은 CLI·Route Handler를 가정해 임의 명령을 만들지 않으며, 각 단계에서 해당 마일스톤의 실제 진입점을 사용한다.

1. **비밀 검증:** 변수 존재 여부만 확인하고 누락된 키는 즉시 실패 처리한다. `lib/config/server-env.ts`의 `getRequiredServerSecret`을 서버 경계에서 사용한다.
2. **DB 준비:** 3장의 dry-run → 적용 → RLS 정책 확인을 마친다. 적용 증적은 migration ID와 테이블/RLS 통과 여부만 Linear `KOR-49`에 남긴다.
3. **KRX 수집:** 거래일 1건과 비거래일 1건을 선택해 요청일, 필수 필드, 중복 코드, 건수 급감 규칙을 검증한다. 원천 응답 본문은 로그나 fixture에 복사하지 않는다.
4. **Kiwoom 수집:** OAuth token 획득 뒤 ETF 마스터 응답의 `return_code`, 페이지 연속 여부, 행 수와 기준일 형식만 기록한다. access token은 기록하지 않는다.
5. **영속화·재실행:** 같은 대상일을 두 번 실행해 원천 snapshot 중복 방지·정규화 upsert·실행 상태를 확인한다.
6. **신호·대시보드:** raw/liquid 결과가 같은 `signal_run`에 귀속되는지, 인증되지 않은 요청이 보호 테이블을 읽지 못하는지 확인한다.
7. **Telegram:** staging chat에서 새 `TRADING_COMPLETE` 신호 보고 1건과 `PUBLISH_PENDING`·`PARTIAL`·`FETCH_FAIL`·휴장/중복 중 현재 재현 가능한 상태 보고 1건을 확인한다. `message_id`·HTTP 상태·상태 구분만 기록하고, token, chat ID, 메시지 전문, 투자 추천처럼 오해될 표현은 로그에 남기지 않는다.
8. **실패 복구:** 의도적으로 KRX/Kiwoom/Telegram 한 공급자를 차단한 뒤 수집·신호·알림이 각각 명시적 실패 상태와 재시도 가능 상태로 남는지 확인한다.

### 5.1 미국 ETF P1 staging E2E

미국 어댑터는 국내 P0와 별도 workflow다. 실제 실행 전 staging 환경에서만 `ENABLE_US_ETF_P1=true`로 설정하고, production은 관측 목적과 수신처가 승인된 뒤에만 같은 값을 설정한다. 이 플래그는 비밀이 아니지만 `true` 전환은 실제 Kiwoom·Supabase 쓰기·Telegram 전송을 발생시킨다.

staging 경계(2026-09-21 결정): Supabase는 운영 프로젝트를 쓰고, Telegram만 별도 테스트 그룹으로 보낸다. KR 경로는 `market="KR"`·전략 버전으로 실행을 고른 뒤 `run_id`로만 읽으므로 US 행과 섞이지 않는다.

> **Kiwoom 허용 IP 제한:** Kiwoom 앱 키는 등록된 IP에서만 토큰을 발급한다. GitHub 호스팅 러너는 IP가 매번 바뀌어 등록할 수 없으므로, Kiwoom을 호출하는 workflow는 등록 IP의 self-hosted runner(`runs-on: [self-hosted, linux, x64, kiwoom]`)에서 실행한다. 운영 절차는 4.3을 따른다.

1. `us-etf-movers.yml`은 GitHub `staging` Environment로 고정되어 있다. 해당 Environment의 `ENABLE_US_ETF_P1` Variable을 staging에서만 `true`로 설정하고 수동 실행을 먼저 사용한다. 로컬 실행 시에는 `ENABLE_US_ETF_P1=true`와 staging `TELEGRAM_CHAT_ID`를 셸 환경변수로 주입한다(`node --env-file`은 이미 설정된 환경변수를 덮어쓰지 않는다). 한국에서 Telegram으로 보낼 때 node 기본 연결 시도 제한(250ms)을 넘어 `ETIMEDOUT`이 나므로 `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=2000`을 함께 설정한다.
2. `usa10104`, `usa20911` 상승·하락, `usa20511`, `usa20931` 호출의 성공 여부·페이지 수·총 행 수만 확인한다. 원문 응답, access token, 종목별 상세값은 기록하지 않는다.
3. 같은 실행을 한 번 더 수행한다. `source_snapshot`은 기준 관측 1개와 `duplicate_observation` 1개, 원본 객체 1개, US `signal_run` 1개인지 확인한다. `market_date`는 `null`이어야 한다. 미국 정규장·프리마켓·애프터마켓 중에는 응답이 계속 바뀌어 두 번째 실행도 새 관측이 되므로, 장이 완전히 닫힌 시간(주말 등)에 수행한다.
4. Telegram 수신처가 staging인지 확인한 뒤 P1 보고를 확인한다. 메시지에는 “실험”과 국내 P0 독립 문구가 있어야 한다. 현재 보고는 전체 순위를 보내 약 10건으로 나뉜다.
5. `ENABLE_US_ETF_P1=false`로 되돌린 후 `npm run ingest:us-movers`, `npm run report:us-movers`가 `DISABLED`로 끝나는지 확인한다. KR workflow와 최근 KR `signal_run`은 변경되지 않아야 한다.

로컬 수동 명령은 다음과 같다. `ENABLE_US_ETF_P1=false`이면 외부 API·DB·Telegram을 호출하지 않는다.

```bash
npm run ingest:us-movers
npm run report:us-movers
```

E2E 완료 기준은 전체 체인이 성공한 경우뿐 아니라, 외부 공급자 실패 시에도 중복 저장·무음 실패·비밀 노출 없이 실패 원인과 재실행 단위가 남는 것이다.

## 6. 현재 상태와 다음 조치

- KRX와 Kiwoom의 읽기 전용 계약 확인은 수행되었고, 키 값은 노출하지 않았다.
- Supabase 공개 연결 정보와 service-role key는 원격 API 인증을 통과했다. Telegram 키는 M3 실발송 E2E 전에 별도로 설정 여부를 점검한다.
- `supabase/migrations/20260918080411_market_data_foundation.sql`, `20260918080422_restrict_rls_auto_enable_execution.sql`, `20260918080626_add_market_data_foreign_key_indexes.sql`은 원격 ETF DB에 적용되었다.
- 위 3장의 절차가 끝나기 전까지 Linear `KOR-49`는 `In Review`/`Gate-blocked` 상태를 유지한다.

키를 설정한 후에는 키 값을 공유하지 말고, 아래 네 가지 결과만 남긴다: migration ID 적용 여부, RLS 정책 통과 여부, E2E 단계별 성공/실패, 재실행 결과.
