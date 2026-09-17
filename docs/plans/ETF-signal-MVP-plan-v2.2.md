# ETF 일일 신호 시스템 MVP v2.2 합의안

> 작성일: 2026-09-17 KST  
> 대상 원문: `docs/plans/ETF-signal-MVP-plan-v2.1.md`  
> 성격: Kiwoom/KRX 실측 범위 기반 타당성 검토 및 실행계획 개선안  
> 문서 언어: 설명과 의사결정은 한국어로 작성하고, API ID·필드명·코드·명령어 등 정확성이 필요한 기술 식별자는 원문을 유지한다.  
> 원칙: 투자/시장 데이터 원천은 Kiwoom과 KRX로 제한한다. 외부 가격, 분배금, 기업행동, 펀더멘털 데이터는 MVP 범위 밖이다.
> 합의 상태: 기획자 작성 → 아키텍트 승인 → 비평가 승인 완료. 애플리케이션 구현은 아직 시작하지 않았다.

## 요구사항 요약

- 국내 상장 ETF를 매일 1회 스캔해 사람이 검토할 후보 목록을 만든다. 자동매매 또는 매수 신호가 아니다.
- 원천은 KRX Open API `etf_bydd_trd`와 Kiwoom REST API로 제한한다.
- KRX는 국내 일일 종가(EOD) 스냅샷의 주 원천이다. Kiwoom은 현재 ETF 마스터·신규 상장, 교차검증, 미국 ETF 순위 어댑터에 사용한다.
- P0 신호는 국내 일간·5거래일 가격 상승/하락 상위 종목, 거래대금 급증, 신규 상장이다.
- P1 신호는 순설정 추정과 미국 ETF 일간·5일 등락 상위 종목이다. 둘 다 별도 섹션과 테이블로 격리하고 관측 후 유지 여부를 판단한다.
- 모든 알림은 시장, 원천, 관측·기준 시각, 선택적 시장일, API ID, 행 수, 페이지 수, 해시, 변환 버전, 제외 사유로 재현 가능해야 한다.
- 서비스 역할 자격 증명은 수집 작업 전용이다. 대시보드는 현재 Supabase SSR 인증 흐름과 RLS `SELECT` 정책으로 읽는다.

## 근거 기반 타당성 및 구현 가치 판정

판정: **구현 타당성은 높다. 단, MVP 범위를 탐색 레이더로 고정해야 가치가 있다.**

- 국내 가격 상승/하락 상위 종목: **P0로 승격**. KRX `TDD_CLSPRC`, `FLUC_RT`, OHLC가 실측 필드에 있고, 추가 API 호출 없이 일간 순위를 만들 수 있다. 5거래일 순위도 25영업일 과거 데이터 적재 후 **KRX가 제공한 종가 기준 가격수익률**로 계산할 수 있다. 이는 분배금·기업행동 조정 총수익률이 아니므로 이상치 표기와 메시지에 그대로 표시한다. 근거: `docs/references/krx_api_report.md:46-52`, `.omx/context/etf-signal-mvp-feasibility-20260917T060004Z.md:67`.
- 거래대금 급증: **P0 유지**. KRX `ACC_TRDVAL`, `ACC_TRDVOL`, `FLUC_RT`, `FLUC_RT_IDX`가 확인되었고, 거래대금 단위도 `ACC_TRDVAL / ACC_TRDVOL` 검산으로 확인할 수 있다. 실측에서 거래량이 0이 아닌 1,164개 행 중 1,163개가 일중 저가·고가 범위에 들어왔다. 근거: `.omx/context/etf-signal-mvp-feasibility-20260917T060004Z.md:32-34`.
- 신규 상장: **P0 유지하되 `ka10099` 중심으로 수정**. v2.1은 `ka10099(mrkt_tp=8)`을 미검증으로 남겼지만, 실측 결과 1,172개 모든 행에 유효한 `regDay`가 있었다. 근거: `docs/plans/ETF-signal-MVP-plan-v2.1.md:77-82`, `docs/references/kiwoom_api_report.md:40-53`.
- 순설정 추정: **P1 실험 항목 유지**. `LIST_SHRS` 변화는 실측상 충분히 자주 발생하지만, LP 보유분과 투자자 자금 흐름을 Kiwoom/KRX만으로 분리할 수 없다. 근거: `.omx/context/etf-signal-mvp-feasibility-20260917T060004Z.md:29-31`, `.omx/context/etf-signal-mvp-feasibility-20260917T060004Z.md:61-62`.
- 미국 ETF 등락 상위 종목: **P1 분리 어댑터**. Kiwoom `usa10104`, `usa20911`, `usa20511`, `usa20931`을 국내 KRX 파이프라인과 분리한다. 국내는 `bas_dd`와 국내 거래일 달력이 기준이며, 미국은 응답에 공식 시장일이 없으면 `observed_at`만 보존하고 `market_date`는 `null`로 둔다. 미국 어댑터는 기능 플래그 뒤에서 수동 또는 미국장 종료 후 워크플로로 실행하며 국내 수집을 차단하지 않는다.

## v2.1 대비 주요 수정

1. `ka10099(mrkt_tp=8)`은 더 이상 0단계 미검증 항목이 아니다. 일간 마스터 원천으로 사용한다.
2. `ka40004(+ka10099) 1회 호출` 설계는 분리한다. `ka10099`는 일간, `ka40004`는 주간·수동 교차검증으로 둔다. `ka40004`는 12페이지 연속조회와 429 재시도 대기가 필요하다.
3. `TRADING = numeric fields > 50%` 규칙은 폐기한다. 전체 시장 스냅샷은 날짜 일치, 중복 없는 키, 필수 필드 완전성, 예상 종목군 포괄 범위를 모두 통과해야 한다.
4. `LIST_SHRS * NAV ~= net assets` 95%@1% 강한 관문은 폐기한다. 실측 유효 거래일에서 89.84%만 통과했다. `LIST_SHRS * close ~= MKTCAP`를 강한 항등 검사로 쓰고, NAV와 순자산은 보조 분포 감시 항목으로 둔다.
5. 대시보드에서 서비스 역할 키를 사용하지 않는다. 현재 `lib/supabase/server.ts`와 `lib/supabase/proxy.ts`는 공개 키와 인증된 JWT를 결합한 흐름을 이미 제공한다.
6. 신규 상장은 `regDay`와 `first_seen`을 분리한다. `regDay`는 상장일이고, `first_seen`은 우리 DB 관측 시작 이후 최초 관측일이다.
7. 메시지에는 국내 일간·5거래일 상승/하락 상위 종목을 P0 앞부분에 배치한다. 단, 5거래일 수익률은 "KRX가 제공한 종가 기준 가격수익률이며 분배금·기업행동 조정 총수익률이 아님"으로 표시한다.
8. 국내와 미국의 시간 의미를 분리한다. 국내만 `bas_dd`와 `trading_calendar_kr.seq`를 사용하고, 미국은 `observed_at`, `asof_at`, 선택적 `market_date`, 스냅샷 해시로 중복을 제거한다.

## 포함 범위

- KRX 국내 일일 종가 스냅샷 수집, 검증, 저장.
- Kiwoom `ka10099` 현재 ETF 마스터·신규 상장 수집.
- Kiwoom `ka40004` 주간·수동 교차검증과 연속조회·재시도 대기.
- 국내 P0 신호:
  - KRX `FLUC_RT` 기준 일간 상승·하락 상위 종목
  - KRX 제공 종가 기준 5거래일 상승·하락 상위 종목. 분배금·기업행동 조정 총수익률은 아님
  - 직전 20거래일 대비 거래대금 급증
  - `regDay`와 스냅샷 차이에 따른 신규 상장
- 국내 P1 신호:
  - `LIST_SHRS` 변화량과 NAV로 추정한 순설정·환매. 실험 항목으로만 제공
- 미국 P1 어댑터:
  - Kiwoom `usa10104` 종목군
  - `usa20911` 일간 상승·하락 순위
  - `usa20511(tm=5)`를 5일 상승 순위의 주 원천으로 사용
  - `usa20931(flu_tp=2, tm_tp=3, tm=2)`를 5일 하락 순위의 주 원천으로 사용하고, 선택적으로 상승 결과 교차검증
- Supabase 스키마·마이그레이션, RLS 읽기 정책, 수집 작업 자격 증명, Telegram 보고서, 인증 대시보드.

## 제외 범위

- 총수익률, 분배금 조정 수익률, 배당·분배금 이벤트.
- 이 시스템이 스냅샷 저장을 시작하기 전의 과거 ETF/ETN 종목군 구성.
- 현재 Kiwoom/KRX 스냅샷을 이용한 상장폐지 이력 복원.
- LP 보유분과 투자자 설정·환매의 귀속 구분.
- 실적, 수출, 수주, 보유 종목, 거시 지표 등의 펀더멘털 조건.
- 자동주문, 포트폴리오 엔진, 학습·검증 전략 평가, 매수·매도 추천.

## 아키텍처

```text
국내 워크플로: GitHub Actions 또는 동등한 스케줄러, 평일 KRX 공표 이후
  -> scripts/ingest-kr.ts
     -> KRX etf_bydd_trd(basDd) 국내 일일 종가 스냅샷
     -> Kiwoom ka10099(mrkt_tp=8) 현재 ETF 마스터
     -> 실패 시 차단하는 계약 검증
     -> source_snapshot 메타데이터와 비공개 원본 객체 저장
     -> 서비스 역할 키로 정규화된 Supabase 테이블 갱신
     -> 국내 P0/P1 신호 생성
     -> Telegram 보고서 전송 및 signal_run 기록

미국 워크플로: 수동 또는 미국장 종료 후 별도 예약 작업, 기능 플래그 적용
  -> scripts/ingest-us-movers.ts
     -> Kiwoom usa10104 / usa20911 / usa20511 / usa20931
     -> observed_at/asof_at 및 선택적 market_date 저장
     -> 휴장 또는 순위 불변으로 반복된 스냅샷을 해시로 중복 제거
     -> 격리된 미국 P1 신호 기록
     -> 국내 워크플로를 차단하거나 실패시키지 않음

Supabase Postgres
  -> 정규화된 시장 테이블
  -> 신호 결과
  -> 인증된 대시보드 사용자를 위한 RLS SELECT 정책

Next.js 인증 대시보드
  -> 기존 Supabase SSR 인증 클라이언트
  -> 인증된 JWT/RLS를 통한 읽기 전용 질의
```

현재 저장소는 Supabase/Next 시작 템플릿 위에 신규 데이터 계층을 구축하는 형태로 이 설계를 지원한다. 관련 현황은 다음과 같다.

- `package.json`에는 Next 16, React 19, Supabase SSR·클라이언트 의존성이 있으며 스크립트는 `dev/build/start/lint`만 있다.
- `lib/supabase/server.ts:12-15`는 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`로 서버 Supabase 클라이언트를 생성한다.
- `lib/supabase/proxy.ts:18-20`은 같은 공개 키 기반 SSR 클라이언트를 사용하고, `lib/supabase/proxy.ts:47-59`는 인증되지 않은 사용자를 이동시킨다.
- `app/protected/page.tsx:8-16`은 이미 `supabase.auth.getClaims()`로 인증 페이지 접근을 제한한다.
- 계획된 수집·신호 파일은 아직 없으므로 기존 파이프라인 동작을 가정하지 않고 MVP에서 새로 만든다.

## 데이터 계약과 스키마

### API 계약

| 원천   | API ID / 엔드포인트                             | 역할                                               | 필수 응답 조건                                                                                                                                                                                            |
| ------ | ----------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KRX    | `GET /svc/apis/etp/etf_bydd_trd?basDd=YYYYMMDD` | 국내 일일 종가의 권위 스냅샷                       | HTTP 200, JSON 객체, `OutBlock_1`, 모든 행의 `BAS_DD = 요청일`, 고유한 `(BAS_DD, ISU_CD)`, 필수 일일 종가 필드가 빈 값이 아니며 숫자형                                                                    |
| Kiwoom | OAuth `au10001`                                 | Bearer 토큰                                        | 토큰은 메모리에서만 발급·사용하며 토큰과 키를 로그에 남기지 않음                                                                                                                                          |
| Kiwoom | `ka10099`, 본문 `{ "mrkt_tp": "8" }`            | 현재 ETF 마스터·신규 상장 일간 원천                | HTTP 200, `return_code=0`, `cont=N`, `code`, `name`, 유효한 `regDay`, 존재할 경우 `state`·경고                                                                                                            |
| Kiwoom | `ka10100(stk_cd)`                               | 단일 종목 `regDay` 선택 확인                       | 특정 표본 검사 또는 불일치 확인에만 사용                                                                                                                                                                  |
| Kiwoom | `ka40004`                                       | 현재 ETF 시세의 주간·수동 교차검증                 | `cont-yn=N`까지 연속조회, 커서·페이지 수 보존, 약 1.25초당 1회로 제한, 429 발생 시 대기 후 같은 커서부터 재개                                                                                             |
| Kiwoom | `ka40003`                                       | 선택적 국내 개별 ETF 일별 추이 확인                | 목표 `cntr_dt`까지 이전 페이지 조회, 날짜 입력을 가정하지 않으며 출처 추적 정보 필수                                                                                                                      |
| Kiwoom | `usa10104`                                      | 미국 ETF/ETN 종목군                                | 연속조회하고 ETF/ETN 구분 값을 보존하여 ETF 전용 결과 필터링 또는 교차검증에 사용                                                                                                                         |
| Kiwoom | `usa20911`                                      | 미국 일간 상승·하락 순위                           | 상승은 정렬값 `1`, 하락은 `4` 사용, 연속조회, 원본 순위와 관측 시각 저장                                                                                                                                  |
| Kiwoom | `usa20511`                                      | 미국 5일 상승 순위의 주 원천                       | `tm=5` 사용. 실측에서 HTTP 200, `return_code=0`, 20행, `cont=Y`였고 최상위 `flu_rt` `+337.18`이 `abs(end/start)-1`과 일치. 방향 표시 부호가 붙은 가격은 `abs`로 정규화                                    |
| Kiwoom | `usa20931`                                      | 미국 5일 하락 순위의 주 원천, 선택적 상승 교차검증 | 하락은 `flu_tp=2`, `tm_tp=3`, `tm=2` 사용. 상승 측 대응 매개변수는 선택적 교차검증에 사용 가능. 방향 표시 부호가 붙은 가격은 `abs`로 정규화하고 `usa20931.flu_rt`를 5일 수익률로 간주하거나 사용하지 않음 |

### 스냅샷 상태 계약

다음 상태를 사용한다.

- `TRADING_COMPLETE`: 유효한 날짜이고 행이 존재하며, 중복이 없고, 모든 필수 필드와 예상 종목군 포괄 범위 기준을 통과함.
- `NON_TRADING`: 검증된 달력상 비거래일이거나 현재일이 아닌 과거·비거래일 조회에서 모든 핵심 필드가 비어 있음. `seq`를 부여하지 않음.
- `PUBLISH_PENDING`: 현재 목표일 데이터의 공표가 확인되기 전임. 나중에 재시도하며 후속 계산을 수행하지 않음.
- `PARTIAL`: 날짜는 유효하지만 완전성·포괄 범위가 기준 미달임. 메타데이터만 저장하고 신호를 계산하지 않음.
- `FETCH_FAIL`: HTTP·인증·JSON·날짜 일치 검증 실패. 재시도 후 알림.

`TRADING_COMPLETE`는 v2.1의 느슨한 `TRADING` 규칙을 대체하며 국내 데이터에만 적용한다. 국내 KRX 스냅샷의 초기 포괄 범위 기준은 다음과 같다.

- 정확한 중복 수 = 0
- `BAS_DD`, `ISU_CD`, `ISU_NM`, `TDD_CLSPRC`, `NAV`, `ACC_TRDVOL`, `ACC_TRDVAL` 필수 필드 완전성 = 100%
- 예상 행 수 >= 직전 유효 KRX ETF 행 수 × 0.98. 단, 저장된 수동 예외가 시장 전체 종목군 변경을 설명하면 예외 허용
- 모든 행의 `BAS_DD`가 요청한 `basDd`와 정확히 일치

미국 스냅샷에는 별도의 관측 계약을 사용한다.

- `observed_at`은 실제 수집 시각이다.
- `asof_at`은 워크플로가 의도한 관측 시각이며 일반적으로 미국장 종료 후 예약 시각이다.
- `market_date`는 선택 값이며 Kiwoom 미국 응답이 공식 시장일을 별도로 제공하지 않으면 `null`로 유지한다.
- 관측 식별자와 콘텐츠 식별자를 분리한다. 모든 요청 시도에 고유한 `observation_key`를 부여한다. 휴장이나 내용 불변으로 반복된 콘텐츠는 앞선 기준 스냅샷과 같은 `sha256`을 가진 새 `duplicate_observation` 행으로 저장하고, `duplicate_of_snapshot_id`가 그 기준 행을 가리키게 한다.
- 중복 콘텐츠는 기준 원본 객체를 재사용하거나 참조하며 새 신호를 생성하지 않는다.
- 미국 어댑터 실패는 국내 `trading_calendar_kr`, 국내 `signal_run`, 국내 Telegram 상태 알림을 변경할 수 없다.

### 테이블

```sql
create table source_snapshot (
  id uuid primary key default gen_random_uuid(),
  observation_key text unique not null, -- 워크플로/실행/요청 시도 식별자
  market text not null check (market in ('KR','US')),
  source text not null,                 -- krx | kiwoom
  api_id text not null,                 -- etf_bydd_trd | ka10099 | ka40004 | usa20911 ...
  requested_asof date,                  -- 해당할 경우 국내 요청일
  market_date date,                     -- 선택 값. 응답에 공식 시장일이 없으면 미국 데이터는 null 유지
  asof_at timestamptz,
  observed_at timestamptz not null default now(),
  status text not null,                 -- duplicate_observation 포함
  http_status int,
  return_code text,
  row_count int not null default 0,
  unique_key_count int,
  page_count int not null default 1,
  sha256 text not null,
  duplicate_of_snapshot_id uuid references source_snapshot(id),
  transform_version text not null,
  object_path text,                     -- 비공개 저장 경로. 외부 공개 금지. 중복 행은 기준 object_path를 가리킬 수 있음
  error_code text,
  error_message text
);

create index source_snapshot_content_lookup
  on source_snapshot (market, api_id, coalesce(market_date, date '0001-01-01'), sha256);

create table trading_calendar_kr (
  bas_dd date primary key,
  seq int unique,                       -- 국내 TRADING_COMPLETE에만 부여
  status text not null,
  source_snapshot_id uuid references source_snapshot(id)
);

create table etf_daily_kr (
  bas_dd date not null,
  isu_cd text not null,
  isu_nm text not null,
  open_prc numeric,
  high_prc numeric,
  low_prc numeric,
  close_prc numeric not null,
  fluc_rt numeric,
  nav numeric not null,
  acc_trdvol numeric not null,
  acc_trdval numeric not null,
  mktcap numeric,
  net_asset numeric,
  list_shrs numeric,
  idx_nm text,
  idx_close numeric,
  idx_fluc_rt numeric,
  quality text not null default 'ok',
  source_snapshot_id uuid references source_snapshot(id),
  primary key (bas_dd, isu_cd)
);

create table etf_master_kr (
  code text primary key,                -- Kiwoom 종목 코드. 가능하면 KRX와 정확히 조인
  name text not null,
  reg_day date,
  market_code text,
  market_name text,
  state text,
  first_seen date not null,
  last_seen date not null,
  first_alerted_at timestamptz,
  source_snapshot_id uuid references source_snapshot(id)
);

create table listing_event_kr (
  event_key text primary key,           -- 예: KR:new_listing:<code>:<reg_day>
  code text not null references etf_master_kr(code),
  reg_day date,
  first_seen date not null,
  new_in_snapshot boolean not null,
  first_alerted_at timestamptz,
  source_snapshot_id uuid references source_snapshot(id)
);

create table signal_run (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market in ('KR','US')),
  bas_dd date,                          -- 국내 전용
  market_date date,                     -- 선택 값. 특히 미국 순위 응답에 적용
  asof_at timestamptz,
  observed_at timestamptz not null default now(),
  strategy_version text not null,
  transform_version text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null,
  input_snapshot_ids uuid[] not null,
  notes jsonb not null default '{}'::jsonb
);

create table signal_daily (
  run_id uuid references signal_run(id),
  market text not null,                 -- KR | US
  bas_dd date,                          -- 국내 전용. 명시적으로 대응하지 않으면 미국은 null
  market_date date,                     -- 미국 데이터에서 선택 값
  observed_at timestamptz not null,
  asof_at timestamptz,
  signal_type text not null,            -- kr_daily_gain, kr_5d_loss, turnover_surge, new_listing, net_creation_exp, us_5d_gain ...
  code text not null,
  name text not null,
  screen text not null check (screen in ('raw','liquid')),
  rank int,
  value numeric,
  value_unit text,
  liquidity_value numeric,
  is_experimental boolean not null default false,
  source_snapshot_id uuid references source_snapshot(id),
  meta jsonb not null default '{}'::jsonb,
  primary key (run_id, market, signal_type, screen, code)
);
```

### 무결성 검사

- 강한 항등 검사: `LIST_SHRS * TDD_CLSPRC ~= MKTCAP`. 1% 오차 이내 통과율이 99% 미만이면 경고한다.
- 보조 감시: `LIST_SHRS * NAV ~= INVSTASST_NETASST_TOTAMT`. 1%, 2%, 3%, 5% 오차별 분포를 보고하고, 초기에는 3% 이내 통과율이 95% 미만이거나 5% 이내가 98% 미만일 때만 경고한다.
- 거래대금 단위 검사: 거래량이 0이 아닌 행은 문서화된 이상치를 제외하고 `ACC_TRDVAL / ACC_TRDVOL`이 `TDD_LWPRC..TDD_HGPRC` 범위에 있어야 한다.
- KRX/Kiwoom 종목 코드 교집합 검사: 매일 개수와 불일치 코드를 보고하며 숫자형 코드라는 이유만으로 대응 관계를 추론하지 않는다.

## 신호 정의

### P0 국내 일간 등락 상·하위 종목

- 입력: 같은 날의 `etf_daily_kr` 행 중 `quality='ok'`인 데이터.
- 상승 상위: `FLUC_RT desc`로 정렬한다.
- 하락 상위: `FLUC_RT asc`로 정렬한다.
- `signal_daily.screen = 'raw' | 'liquid'`를 사용해 전체 기준 상위 10개와 유동성 선별 상위 10개를 출력한다.
- 초기 유동성 선별 기준: `ACC_TRDVAL >= 1,000,000,000 KRW` 및 `ACC_TRDVOL > 0`.
- "KRX가 제공한 종가 기준 가격수익률이며 분배금·기업행동 조정 총수익률이 아님"으로 표시한다. 분배금·기업행동 왜곡이 의심되는 행은 `anomaly_label`과 함께 전체 순위에만 남기며 임의로 조정하지 않는다.

### P0 국내 5거래일 등락 상·하위 종목

- 입력: `trading_calendar_kr.seq` 연속성과 `etf_daily_kr.close_prc`.
- 수익률: 두 끝점이 모두 존재하고 누락된 `seq`가 없을 때만 `(close_t / close_t_minus_5) - 1`로 계산한다.
- `signal_daily.screen = 'raw' | 'liquid'`를 사용해 전체 기준 및 유동성 선별 상승·하락 상위 종목을 출력한다.
- 조회 기간 안에 `reg_day`가 있는 ETF는 "신규·이력 부족" 섹션에 명시적으로 표시하지 않는 한 제외한다.
- 모든 값을 "KRX가 제공한 종가 기준 가격수익률이며 분배금·기업행동 조정 총수익률이 아님"으로 표시한다. 의심스러운 가격 공백은 표기만 하고 총수익률로 조정하지 않는다.

### P0 거래대금 급증

- 입력: 직전 20개 완전 거래일과 현재 `ACC_TRDVAL`.
- 기준 버전 1:
  - 직전 구간 행 수 = 20, `span20 = 19`
  - 직전 평균 `ACC_TRDVAL >= 1,000,000,000 KRW`
  - 현재 값 / 직전 평균 >= 3.0
  - 가능하면 `FLUC_RT`, `IDX_IND_NM`, `FLUC_RT_IDX`, 초과수익률 포함
- 예상 출력은 0~15개다. 일간 출력이 반복해서 50개를 넘거나 항상 0이면 20거래일 관측 후 기준을 조정한다.

### P0 신규 상장

- 일간 초기화:
  - `ka10099(mrkt_tp=8)` 스냅샷에서 현재 상장 ETF의 `code`, `name`, `regDay`를 가져온다.
  - 최초 운영일은 초기 스냅샷으로 취급한다. 기존 모든 ETF를 신규 상장으로 알리면 안 된다.
  - 초기 요약에는 최근 30일 안에 `regDay`가 있는 ETF만 표시할 수 있으며 이벤트 알림이 아닌 초기 보유 목록임을 명시한다.
- 알림 의미:
  - 정상 이벤트 알림은 초기 스냅샷 이후 `new_in_snapshot = true`여야 한다.
  - 이벤트 키 `KR:new_listing:<code>:<reg_day>`는 고유해야 한다.
  - 반복 알림을 막기 위해 최초 정상 이벤트 알림 시 `first_alerted_at`을 설정한다.
  - 최근 30일 상장 목록은 대시보드·요약 섹션에 표시하며 반복 이벤트 알림으로 보내지 않는다.
- 구분할 값:
  - `reg_day`: Kiwoom 상장일
  - `first_seen`: 이 시스템이 해당 코드를 처음 관측한 날짜
  - `new_in_snapshot`: 직전 저장 마스터 스냅샷에 없던 코드인지 여부
  - `first_alerted_at`: 최초 정상 이벤트 알림 시각

### P1 실험적 순설정·환매 추정

- 계산 후보: `(LIST_SHRS_t - LIST_SHRS_t-1) * NAV_t`.
- 5거래일 이동 합계와 양수·음수 일수를 사용한다.
- 유입과 유출을 분리한다.
- 누락된 `seq`, 큰 기업행동 의심, 강한 항등 검사 이상이 있는 행은 제외한다.
- 메시지 표기: "추정 순설정·환매, 실험 항목이며 LP 보유분이 포함될 수 있음."
- 중단 기준: 20개 완전 거래일 관측 후 사람의 검토 가치가 없다면 메시지에서 제거한다.

### P1 미국 ETF 등락 어댑터

- 기능 플래그 뒤에서 국내 KRX 파이프라인과 분리된 모듈·테이블 경로로 구현한다.
- 수동 또는 미국장 종료 후 별도 워크플로로 실행한다. 국내 수집, 국내 Telegram 상태 알림, 국내 대시보드 최신성을 차단하지 않는다.
- 원천:
  - `usa10104`: 종목군, 연속조회, `etn` 필터·교차검증
  - `usa20911`: 상승 정렬값 `1`, 하락 정렬값 `4`를 사용한 일간 순위
  - `usa20511(tm=5)`: 5일 상승의 주 원천. 실측에서 HTTP 200, `return_code=0`, 20행, `cont=Y`였고 최상위 `flu_rt` `+337.18`이 `abs(end/start)-1`과 일치함
  - `usa20931(flu_tp=2, tm_tp=3, tm=2)`: 5일 하락의 주 원천. 상승 측 `usa20931`은 선택적 교차검증에만 사용
- 가격 정규화:
  - Kiwoom 미국 가격의 선행 부호는 시장 방향 표시로 취급하고 숫자 가격에는 `abs(value)`를 사용한다.
  - 시작·종료 가격이 명시된 엔드포인트에서는 기간 수익률을 `abs(end_pric) / abs(start_pric) - 1` 또는 동등한 필드 쌍으로 계산한다.
  - `usa20931.flu_rt`를 5일 수익률로 간주하거나 사용하지 않는다.
  - Kiwoom 원본 순위와 계산 수익률을 나란히 보존한다.
- 시간 의미:
  - `observed_at`과 `asof_at`을 저장한다.
  - 응답이 공식 시장일을 별도로 제공하지 않으면 `market_date`를 `null`로 유지한다.
  - 각 요청 시도의 고유한 `observation_key`를 보존하면서 휴장 또는 순위 불변으로 반복된 스냅샷을 콘텐츠 해시로 중복 제거한다.
  - 중복 콘텐츠는 기준 스냅샷을 가리키는 `duplicate_observation` 상태의 `source_snapshot` 행을 생성하며 새 미국 등락 신호는 만들지 않는다.
- 출력:
  - 미국 일간 상승·하락
  - 미국 5일 상승·하락
  - 가능한 경우 유동성·범위 메타데이터. 없으면 `liquidity_screen='not_available'`로 표시
- 국내 순위, KRX 필드, 국내 `bas_dd`, 국내 `trading_calendar_kr`와 합치지 않는다.

## 구현 단계

### 0단계 - 계약 검증과 초기 스냅샷 결정, 0.5일

1. 비밀정보나 원본 응답을 Git에 저장하지 않고 읽기 전용 검증을 수행하도록 `scripts/probe.ts`를 구현한다.
2. 유효 거래일 정확히 2개와 달력상 유효한 비거래일 1개로 KRX를 검증한다.
3. `20260230` 같은 잘못된 달력 날짜는 HTTP 요청 전에 거부한다. 실제 API 호출 대신 무호출 단위 테스트로 검증한다.
4. Kiwoom `ka10099(mrkt_tp=8)` 현재 마스터를 검증하고 최근 유효 KRX 스냅샷과 비교한다.
5. 기능 플래그가 켜진 경우에만 미국 어댑터 계약을 검증한다. 대상은 `usa10104` 연속조회·ETN 필터, `usa20911` 정렬값 `1`·`4`, `usa20511(tm=5)`, `usa20931` 하락 요청이다.
6. `workflow_dispatch`로 GitHub Actions의 KRX 외부 통신을 확인한다. 차단되면 아키텍처는 유지하고 스케줄러 실행 위치만 옮긴다.
7. 최초 `ka10099` 운영 실행을 초기 스냅샷으로 기록한다. 정상 이벤트 알림 대신 최근 30일 초기 요약만 선택적으로 보낸다.

### 1단계 - 국내 데이터 수집 및 저장, 1.5일

1. `source_snapshot`, `trading_calendar_kr`, `etf_daily_kr`, `etf_master_kr`, `listing_event_kr`, `signal_run`, `signal_daily`용 Supabase 마이그레이션을 추가한다.
2. 파서, 완전성 계약, 강한·보조 항등 검사를 포함한 `lib/market-data/krx.ts`를 추가한다.
3. 토큰 처리, `ka10099`, `ka40004` 교차검증 어댑터를 포함한 `lib/market-data/kiwoom.ts`를 추가한다.
4. 완전한 KRX 거래일 25일을 적재하는 `scripts/backfill.ts`를 추가한다.
5. 국내 일간 실행, 멱등 갱신, 비공개 원본 저장 메타데이터, 실패 시 차단하는 알림 상태를 처리하는 `scripts/ingest-kr.ts`를 추가한다.

### 2단계 - 국내 P0 신호, 1일

1. 일간·5거래일 상승/하락 상위 종목을 구현한다.
2. 직전 20일 구간을 사용한 거래대금 급증을 구현한다.
3. 초기 스냅샷 의미를 반영한 신규 상장 알림을 구현한다.
4. 메시지 길이 제한과 상태 알림 동작을 포함한 Telegram 포매터를 작성한다.
5. 구간 연속성, 부분 스냅샷, 잘못된 KRX 날짜, 초기일 신규 상장 알림 억제용 고정 데이터 테스트를 추가한다.

### 3단계 - 예약 실행 및 대시보드, 1일

1. 평일 예약 실행과 수동 실행을 포함한 `.github/workflows/ingest.yml`을 추가한다.
2. KRX·Kiwoom·Supabase 서비스 역할·Telegram 비밀정보는 GitHub Actions에만 저장한다.
3. 읽기 모델에 인증 사용자를 위한 RLS `SELECT` 정책을 추가한다.
4. 시작 템플릿의 인증 페이지를 최소 읽기 전용 대시보드로 교체한다.
   - 최근 실행 상태
   - P0 국내 등락 상·하위 종목
   - 거래대금 급증
   - 신규 상장
   - 검증 경고
5. 대시보드 질의는 서비스 역할 키가 아닌 기존 인증 Supabase 클라이언트를 사용한다.

### 4단계 - P1 어댑터 및 관측, 20거래일

1. P0 섹션 아래에 실험적 순설정·환매 추정 결과를 추가한다.
2. 설정 플래그 뒤에 미국 등락 어댑터 `scripts/ingest-us-movers.ts`를 추가하고, 수동 또는 미국장 종료 후 별도 워크플로에서만 실행한다.
3. 일간 신호 수, 검증 경고, 불일치 코드 수, 가능할 경우 사용자가 열어 본 조사 건수를 수집한다.
4. 이 단계에서는 신호를 매매에 사용하지 않는다.

### 5단계 - 유지·폐기·조정 판정, 완전 거래일 20일 이후

1. 완전 거래일 20일 이후에만 임계값을 조정한다.
2. 관측된 유용성에 따라 순설정 추정을 정식 승격, 실험 유지 또는 제거한다.
3. 미국 어댑터에 대시보드 섹션을 제공할지 결정한다.
4. 신호량과 사람의 검토 유용성이 입증될 때까지 포트폴리오·백테스트 작업을 미룬다.

## 수용 기준

- KRX 유효 거래일 수집은 모든 필수 필드가 완전하고, 모든 행이 요청한 `BAS_DD`와 일치하며, 중복 `(BAS_DD, ISU_CD)` 수가 0이고, 행 포괄 범위 기준을 통과한 스냅샷만 저장한다.
- KRX 실시간 검증은 유효 거래일 2개와 달력상 유효한 비거래일 1개를 포함한다.
- KRX 비거래일 고정 데이터는 `NON_TRADING`, `PUBLISH_PENDING`, `FETCH_FAIL` 중 하나를 반환하며 `TRADING_COMPLETE`를 반환하지 않는다.
- `20260230` 같은 잘못된 달력 날짜는 API 요청 전 무호출 단위 테스트에서 거부된다.
- `source_snapshot`은 모든 저장 실행에 대해 `observation_key`, `source`, `api_id`, 날짜·시각 필드, 상태, 행 수, 페이지 수, SHA-256 콘텐츠 해시, 해당할 경우 중복 참조, 변환 버전, 비공개 객체 경로를 기록한다.
- `source_snapshot`, `signal_run`, `signal_daily`는 해당하는 경우 `market`, `observed_at`/`asof_at`, 선택적 `market_date`, `source_snapshot_id`를 포함한다.
- 반복 콘텐츠는 고유한 `observation_key`, `duplicate_observation` 상태, 같은 `sha256`, 기준 스냅샷을 가리키는 `duplicate_of_snapshot_id`를 가진 새 `source_snapshot` 행을 만들며, 해당 중복 관측에서는 새 신호를 생성하지 않는다.
- `source_snapshot`은 고유 콘텐츠 제약 대신 `(market, api_id, coalesced market_date, sha256)`에 비고유 조회 인덱스를 사용한다.
- `signal_daily`는 `screen`(`raw` 또는 `liquid`)을 포함하고 기본 키에도 이를 넣어 같은 실행·유형·코드의 전체 및 유동성 선별 결과가 충돌 없이 공존하게 한다.
- 미국 행은 국내 `bas_dd`를 재사용하지 않으며 국내 `trading_calendar_kr`를 미국 신호와 조인하지 않는다.
- `LIST_SHRS * TDD_CLSPRC ~= MKTCAP`는 강한 항등 감시이고, `LIST_SHRS * NAV ~= net assets`는 1%·2%·3%·5% 오차별 통과율을 보는 보조 분포 감시다.
- `ka10099(mrkt_tp=8)` 수집은 유효한 `regDay`를 가진 현재 모든 코드를 저장한다. 최초 운영 실행은 모든 행을 신규로 알리지 않고 마스터를 초기화하며, 초기 요약은 최근 30일 안에 `regDay`가 있는 종목으로 제한한다.
- `ka40004` 교차검증은 `cont-yn=N`까지 연속조회하고 429를 재시도 대기로 처리하며 과거 종목군 구성의 대체 자료로 사용하지 않는다.
- 국내 일간 등락 상·하위 종목은 최근 완전 거래일의 KRX `FLUC_RT`로 생성한다.
- 국내 5거래일 등락 순위는 `seq` 연속성과 두 끝점 가격이 모두 있을 때만 생성하며, 모든 결과에 "KRX가 제공한 종가 기준 가격수익률이며 분배금·기업행동 조정 총수익률이 아님"을 표시한다.
- 거래대금 급증의 직전 평균에서는 현재일을 제외하고 연속된 직전 거래일 20개를 요구한다.
- 신규 상장 알림은 `reg_day`, `first_seen`, `new_in_snapshot`, `first_alerted_at`을 구분한다. 반복되는 최근 30일 목록은 대시보드·요약 내용이며 이벤트 알림 내용이 아니다.
- 순설정 알림은 실험 항목으로 표시하고 P0 섹션과 분리하며 LP 보유분이 포함될 수 있음을 명시한다.
- 미국 등락 어댑터는 국내 신호와 분리하여 미국 순위를 저장·계산한다. 일간은 `usa20911` 정렬값 `1`·`4`, 5일 상승은 `usa20511(tm=5)`, 5일 하락은 `usa20931(flu_tp=2, tm_tp=3, tm=2)`, ETN 필터·교차검증은 `usa10104`를 사용하고 방향 표시 부호가 붙은 가격은 `abs`로 정규화한다.
- 미국의 휴장 또는 불변 스냅샷은 해시로 중복 제거해 `duplicate_observation` 행으로 저장하며 새 등락 알림을 생성하지 않는다.
- 대시보드는 인증된 Supabase/RLS 읽기를 사용하고, 서비스 역할 키는 수집 작업 환경 경로에만 둔다.
- Telegram은 모든 예약 실행마다 상태 알림 또는 명시적 실패 메시지를 보낸다.
- 원본 API 키, 토큰, 전체 원본 응답을 Git에 커밋하지 않는다.

## 검증 절차

1. 구현 후 `npm run lint`를 실행한다.
2. KRX 유효 거래일 2개, 달력상 유효한 비거래일, 잘못된 날짜의 무호출 동작, 중복 키, 필수 필드 누락, 숫자 파싱 사례를 포함한 파서·단위 테스트를 실행한다.
3. `ka10099`, `ka40004` 연속조회 메타데이터와 429 재개, `usa10104` 연속조회·ETN 필터, `usa20911` 정렬값 `1`·`4`, `usa20511(tm=5)`, `usa20931` 하락 매개변수, 미국 가격 부호 정규화, 해시 중복 제거를 포함한 Kiwoom 파서 테스트를 실행한다.
4. 동일 콘텐츠 관측 2건이 서로 다른 `observation_key`를 가진 `source_snapshot` 행 2개를 만들고, 두 번째 행의 `status='duplicate_observation'`이며, `duplicate_of_snapshot_id`가 기준 행을 가리키고, 원본 객체 저장소를 재사용·참조하며, 중복 신호가 나오지 않음을 출처 추적 테스트로 증명한다.
5. 같은 `(run_id, market, signal_type, code)`에 `screen='raw'`와 `screen='liquid'` 행이 공존할 수 있음을 신호 저장 테스트로 증명한다.
6. `.env` 비밀정보를 불러오되 로그에서는 가린 상태로 로컬 모의 실행 검증을 수행한다.
7. 국내 `workflow_dispatch`를 한 번 실행하여 KRX 외부 통신, Telegram 수신, Supabase 쓰기를 확인한다. 미국 워크플로는 기능 플래그가 켜진 경우에만 별도로 실행한다.
8. 과거 데이터 적재 후 Supabase를 질의한다.
   - `TRADING_COMPLETE` 달력 행 25개 또는 명시적으로 문서화된 예외
   - 중복 `(bas_dd, isu_cd)` 없음
   - 원천 스냅샷의 해시가 비어 있지 않음
   - 모든 원천 스냅샷에 고유한 `observation_key`가 있음
   - 중복 관측이 기준 스냅샷을 가리키며 연결된 새 신호 행이 없음
   - 국내 신호 행이 국내 `signal_run`을 참조함
   - 기능이 켜진 경우 미국 신호 행의 `bas_dd`는 `null`이고, 관측 시각과 선택적 `market_date`, 자체 원천 스냅샷 ID를 가짐
   - 전체·유동성 선별 변형은 충돌하는 중복 기본 키가 아니라 `screen`으로 표현됨
9. 인증 사용자로 보호된 대시보드를 열어 서비스 역할 자격 증명 노출 없이 읽기 전용 P0 섹션이 표시되는지 확인한다.

## 위험과 대응

| 위험                                       | 영향                                 | 대응                                                                                    |
| ------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------- |
| KRX가 HTTP 200과 빈 행을 반환함            | 잘못된 스냅샷이 계산 구간을 오염함   | 완전성·날짜 일치 검사를 실패 시 차단 방식으로 적용                                      |
| KRX 공표가 예약 시각보다 늦음              | 거짓 실패 또는 보류일 발생           | `PUBLISH_PENDING`, 재시도, 상태 알림                                                    |
| GitHub Actions에서 KRX에 접근하지 못함     | 수집 불가                            | 스케줄러 실행 위치만 옮기고 스키마·대시보드는 유지                                      |
| Kiwoom 호출 제한이 변경됨                  | 마스터·교차검증 실패                 | 토큰 버킷, 429 재시도 대기, 페이지 커서 보존                                            |
| KRX/Kiwoom 종목 코드 교집합이 변함         | 신규 상장 또는 조인 실패             | 일간 불일치 코드 보고, 추론에 의한 대응 금지                                            |
| NAV·순자산 항등 검사의 거짓 경보           | 잡음이 유효 거래일 처리를 차단함     | 95%@1% 강한 관문 대신 보조 분포 감시                                                    |
| 순설정 추정을 투자자 자금 흐름으로 오해함  | 잘못된 투자 해석                     | 실험 표기, 별도 섹션, 유지·폐기 관문                                                    |
| 서비스 역할 키가 프런트엔드에 노출됨       | 보안 사고                            | 인증된 RLS로만 대시보드 접근, 비밀정보 정적 검사                                        |
| 미국 순위에 충분한 유동성 맥락이 없음      | 품질이 낮은 극단값                   | 전체·유동성 선별 섹션 분리, 어댑터 플래그                                               |
| 미국 순위 응답에 공식 시장일이 없음        | 잘못된 날짜 의미 또는 휴장일 중복    | `observed_at` 저장, 공식 시장일이 없으면 `market_date=null`, 반복 스냅샷 해시 중복 제거 |
| 미국 워크플로 실패가 국내 보고를 차단함    | P1 기능으로 국내 탐색 레이더 중단    | 별도 워크플로·기능 플래그, 미국 실패가 국내 작업에 영향 없음                            |
| 최근 신규 상장 목록이 매일 반복됨          | 알림 피로                            | 일회성 초기 요약, `first_alerted_at`이 포함된 고유 이벤트 키                            |
| 콘텐츠 해시를 관측 식별자로 사용함         | 감사 이력 손실 또는 휴장일 반복 알림 | 시도별 고유 `observation_key`, 비고유 콘텐츠 조회, `duplicate_of_snapshot_id`           |
| 전체·유동성 선별 행이 신호 저장에서 충돌함 | 순위 누락 또는 덮어쓰기              | `signal_daily` 기본 키에 명시적 `screen` 열 포함                                        |

## RALPLAN-DR 요약

### 원칙

1. 시장 데이터 품질 검증에 실패하면 후속 처리를 차단한다.
2. 투명한 가격·거래량 탐색 신호와 실험적 해석 신호를 분리한다.
3. 모든 알림을 재현할 수 있을 만큼 원천 추적 정보를 보존한다.
4. 현재 스냅샷으로 확보할 수 없는 과거 이력이나 경제적 의미를 추론하지 않는다.
5. 자격 증명 범위를 제한한다. 작업에는 서비스 역할 키, 대시보드에는 인증된 RLS를 사용한다.

### 핵심 결정 요인

1. Kiwoom/KRX 전용 제약 안에서 API로 검증된 구현 가능성.
2. 전략·백테스트 복잡성을 도입하기 전에 얻는 즉각적인 사람 검토 가치.
3. 무인 일간 작업의 재현성과 보안.

### 실행 가능한 선택지

선택지 A - 국내 P0 우선  
장점: 가장 빠르고 운영 위험이 가장 낮으며 모든 핵심 신호가 KRX와 `ka10099`에서 나온다.  
단점: 미국 등락 추적 요구를 뒤로 미루며 시장 포괄 범위가 좁다.

선택지 B - 국내 P0와 격리된 미국 P1 어댑터, 권장  
장점: 의미 차이를 격리하면서 국내와 미국 등락 상·하위 종목을 포괄하고 MVP의 초점을 유지한다.  
단점: Kiwoom 해외 API 파싱과 추가 검증 범위가 생긴다.  
조건: 미국 기능이 별도 워크플로에서 동작하는 비차단 P1이고, `market_date`가 선택 값이며, 국내 `bas_dd`에 의존하지 않을 때만 타당하다.

선택지 C - 순설정을 동급 핵심 신호로 포함  
장점: 차별화된 ETF 자금 흐름 탐색 기능이 될 가능성이 있다.  
단점: Kiwoom/KRX만으로 LP 보유분의 모호성을 해소할 수 없어 오용 위험이 크다. P0에서는 제외하고 P1 실험 항목으로 유지한다.

아키텍트의 반론: 국내 데이터는 날짜가 명확한 일일 종가 시장 데이터인 반면 Kiwoom 미국 순위 응답은 신뢰할 수 있는 공식 시장일이 없는 관측 시점 순위이므로, 미국 등락 기능을 MVP에 추가하면 사용자가 혼동할 위험이 있다.  
상충 관계 종합: 선택지 B는 미국 기능을 명확한 시간 의미와 해시 중복 제거를 갖춘 기능 플래그 기반 비차단 P1 어댑터로 유지하고 국내 달력과 조인하지 않을 때만 수용할 수 있다. 그렇지 않다면 선택지 A가 더 안전한 MVP다.

## ADR

### 결정

선택지 B를 채택한다. 국내 P0 탐색 레이더를 먼저 구현하고 미국 등락 기능은 격리된 비차단 P1 어댑터로 추가한다. 순설정·환매 추정은 핵심 신호가 아닌 실험 항목으로 유지한다.

### 결정 요인

- KRX는 신뢰할 수 있는 국내 일일 종가 필드를 제공하지만 엄격한 완전성 검증이 필요하다.
- Kiwoom `ka10099`의 현재 ETF 상장일은 실시간 호출로 검증되었다.
- Kiwoom 미국 순위 API는 사용할 수 있지만 응답 의미가 국내 KRX 데이터와 다르고, 순위 응답에 신뢰할 수 있는 공식 시장일이 없다.
- 대시보드 보안은 기존 인증 Supabase SSR 설계와 맞아야 한다.

### 검토한 대안

- 국내 전용: 미국 관측 시각 의미를 피하므로 더 안전하고 아키텍처가 단순하지만, 요구된 미국 일간·주간 등락 추적이 계획에서 빠진다.
- 자금 흐름 우선 MVP: 더 새로울 수 있지만 LP 보유분과 투자자 수요를 분리할 수 없는 데이터를 과도하게 해석한다.
- 서비스 역할 대시보드: 서버 코드는 단순해지지만 최소 권한 원칙을 위반하고 RLS를 우회한다.

### 선택 이유

이 선택지는 검증된 필드에서 유용한 일간 탐색 결과를 최대화하면서 요구된 미국 등락 기능도 포함한다. 단, 국내 KRX 계약과 Kiwoom 해외 순위 의미를 명시적으로 연결하지 않아야 한다. 미국 기능을 비차단 P1으로 유지할 수 없다면 국내 전용 선택지 A로 되돌린다.

### 결과 및 영향

- 단순 스크립트보다 스키마와 출처 추적 작업이 많지만 알림을 재현할 수 있다.
- 미국 등락 기능에는 별도 어댑터 테스트, 메시지 섹션, 워크플로 예약, 시간 의미, 해시 중복 제거 처리가 필요하다.
- 순설정 추정은 핵심 MVP에 영향 없이 관측 후 제거할 수 있다.

### 후속 작업

- 완전 거래일 20일 후 적중률과 사람의 검토 이용도를 평가한다.
- P0 신호량의 유용성이 입증된 뒤에만 포트폴리오·백테스트 설계를 검토한다.
- 데이터 원천 제약이 변경될 때만 공식 과거 마스터 또는 분배금 원천을 추가한다.

## 사용 가능한 에이전트 유형

- `planner`: 계획 개선과 범위 통제.
- `architect`: 스키마, 보안, 파이프라인 경계 검토.
- `executor`: 마이그레이션, 수집, 신호, 워크플로, UI 구현.
- `test-engineer`: 고정 데이터, 파서 테스트, 통합 테스트, CI 관문.
- `verifier`: 구현 후 증거 검토와 수용 기준 감사.
- `critic`: 과도한 범위와 근거 없는 가정을 찾는 최종 계획·구현 검토.
- `researcher`: 새로운 Kiwoom/KRX/Supabase 동작을 확인해야 할 때 공식 API·문서 근거 조사.

## 실행 인력 구성 지침

권장 실행 경로: **Team + Ultragoal**.

- `architect`, 높은 추론 강도: 구현 전에 스키마, RLS, 출처 추적, 데이터 원천 경계를 검토한다.
- `executor`, 중간 추론 강도: 데이터베이스 마이그레이션, KRX/Kiwoom 클라이언트, 수집 스크립트, 신호 모듈, Telegram 포매터, 대시보드를 구현한다.
- `test-engineer`, 중간 추론 강도: 민감정보를 제거한 표본으로 고정 데이터, 단위·통합 테스트, 워크플로 모의 실행 검사를 만든다.
- `verifier`, 높은 추론 강도: 수용 기준, 비밀정보 경계, 데이터 계약, 대시보드 인증 동작을 검증한다.

Ralph 대안: 한 명의 지속 실행 주체가 순차적으로 구현·검증해야 할 때만 `$ralph`를 사용한다. 이 MVP는 계약이 고정된 뒤 수집, 스키마, 테스트, 대시보드를 병렬로 진행할 수 있으므로 조율된 Team 실행이 더 적합하다.

## 목표 모드 후속 실행 제안

- `$ultragoal`: 기본 후속 실행. MVP 구현, 검증 목록, 20거래일 관측 기록의 지속 상태를 유지하는 데 사용한다.
- `$team`: 병렬 구현 경로가 필요할 때 `$ultragoal`과 함께 사용한다.
- `$autoresearch-goal`: 구현 자체에는 권장하지 않는다. 다음 작업이 외부 시장 데이터 원천에 관한 조사 산출물로 바뀔 때만 사용한다.
- `$performance-goal`: 수집·실행 성능이 측정된 병목이 되기 전에는 필요하지 않다.

## 팀 실행 예시

```text
$ultragoal implement .omx/drafts/etf-signal-mvp-v2.2-draft.md
$team implement ETF signal MVP v2.2 from .omx/drafts/etf-signal-mvp-v2.2-draft.md with architect, executor, test-engineer, verifier
```

팀 검증 경로:

1. 아키텍트가 스키마·보안·데이터 원천 경계를 승인한다.
2. 실행 담당자가 범위에 맞는 구현을 반영한다.
3. 테스트 엔지니어가 파서, 기간 계산, 초기 스냅샷 의미, 자격 증명 경계를 증명한다.
4. 검증 담당자가 최신 명령 출력과 모의 실행 1회를 수용 기준에 대조한다.
5. Ultragoal에 최종 증거와 20거래일 관측 후속 점검 지점을 기록한다.

## 이 계획서에 반영한 변경 사항

- 국내 일간·5거래일 상승/하락 상위 종목을 P0로 승격했다.
- `ka10099`를 미검증 후보에서 검증된 일간 마스터 원천으로 변경했다.
- `ka40004`를 일간 마스터에서 주간·수동 교차검증으로 내렸다.
- 50% 거래일 규칙을 실패 시 차단하는 스냅샷 완전성 규칙으로 교체했다.
- NAV 강한 항등 관문을 시가총액 강한 항등 검사와 NAV 보조 감시로 교체했다.
- 미국 ETF 등락 기능을 격리된 P1 어댑터로 추가했다.
- 대시보드 자격 증명 모델을 서비스 역할이 아닌 인증된 RLS로 바로잡았다.
- 재현성 메타데이터와 명시적 `signal_run`을 추가했다.

## 지속 가능한 합의 인계

### 계획 산출물

- 배경 스냅샷: `.omx/context/etf-signal-mvp-feasibility-20260917T060004Z.md`
- 기획자 초안: `.omx/drafts/etf-signal-mvp-v2.2-draft.md`
- 최종 합의 계획: `docs/plans/ETF-signal-MVP-plan-v2.2.md`
- OMX 런타임 사본: `.omx/plans/prd-etf-signal-mvp-v2.2.md`

### 검토 순서와 판정

1. 기획자가 근거 기반 v2.2 초안을 작성했다.
2. 아키텍트가 초안을 검토하고 국내·미국 시간 의미, 미국 5일 끝점 의미, 신규 상장 이벤트 의미, 잘못된 날짜 사전 검사, 관측·콘텐츠 중복 제거 수정을 요구했다. 수정 반영 후 `APPROVE`를 반환했다.
3. 비평가가 아키텍트 승인 계획을 검토하고 선택지 일관성, 공정한 대안 비교, 위험 통제, 검증 가능한 수용 기준, 구체적 검증 절차, 데이터 원천 경계의 정확성, 필수 실행 인계 섹션을 확인한 뒤 `APPROVE`를 반환했다.

### 합의 통과 기록

```yaml
planning_artifacts:
  context: .omx/context/etf-signal-mvp-feasibility-20260917T060004Z.md
  prd: docs/plans/ETF-signal-MVP-plan-v2.2.md
  runtime_copy: .omx/plans/prd-etf-signal-mvp-v2.2.md
ralplan_architect_review:
  verdict: APPROVE
  completed: true
ralplan_critic_review:
  verdict: APPROVE
  completed_after_architect: true
ralplan_consensus_gate:
  complete: true
execution_started: false
```
