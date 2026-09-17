# 키움 REST API ETF 데이터 실측 검증 및 개선안

> 검증일: 2026-09-17 (KST)  
> 범위: 로컬 키움 명세, 운영 API `https://api.kiwoom.com`의 read-only 호출, [KRX ETF 리포트](krx_api_report.md)

## 결론

키움 REST API는 **현재 ETF/ETN 목록, 최근 일별 가격·NAV·거래량·거래대금, 장중 체결·NAV·수급**을 수집하는 기술적 원천으로 유효하다. `.env`의 키를 메모리에서만 사용해 운영 API를 호출한 결과, 토큰 발급과 ETF TR 9종 모두 `HTTP 200` 및 `return_code: 0`으로 응답했다. 키·토큰·원본 응답은 저장소나 이 문서에 저장하지 않았다.

반면 이 API만으로 특정 과거 기준일의 complete universe, ETF/ETN 구분, 레버리지·인버스 여부, 분배금 확정 이력은 증명할 수 없다. 현재 상장 ETF의 상장일은 아래 `ka10099`에서 확인할 수 있지만, 이는 과거 특정일의 membership 또는 상장폐지 이력을 대체하지 않는다. 현 시점 목록이나 현재 수집한 일별 데이터로 과거 투자 universe 또는 최종 선정 결과를 만들면 안 된다.

## 실측 방법과 판정 기준

`au10001`으로 Bearer 토큰을 발급한 후 ETF endpoint에 `api-id`와 토큰을 넣어 호출했다. 목록에서 실제 반환된 `153270`(KIWOOM 코스피100)을 대표 표본으로 사용했다.

다음 네 가지를 모두 충족하면 기술 검증 통과로 판정했다.

- 인증 endpoint가 200, Bearer token type, 만료 시각을 반환한다.
- 각 TR이 200 및 `return_code: 0`을 반환한다.
- 명세의 핵심 배열과 필드가 실제 응답에 있다.
- 연속 데이터는 `cont-yn: Y`와 비어 있지 않은 `next-key`를 함께 반환한다.

이는 접근 권한·응답 형식·대표 표본의 데이터 존재만 검증한다. 값의 경제적 의미나 과거 완결성까지 보장하지 않는다.

## 실제 데이터 확보 범위

### 전체 목록 (`ka40004`)

| 항목         | 실측 결과                                                      | 판정                                |
| ------------ | -------------------------------------------------------------- | ----------------------------------- |
| 인증         | HTTP 200, Bearer token, 만료 시각 존재                         | 통과                                |
| 페이지       | 앞 11페이지 각 100건, 마지막 12페이지 72건                     | 연속조회 필요                       |
| 총 목록      | 1,172행, 중복 `stk_cd` 0건, 마지막 `cont-yn: N`                | 현 시점 snapshot 가능               |
| 식별자       | 6자리 숫자 864건, 비숫자 식별자 308건                          | 숫자 코드만으로 universe 축소 금지  |
| 전 행 비공란 | `stk_cd`, `stk_cls`, `stk_nm`, `close_pric`, `trde_qty`, `nav` | 현재 시세 snapshot에 사용 가능      |
| 지수 정보    | `trace_idex_nm` 318건만 존재, `trace_idex_cd`는 전 행 공란     | 목록만으로 지수 코드 기반 분류 불가 |

고속 연속조회에서는 9번째 페이지에서 `HTTP 429`, `return_code: 5`, 허용 요청 수 초과(응답 메시지 유량=5)가 발생했다. 약 1.25초 간격으로 재시도하자 12페이지 전체가 정상 종결됐다. 따라서 cursor 보존, throttle, 429 backoff 없이는 목록을 신뢰성 있게 확보할 수 없다.

### 신규 상장 ETF 확인 (`ka10099`)

ETF 전용 TR에는 상장일이 없지만, 일반 종목정보 리스트 `ka10099`에 `mrkt_tp: "8"`(ETF)을 요청하면 현재 상장 ETF의 `regDay`(상장일, `YYYYMMDD`)를 받는다. 단일 종목은 `ka10100`의 같은 `regDay` 필드로 재확인할 수 있다.

운영 API 실측에서 `ka10099`는 `HTTP 200`, `return_code: 0`, `cont-yn: N`으로 1,172건을 한 번에 반환했다. 모든 행에 유효한 `regDay`가 있었고, 최저 상장일은 `20021014`, 최고 상장일은 `20260915`였다. 실제 응답에는 `code`, `name`, `regDay`, `marketCode`, `marketName`, `state`, `orderWarning`, `nxtEnable` 등이 포함됐다.

| 목적                           | 구현 방법                                                       | 유효 범위                               |
| ------------------------------ | --------------------------------------------------------------- | --------------------------------------- |
| 현재 신규 상장 ETF 찾기        | `ka10099(mrkt_tp=8)`의 `regDay >= 기준일` filter                | 아직 목록에 남아 있는 ETF의 상장일 기준 |
| 특정 ETF 상장일 재확인         | `ka10100(stk_cd)`의 `regDay` 대조                               | 현재 조회 가능한 개별 종목              |
| 일별 신규 편입 감지            | 매 영업일 `ka10099` snapshot의 `code` 집합을 전일과 차집합 비교 | snapshot 보관 시작 이후의 코드 추가     |
| 과거 상장/상장폐지 이력 재구성 | 별도 공식 historical master 사용                                | `ka10099` 현재 목록만으로는 불가        |

`regDay`는 **신규 상장일**이지 상품 출시 공시일·거래 개시 전 예정일·분배금 기준일이 아니다. 또한 과거 snapshot을 저장하지 않았다면, 오늘 응답만으로 언제 목록에 새로 편입됐는지나 상장폐지 종목을 역산할 수 없다.

### ETF TR 9종의 대표 표본 결과

| TR                     | 실제 배열/객체 | 연속조회 | 활용 가능성                  | 핵심 한계                         |
| ---------------------- | -------------- | -------- | ---------------------------- | --------------------------------- |
| `ka40001` 수익률       | 1행            | N        | 기간 성과·순매수 보조        | 분배금을 포함한 total return 아님 |
| `ka40002` 종목정보     | 단일 객체      | N        | 종목명·대상지수명·과세 정보  | ETF/ETN 구분·상장일 없음          |
| `ka40003` 일별추이     | 30행           | Y        | EOD 가격·NAV·거래량·거래대금 | 날짜 입력이 없어 page-back 필요   |
| `ka40004` 전체시세     | 100행          | Y        | 현재 종목·시세 snapshot      | historical universe 아님          |
| `ka40006` 시간대별추이 | 20행           | Y        | 장중 가격·NAV·거래대금       | 수집 시각 없이 EOD 증거 불가      |
| `ka40007` 시간대별체결 | 20행           | Y        | 장중 체결·거래소 분석        | 장기 일별 시계열 대체 불가        |
| `ka40008` 일자별체결   | 20행           | Y        | 누적거래량·외인/기관 순매수  | pagination provenance 필요        |
| `ka40009` 시간대별NAV  | 20행           | Y        | NAV·괴리율·추적오차          | 분배금·historical 분류 근거 아님  |
| `ka40010` 시간대별수급 | 100행          | Y        | 가격·거래량·외인 순매수      | 확정 일별 수급으로 해석 금지      |

`ka40003` 실제 행에는 `cntr_dt`, `cur_prc`, `trde_qty`, `nav`, `acc_trde_prica`, 괴리율·추적 관련 필드가 있었다. 가격·NAV·거래량·거래대금 수집 후보로는 유효하다. 그러나 `acc_trde_prica`의 명세는 “누적거래대금”이라면서 단위를 “1주”로 표기하므로, 통화 단위와 selection 적합성은 KRX `ACC_TRDVAL` 및 계산 검산으로 별도 확인해야 한다.

## 활용 가능성 및 유효성 경계

| 요구 데이터                                       | 현재 판정   | 이유                                                                   |
| ------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| 현 시점 전체 종목 snapshot                        | 가능        | 12페이지 1,172건을 중복 없이 종결 수집                                 |
| EOD 가격·NAV·거래량                               | 가능        | 목록 및 `ka40003`에서 실제 필드 확인; KRX 교차검증 필요                |
| 최근 일별 시계열                                  | 조건부 가능 | 30행/page와 다음 key 확인; cursor page-back 및 date coverage 검증 필요 |
| 장중 체결·NAV·수급                                | 조건부 가능 | 수집 시각·장 상태·거래소를 함께 저장해야 함                            |
| 과거 특정일 complete universe                     | 불가        | 목록 요청에 as-of 날짜가 없고 현재 snapshot만 제공                     |
| 현재 상장 ETF의 상장일·상장기간 filter            | 가능        | `ka10099(mrkt_tp=8)`의 `regDay`; 현재 목록에 남은 종목에 한정          |
| 과거 ETF/ETN·레버리지·인버스·상장기간 eligibility | 불가        | historical membership와 분류가 결속된 공식 master 필드 없음            |
| 분배금 및 total return                            | 불가        | 금액·분배락일·기준일·지급일을 제공하지 않음                            |

KRX는 [KRX ETF 리포트](krx_api_report.md)대로 동일 EOD의 종가·NAV·거래량·거래대금 교차검증에만 쓴다. 두 API의 식별자를 코드 자릿수나 이름만으로 추정 매핑하지 않는다.

## 개선안

### P0 — 재현 가능한 수집기

1. 토큰은 서버 메모리에 만료 전까지만 cache한다.
2. `ka40004`는 `cont-yn: N`까지 cursor를 이어 snapshot을 만들고, `(fetchedAt, request, page, nextKey 존재 여부, rowCount, SHA-256)`를 기록한다.
3. `ka40003`은 page-back하며 목표 기준일 행을 실제로 찾는다. 페이지 수만으로 date coverage를 주장하지 않는다.
4. API ID별 token bucket은 우선 `1 req / 1.25 s`로 시작하고, 429에서는 `Retry-After` 우선, 없으면 지수 backoff 후 같은 `next-key`로 재개한다.
5. raw bytes는 비공개 evidence storage에만 보관한다. Git에는 key 없는 metadata와 hash만 둔다.
6. 매 영업일 `ka10099(mrkt_tp=8)` snapshot을 저장하고, 전일 대비 새 `code`와 `regDay`를 신규 상장 후보로 기록한다.

### P0 — fail-closed 데이터 계약

다음 중 하나라도 실패하면 해당 종목·날짜를 결측으로 처리하고 ranking/signal에서 제외한다.

- HTTP 200과 `return_code: 0`
- `cont-yn: Y`일 때 `next-key` 존재
- 중복 없는 `stk_cd`, 비어 있지 않은 종목명·가격·거래량·NAV
- 유효한 `cntr_dt`, 유한 숫자로 파싱되는 가격·거래량·NAV·거래대금
- 요청 기준일과 응답 일자의 정확한 결속, 중복 `(ticker, date)` 거부

`trace_idex_cd`는 실측상 전 행 공란이므로 필수 지수 key로 쓰지 않는다. 지수 분류는 대상지수명과 발행사/거래소의 공식 master를 별도 수집하고 기준일과 원천을 보관한다.

### P1/P2 — 원천 역할 분리

- **키움:** 현재 snapshot, 일별 가격/NAV/거래량, 유동성 후보, 장중 관찰.
- **키움 `ka10099`/`ka10100`:** 현재 상장 ETF의 상장일 확인과 snapshot 이후 신규 상장 코드 감지.
- **KRX:** 키움 EOD 값의 독립 교차검증. KRX 거래대금으로 키움 원천을 임의 대체하지 않는다.
- **공식 historical master:** 과거 universe, ETF/ETN, 레버리지/인버스, 상장일, eligibility.
- **공식 분배금 원천:** 분배락일·기준일·지급일·금액·통화와 total-return 규칙.

이 네 범주가 같은 `signalAsOf`에 결속되기 전에는 “상위 30개”, “적격 ETF universe”, “total return”을 최종 산출하지 않는다.

## 수용 기준

| 우선순위 | 완료 기준                                                                                 |
| -------- | ----------------------------------------------------------------------------------------- |
| P0       | 12페이지 1,172행 snapshot을 중복 없이 재현하고 429 재시도 로그 보존                       |
| P0       | 목표 기준일의 `ka40003` 행 date binding·숫자 검증·cursor provenance·hash 기록             |
| P0       | 영업일별 `ka10099(mrkt_tp=8)` snapshot에서 `regDay`·새 `code`를 보존하고 전일 차이를 보고 |
| P0       | 공식 매핑이 있는 동일 종목/일자만 KRX와 price/NAV/volume/value 차이 보고                  |
| P1       | 장중 TR은 polling 시각·거래소·장 상태·cursor와 함께 EOD 테이블과 분리 저장                |
| P2       | historical master와 분배금 evidence가 갖춰질 때까지 final selection 잠금                  |

## 근거 및 정정

- 로컬 명세: [kiwoom-rest-api-spec.json](kiwoom-rest-api-spec.json)
- EOD 교차검증 범위: [krx_api_report.md](krx_api_report.md)
- 본 문서의 수치는 2026-09-17 KST 운영 API read-only 실측 결과다.

이 저장소에는 이전 보고서가 언급하던 `src/lib/etf/*`, `scripts/capture-*`, `docs/plan/gates/*` 경로가 존재하지 않는다. 따라서 해당 historical capture나 Gate 상태를 현재 검증 근거로 인용하지 않았으며, 본 문서는 현 저장소의 명세와 이번 운영 API 실측만을 근거로 한다.
