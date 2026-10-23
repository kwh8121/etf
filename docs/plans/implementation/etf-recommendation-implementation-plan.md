# ETF 추천 예비 연구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 진행·완료 상태는 이 문서가 아니라 [NEXT.md](../NEXT.md)에만 기록한다.

**Goal:** 로컬 KRX 백필 자료로 `kr-equity-momentum-v1` 후보 선정, 월간 가상 포트폴리오, 비교군 성과를 재현 가능하게 계산하는 연구 CLI를 만든다(분배금 추정 반영 예비 결과).

**Architecture:** `lib/recommendations/`의 순수 함수 모듈을 `history-store → total-return → kr-universe → kr-momentum → paper-portfolio → evaluation` 순으로 쌓고, `scripts/research-kr-etf-recommendations.ts`가 파일 입출력만 담당한다. 운영 DB·daily·Telegram 경로와 연결하지 않는다.

**Tech Stack:** Node 22.23.2, TypeScript strict, Vitest. 신규 의존성 없음.

**Spec:** [데이터 계약](etf-recommendation-data-contract.md), [추천 계획 v0.3](../2026-10-23-etf-market-outperformance-recommendation-draft.md) 4·6·7·8절.

## Global Constraints

- 거래일 순번 `t`와 총수익지수 `TRI`, `M6 = TRI(t-21)/TRI(t-147)-1`, `M12 = TRI(t-21)/TRI(t-273)-1`, `score = 0.5×pct(M6)+0.5×pct(M12)`.
- `pct`: 적격 수 `n>1`이면 작은 값부터 매긴 평균 등수 `r`에 대해 `(r-1)/(n-1)`, `n=1`이면 0.5.
- 후보 조건 `M6>0 && M12>0`, 정렬은 `score` 내림차순·`ISU_CD` 오름차순, 그룹당 1개, 최대 3개.
- 적격: 연속 관측 274거래일 이상, 직전 60거래일 평균 거래대금 1,000,000,000원 이상.
- 체결: 기준일 `T` 다음 **둘째** 거래일 개장가. 비용 편도 0.15%(스트레스 0.30%). 목표 비중 슬롯당 1/3, 부족분 현금 0%. 월 마지막 거래일에만 리밸런싱.
- 모든 출력에 `evidence_grade`(`observed`<`derived`<`estimated` 중 최저)와 `예비 결과` 표시. 코드·파일명·필드는 영문, 문서·사용자 표시는 한국어.
- 파일은 `.ts` + 2칸 들여쓰기, 내부 모듈은 `@/` 별칭(테스트)·상대 경로+`.ts`(scripts, 기존 패턴).

## Review Focus

1. 기준일 `T` 이후 행을 바꿔도 `T`의 후보가 같아야 한다(미래 정보 차단).
2. 분배락일에 종가가 하락해도 총수익이 손실로 계산되지 않아야 한다(`100→95, 분배 5`면 0%).
3. 판단일 이후 폐지된 종목이 그 이전 판단일 종목군에 남아 있어야 하며, 보유 중 사라지면 마지막 종가로 청산돼야 한다.
4. 후보가 0개·1개일 때 현금 비중이 맞고 현금·순자산이 음수가 되지 않아야 한다.
5. 같은 입력으로 두 번 실행한 JSON 출력이 `generated_at`을 제외하고 동일해야 한다.

---

## 파일 구조

| 경로 | 책임 |
| --- | --- |
| `lib/recommendations/contracts.ts` | 공통 타입과 상수 |
| `lib/recommendations/history-store.ts` | 백필 JSON → 일자·종목 시계열 |
| `lib/recommendations/total-return.ts` | 분배락 추정, TRI |
| `lib/recommendations/kr-universe.ts` | 적격성·제외 사유 |
| `lib/recommendations/kr-momentum.ts` | 점수·후보 |
| `lib/recommendations/paper-portfolio.ts` | 체결·현금·비용 |
| `lib/recommendations/evaluation.ts` | 비교군·성과 지표 |
| `scripts/research-backfill-kr-index.ts` | 코스피 200 가격지수 백필 |
| `scripts/research-kr-etf-recommendations.ts` | 연구 CLI |

기존 `lib/recommendations/krx-history.ts`와 `scripts/research-backfill-kr-etf.ts`는 재사용한다.

---

### Task 1: 코스피 200 가격지수 백필

**Files:** Create `scripts/research-backfill-kr-index.ts`; Modify `lib/recommendations/krx-history.ts`; Test `test/recommendations/krx-history.test.ts`

**Interfaces:**
- Produces: `buildIndexHistoryRecord(requestedDate: string, rawRows: Record<string,string|undefined>[], fetchedAt: string): { basDd; status: "TRADING_COMPLETE"|"NON_TRADING"; rowCount; rawSha256; fetchedAt; rows }` — `IDX_NM === "코스피 200"` 행만 남기고, `CLSPRC_IDX`가 공란이면 `NON_TRADING`.

- [ ] **Step 1:** `buildIndexHistoryRecord`가 (a) `코스피 200` 행 1개만 보존, (b) 종가 공란이면 `NON_TRADING`·`rows: []`, (c) 같은 입력 같은 `rawSha256`을 만족하는 테스트 3개를 `krx-history.test.ts`에 추가한다.
- [ ] **Step 2:** `node_modules/.bin/vitest run test/recommendations`로 실패를 확인한다(함수 미정의).
- [ ] **Step 3:** `krx-history.ts`에 `buildIndexHistoryRecord`를 구현한다. 해시는 필터 전 원문(`rawRows`)으로 계산한다.
- [ ] **Step 4:** 위 vitest 명령이 통과하는지 확인한다.
- [ ] **Step 5:** `scripts/research-backfill-kr-index.ts`를 만든다. `idx/kospi_dd_trd` 엔드포인트를 `AUTH_KEY` 헤더로 호출하고 `research-data/kr-index-daily/YYYYMMDD.json`에 저장하며, 재개·재시도·지연은 `research-backfill-kr-etf.ts`와 같은 방식이다. 파일럿(`--from 20260921 --to 20261002`)으로 ETF 거래일 분류와 일치하는지 확인한 뒤 2019-01-02~2026-10-22를 백그라운드로 실행한다.
- [ ] **Step 6:** 커밋 `feat: 코스피 200 가격지수 연구 백필`.

### Task 2: 공통 타입과 이력 저장소

**Files:** Create `lib/recommendations/contracts.ts`, `lib/recommendations/history-store.ts`; Test `test/recommendations/history-store.test.ts`

**Interfaces:**
- Produces (`contracts.ts`): `type EvidenceGrade = "observed"|"derived"|"estimated"`; `interface DailyBar { basDd: string; isuCd: string; isuName: string; indexName: string|null; open: number; close: number; basePrice: number|null; turnover: number }`; `interface TradingHistory { dates: string[]; bars: Map<string, Map<string, DailyBar>> }`(날짜 → 코드 → 바); `const STRATEGY_VERSION = "kr-equity-momentum-v1"`.
- Produces (`history-store.ts`): `buildTradingHistory(records: KrxHistoryRecord[]): TradingHistory` — `TRADING_COMPLETE`만 사용, 날짜 오름차순; `loadTradingHistory(dir: string): Promise<{ history: TradingHistory; dataVersion: string }>` — `dataVersion`은 정렬된 `rawSha256` 목록의 SHA-256.

- [ ] **Step 1:** 테스트: (a) 휴장일·`PARTIAL` 레코드는 `dates`에서 제외, (b) `basePrice = close - CMPPREVDD_PRC`, (c) 쉼표·`-` 파싱(결측 필드 행은 해당 날짜 코드만 제외), (d) 입력 순서를 바꿔도 `dataVersion` 동일, (e) 한 `rawSha256`을 바꾸면 `dataVersion` 변경.
- [ ] **Step 2:** `vitest run test/recommendations/history-store.test.ts`로 실패를 확인한다.
- [ ] **Step 3:** 두 파일을 구현한다. `loadTradingHistory`는 `readdir` 정렬 후 순차 읽기로 메모리를 억제한다(약 600MB 원문, 필요한 필드만 보존).
- [ ] **Step 4:** 통과를 확인한다. **Step 5:** 커밋 `feat: 추천 연구 이력 저장소`.

### Task 3: 분배락 추정과 총수익지수

**Files:** Create `lib/recommendations/total-return.ts`; Test `test/recommendations/total-return.test.ts`

**Interfaces:**
- Consumes: `DailyBar`.
- Produces: `estimateDistribution(prevClose: number, basePrice: number|null): { amount: number; reason: "DISTRIBUTION_ESTIMATED"|"UNEXPLAINED_ADJUSTMENT"|"SPLIT_OR_MERGE_CANDIDATE"|null }`; `buildTotalReturnSeries(bars: { dates: string[]; closes: number[]; basePrices: (number|null)[] }): { tri: number[]; events: { index: number; reason: string; amount: number }[] }` — `tri[0] = 1`.

- [ ] **Step 1:** 테스트: (a) `prevClose=100, basePrice=95` → `amount 5, DISTRIBUTION_ESTIMATED`, 종가 95이면 해당일 `tri` 변화 0%, (b) `basePrice=prevClose`·`null` → `amount 0, reason null`, (c) `basePrice>prevClose` → `UNEXPLAINED_ADJUSTMENT, amount 0`, (d) 하락폭이 `prevClose`의 10% 초과 → `SPLIT_OR_MERGE_CANDIDATE, amount 0`, (e) 3일 시계열 `tri` 수치 고정.
- [ ] **Step 2:** 실패 확인. **Step 3:** 계약 4절의 식으로 구현. **Step 4:** 통과 확인. **Step 5:** 커밋 `feat: 분배락 추정 총수익지수`.

### Task 4: 적격 종목군

**Files:** Create `lib/recommendations/kr-universe.ts`; Test `test/recommendations/kr-universe.test.ts`

**Interfaces:**
- Consumes: `TradingHistory`, `buildTotalReturnSeries`.
- Produces: `interface EligibleInstrument { isuCd: string; isuName: string; groupKey: string; groupKeySource: "broad_market"|"index_name" }`; `interface Exclusion { isuCd: string; reasonCode: "INSUFFICIENT_HISTORY"|"LOW_TURNOVER"|"TYPE_EXCLUDED"|"MISSING_FIELD"|"UNEXPLAINED_ADJUSTMENT" }`; `selectEligible(history: TradingHistory, asOfIndex: number): { eligible: EligibleInstrument[]; exclusions: Exclusion[] }`.

- [ ] **Step 1:** 테스트: (a) 관측 273일이면 `INSUFFICIENT_HISTORY`, 274일이면 통과, (b) 60일 평균 거래대금 9.99억이면 `LOW_TURNOVER`, 10억이면 통과, (c) 이름에 `커버드콜`·`레버리지`·`인버스`·`선물`·`(합성)`·`액티브`면 `TYPE_EXCLUDED`, (d) `asOfIndex` 이후에만 상장된 종목은 포함되지 않고 이후 폐지된 종목은 포함, (e) `코스피 200` 추적지수는 `broad_market`, 그 외는 추적지수명, (f) 직전 274일 안에 `UNEXPLAINED_ADJUSTMENT`가 있으면 제외.
- [ ] **Step 2~5:** 실패 확인 → 계약 5절 구현 → 통과 확인 → 커밋 `feat: 추천 연구 적격 종목군`.

### Task 5: 모멘텀 후보

**Files:** Create `lib/recommendations/kr-momentum.ts`; Test `test/recommendations/kr-momentum.test.ts`

**Interfaces:**
- Consumes: `EligibleInstrument`, `TradingHistory`, `buildTotalReturnSeries`.
- Produces: `interface Candidate { isuCd: string; rank: number; score: number; momentum6m: number; momentum12m: number; groupKey: string; groupKeySource: string; reasonCodes: string[] }`; `percentileRanks(values: number[]): number[]`; `selectCandidates(history: TradingHistory, asOfIndex: number, eligible: EligibleInstrument[]): Candidate[]`.

- [ ] **Step 1:** 테스트: (a) `percentileRanks([1,2,3])=[0,0.5,1]`, 동률 `[1,1,3]`은 평균 등수 `[1.5,1.5,3]`에 `(r-1)/(n-1)`을 적용해 `[0.25,0.25,1]`, 단일 값은 `[0.5]`, (b) 274번째 관측이 정확히 경계(M12가 `t-273`)에서 계산됨, (c) `M6<=0` 또는 `M12<=0`이면 후보 제외, (d) 같은 `groupKey`는 점수 최고 1개만, (e) 점수 동률은 `isuCd` 오름차순, (f) 후보 4개 이상이어도 3개, 0개면 빈 배열, (g) **`asOfIndex` 이후 종가를 바꿔도 결과 동일**(Review Focus 1).
- [ ] **Step 2~5:** 실패 확인 → 구현(`t`는 `asOfIndex`) → 통과 확인 → 커밋 `feat: kr-equity-momentum-v1 후보 계산`.

### Task 6: 가상 포트폴리오

**Files:** Create `lib/recommendations/paper-portfolio.ts`; Test `test/recommendations/paper-portfolio.test.ts`

**Interfaces:**
- Consumes: `TradingHistory`, `Candidate`.
- Produces: `interface PortfolioConfig { costRate: number; initialCash: number; slots: 3 }`; `interface DailyValuation { basDd: string; nav: number; cash: number; holdings: Record<string, number> }`; `interface PaperTrade { basDd: string; isuCd: string; side: "buy"|"sell"; price: number; quantity: number; cost: number; reasonCode?: "DELISTED_LIQUIDATION" }`; `simulatePortfolio(history: TradingHistory, candidatesByRebalance: Map<number, Candidate[]>, config: PortfolioConfig): { valuations: DailyValuation[]; trades: PaperTrade[] }` — 키는 판단일 순번이며 체결은 `+2`거래일 개장가.

- [ ] **Step 1:** 테스트: (a) 후보 1개 → 순자산의 1/3 매수, 나머지 2/3 현금, (b) 판단일 `T`의 후보가 `T+2` 개장가로 체결(`T+1` 아님), (c) 매수·매도 각각 `costRate` 차감 후 현금 ≥ 0, (d) 다음 달 후보에서 빠진 종목은 매도, 유지 종목은 목표 비중으로 재조정, (e) 후보 0개면 전량 현금화, (f) 보유 종목이 이후 이력에서 사라지면 마지막 종가로 청산하고 `DELISTED_LIQUIDATION` 기록, (g) 월중 후보 변화는 거래를 만들지 않음(입력이 리밸런싱 판단일만 받는다는 계약 확인).
- [ ] **Step 2~5:** 실패 확인 → 구현(소수 수량, 평가는 매 거래일 종가) → 통과 확인 → 커밋 `feat: 월간 가상 포트폴리오`.

### Task 7: 비교군과 성과 지표

**Files:** Create `lib/recommendations/evaluation.ts`; Test `test/recommendations/evaluation.test.ts`

**Interfaces:**
- Consumes: `DailyValuation`, `TradingHistory`.
- Produces: `interface Performance { cumulativeReturn: number; cagr: number; maxDrawdown: number; volatility: number; turnover: number; costShare: number }`; `computePerformance(navs: number[], tradingDays: number, trades: PaperTrade[]): Performance`; `excessReturnPp(strategy: number, benchmark: number): number` — `(strategy-benchmark)×100`; `selectPriorBenchmarkEtf(history: TradingHistory, asOfIndex: number): string|null` — `IDX_IND_NM==="코스피 200"`인 종목 중 직전 60일 평균 거래대금 최대(동률 `isuCd` 오름차순); `splitPeriods(dates: string[], opts: { prepDays: 273; devMonths: 24; evalMonths: 36; holdoutMonths: 12 }): { prep; development; evaluation; holdout } | null` — 자료가 부족하면 `null`.

- [ ] **Step 1:** 테스트: (a) NAV `[100,110,99]` → 누적 `-0.01`, 최대낙폭 `-0.1`, (b) 252거래일 NAV 2배 → CAGR 1.0, (c) `excessReturnPp(0.12,0.10)=2`, (d) 최대낙폭은 음수 부호, (e) 벤치마크 ETF 선정이 수익률 입력 없이 거래대금만으로 결정, (f) `splitPeriods`가 2019-01-02~2026-10-22 달력에서 273일 준비·24개월 개발·36개월 평가를 만족하며 평가의 마지막 12개월이 holdout, 자료 부족이면 `null`.
- [ ] **Step 2~5:** 실패 확인 → 구현 → 통과 확인 → 커밋 `feat: 추천 연구 성과 지표`.

### Task 8: 연구 CLI와 재현성

**Files:** Create `scripts/research-kr-etf-recommendations.ts`; Test `test/recommendations/research-cli.test.ts`; Modify `package.json`(`research:kr-etf` 스크립트), `docs/plans/NEXT.md`

**Interfaces:**
- Consumes: Task 1~7의 모든 함수.
- Produces: `runResearch(input: { history: TradingHistory; dataVersion: string; costRate: number; generatedAt: string }): ResearchReport` — `{ strategyVersion; dataVersion; inputHash; evidenceGrade: "estimated"; label: "예비 결과"; periods; weeklyCandidates; portfolio; comparisons; exclusionsSummary }`; CLI는 `--data-dir`, `--out`, `--cost-rate`(기본 0.0015) 인자와 `--cost-rate 0.003` 스트레스 실행을 지원한다.

- [ ] **Step 1:** 합성 이력(20종목, 400거래일, 분배락 2건, 폐지 1건)으로 테스트: (a) 같은 입력 두 번 실행한 보고서가 `generatedAt`을 제외하고 `JSON.stringify` 동일(Review Focus 5), (b) `evidenceGrade === "estimated"`와 `label === "예비 결과"`, (c) 원천 한 행을 바꾸면 `inputHash` 변경, (d) 기록된 모든 제외 사유가 계약 8절의 `reason_code` 집합 안, (e) 후보 0개 주간이 `후보 없음`으로 기록됨, (f) 비용 0.30% 결과가 0.15%보다 낮거나 같음.
- [ ] **Step 2:** 실패 확인. **Step 3:** `runResearch`와 CLI를 구현한다. 주간 후보는 매주 마지막 거래일, 포트폴리오는 월 마지막 거래일 후보만 사용한다. 출력은 `research-data/reports/<dataVersion 앞 12자>.json`.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`를 실행해 모두 통과함을 확인한다.
- [ ] **Step 5:** 실제 백필 자료로 CLI를 실행해 보고서 요약(적격 종목 수, 후보 분포, 구간별 성과, 비용 스트레스, 제외 사유 집계)을 `docs/references/etf-recommendation-preliminary-results.md`에 `예비 결과`로 기록하고, 정식 게이트 근거가 아님을 명시한다. **Step 6:** 커밋 `feat: 추천 예비 연구 CLI`.

---

## 자체 검토 결과

- 계획 6.2·7·8.1절의 값(274관측, 1/3 슬롯, 둘째 거래일 개장, 비용 0.15%/0.30%, 273·24·36·12 구간)은 Global Constraints와 각 Task 테스트에 나타난다.
- 8.3절 게이트 중 G2(재현성)는 Task 8, G1·G3는 `estimated` 등급으로 인해 이 계획 범위 밖이며 [데이터 계약 9절](etf-recommendation-data-contract.md)의 B1~B4 해소 뒤에 별도 실행안에서 다룬다. 벤치마크는 Q-42에 따라 Task 7의 `selectPriorBenchmarkEtf`를 교체하거나 보강한다.
- 타입 이름(`DailyBar`, `TradingHistory`, `Candidate`, `PaperTrade`, `DailyValuation`, `Performance`)은 Task 간에 동일하게 사용한다.
- 예상 규모는 8 Task이며 추천 계획 ER-2~ER-3의 예비 연구 범위(2~3일 + 3~5일)에 해당한다.
