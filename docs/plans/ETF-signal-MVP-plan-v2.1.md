# ETF 일일 신호 시스템 — MVP 계획서 v2.1

> 작성일: 2026-09-17
> 기준: v2(2026-09-17) + v3 리뷰 검토 결과 반영
> 문서 성격: **구현 지시서**. v2는 승인 판단용이었고, v2.1은 실제로 무엇을 짤지 고정한다
> 원칙: 투자·시장 데이터 원천은 **KRX + 키움**으로 제한. 임계값은 전부 초기값(seed)이며 관측 20영업일 후 교체

---

## v2 → v2.1 변경 요약

| # | 항목 | v2 | v2.1 | 근거 |
|---|---|---|---|---|
| 1 | 액면분할 필터 | `좌수비 × NAV비`가 0.95~1.05면 **합산** | 순자산총액 연속성 기준으로 **분할일 격리** | v2 SQL이 v2 본문 L4의 판정 원리와 반대. 분할만 모으고 실제 설정을 버림 |
| 2 | `obs_days` | `count(*) over (partition by isu_cd)` | `order by bas_dd` + 누적 프레임 | 미래 정보 포함(look-ahead) |
| 3 | 결측 처리 | `lag()`가 거래일 간격을 무시 | `session_calendar`의 `seq` 연속성 강제 | 여러 거래일 변화를 하루 변화로 계산 |
| 4 | 휴장일 판정 | 빈 배열 → `holiday` | 5상태 분류(`TRADING`/`NON_TRADING`/`PUBLISH_PENDING`/`PARTIAL`/`FETCH_FAIL`) | 행은 900개인데 값이 전부 `"-"`인 응답이 실재 |
| 5 | 유입/유출 | `abs(flow_5d)` 단일 목록 | 유입·유출 분리, 연속 유입일수 별도 계산 | 5일 롤링 합계는 단일 스파이크로 "3일 연속"을 자동 생성 |
| 6 | 신규 상장 | `first_seen` 최초 등장 | `first_seen`(최초 관측)과 `reg_day`(키움 상장일) 분리 | 백필 1일차에 900종 전체가 신규로 오탐 |
| 7 | 단위 검증 | Phase 0 육안 확인 | 항등식 자동 검산 2종 | 추가 호출 0회로 확정 가능 |
| 8 | 기초지수 필드 | 저장만 | 초과수익·분배락 의심 플래그 계산 | `FLUC_RT_IDX` 추가 호출 0회 |
| 9 | 성공 판정 | "3일 연속 등장 월 3건" | "5일 중 양수 유입 3일 이상" | #5의 결과, 기존 기준은 산술적 부산물 |
| 10 | 무료 티어 용량 검증 | 대응 항목 | **삭제** | raw gzip 연 7.5MB, 1GB의 0.8% |

**v3 리뷰에서 반영하지 않은 것:** 가상 포트폴리오 엔진, 3전략 비교 실험, train/test 분리, 데이터 계약 문서 선행 작성. 모두 Phase 5 이후로 이연한다. 근거는 §5.3.

---

# PART 1. 목적과 경계

## 1.1 만드는 것

국내 상장 ETF 전체를 매일 1회 스캔해 **후보 목록**을 텔레그램으로 보내는 파이프라인.
매수 신호가 아니라 "오늘 사람이 들여다볼 가치가 있는 종목 목록"이다.

```
Scanner (자동화 대상) → Emerging Radar (수동) → Deep Research (수동)
```

Deep Research를 통과하기 전에는 어떤 신호도 투자 확신으로 다루지 않는다.

## 1.2 신호 3종

| 신호 | 사용 필드 | 추가 호출 | MVP 등급 |
|---|---|---|---|
| ① 순설정 추정 (자금 유입/유출) | `LIST_SHRS`, `NAV`, `INVSTASST_NETASST_TOTAMT` | 0 | **P1 실험** |
| ② 거래대금 급증 | `ACC_TRDVAL`, `FLUC_RT`, `FLUC_RT_IDX` | 0 | **P0 핵심** |
| ③ 신규 상장 | `ISU_CD`, `ISU_NM` + 키움 `regDay` | 키움 1회/일 | **P0 핵심** |

### 신호 ①을 P1로 내리는 이유

계산 정확도 문제가 아니다. **상장좌수 증감에는 실제 투자자 유입과 LP(유동성공급자)의 호가 공급용 재고 조정이 섞이고, KRX·키움 범위 안에서 이를 분리할 방법이 없다.** 5일 누적으로 완화되지만 분리되지는 않는다.

따라서 ①은 다음 조건에서만 유지한다.
- 계산 결과를 "자금유입"이 아니라 **`순설정 추정(net creation estimate)`**으로 명명한다
- 메시지에서 ②③과 시각적으로 분리하고 `실험` 태그를 단다
- Phase 5에서 기준 전략 대비 추가 가치가 없으면 폐기한다

## 1.3 하지 말아야 할 것

| 금지 | 이유 |
|---|---|
| 신호를 보고 당일 매수 | 임계값 미검증. 관측 20일 전 통계적 근거 0 |
| 순설정 추정 1위를 "가장 좋은 종목"으로 해석 | 절대액 1위는 대형 ETF. LP 재고 조정 가능성 상시 존재 |
| 급증 상위를 모멘텀으로 해석 | 급증의 절반 이상이 악재일 수 있다. `FLUC_RT`와 같이 본다 |
| 신호 0건인 날을 "일이 없는 날"로 해석 | 임계값 미달일 뿐이다 |
| `PARTIAL`/`PUBLISH_PENDING` 경고를 무시하고 사용 | 20일 평균이 오염된 상태 |

---

# PART 2. 데이터

## 2.1 원천과 검증 상태

| 원천 | 상태 | 역할 |
|---|---|---|
| KRX `etf_bydd_trd` | **실측 검증** (2026-09-04, 09-08 snapshot) | 주 수집원. 일 1회 호출 |
| 키움 `ka40004` (ETF전체시세요청) | **실측 검증** (2026-08-03 bulk) | 현재 ETF 목록. 코드 대조 |
| 키움 `ka10099` (`mrkt_tp=8`) | **명세만 확인, 실측 미검증** | `regDay`(상장일), `listCount`(상장좌수), `state` 확보용 후보 |
| 키움 `ka40003` (ETF일별추이) | **실측 검증** | 표본 대조용. 연속조회 필요 |

> `ka10099`의 `mrkt_tp`에 `8 : ETF`가 존재하는 것은 로컬 명세(`kiwoom-rest-api-spec.json`)에서 확인했다. 다만 실제 응답은 미검증이므로 Phase 0에서 1회 호출해 확인하기 전까지 확보된 것으로 간주하지 않는다. 실패하면 `ka40004`만으로 진행하고 `reg_day`는 null로 남긴다.

**금지:** KRX 영숫자 `ISU_CD`를 키움 숫자 ticker로 추정 변환. 매핑이 안 되는 항목은 `unsupported_identifier`로 보존하고 신호 계산에서 제외한다.

## 2.2 KRX 응답 필드 전량

| 필드 | 의미 | v2.1 사용처 |
|---|---|---|
| `BAS_DD` | 기준일자 | 요청일과 일치 검증 |
| `ISU_CD` / `ISU_NM` | 종목코드/명 | PK. 정규식 `^[0-9A-Z]{6}$` |
| `TDD_OPNPRC` / `TDD_HGPRC` / `TDD_LWPRC` / `TDD_CLSPRC` | 시/고/저/종가 | **신규 저장**. 단위 검산과 향후 체결 규칙 |
| `FLUC_RT` | 등락률 | 급증 방향 판정 |
| `NAV` | 순자산가치 | 순설정 추정, 항등식 검산 |
| `ACC_TRDVOL` / `ACC_TRDVAL` | 거래량/거래대금 | 급증 신호, 단위 검산 |
| `MKTCAP` | 시가총액 | **신규 저장**. 항등식 2 |
| `INVSTASST_NETASST_TOTAMT` | 순자산총액 | **분할 판정의 핵심**. 항등식 1 |
| `LIST_SHRS` | 상장좌수 | 순설정 추정 |
| `IDX_IND_NM` | 기초지수명 | **신규 저장**. 중복 노출 그룹핑(P1) |
| `OBJ_STKPRC_IDX` / `CMPPREVDD_IDX` / `FLUC_RT_IDX` | 기초지수 종가/대비/등락률 | **신규 저장**. 초과수익, 분배락 의심 플래그 |

값 없음은 `"-"`로 온다. `0`으로 치환 금지. `null` 반환 후 해당 행을 그날 계산에서 제외한다.

## 2.3 항등식 검산 — 단위 문제를 추가 호출 0회로 해결

```
항등식 1:  LIST_SHRS × NAV        ≈ INVSTASST_NETASST_TOTAMT
항등식 2:  LIST_SHRS × TDD_CLSPRC ≈ MKTCAP
검산 3:    ACC_TRDVAL / ACC_TRDVOL 이 TDD_LWPRC ~ TDD_HGPRC 범위에 들어오면 거래대금 단위 = 원
           1/1,000,000 수준이면 백만 원 단위
```

키움 `ka40003`의 `acc_trde_prica`는 명세에 단위가 `1주`로 적혀 있다(오기로 추정). 동일하게 `acc_trde_prica / trde_qty`를 `cur_prc`와 비교해 확정한다.

항등식 1·2는 매일 실행하는 **상시 무결성 검사**로 둔다. 전 종목의 95% 이상에서 오차 1% 이내면 `ok`, 아니면 파싱 또는 단위 변경을 의심하고 알림을 보낸다.

## 2.4 일자 상태 5분류

| 상태 | 조건 | 동작 |
|---|---|---|
| `TRADING` | 행 존재 + 숫자 필드가 채워진 행이 전체의 50% 초과 | 정상 저장, `seq` 부여 |
| `NON_TRADING` | 행 존재하나 숫자 필드가 전부 `"-"` / 또는 `OutBlock_1` 부재 | 저장하되 `seq` 미부여. 재시도 금지 |
| `PUBLISH_PENDING` | 당일 호출인데 `NON_TRADING` 패턴 | 익일 1회 재조회 후 재판정 |
| `PARTIAL` | 채워진 행이 50% 이하 | 저장하되 신호 계산 보류 + 알림 |
| `FETCH_FAIL` | HTTP 비정상 또는 `BAS_DD` 불일치 | 재시도 3회(60초) 후 알림. 데이터 사용 금지 |

**`seq`가 부여된 날만 거래일이다.** 모든 window 계산은 `bas_dd`가 아니라 `seq` 연속성으로 판정한다.

---

# PART 3. 구현

## 3.1 아키텍처

```
GitHub Actions  (평일 19:00 KST = 10:00 UTC)
  └─ scripts/ingest.ts
       ① KRX etf_bydd_trd 1회 호출 (재시도 3회 × 60초)
       ② 일자 상태 5분류 → 행 검증 → 항등식 검산      ← L1 L2 L3 L12
       ③ 키움 ka40004(+ka10099) 1회 호출, 마스터 갱신   ← L13
       ④ Supabase upsert (PK 멱등)                     ← L8
       ⑤ Storage에 raw.json.gz 보관                    ← L10
       ⑥ SQL view 조회 → 신호 3종                      ← L4~L7
       ⑦ signal_daily 저장 + 텔레그램 발송             ← L9 L11

Supabase        Postgres(집계) + Storage(원본 보존)
Next.js/Vercel  읽기 전용 조회 화면 (Phase 4 1주차)
```

**검증 순서가 중요하다: 구조 검사 → 일자 상태 → 행 검증.** 역순으로 하면 휴장일 응답이 900건의 파싱 오류로 잡힌다.

Vercel Cron을 수집에 쓰지 않는 이유는 v2와 동일하다. Hobby 플랜은 하루 1회 상한, 실행 시각이 시(hour) 단위로만 보장, **실패 재시도·실패 알림 없음**. 수집이 죽어도 아무도 모른다. Actions 사용량은 월 약 22분(1분/일)으로 무료 한도(private 2,000분) 안이다.

알려진 함정 2개 — 60일 무커밋 시 스케줄 자동 비활성화, 부하에 따른 5~15분 지연. 둘 다 텔레그램 미수신으로 드러난다. **매일 메시지가 오는 것 자체를 heartbeat로 정의**하고 2일 연속 미수신 시 수동 점검한다.

## 3.2 스키마

```sql
-- 거래일 시퀀스. 모든 window 계산의 기준
create table session_calendar (
  bas_dd date primary key,
  seq    int  not null unique          -- TRADING 일자에만 부여, 1부터 증가
);

create table etf_daily (
  bas_dd      date   not null,
  isu_cd      text   not null,
  isu_nm      text   not null,
  open_prc    numeric,                 -- TDD_OPNPRC   (v2.1 신규)
  high_prc    numeric,                 -- TDD_HGPRC    (v2.1 신규)
  low_prc     numeric,                 -- TDD_LWPRC    (v2.1 신규)
  close_prc   numeric,
  fluc_rt     numeric,
  nav         numeric,
  acc_trdvol  bigint,
  acc_trdval  bigint,
  mktcap      numeric,                 -- MKTCAP       (v2.1 신규)
  net_asset   numeric,                 -- INVSTASST_NETASST_TOTAMT
  list_shrs   bigint,
  idx_nm      text,
  idx_close   numeric,
  idx_fluc_rt numeric,
  quality     text not null default 'ok'
              check (quality in ('ok','null_field','identity_mismatch')),
  src         text not null default 'krx',
  fetched_at  timestamptz not null default now(),
  primary key (bas_dd, isu_cd)
);
create index etf_daily_cd_dd on etf_daily (isu_cd, bas_dd desc);

create table collection_ledger (
  bas_dd     date primary key,
  status     text not null check (status in
             ('TRADING','NON_TRADING','PUBLISH_PENDING','PARTIAL','FETCH_FAIL')),
  rows       int,
  rows_valid int,                      -- 숫자 필드가 채워진 행 수
  identity_ok_rate numeric,            -- 항등식 1 통과 비율
  sha256     text,
  fetched_at timestamptz not null default now(),
  error      text
);

-- 키움 기준 마스터. first_seen과 reg_day를 분리한다
create table etf_master (
  isu_cd       text primary key,       -- KRX 코드
  kiwoom_cd    text,                   -- 매핑 실패 시 null. 추정 변환 금지
  isu_nm       text not null,
  first_seen   date not null,          -- 우리 DB 최초 관측일
  last_seen    date not null,
  reg_day      date,                   -- 키움 regDay. 실제 상장일
  list_count   bigint,                 -- 키움 listCount. LIST_SHRS 교차검증용
  state        text,                   -- 키움 state (거래정지 등)
  synced_at    timestamptz
);

create table signal_daily (
  bas_dd      date not null,
  signal_type text not null,           -- inflow / outflow / surge / new_listing
  isu_cd      text not null,
  rank        int,
  value       numeric,
  meta        jsonb,                   -- 임계값 버전, 제외 사유, 부가 지표
  strategy_ver text not null,          -- 임계값 변경 시 증가. 튜닝 전후 비교용
  primary key (bas_dd, signal_type, isu_cd)
);
```

원본 응답은 Supabase Storage에 `raw/YYYYMMDD_krx.json.gz`로 보관하고 덮어쓰지 않는다. 용량은 gzip 기준 일 약 30KB, **연 7.5MB**로 무료 1GB의 0.8%다. 정규화 행은 연 약 40MB로 무료 DB 500MB 안이다. 별도 용량 검증 과제를 두지 않는다.

## 3.3 신호 SQL

### 공통 — 거래일 연속성이 보장된 기준 CTE

```sql
create or replace view v_base as
with d as (
  select e.bas_dd, c.seq, e.isu_cd, e.isu_nm,
         e.nav, e.list_shrs, e.net_asset, e.acc_trdval,
         e.fluc_rt, e.idx_fluc_rt,
         lag(c.seq)        over w as prev_seq,
         lag(e.list_shrs)  over w as prev_shrs,
         lag(e.nav)        over w as prev_nav,
         lag(e.net_asset)  over w as prev_net,
         count(*) over (partition by e.isu_cd order by c.seq
                        rows between unbounded preceding and current row) as obs_days
  from etf_daily e
  join session_calendar c using (bas_dd)
  where e.quality = 'ok'
  window w as (partition by e.isu_cd order by c.seq)
)
select *,
  (seq - prev_seq) = 1                                as seq_ok,
  list_shrs::numeric / nullif(prev_shrs, 0)           as shr_ratio,
  net_asset          / nullif(prev_net, 0)            as net_ratio,
  fluc_rt - idx_fluc_rt                               as idx_gap
from d;
```

- `obs_days`에 `order by seq`와 누적 프레임을 명시해 **미래 행이 절대 들어가지 않는다.**
- `join session_calendar`로 `NON_TRADING`/`PARTIAL` 일자가 자동 제외된다.
- `seq_ok`가 false인 행은 이전 값과의 비교를 쓰지 않는다.

### 신호 ① 순설정 추정 (P1 실험)

```sql
create or replace view v_net_creation as
with c as (
  select *,
    case
      when not seq_ok or shr_ratio is null           then 'gap'
      -- 분할·병합: 좌수는 크게 변하는데 순자산총액은 연속
      when abs(shr_ratio - 1) >= 0.50
       and abs(net_ratio - 1) <= 0.10                then 'corp_action_suspect'
      -- 순자산 항등식 붕괴
      when abs(net_ratio - 1) >= 0.80                then 'anomaly'
      else 'ok'
    end as day_state,
    (list_shrs - prev_shrs) * nav as raw_flow
  from v_base
),
g as (
  select *, case when day_state = 'ok' then raw_flow end as flow_1d from c
)
select bas_dd, seq, isu_cd, isu_nm, net_asset, obs_days, day_state,
  sum(flow_1d)                                    over w5 as flow_5d,
  count(flow_1d)                                  over w5 as n5,
  sum(case when flow_1d > 0 then 1 else 0 end)    over w5 as pos_days,
  max(seq) over w5 - min(seq) over w5              as span5
from g
window w5 as (partition by isu_cd order by seq rows between 4 preceding and current row);
```

**분할 판정 원리 (v2에서 반전된 부분).**

| 사건 | 좌수비 | NAV비 | 순자산비 | v2.1 판정 |
|---|---|---|---|---|
| 10배 분할 | 10.0 | 0.10 | **1.00** | `corp_action_suspect` → 제외 |
| 실제 설정 +10% | 1.10 | 1.00 | **1.10** | `ok` → 합산 |
| 실제 설정 +60% | 1.60 | 1.00 | **1.60** | `ok` → 합산 |

v2는 `좌수비 × NAV비`가 1에 가까운 날을 합산했는데, 분할이 바로 그 조건을 만족한다. **분할만 모으고 실제 설정을 버리는 필터였다.** 순자산총액은 분할에서 보존되고 설정/환매에서만 움직이므로 판정 축을 순자산으로 옮긴다.

`corp_action_suspect`는 **확정이 아니라 격리**다. 해당 일자는 신호에서 빼고 `signal_daily.meta`에 기록만 한다. 키움·KRX에서 분할 이력을 확인할 수 없는 한 배수를 추정해 보정하지 않는다.

### 신호 ② 거래대금 급증 (P0)

```sql
create or replace view v_surge as
select bas_dd, seq, isu_cd, isu_nm, acc_trdval, fluc_rt, idx_fluc_rt,
       fluc_rt - idx_fluc_rt as excess_rt,
       avg(acc_trdval) over w20 as avg20,
       count(*)        over w20 as n20,
       max(seq) over w20 - min(seq) over w20 as span20
from v_base
window w20 as (partition by isu_cd order by seq rows between 20 preceding and 1 preceding);
```

- `1 preceding`으로 당일을 분모에서 제외
- `n20 = 20 and span20 = 19` 두 조건으로 "20개 행이 25일에 걸쳐 모이는" 경우를 차단
- `excess_rt`(기초지수 대비 초과수익)를 같이 내보낸다. 거래대금이 터졌는데 초과수익이 0에 가까우면 시장 전체 이벤트일 가능성이 높다

### 신호 ③ 신규 상장 (P0)

```sql
-- 마스터 갱신
insert into etf_master (isu_cd, isu_nm, first_seen, last_seen)
select isu_cd, isu_nm, bas_dd, bas_dd from etf_daily where bas_dd = $1
on conflict (isu_cd) do update
  set last_seen = excluded.last_seen, isu_nm = excluded.isu_nm;

-- 알림 대상: 키움 상장일 기준 30일 이내인 것만
select m.isu_cd, m.isu_nm, m.reg_day, m.first_seen
from etf_master m
where m.reg_day is not null
  and m.reg_day > $1::date - interval '30 days'
  and m.first_seen = $1;
```

`reg_day`가 null인 종목(키움 매핑 실패)은 **신규 알림에서 제외하고 `unmapped` 목록에 별도 표기**한다. `first_seen`만으로 신규를 판정하면 백필 1일차에 900종 전체가 신규가 된다.

### 임계값 필터 (애플리케이션 레이어, `strategy_ver = 1`)

```
[P0] 급증:
    n20 = 20  AND  span20 = 19
    AND avg20 >= 10억 원
    AND acc_trdval / avg20 >= 3.0
    AND reg_day <= 기준일 - 30일          (상장 직후 제외)

[P0] 신규 상장:
    reg_day >= 기준일 - 30일  AND  first_seen = 기준일

[P1] 순설정 추정 — 유입:
    n5 = 5  AND  span5 = 4  AND  obs_days >= 6  AND  day_state = 'ok'
    AND flow_5d >= 10억 원
    AND flow_5d / net_asset >= 1.0%
    AND pos_days >= 3                     (5일 중 일별 순유입 양수가 3일 이상)

[P1] 순설정 추정 — 유출:
    위와 동일, 부호만 반대. 유입 목록과 섞지 않는다
```

절대액 하한만 두면 대형 ETF가 상위를 독점하고, 비율 하한만 두면 초소형 ETF가 노이즈로 튄다. AND로 건다.

`pos_days >= 3`이 v2의 "3일 연속 등장" 규칙을 대체한다. **`flow_5d`는 5일 롤링 합계이므로 단일 스파이크 1건이 자동으로 5일간 상위를 유지한다.** v2의 성공 판정 기준("3일 연속 종목이 월 3건")은 측정 대상이 아니라 롤링 윈도의 산술적 부산물이었다.

## 3.4 필수 구현 로직

틀리면 신호가 통째로 무효가 되는 순서로 나열한다.

**L1. 일자 상태 분류** — §2.4의 5상태. 구조 검사 → 일자 상태 → 행 검증 순서를 지킨다. `NON_TRADING`에는 `seq`를 부여하지 않는다.

**L2. 숫자 파싱** — KRX는 값 없음을 `"-"`로 반환한다. `0` 치환 시 좌수 변화가 -100%로 계산돼 순설정 1위로 올라온다. `null` 반환 + `quality = 'null_field'`.

**L3. 종목 식별자** — `ISU_CD`는 숫자 6자리가 아니다. `0184E0` 같은 영숫자 코드가 실재한다. 정규식 `^[0-9A-Z]{6}$`.

**L4. 기업행동 격리** — 순자산총액 연속성 기준(§3.3). 확정하지 않고 격리한다.

**L5~L7** — SQL view가 담당.

**L8. 멱등성** — `etf_daily` PK `(bas_dd, isu_cd)`. 집계는 매번 전량 재계산한다. ETF 1,000종 × 25일 = 25,000행으로 1초 안에 끝나며, **증분 계산은 결손 하루를 영구 오염으로 만든다.**

**L9. 실패 노출** — 조용한 실패가 최악이다.
```
PARTIAL:  "⚠️ 0916 부분 수집 (유효 412/912행) — 20일 평균 신뢰도 저하"
결손:     "⚠️ 최근 25거래일 중 2일 결손 (0916, 0911)"
항등식:   "⚠️ 순자산 항등식 통과율 61% — 파싱 또는 단위 변경 의심"
장애:     "❌ 수집 실패: <사유>" 만이라도 발송
```

**L10. 시크릿** — GitHub Secrets / Vercel 환경변수에만. `.env.local`은 gitignore. 원본 응답과 키는 커밋 금지.

**L11. 메시지 길이** — 텔레그램 `sendMessage` 상한 4,096자. 생성 후 검사 → 초과 시 섹션당 5개로 축소.

**L12. 항등식 검산** — §2.3. 매일 실행, 통과율을 `collection_ledger.identity_ok_rate`에 기록. 95% 미만이면 알림.

**L13. 키움 마스터 동기화** — 일 1회. 실패해도 KRX 수집은 계속한다. `reg_day` 미확보 시 신규 상장 신호만 보류하고 급증 신호는 정상 발송.

## 3.5 보안

```
클라이언트 번들 진입 금지:
  SUPABASE_SERVICE_ROLE_KEY   ← NEXT_PUBLIC_ 접두사 실수가 1순위 사고
  KRX_AUTH_KEY, KIWOOM_APP_KEY, KIWOOM_SECRET_KEY
```

- 모든 테이블 RLS 활성화 후 **anon 정책을 만들지 않는다.** 정책이 없으면 anon은 아무것도 읽지 못한다
- 대시보드는 Server Component에서 service role key로 조회
- Vercel Password Protection은 Pro 전용이므로 middleware Basic Auth 환경변수 1개로 대체

## 3.6 저장소 구조

```
/
├── .github/workflows/ingest.yml
├── scripts/
│   ├── probe.ts          # Phase 0 검증 (3회 호출)
│   ├── ingest.ts         # 일일 수집
│   └── backfill.ts       # 25영업일, 로컬 1회
├── lib/
│   ├── krx.ts            # 호출 + L1 L2 L3 L12
│   ├── kiwoom.ts         # ka40004 / ka10099 + L13
│   ├── signals.ts        # view 조회 + 임계값 필터
│   └── telegram.ts
├── supabase/migrations/
├── app/                  # Next.js — Phase 4 1주차
└── .env.local            # gitignore
```

```yaml
# .github/workflows/ingest.yml
name: ETF daily ingest
on:
  schedule:
    - cron: "0 10 * * 1-5"    # 19:00 KST
  workflow_dispatch:           # 수동 재실행 — 필수
jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: npm ci
      - run: npx tsx scripts/ingest.ts
        env:
          KRX_AUTH_KEY:              ${{ secrets.KRX_AUTH_KEY }}
          KIWOOM_APP_KEY:            ${{ secrets.KIWOOM_APP_KEY }}
          KIWOOM_SECRET_KEY:         ${{ secrets.KIWOOM_SECRET_KEY }}
          SUPABASE_URL:              ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          TG_TOKEN:                  ${{ secrets.TG_TOKEN }}
          TG_CHAT_ID:                ${{ secrets.TG_CHAT_ID }}
```

## 3.7 일일 메시지 형식

```
📊 ETF 일일 리포트 2026-09-17 (목)  [strategy_ver 1]

🔥 거래대금 급증 (직전 20거래일 평균 대비)
1. TIGER OOOOOO   4.2배  등락 +3.1%  (지수 대비 +2.8%p)  거래대금 320억
2. KODEX OOOOOO   3.6배  등락 -1.2%  (지수 대비 -1.4%p)  거래대금 180억

🆕 신규 상장 2종  (키움 상장일 기준 30일 이내)
- KODEX OOOOOO   상장 2026-09-15
- TIGER OOOOOO   상장 2026-09-11

🧪 순설정 추정 — 실험 지표, 매수 근거로 사용 금지
   유입  1. TIGER OOOOOO  +142억  (순자산 대비 2.4%, 5일 중 양수 4일)
   유출  1. KODEX OOOOOO   -88억  (순자산 대비 1.1%, 5일 중 음수 3일)
   ※ 기업행동 의심 격리 1건, 상장좌수 변동에는 LP 재고 조정이 포함됨

⚠️ 0916 부분 수집 (유효 412/912행)
```

순설정 섹션은 실험 태그를 달고 맨 아래에 둔다. 이 배치 자체가 §1.3의 오용 방지 장치다.

---

# PART 4. 일정

## Phase 0 — 검증 (반나절) · **Go/No-Go 게이트**

`scripts/probe.ts` 하나로 총 **KRX 3회 + 키움 2회** 호출한다.

| # | 확인 항목 | 방법 | 판정 |
|---|---|---|---|
| A | 좌수 변동 종목 수 | 연속 2영업일 `LIST_SHRS` 비교 | 30종 이상 Go / 10~29 조건부(임계값 5억) / 10 미만 **신호 ① 폐기** |
| B | Actions에서 KRX 호출 | `workflow_dispatch` 1회 | 실패 시 국내 리전 VM 또는 집 서버로 **실행 위치만** 교체. 저장소·조회 화면은 재설계하지 않는다 |
| C | 거래대금 단위 | `ACC_TRDVAL / ACC_TRDVOL` vs 고가·저가 | 원 / 백만 원 확정 |
| D | 순자산 항등식 | `LIST_SHRS × NAV` vs `INVSTASST_NETASST_TOTAMT` | 95% 이상 오차 1% 이내면 통과 |
| E | 휴장일 응답 형태 | 확인된 휴장일 1일 호출 | "행 존재 + 값 전부 `-`" 재현 확인 |
| F | 키움 `ka10099(mrkt_tp=8)` | 1회 호출 | `regDay`·`listCount`·`state` 수신 확인. 실패 시 `ka40004`만 사용 |

**B가 실패해도 계획은 유지한다.** v2는 "아키텍처 통째 재설계"라 썼으나, 바뀌는 것은 실행 위치 1곳이다.

## Phase 1 — 수집기 + 백필 (1.5일)

Supabase 프로젝트 생성, 마이그레이션 적용, `ingest`/`backfill` 구현(L1 L2 L3 L8 L10 L12 L13), **25영업일 백필**.

25일인 이유: 최장 요구가 급증 신호의 21일이므로 여유 4일로 휴장일 오판·결손·재시도 실패를 흡수한다. KRX는 2010-01-04 데이터부터 `basDd`로 직접 조회 가능하므로 25회 호출로 끝난다. **백필은 로컬 1회 실행**한다 — 서버리스 함수에서 25회 순차 호출은 타임아웃 위험이 있고 MVP에서 함수로 만들 이유가 없다.

검증: `collection_ledger`의 `TRADING` 건수 25 ± 결손, `identity_ok_rate` 평균 95% 이상.

## Phase 2 — 신호 계산 (0.5일)

view 3개 + 임계값 필터. 검증 기준:

| 신호 | 기대 범위 | 벗어나면 |
|---|---|---|
| 급증 | 일 0~15건 | 50건 이상 → 배수 3.0 상향 / 매일 0건 → 하한 10억 하향 |
| 신규 상장 | 주 0~3건 | — |
| 순설정 유입 | 일 0~10건 | — |

**데이터 부족 시 절대 금지:** 20일 평균 자리에 8일 평균 대체 투입. 배수가 부풀려져 오탐이 폭증한다. 계산을 건너뛰고 "준비중 (n/20일)"로 출력하는 게 항상 낫다.

## Phase 3 — 발송 + 스케줄 (1일)

텔레그램 발송(L9 L11), Actions 등록, secrets 설정. 검증: 수동 1회 + 자동 1회 수신.

## Phase 4 — 관측 (20영업일) · **매매 사용 금지**

목적은 수익이 아니라 **신호가 나오는가**의 측정이다.

1. 신호별 일일 건수 분포
2. `corp_action_suspect` 발생 건수와 실제 분할 여부 사후 대조
3. 항등식 통과율 추이
4. `PARTIAL`/`FETCH_FAIL` 발생 빈도
5. 급증 상위 종목의 이후 5일 가격수익률 (**분배금 미조정 가격수익률임을 필드명에 명시**)

관측 1주차에 Next.js 조회 화면 1페이지를 추가한다.

## Phase 5 — 판정 및 튜닝 (Day 21+)

임계값을 실측치로 교체하고 `strategy_ver`를 2로 올린다. 여기서부터 v3 리뷰의 §6(수익성 검증 설계)을 착수 대상으로 검토한다.

---

# PART 5. 판정 기준과 미확인 사항

## 5.1 성공/실패 판정

| 시점 | 성공 | 실패 → 조치 |
|---|---|---|
| Phase 0 | 좌수 변동 30종 이상 + 항등식 95% + Actions 호출 성공 | 좌수 변동 10종 미만 → **신호 ① 폐기, ②③ 2개로 재정의** |
| Phase 2 | 급증 신호 일 0~15건 | 매일 50건 이상 또는 매일 0건 → 임계값 1회 조정 후 재측정 |
| Phase 3 | 자동 실행으로 텔레그램 수신 | — |
| Phase 4 | `TRADING` 무결손 18일 이상 + 급증 신호 일평균 3~15건 | 결손 5일 이상 → 수집 안정화 우선, 신호 개발 중단 |
| Phase 5 | 급증 신호가 월 15건 이상 발생하고, 그중 사람이 Deep Research를 연 건이 월 3건 이상 | 월 0~1건 → **Scanner 자동화의 실효성 없음, 프로젝트 종료** |
| Phase 5 | 순설정 유입 조건(`pos_days>=3`) 충족 종목 월 3건 이상 | 월 0~1건 → **신호 ① 폐기** |

**마지막 두 줄이 진짜 판정 기준이다.** 신호가 기술적으로 동작해도 후보가 안 나오면 쓸모가 없고, 후보가 나와도 사람이 안 열면 자동화할 이유가 없다.

## 5.2 미확인 사항

| 항목 | 틀렸을 때 깨지는 범위 | 확인 시점 |
|---|---|---|
| `LIST_SHRS`가 유의미하게 변동하는지 | 신호 ① 전체 | Phase 0-A |
| Actions IP에서 KRX 호출 가능 여부 | 실행 위치 1곳 | Phase 0-B |
| `ACC_TRDVAL` 단위 | 신호 ② 임계값 | Phase 0-C |
| 키움 `ka10099(mrkt_tp=8)` 실제 응답 | 신호 ③ (급증은 무관) | Phase 0-F |
| KRX 당일 데이터 반영·안정화 시각 | 스케줄 시각 | Phase 4 (2주 관측) |
| KRX API 일일 호출 한도 | 백필 전략 | Phase 1 |
| 실제 분할 발생 시 NAV·좌수 동시 반영 여부 | L4 정확도 | Phase 4 (발생 시) |
| LP 재고 조정 비중 | 신호 ① 해석 | **확인 불가** — 키움·KRX 범위 밖 |

마지막 줄이 신호 ①을 P1로 내린 이유다. 계산을 고쳐도 해석 문제는 남는다.

## 5.3 v3 리뷰에서 이연한 항목과 근거

| v3 제안 | 판정 | 근거 |
|---|---|---|
| 가상 포트폴리오 엔진 (진입·청산·현금·중복 진입·비용 가정) | Phase 5 이후 | Scanner가 후보를 내는지도 모르는 상태에서 체결 엔진을 먼저 만든다 |
| 3전략 비교 실험 (기준/핵심/실험) + train/test 분리 | Phase 5 이후 | 20영업일 × 일 5건 = 100건이나 동일 종목·테마 반복을 걷어내면 독립 표본은 수십 건. 승률 55%와 50%를 구분하려면 표준오차가 5%p대라 **측정 장비를 만들어도 눈금이 안 보인다** |
| 데이터 계약 문서 + 실패 테스트 패키지 선행 작성 | 축소 반영 | Phase 0의 6개 검산으로 대체. 검증되지 않은 가정 위에 계약 문서를 먼저 쓰지 않는다 |
| `signal_run` 별도 테이블, `decision_log` | 축소 반영 | `signal_daily.strategy_ver` + `meta` jsonb로 대체 |
| raw를 수집시각별 버전 보존 | 미반영 | 일 1회 호출이므로 `raw/YYYYMMDD_krx.json.gz` 1개로 충분 |
| 무료 티어 실제 용량 측정 | 기각 | raw gzip 연 7.5MB, 정규화 행 연 40MB. 실제 위험은 Supabase 7일 무활동 정지와 Actions 60일 비활성화이며 둘 다 대응 완료 |
| 분배금 포함 총수익률 미산출 | 반영 + 보강 | 금액은 확보 불가하나 `gap = FLUC_RT − FLUC_RT_IDX` (θ = -0.30%)로 **분배락 의심일 격리**는 가능. Phase 4에서 플래그만 기록 |

## 5.4 제외 기능과 복귀 조건

| 기능 | 제외 사유 | 복귀 조건 |
|---|---|---|
| 외국인·기관 순매수 | ETF 기관 순매수에는 LP 헤지가 섞여 신호 ①과 같은 사건을 두 번 셀 수 있다(추정) | Phase 4 데이터로 좌수 증감과의 상관계수 계산. 0.5 이하면 추가, 0.8 이상이면 영구 폐기 |
| 기초지수 기준 중복 노출 제거 | `trace_idex_cd` 직접 사용은 look-ahead를 만든다 | `FLUC_RT_IDX` 20일 시계열 해시 방식으로 Day 25 이후 구현. 저장은 Phase 1부터 |
| 테마·업종 회전맵 | 상대강도는 60영업일 이상 있어야 의미가 생긴다 | Phase 1부터 저장만 병행, Day 60에 로직 구현 |
| 구성종목 검증 | 유일하게 수동 등록이 필요 | 2주 무결손 운영 후 ETF 3개로 축소 시작 |
| 펀더멘털 Trigger (실적·수출·수주) | 원천이 키움·KRX 밖 | MVP 복귀 없음. 별도 프로젝트 |
| 자동 주문 | — | 복귀 없음 |
| 카카오톡 전달 | refresh token 2개월마다 수동 재인증, 잊으면 조용히 멈춘다 | 복귀 없음 |

---

# 다음 행동 하나

**`scripts/probe.ts`를 작성해 Phase 0의 A~F 6개 항목을 한 번에 실행한다.** KRX 3회(연속 2영업일 + 확인된 휴장일 1일), 키움 2회(`ka40004`, `ka10099`)로 끝난다. 반나절.

이 6개 숫자가 나오기 전에는 Supabase 스키마도 Next.js도 만들지 않는다. 특히 A(좌수 변동 종목 수)가 10 미만이면 이 문서의 신호 ① 관련 분량 절반이 그 자리에서 삭제된다.
