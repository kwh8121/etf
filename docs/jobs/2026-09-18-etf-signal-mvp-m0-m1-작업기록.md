# ETF 신호 MVP M0–M1 작업 기록

> 작업일: 2026-09-18
>
> 범위: M0–M1 기반 구축, Supabase 연결·스키마 적용, M2 수집 계약 준비, Linear 실행 원장 구성
>
> 상태: 완료 — M0–M1 품질 게이트 통과

## 1. 오늘의 결과

M0–M1의 구현 항목(FND-01~FND-05)을 완료하고, 원격 Supabase `ETF` 프로젝트에 핵심 스키마와 RLS 정책을 적용했다. KRX·Kiwoom API의 읽기 전용 계약 확인과 M2 수집 모듈의 초기 구현도 진행했다.

기본 build 스크립트를 공식 Next.js Webpack 경로로 고정하고 Node `22.23.2`를 프로젝트 표준으로 기록했다. 그 환경에서 `npm run build`가 성공해 M0–M1 품질 게이트를 마감했다.

## 2. 구현 내역

### 2.1 M0: 개발 기반과 품질 게이트

- Vitest를 추가하고 `npm test` 명령을 구성했다.
- `vitest.config.mts`에 Node 테스트 환경과 `@/` 별칭을 설정했다.
- 서버 전용 비밀값 계약을 `lib/config/server-env.ts`에 추가했다.
  - 필수 비밀값 누락 시 서버 경계에서 실패한다.
  - 마스킹 유틸리티로 원문 로그 기록을 방지한다.
- 테스트 fixture에 비밀값과 원천 API 응답을 넣지 않는 규칙을 문서화했다.

### 2.2 M1: 데이터 계약과 저장소

- KRX 요청일의 `YYYYMMDD`·실제 Gregorian 날짜 검증을 구현했다.
- 다음 데이터 모델과 RLS 계약을 원격 Supabase에 적용했다.
  - `source_snapshot`
  - `trading_calendar_kr`
  - `etf_daily_kr`
  - `etf_master_kr`
  - `listing_event_kr`
  - `signal_run`
  - `signal_daily`
- 모든 테이블의 RLS 활성화를 확인했다.
- 인증 사용자는 거래일·ETF 일별·마스터·상장 이벤트·신호 실행·신호 결과만 조회할 수 있다.
- `source_snapshot`에는 RLS 정책을 만들지 않아 원천 응답과 object path가 공개되지 않도록 유지했다.
- advisor가 찾은 외래 키 7개에 인덱스를 추가했다.

### 2.3 기존 보안 경고 해소

기존 `public.rls_auto_enable()`은 `SECURITY DEFINER` 함수이면서 외부 역할에서 실행 가능해 Supabase security advisor 경고가 있었다. 승인 후 다음 권한을 회수했다.

```sql
revoke execute on function public.rls_auto_enable()
  from anon, authenticated, public;
```

검증 결과 `postgres`, `service_role`만 해당 함수의 실행 권한을 보유한다.

### 2.4 M2 착수 준비

- KRX 일별 ETF 데이터 파서·상태 검증·HTTP 클라이언트를 추가했다.
- 거래일, 비거래일, 필수 필드, 중복 코드, 행 수 급감 상태를 구분한다.
- Kiwoom ETF 마스터 API의 읽기 전용 계약을 확인했다.
- 다음 단계는 수집 결과를 `source_snapshot`과 정규화 테이블에 멱등적으로 저장하는 작업이다.

## 3. 원격 Supabase 적용 이력

| 원격 migration | 목적 | 결과 |
| --- | --- | --- |
| `20260918080411_market_data_foundation` | 핵심 ETF 테이블·RLS·조회 정책 | 적용 완료 |
| `20260918080422_restrict_rls_auto_enable_execution` | 기존 보안 함수의 외부 실행 권한 회수 | 적용 완료 |
| `20260918080626_add_market_data_foreign_key_indexes` | 외래 키 7개 인덱스 추가 | 적용 완료 |

저장소 migration 파일도 원격 이력 ID와 일치하도록 정리했다. 이후 CLI 기반 migration 동기화에서 같은 스키마를 중복 적용하지 않도록 하기 위함이다.

## 4. Linear 모니터링

- 프로젝트: [ETF 일일 신호 시스템 MVP v2.2](https://linear.app/koreatimes/project/etf-일일-신호-시스템-mvp-v22-7eb5f1754b76)
- M0–M6, R1, R2 마일스톤 생성
- M0–M1 이슈 `KOR-46`~`KOR-50` 완료
- M1 스키마·RLS 이슈 [KOR-49](https://linear.app/koreatimes/issue/KOR-49/m0-m1fnd-04-핵심-데이터-스키마와-rls-적용) 완료
- M2 수집 계약 이슈 `KOR-51`은 `In Progress`
- 프로젝트 건강 상태: `onTrack`

Linear에는 키, 토큰, DB 비밀번호, API 원문 응답을 기록하지 않았다.

### 4.1 세션 연속성·정합성 하네스

- `docs/guides/etf-signal-mvp-continuity-harness.md`에 세션 시작·구현 경계·세션 종료의 동기화 계약을 추가했다.
- `scripts/continuity-harness.mjs`와 `npm run continuity:check`로 필수 정본, 최신 작업 기록, `git diff --check`, 작업 트리 요약을 검사한다.
- 종료 순서는 **검증 증거 → 작업 기록 → 정본 상태 → Linear → OpenViking 메모리 → 로컬 하네스 검사**로 고정했다.
- MCP 인증과 의미 판단이 필요한 Linear·OpenViking 쓰기는 스크립트가 자동 실행하지 않고, 하네스 절차를 따르는 에이전트가 수행한다.

### 4.2 계획 문서 정리

- 활성 정본·로드맵·상세 실행방안·마일스톤 구현 계획은 `docs/plans/`에 유지했다.
- 현재 구현에서 직접 참조되지 않는 초기 초안 `ETF-signal-MVP-plan-v2.md`, `ETF-signal-MVP-plan-v3.md`는 삭제하지 않고 `docs/archive/plans/`로 이동했다.
- `v2.1` 계획서와 아카이브 README에 이력 경로를 남겨 의사결정 배경을 계속 추적할 수 있게 했다.

## 5. 검증 결과

| 검증 | 결과 | 증거 |
| --- | --- | --- |
| Vitest | 통과 | 5개 파일, 24개 테스트 |
| TypeScript | 통과 | `npx tsc --noEmit` 종료 코드 0 |
| ESLint | 통과 | `npm run lint` 종료 코드 0 |
| diff 검사 | 통과 | `git diff --check` 종료 코드 0 |
| Supabase 연결 | 통과 | publishable key Auth 요청과 service-role REST 요청이 모두 정상 응답 |
| 스키마/RLS | 통과 | 7개 테이블 RLS, 6개 인증 사용자 SELECT 정책, 원천 snapshot 비공개 확인 |
| security advisor | 통과 | 기존 SECURITY DEFINER 실행 권한 경고 해소 |
| performance advisor | 정보성 관측 | 빈 신규 테이블의 미사용 인덱스 정보만 남음 |
| production build | 재검증 대기 | 실행 환경의 Google Fonts 네트워크·Turbopack 권한 제약 |

## 6. 변경 파일

- `package.json`, `package-lock.json`, `vitest.config.mts`
- `lib/config/server-env.ts`
- `lib/market-data/krx-date.ts`
- `lib/market-data/krx.ts`
- `lib/market-data/krx-validation.ts`
- `lib/market-data/krx-client.ts`
- `supabase/migrations/20260918080411_market_data_foundation.sql`
- `supabase/migrations/20260918080422_restrict_rls_auto_enable_execution.sql`
- `supabase/migrations/20260918080626_add_market_data_foreign_key_indexes.sql`
- `test/` 아래 환경 변수·KRX 날짜·스키마·KRX 클라이언트/검증 테스트
- `docs/plans/implementation/M0-M1-foundation-plan.md`
- `docs/plans/implementation/M2-kr-market-data-plan.md`
- `docs/guides/etf-signal-mvp-e2e-configuration-guide.md`

## 7. 다음 작업

1. M2에서 KRX/Kiwoom 수집 결과를 원천 snapshot과 정규화 테이블에 저장한다.
2. 같은 대상일의 재실행이 중복 저장 없이 동작하는지 검증한다.
3. 25개 완전 거래일 backfill과 데이터 적격성 결과를 기록한다.
4. M2 완료 후 지표·유니버스·신호 엔진(M3) 상세 계획을 확정한다.

## 8. 보안 기록 원칙

- `.env`의 실제 값, Supabase DB 비밀번호, service-role key, KRX·Kiwoom·Telegram 키는 읽기 결과와 이 작업 기록에 포함하지 않는다.
- 운영 DB 변경은 migration 이름, 적용 여부, RLS·advisor 검증 결과만 기록한다.
- 관련 없는 기존 작업 트리 변경은 이 작업 범위에 포함하거나 수정하지 않았다.
