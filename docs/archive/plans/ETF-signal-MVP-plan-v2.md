# ETF 일일 신호 시스템 — MVP 계획서 v2

> 작성일: 2026-09-17
> 버전: v2 (v1 대비 스택 확정 — Next.js / Supabase / Vercel / GitHub Actions)
> 문서 성격: **리뷰어 판단용**. 구현 지시서가 아니라 "이 계획을 승인할 것인가"를 판단하기 위한 자료
> 전제: 본문의 모든 임계값은 **초기값(seed)**이며 관측 20영업일 후 실측치로 교체한다

---

## 리뷰어를 위한 30초 요약

| 항목 | 내용 |
|---|---|
| 무엇을 만드나 | 국내 상장 ETF 전체를 매일 스캔해 **후보 3종 신호**를 텔레그램으로 보내는 파이프라인 |
| 무엇이 아닌가 | 매매 신호 시스템이 아니다. 자동매매는 물론 매수 추천도 하지 않는다 |
| 데이터 소스 | KRX `etf_bydd_trd` **단일 소스, 1일 1회 호출** |
| 신호 | ① 자금유입(설정/환매 추정) ② 거래대금 급증 ③ 신규 상장 |
| 스택 | GitHub Actions(수집) + Supabase(저장·집계) + Next.js/Vercel(조회) |
| 비용 | **월 0원** (전부 무료 티어 범위) |
| 구현 기간 | 4영업일 + 관측 20영업일 |
| 중단 조건 | Phase 0 검증 실패 시 신호 ①을 폐기하고 계획 재작성 |

**리뷰어가 판단해야 할 핵심 질문 3개는 §13에 정리했다.**

---

# PART 1. 목적과 활용법

## 1.1 해결하려는 문제

국내 상장 ETF는 900종을 넘는다. 개인이 매일 전체를 훑는 것은 불가능하고, 증권사 HTS의 기본 정렬(등락률·거래량)은 **이미 오른 것**만 보여준다. 가격이 움직인 뒤에 발견하는 구조다.

이 시스템은 **가격에 아직 반영되지 않았을 가능성이 있는 변화**를 매일 자동으로 걸러낸다. 구체적으로 세 가지다.

**① 자금유입 — 돈이 실제로 들어왔는가**
ETF의 거래대금은 2차 시장에서 A가 B에게 판 금액이다. 새 돈이 들어온 게 아니다. 반면 상장좌수(`LIST_SHRS`)가 늘었다는 것은 운용사가 **신규로 설정(creation)**했다는 뜻이고, 이건 외부 자금이 실제로 유입됐다는 직접 증거다. 가격이 아직 안 움직였는데 좌수가 늘고 있다면 미반영 수급이다.

**② 거래대금 급증 — 관심이 몰리기 시작했는가**
20일 평균 대비 3배 이상의 거래대금은 무언가 일어났다는 신호다. 원인은 모른다. 원인을 찾는 것은 사람의 일이고, 시스템은 "어디를 볼지"만 알려준다.

**③ 신규 상장 — 새 테마가 등장했는가**
운용사는 시장 수요가 있다고 판단할 때 상품을 낸다. 신규 ETF의 등장 자체가 산업 트렌드의 지표이며, 동시에 ②의 오탐 원인이라 반드시 같이 추적해야 한다.

## 1.2 왜 이 3개만인가

세 신호는 **같은 API 응답 1건에서 전부 파생된다.** 추가 호출이 0이므로 기능 3개가 아니라 집계 3개다.

| 신호 | 사용 필드 | 추가 호출 |
|---|---|---|
| 자금유입 | `LIST_SHRS`, `NAV`, `INVSTASST_NETASST_TOTAMT` | 0 |
| 거래대금 급증 | `ACC_TRDVAL`, `FLUC_RT` | 0 |
| 신규 상장 | `ISU_CD`, `ISU_NM` | 0 |

검토했으나 제외한 4개(외국인·기관 수급 / 테마·업종 회전맵 / 구성종목 검증 / 크로스에셋)는 각각 별도 API + 별도 시계열 축적 + 별도 실패 처리가 필요하다. 붙이면 완성 시점이 4일에서 4주로 밀린다. **제외 사유와 복귀 조건은 §12에 명시했다.**

## 1.3 이 시스템의 위치 — Scanner이지 판단기가 아니다

기존 리서치 원칙은 분석을 3단계로 나눈다.

```
Scanner (전체시장 탐지) → Emerging Radar (테마 발굴) → Deep Research (판단 검증)
```

**이 MVP는 첫 단계인 Scanner만 자동화한다.** Deep Research를 통과하기 전에는 어떤 신호도 투자 확신으로 다루지 않는다. 시스템이 출력하는 것은 "매수 대상"이 아니라 **"오늘 사람이 들여다볼 가치가 있는 종목 목록"**이다.

이 구분이 무너지면 시스템은 해롭다. 신호를 그대로 사기 시작하면, 검증되지 않은 임계값 3개(3.0배·10억 원·1.0%)에 돈을 거는 것과 같다.

## 1.4 활용법 — 매일 3분 루틴

**저녁 19시, 텔레그램 수신**

1. **신규 상장 섹션을 먼저 읽는다** (10초)
   새 ETF가 있으면 이름만 확인한다. 모르는 테마면 기록해 둔다. 여기서 매수 판단은 하지 않는다 — 상장 직후는 거래대금이 비정상이라 어떤 지표도 신뢰할 수 없다.

2. **자금유입 상위 10개를 본다** (1분)
   보는 것은 순위가 아니라 **연속성**이다. 어제도 상위에 있었는가? 3일 연속 들어온 종목이 1일짜리 스파이크보다 훨씬 중요하다. 연속 3일 이상 등장한 종목만 후보 목록에 넣는다.

3. **거래대금 급증과 교차 확인한다** (1분)
   **두 섹션에 동시에 등장한 종목이 가장 강한 후보다.** 자금유입만 있으면 조용한 매집일 수 있고, 거래대금만 있으면 단기 뉴스일 수 있다. 둘이 겹치면 "새 돈이 들어오면서 관심도 붙은" 상태다.

4. **후보가 나오면 그때 Deep Research를 연다** (별도 시간)
   여기서부터는 시스템 밖이다. 왜 자금이 들어왔는지, 기초지수가 무엇인지, 이미 가격에 반영됐는지, 같은 Thesis를 더 좋은 조건으로 구현할 대안이 있는지를 사람이 확인한다.

**주 1회 (금요일)**
- 이번 주 자금유입 상위에 3회 이상 등장한 종목을 목록화 → 다음 주 Deep Research 대상
- 결손 경고가 있었는지 확인

## 1.5 하지 말아야 할 것

| 금지 | 이유 |
|---|---|
| 신호를 보고 당일 매수 | 임계값이 검증되지 않았다. 관측 20일 전에는 통계적 근거가 0이다 |
| 자금유입 1위를 "가장 좋은 종목"으로 해석 | 절대 금액 1위는 대부분 대형 ETF다. 순위가 아니라 순자산 대비 비율과 연속성을 본다 |
| 거래대금 급증 상위를 모멘텀으로 해석 | 급증의 절반 이상은 악재일 수 있다. 등락률을 같이 봐야 방향을 안다 |
| 신호가 없는 날을 "시장에 일이 없는 날"로 해석 | 임계값을 못 넘었을 뿐이다. 필터를 통과 못 한 것과 사건이 없는 것은 다르다 |
| 결손 경고를 무시하고 사용 | 20일 평균이 오염된 상태다. 배수 자체가 의미를 잃는다 |

---

# PART 2. 구현 계획

## 2.1 아키텍처

```
GitHub Actions  (평일 19:00 KST = 10:00 UTC)
  └─ scripts/ingest.ts
       ① KRX API 1회 호출 (재시도 3회 × 60초)
       ② 파싱·검증                 ← L1, L2, L3
       ③ Supabase upsert           ← 멱등성은 PK가 담당
       ④ Storage에 raw.json.gz 보관
       ⑤ SQL view 조회 → 신호 3종  ← L4~L7
       ⑥ signal_daily 저장 + 텔레그램 발송  ← L9, L11

Supabase        Postgres(집계) + Storage(원본 보존)
Next.js/Vercel  읽기 전용 조회 화면 (Phase 4부터)
```

### 왜 Vercel Cron을 수집에 쓰지 않는가

Vercel Hobby 플랜의 cron은 **하루 1회가 상한**이고, 실행 시각은 지정한 시(hour) 안에서만 보장되며 UTC로만 지정할 수 있다. 무엇보다 **실패 시 재시도가 없고 실패 알림도 없다.**

| 필요한 것 | Vercel Cron (Hobby) | 판정 |
|---|---|---|
| L1 재시도 3회 | 플랫폼 재시도 없음 | 함수 내부 구현 필요 |
| L9 실패 노출 | 실패 알림 없음 | **수집이 죽어도 아무도 모름** |
| 19:00 정시 실행 | 19:00~19:59 임의 | KRX 반영 시각 미확인 상태에서 불확실성 증폭 |
| 1차 실패 시 당일 재시도 | 하루 1회 상한 | 불가 |

GitHub Actions는 재시도·수동 재실행(`workflow_dispatch`)·실패 알림이 기본 제공되고, 이미 Git을 쓰므로 추가 서비스가 없다. 사용량은 월 약 22분(1분/일)으로 무료 한도(private repo 2,000분) 안이다.

**Actions의 알려진 함정 2개**
- 저장소에 60일간 커밋이 없으면 scheduled workflow가 자동 비활성화된다
- 스케줄 실행은 부하에 따라 5~15분 지연되거나 드물게 건너뛴다

두 경우 모두 텔레그램 메시지 미수신으로 드러난다. **"매일 메시지가 오는 것 자체를 heartbeat로 정의"**하고, 2일 연속 미수신 시 수동 점검을 규칙으로 둔다.

---

## 2.2 단계적 데이터 누적

### 신호별 최소 필요 데이터

| 신호 | 계산 | 최소 일수 | 권장 |
|---|---|---|---|
| 신규 상장 | 전체 이력 대비 최초 등장 | 2일 | 25일 |
| 자금유입 | 5영업일 누적 좌수 변화 | 6일 | 25일 |
| 거래대금 급증 | 당일 ÷ 20일 평균 | 21일 | 25일 |

최장 요구가 21일이므로 **백필 25영업일**로 여유 4일을 둔다. 여유분은 휴장일 오판·응답 결손·재시도 실패를 흡수한다.

### 백필로 대기 시간이 사라진다

KRX API는 2010-01-04 데이터부터 `basDd` 파라미터로 과거 일자를 직접 조회할 수 있다. **25영업일 백필 = 25회 호출**이므로 Phase 1 종료 시점에 세 신호가 전부 동작한다.

백필은 **로컬 스크립트로 1회** 실행한다. 서버리스 함수에서 25회 순차 호출은 타임아웃 리스크가 있고, MVP에서 백필을 함수로 만들 이유가 없다.

### 데이터 부족 시 동작 규칙 (필수)

```
각 신호는 실행 시 가용 일수를 먼저 검사한다.
  가용 >= 최소  → 계산, 출력
  가용 <  최소  → 계산하지 않고 "준비중 (n/N일)"로 출력
```

**절대 금지:** 20일 평균 자리에 8일 평균을 대체 투입하지 않는다. 배수가 부풀려져 오탐이 폭증한다. 계산을 건너뛰는 게 항상 낫다.

### 종목 단위 누적 (전체와 별개)

전체 히스토리가 25일이어도 신규 상장 ETF의 개별 관측일은 1일이다.

- 개별 관측일 < 21일 → 거래대금 급증 판정에서 제외
- 개별 관측일 < 6일 → 자금유입 판정에서 제외
- 상장 30일 이내 → 급증 순위에서 제외하고 태깅만

---

## 2.3 스키마

```sql
create table etf_daily (
  bas_dd      date   not null,
  isu_cd      text   not null,
  isu_nm      text   not null,
  close_prc   numeric,
  nav         numeric,
  acc_trdvol  bigint,
  acc_trdval  bigint,
  net_asset   numeric,        -- INVSTASST_NETASST_TOTAMT
  list_shrs   bigint,
  fluc_rt     numeric,
  idx_nm      text,
  idx_close   numeric,
  idx_fluc_rt numeric,
  primary key (bas_dd, isu_cd)      -- 멱등성
);
create index etf_daily_cd_dd on etf_daily (isu_cd, bas_dd desc);

create table collection_ledger (
  bas_dd     date primary key,
  status     text not null check (status in ('ok','holiday','missing')),
  rows       int,
  sha256     text,
  fetched_at timestamptz not null default now(),
  error      text
);

create table etf_universe (
  isu_cd     text primary key,
  isu_nm     text not null,
  first_seen date not null,
  last_seen  date not null
);

create table signal_daily (
  bas_dd      date not null,
  signal_type text not null,
  isu_cd      text not null,
  rank        int,
  value       numeric,
  meta        jsonb,
  primary key (bas_dd, signal_type, isu_cd)
);
```

`collection_ledger`가 없으면 결손이 조용히 평균을 오염시킨다. `signal_daily`는 Phase 4 관측 기록을 **수동 메모가 아니라 쿼리**로 남기게 해준다 — 20일 뒤 임계값 튜닝이 SQL 한 번으로 끝난다.

원본 응답은 Supabase Storage에 `raw/YYYYMMDD.json.gz`로 보관하고 덮어쓰지 않는다.

---

## 2.4 신호 SQL

### 자금유입

```sql
create or replace view v_flow as
with d as (
  select bas_dd, isu_cd, isu_nm, nav, list_shrs, net_asset,
         lag(list_shrs) over w as prev_shrs,
         lag(nav)       over w as prev_nav,
         count(*) over (partition by isu_cd) as obs_days
  from etf_daily
  where nav is not null and list_shrs is not null
  window w as (partition by isu_cd order by bas_dd)
),
f as (
  select *,
    case when prev_shrs > 0 and prev_nav > 0
         then (list_shrs::numeric / prev_shrs) * (nav / prev_nav)
    end as split_check,
    (list_shrs - prev_shrs) * nav as raw_flow
  from d
)
select bas_dd, isu_cd, isu_nm, net_asset, obs_days,
  sum(case when split_check between 0.95 and 1.05 then raw_flow end)
    over (partition by isu_cd order by bas_dd
          rows between 4 preceding and current row) as flow_5d
from f;
```

`split_check`가 밴드를 벗어난 날은 `null`이 되어 `sum`이 무시한다. **분할 당일만 빠지고 나머지 4일은 살아남는다.** 행 자체를 `where`로 버리면 window 프레임이 밀려 6일치를 5일로 세게 되므로 이 방식이어야 한다.

### 거래대금 급증

```sql
create or replace view v_surge as
select bas_dd, isu_cd, isu_nm, acc_trdval, fluc_rt,
  avg(acc_trdval) over w20 as avg20,
  count(*)        over w20 as n20
from etf_daily
window w20 as (partition by isu_cd order by bas_dd
               rows between 20 preceding and 1 preceding);
```

`n20 = 20` 조건 하나가 "데이터 부족 시 계산 금지" 규칙을 대체한다. `1 preceding`으로 당일을 분모에서 제외하는 것도 SQL에 명시된다.

**주의:** `rows between`은 달력이 아니라 **확보된 행** 기준이다. 결손이 있으면 20개 행이 25일에 걸쳐 모인다. 의도한 동작이지만 문서화가 필요하다.

### 신규 상장

```sql
insert into etf_universe (isu_cd, isu_nm, first_seen, last_seen)
select isu_cd, isu_nm, bas_dd, bas_dd from etf_daily where bas_dd = $1
on conflict (isu_cd) do update
  set last_seen = excluded.last_seen, isu_nm = excluded.isu_nm
returning isu_cd, isu_nm, (xmax = 0) as is_new;
```

`xmax = 0`은 해당 행이 insert였는지 update였는지 구분하는 Postgres 관용구다. **거래정지 후 재개 종목을 신규로 오탐하지 않으면서 한 번의 쿼리로 끝난다.**

### 임계값 필터 (애플리케이션 레이어)

```
자금유입:  |flow_5d| >= 10억 원  AND  |flow_5d| / net_asset >= 1.0%  AND  obs_days >= 6
급증:      avg20 >= 10억 원  AND  acc_trdval/avg20 >= 3.0  AND  n20 = 20
           AND 상장 30일 초과
```

절대액 하한만 두면 대형 ETF가 상위를 독점하고, 비율 하한만 두면 초소형 ETF가 노이즈로 튄다. **AND로 걸어야 한다.**

---

## 2.5 필수 구현 로직

틀리면 신호가 통째로 무효가 되는 순서로 나열한다.

**L1. 날짜·휴장일 처리**
```
HTTP 비정상            → 재시도 3회(60초 간격) → ledger=missing + 알림
OutBlock_1 없음/빈배열 → ledger=holiday, 정상 종료 (재시도 금지)
BAS_DD != 요청일       → ledger=missing + 알림. 데이터 사용 금지
```
휴장일과 장애를 구분하지 않으면 연휴마다 재시도가 헛돌고, 반대로 장애를 휴장 처리하면 결손을 영원히 못 채운다.

**L2. 숫자 파싱** — KRX는 값 없음을 `"-"`로 반환한다. `"-"`를 0으로 치환하면 좌수 변화가 -100%로 계산돼 자금유입 1위로 올라온다. `null`을 반환하고 해당 종목을 그날 계산에서 제외한다.

**L3. 종목 식별자** — `ISU_CD`는 숫자 6자리가 아니다. `0184E0` 같은 영숫자 코드가 실재한다. 정규식은 `^[0-9A-Z]{6}$`. 숫자만 허용하면 일부 ETF가 조용히 누락된다.

**L4. 액면분할 필터** — 분할이 일어나면 좌수가 10배 뛰고 NAV가 1/10이 된다. 안 거르면 분할 종목이 자금유입 1위를 독점한다. 판정 원리: 분할은 총 순자산을 보존하므로 `좌수비 × NAV비 ≈ 1.0`이고, 실제 설정/환매는 이 곱을 바꾼다. (SQL 구현은 §2.4)

**L5~L7** — SQL view가 담당. (§2.4)

**L8. 멱등성** — `etf_daily`의 PK `(bas_dd, isu_cd)`가 처리한다. 집계는 매번 전량 재계산한다. ETF 1,000종 × 25일 = 25,000행이므로 1초 안에 끝나며, **증분 계산은 결손 하루를 영구 오염으로 만든다.**

**L9. 실패 노출** — 조용한 실패가 최악이다.
```
결손: "⚠️ 최근 25일 중 2일 결손 (0916, 0911) — 20일 평균 신뢰도 저하"
장애: "❌ 수집 실패: <사유>" 만이라도 발송
```

**L10. 시크릿** — GitHub Secrets와 Vercel 환경변수에만 둔다. `.env.local`은 gitignore. 원본 응답과 키는 Git 커밋 금지.

**L11. 메시지 길이** — 텔레그램 `sendMessage` 상한 4,096자. 생성 후 길이 검사 → 초과 시 섹션당 5개로 축소.

---

## 2.6 무료 티어 제약과 대응

| 제약 | 사실 | 대응 |
|---|---|---|
| Supabase 자동 일시정지 | 7일간 활동이 없으면 프로젝트가 정지되고 수동 복구가 필요하다 | **휴장일에도 `collection_ledger`에 행을 쓴다.** 설·추석 연휴 + 주말이면 7일 무거래가 가능하므로, 거래일에만 쓰면 정지될 수 있다 |
| Supabase 용량 | 무료 DB 500MB, 파일 스토리지 1GB | 정규화 행 기준 연 약 37MB. **원본 JSON은 DB가 아니라 Storage에 gzip** |
| Vercel 함수 타임아웃 | Hobby 기본 10초 (설정 시 상향) | 백필을 함수로 만들지 않는다. 로컬 실행 |
| Actions 60일 비활성화 | 무커밋 60일 시 스케줄 중단 | 텔레그램을 heartbeat로 간주, 2일 미수신 시 점검 |
| Vercel Password Protection | Pro 전용 | 대시보드 접근 제어는 middleware Basic Auth 환경변수 1개 |

---

## 2.7 보안

```
클라이언트 번들에 절대 들어가면 안 되는 것:
  SUPABASE_SERVICE_ROLE_KEY   ← NEXT_PUBLIC_ 접두사 실수가 1순위 사고
  KRX_AUTH_KEY                ← 클라이언트에서 KRX 직접 호출 금지 (CORS + 키 노출)
```

- 모든 테이블에 RLS 활성화 후 **anon 정책을 만들지 않는다.** 정책이 없으면 anon은 아무것도 읽지 못한다
- 대시보드는 Server Component에서 service role key로 조회 (브라우저에 키가 나가지 않음)

---

## 2.8 저장소 구조

```
/
├── .github/workflows/ingest.yml
├── scripts/
│   ├── ingest.ts        # 일일 수집 (Actions가 실행)
│   └── backfill.ts      # 25영업일, 로컬 1회
├── lib/
│   ├── krx.ts           # 호출 + L1/L2/L3
│   ├── signals.ts       # view 조회 + 임계값 필터
│   └── telegram.ts
├── supabase/migrations/ # Supabase CLI로 버전 관리
├── app/                 # Next.js — Phase 4부터
└── .env.local           # gitignore
```

```yaml
# .github/workflows/ingest.yml
name: ETF daily ingest
on:
  schedule:
    - cron: "0 10 * * 1-5"   # 19:00 KST
  workflow_dispatch:          # 수동 재실행 — 필수
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
          KRX_AUTH_KEY: ${{ secrets.KRX_AUTH_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          TG_TOKEN: ${{ secrets.TG_TOKEN }}
          TG_CHAT_ID: ${{ secrets.TG_CHAT_ID }}
```

---

## 2.9 일정

### Phase 0 — 검증 (반나절) · **Go/No-Go 게이트**

코드를 쓰기 전에 두 가지를 확인한다.

```
A. 연속 2영업일 데이터로 LIST_SHRS 변동 종목 수 집계
B. GitHub Actions(workflow_dispatch)에서 KRX API 호출 성공 여부
C. ACC_TRDVAL 단위 확인 (원 / 백만 원)
```

| A 결과 | 판정 |
|---|---|
| 변동 30개 이상 | **Go.** 계획 그대로 |
| 10~29개 | 조건부 Go. 자금유입 임계값 5억으로 하향 후 재검토 |
| 10개 미만 | **No-Go.** 신호 ① 폐기, ②③ 2개로 MVP 재정의 |

**B가 실패하면 아키텍처를 통째로 바꿔야 한다.** 국내 공공 API가 해외 IP(Actions는 Azure 대역)를 차단하는 경우가 있다. 막히면 대안은 집 서버 또는 국내 리전 VM이며, 이 경우 Supabase·Next.js 설계도 재검토 대상이 된다.

### Phase 1 — 수집기 + 백필 (1.5일)
Supabase 프로젝트 생성, 마이그레이션 적용, `fetch`/`backfill` 구현(L1·L2·L3·L8·L10), 25영업일 백필.
검증: `collection_ledger`의 `ok` 건수가 25 ± 결손 이내.

### Phase 2 — 신호 계산 (0.5일)
view 3개 생성 + 임계값 필터.
검증: 25일치 기준 각 신호가 **매일 0~15건** 범위인지 확인. 매일 50건 이상이면 임계값이 느슨하고, 매일 0건이면 과도하거나 L4 필터가 과하다.

### Phase 3 — 발송 + 스케줄 (1일)
텔레그램 발송(L9·L11), Actions workflow 등록, secrets 설정.
검증: 수동 1회 + 자동 1회 수신.

### Phase 4 — 관측 (20영업일) · **매매 사용 금지**
`signal_daily`에 자동 기록된다. 이 기간의 목적은 수익이 아니라 신호 품질 측정이다.
관측 1주차에 Next.js 조회 화면 1페이지를 추가한다.

측정 항목:
1. 신호별 일일 건수 분포
2. 오탐 의심 건 (분할 미필터, 신규 상장 오염 등)
3. 자금유입 상위 종목의 이후 5일 수익률
4. 결손 발생 빈도

### Phase 5 — 튜닝 및 확장 (Day 21+)
임계값을 실측치로 교체. §12의 확장 후보 검토.

---

## 2.10 일일 메시지 형식

```
📊 ETF 일일 리포트 2026-09-17 (목)

💰 자금유입 5일 누적 상위
1. TIGER OOOOOO   +142억  (좌수 +3.1%, 순자산 대비 2.4%)  [3일 연속]
2. KODEX OOOOOO    +88억  (좌수 +1.7%, 순자산 대비 1.1%)
...

🔥 거래대금 급증 (20일 평균 대비)
1. TIGER OOOOOO   4.2배  등락 +3.1%  거래대금 320억  ⭐자금유입 동시
2. KODEX OOOOOO   3.6배  등락 -1.2%  거래대금 180억
...

🆕 신규 상장 2종
- KODEX OOOOOO
- TIGER OOOOOO

⚠️ 최근 25일 중 1일 결손 (0916)
```

`[3일 연속]`과 `⭐자금유입 동시` 태그가 §1.4 루틴을 직접 지원한다. **사용자가 매일 머리로 교차 확인할 필요를 없앤다.**

---

# PART 3. 판단 자료

## 3.1 성공/실패 판정 기준

| 시점 | 성공 | 실패 |
|---|---|---|
| Phase 0 | 좌수 변동 30종 이상 + Actions에서 KRX 호출 성공 | 변동 10종 미만 → 신호 ① 폐기 / Actions 차단 → 아키텍처 재설계 |
| Phase 3 | 자동 실행으로 텔레그램 수신 | — |
| Phase 4 (20일 후) | 무결손 운영 18일 이상 + 신호 일평균 3~15건 | 결손 5일 이상 또는 신호가 매일 0건/50건 이상 |
| Phase 5 | 자금유입 3일 연속 종목이 월 3건 이상 나옴 | 3일 연속 종목이 월 0~1건 → 신호 ①의 실효성 없음 |

**마지막 줄이 이 프로젝트의 진짜 판정 기준이다.** 신호가 기술적으로 동작해도 후보가 안 나오면 쓸모가 없다.

## 3.2 미확인 사항

가정했으나 검증하지 않은 항목이다. 틀렸을 때 깨지는 범위를 함께 적는다.

| 항목 | 영향 | 확인 시점 |
|---|---|---|
| `LIST_SHRS`가 유의미하게 변동하는지 | **신호 ① 전체** | Phase 0 |
| Actions IP에서 KRX 호출 가능 여부 | **아키텍처 전체** | Phase 0 |
| `ACC_TRDVAL` 단위 (원/백만 원) | 신호 ② 임계값 | Phase 0 |
| KRX 당일 데이터 반영 시각 | 스케줄 시각 | Phase 4 (2주 관측) |
| KRX API 일일 호출 한도 | 백필 전략 | Phase 1 |
| 거래량 0 종목의 응답 포함 여부 | 신호 ③ 오탐률 | Phase 4 |
| 액면분할 시 NAV·좌수 동시 반영 | L4 필터 정확도 | Phase 4 (분할 발생 시) |
| Vercel Hobby 함수 기본 타임아웃 | 없음 (백필을 로컬로 돌려 회피) | — |

## 3.3 제외 기능과 복귀 조건

| 기능 | 제외 사유 | 복귀 조건 |
|---|---|---|
| 외국인·기관 순매수 | ETF의 기관 순매수에는 LP 헤지가 섞인다. 신호 ①과 **같은 사건을 두 번 셀 가능성**이 있다(추정) | Phase 4 데이터로 좌수 증감과의 상관계수 계산. **0.5 이하면 추가, 0.8 이상이면 영구 폐기** |
| 테마·업종 회전맵 | 새 시계열이 필요하고 상대강도는 60영업일 이상 있어야 의미가 생긴다 | **Phase 1부터 수집만 병행**(판단 로직 없이 저장, 약 10줄). Day 60에 로직 구현 |
| 구성종목 우회 검증 | 유일하게 수동 등록이 필요하다. ETF 5개 × 종목 10개, 분기 갱신 | MVP 2주 무결손 운영 후. ETF 3개로 축소 시작 |
| 크로스에셋 레짐 | 기능이 아니라 리서치 질문이다. 선행 일수를 모르면 알림을 해석할 기준이 없다 | 선행 일수 측정 후 기능화 |
| 카카오톡 전달 | access token 6시간 / refresh token 2개월. **2개월마다 수동 재인증**, 잊으면 조용히 멈춘다 | 복귀 안 함 |

---

## 3.4 리뷰어 확인 요청 — 핵심 질문 3개

**Q1. Scanner와 판단기의 경계가 문서상으로만 존재한다. 이게 실제로 지켜질 구조인가?**
§1.5에 금지 항목을 명시했지만 강제 장치는 없다. 텔레그램 메시지에 "이것은 후보 목록이며 매수 신호가 아님"을 매일 고정 문구로 넣을지, 아니면 Phase 4 동안 아예 종목명을 마스킹할지 판단이 필요하다.

**Q2. 자금유입 신호가 LP 재고 조정과 구분되지 않는다는 한계를 감수할 것인가?**
상장좌수 증감에는 실제 투자자 유입과 LP의 호가 공급용 재고 조정이 섞인다. 5일 누적으로 완화되지만 분리되지는 않는다. 이 한계를 안고 갈지, Phase 0에서 LP 비중을 추정할 방법을 먼저 찾을지 결정이 필요하다.

**Q3. 단일 소스 의존을 허용할 것인가?**
KRX API가 스펙을 바꾸거나 중단되면 시스템 전체가 멈춘다. 키움 API로 교차검증을 넣으면 안정성이 올라가지만 호출량과 코드가 2배가 되고 MVP 기간이 2일 늘어난다. **v2는 단일 소스를 선택했다.** 이 트레이드오프의 승인이 필요하다.

---

## 3.5 다음 행동 하나

**Phase 0을 실행한다.** 로컬에서 연속 2영업일 데이터를 받아 `LIST_SHRS` 변동 종목 수를 세고, 동시에 `workflow_dispatch` 워크플로 하나를 만들어 GitHub Actions에서 KRX 호출이 되는지 확인한다. 합쳐서 반나절이면 끝난다.

이 두 숫자가 나오기 전에는 Supabase 스키마도 Next.js도 만들지 않는다. **보낼 내용이 있는지, 보낼 수 있는 자리인지가 먼저다.**
