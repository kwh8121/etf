# ETF 추천 연구 데이터 계약 (예비 연구 v1)

> 작성일: 2026-10-23 KST. 상위 계획: [추천 계획 v0.3](../2026-10-23-etf-market-outperformance-recommendation-draft.md). 근거: [데이터 확보 가능성 조사](../../references/etf-recommendation-data-feasibility.md).
> 범위: **가격 기준 예비 연구**. 이 계약의 결과는 `분배금 추정 반영 예비 결과`로만 표시하며 G1·G3의 정식 근거가 아니다. 진행 상태의 정본은 [NEXT.md](../NEXT.md)다.

## 1. 계약 등급

| 등급 | 의미 | 사용처 |
| --- | --- | --- |
| `observed` | KRX 응답 원문 값 | 가격·거래대금·개장가·NAV·지수 종가 |
| `derived` | 관측 값에서 규칙으로 계산 | 수익률, 모멘텀, 거래대금 평균 |
| `estimated` | 가정·추정이 섞인 값 | 기준가 기반 분배금, 이름·추적지수 기반 유형 판정 |

모든 출력 행은 가장 낮은 입력 등급을 상속한다. `estimated`가 하나라도 섞인 성과는 `예비 결과`로 표시한다.

## 2. 입력 원천과 고정 버전

| 입력 | 원천 | 위치 | 고정 방법 |
| --- | --- | --- | --- |
| ETF 일별 자료 | KRX `etp/etf_bydd_trd` | `research-data/kr-etf-daily/YYYYMMDD.json` | 일별 `rawSha256`, 전체는 정렬된 해시 목록의 SHA-256(`data_version`) |
| 시장 지수 | KRX `idx/kospi_dd_trd`의 `코스피 200`(가격지수) | `research-data/kr-index-daily/` (별도 백필, 계획 Task 1) | 동일 |
| 거래일 달력 | 위 ETF 자료에서 `TRADING_COMPLETE`인 날 | 파생 | `data_version`에 포함 |

연구 입력은 파일 읽기 전용이다. 운영 DB·daily·catchup·Telegram 경로에 연결하지 않는다.

## 2.1 필드 매핑 (KRX 원문 → 연구 모델)

| 연구 필드 | KRX 필드 | 등급 | 비고 |
| --- | --- | --- | --- |
| `close` | `TDD_CLSPRC` | observed | 원화 정수 |
| `open` | `TDD_OPNPRC` | observed | 체결 가격 |
| `turnover` | `ACC_TRDVAL` | observed | 원 |
| `nav` | `NAV` | observed | 참고용 |
| `indexName` | `IDX_IND_NM` | observed | 동일 지수 그룹 대체 키 |
| `basePrice` | `TDD_CLSPRC - CMPPREVDD_PRC` | derived | 거래소 기준가. 전일 종가와 다르면 조정 사건 |

쉼표를 제거해 파싱하고 빈 값·`-`는 결측이다. 결측이면 해당 종목-일자를 제외하고 사유를 남긴다.

## 3. 시점 계약

- `signal_as_of = T`는 후보 계산에 사용한 마지막 거래일이다. `T` 이후 행은 어떤 계산에도 접근하지 못한다(테스트로 고정).
- 연구 모드의 `available_at(T)`는 `T`의 다음 거래일 09:30 KST로 가정한다(현재 운영 timer 기준). 이 값은 `estimated`다.
- 체결은 `T` 다음 **둘째** 거래일 개장가다. 거래일은 달력(`TRADING_COMPLETE`) 기준이며 사이 휴장일은 건너뛴다.
- 판단일 `T`에서 보이는 종목군은 `T`의 응답에 있던 종목이다. 이후 사라진 종목도 포함한다.

## 4. 분배금 추정 계약

`estimated` 등급. 종목-일자 `d`에 대해 `prevClose(d-1)`와 `basePrice(d)`를 비교한다.

```text
estDistribution(d) = prevClose - basePrice      (basePrice < prevClose 일 때)
```

- `0 < estDistribution/prevClose <= 10%`이면 분배락 후보로 채택한다. 초과하면 분할·합병 후보로 제외하고 감사 기록에 남긴다.
- `basePrice > prevClose`(조사에서 525건)이면 분배금으로 쓰지 않고 `unexplained_adjustment`로 기록한다.
- 총수익지수: `TRI(d) = TRI(d-1) × (close(d) + estDistribution(d)) / prevClose`. 분배금은 분배락일 종가에 즉시 재투자한 것으로 근사한다(지급일·세금·재투자 시차는 모른다).
- 분배락 후보가 한 번이라도 없는 ETF도 유효하다. 가격 조정이 전혀 없는 ETF는 분배금 0으로 둔다.

## 5. 적격성 필터 (판단일 `T`)

1. `T`까지 해당 종목의 연속 관측이 **274거래일 이상**(계획 6.1절).
2. 직전 60거래일 평균 거래대금 **10억 원 이상**(제안값, 조사 말일 기준 423/1,183 통과).
3. 필수 결측·조정 미해결(`unexplained_adjustment`가 직전 274일 안에 있음)·분류 제외는 제외하고 `reason_code`를 기록한다.
4. 유형 제외(`estimated`): `ISU_NM`·`IDX_IND_NM`에 `커버드콜`, `레버리지`, `인버스`, `선물`, `(합성)`, `액티브`가 있으면 제외한다. 계획 3.1절의 제외 대상(커버드콜·합성·혼합형·액티브)에 대한 공식 분류 원천이 없는 동안의 대체 규칙이며, 정식 게이트 전에는 공식 분류로 교체한다.

## 6. 후보 계산과 포트폴리오

계획 6.2절·4절·7절을 그대로 따른다. 이 계약에서 추가로 고정하는 값은 다음과 같다.

| 항목 | 값 |
| --- | --- |
| 모멘텀 기간 | `M6`: `TRI(t-21)/TRI(t-147)-1`, `M12`: `TRI(t-21)/TRI(t-273)-1` (t는 거래일 순번) |
| 동률 | 점수 내림차순, 같으면 `ISU_CD` 오름차순 |
| 그룹 키 | `broad_market`(추적지수명이 `코스피 200`·`코스피`·`KRX 300` 계열) 또는 추적지수명. 섹터 분류 원천 확보 전의 `estimated` 키 |
| 후보 수 | 최대 3. 부족분은 현금(수익률 0%) |
| 리밸런싱 | 월 마지막 거래일 `T`의 후보를 `T` 다음 둘째 거래일 개장가에 체결 |
| 비용 | 체결대금의 편도 0.15%, 스트레스 0.30% |
| 수량 | 소수 허용. 현금 제약 `cash >= 0` |
| 보유 중 소멸 | 마지막 관측 종가로 청산하고 `delisted_liquidation`을 기록(예비 연구 가정) |

## 7. 벤치마크 (Q-42 결정 전 잠정)

- 정식 총수익 벤치마크는 확보하지 못했다(`코스피 200`은 가격지수만 제공).
- Q-42 A안(권장)을 가정할 때의 잠정 비교군은 다음과 같다. 선정 기준은 수익률을 보기 전에 고정한다.
  - **사전 선정 추종 ETF:** 연구 시작일(첫 평가일) 기준 `IDX_IND_NM`이 `코스피 200`이고 직전 60거래일 평균 거래대금이 최대인 ETF를 매수 후 보유한다. 선정 시점·기준을 산출물에 기록한다.
  - **가격지수:** `코스피 200` 종가 수익률(참고 비교, 총수익 아님).
- Q-42가 B안이면 TR 지수 입력을 추가하고, C안이면 총수익 초과 표현을 쓰지 않는다. 어느 쪽이든 이 절만 수정하고 코드 경계는 `benchmark` 모듈로 분리한다.

## 8. 감사 기록

계획 9절의 최소 필드를 따른다. 예비 연구에 추가로 필요한 필드는 다음과 같다.

- 실행: `data_version`, `input_hash`, `evidence_grade`(가장 낮은 입력 등급), `available_at_assumption`.
- 제외·조정: `reason_code`는 `INSUFFICIENT_HISTORY`, `LOW_TURNOVER`, `TYPE_EXCLUDED`, `MISSING_FIELD`, `UNEXPLAINED_ADJUSTMENT`, `DISTRIBUTION_ESTIMATED`, `DELISTED_LIQUIDATION` 중 하나다.
- 모든 CLI 출력은 같은 입력·전략 버전·비용 모델이면 바이트 단위로 같아야 한다(타임스탬프는 `generated_at`에만 둔다).

## 9. 미해결 항목

| ID | 내용 | 영향 |
| --- | --- | --- |
| B1 | 분배금 공식 이력 | 4절 추정을 공시 표본과 대조하기 전에는 `estimated` 유지 |
| B2 | 총수익 벤치마크 | Q-42 |
| B3 | 유형·섹터 공식 분류 | 5절 4항·6절 그룹 키 대체 규칙 교체 |
| B4 | 가용 시각·정정 이력 | 3절 `available_at`은 가정 |
