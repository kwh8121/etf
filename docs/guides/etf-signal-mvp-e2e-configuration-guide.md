# ETF 신호 MVP E2E 환경·키 설정 가이드

> 적용 대상: `ETF-signal-MVP-plan-v2.2.md`의 M1~M6 및 R1 E2E 검증
>
> 마지막 확인: 2026-09-18

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
- **staging:** 별도 Supabase 프로젝트·별도 Telegram 테스트 chat·제한된 API 요청량.
- **production:** 보호된 GitHub Environment, 승인자 지정, 운영 DB와 운영 Telegram chat만 사용.

staging과 production은 KRX·Kiwoom 키도 가능하면 분리한다. 공급자가 키 분리를 지원하지 않으면, 실행 주체·IP·호출량을 분리하여 audit log로 추적한다.

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

1. GitHub Environment의 `ENABLE_US_ETF_P1` Variable을 staging에서만 `true`로 설정한다. `us-etf-movers.yml`의 수동 실행을 먼저 사용한다.
2. `usa10104`, `usa20911` 상승·하락, `usa20511`, `usa20931` 호출의 성공 여부·페이지 수·총 행 수만 확인한다. 원문 응답, access token, 종목별 상세값은 기록하지 않는다.
3. 같은 실행을 한 번 더 수행한다. `source_snapshot`은 기준 관측 1개와 `duplicate_observation` 1개, 원본 객체 1개, US `signal_run` 1개인지 확인한다. `market_date`는 `null`이어야 한다.
4. Telegram 수신처가 staging인지 확인한 뒤 P1 전용 메시지 1건을 확인한다. 메시지에는 “실험”과 국내 P0 독립 문구가 있어야 한다.
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
