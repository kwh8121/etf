# KRX Open API ETF 일별매매정보 실측 검증 및 개선안

> 검증일: 2026-09-17 (KST)  
> 범위: [`ETF 일별매매정보_Spec.docx`](ETF%20일별매매정보_Spec.docx)의 API 계약, 운영 API `https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd`의 read-only 호출, [키움 ETF 리포트](kiwoom_api_report.md)

## 결론

KRX ETF 일별매매정보 API는 기준일별 **종가·NAV·거래량·거래대금·순자산·시가총액·상장좌수·지수명**을 한 응답에서 확보하는 EOD 원천으로 기술적으로 유효하다. 최근 거래일과 약 3개월 전 거래일에서 1,140건 이상을 반환했고, 모든 행의 날짜와 핵심 숫자 필드가 요청일과 일치했다.

그러나 이 API는 유효하지 않은 달력 날짜와 비거래일에도 `HTTP 200` 및 비어 있지 않은 `OutBlock_1`을 반환한다. 이때 가격·NAV·거래량·거래대금 등 핵심 값은 전 행 공란이다. 따라서 HTTP 상태, JSON 파싱, 행 수만으로 수집 성공을 판정하면 잘못된 snapshot을 정상 데이터로 저장하게 된다.

이 endpoint는 키움의 EOD 가격·NAV·거래량·거래대금 교차검증과 기준일별 시장 snapshot에는 적합하다. 반면 분배금, total return, historical ETF eligibility, 키움 universe의 완전한 과거 membership을 확정하는 원천은 아니다.

## 실제 호출 방법과 성공 기준

`.env`의 `KRX_API_KEY`를 `AUTH_KEY` header에만 넣고 다음 read-only 요청을 실행했다.

```text
GET https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd?basDd=YYYYMMDD
```

키와 raw response는 출력·Git 저장·문서 기록을 하지 않았다. HTTP redirect도 허용하지 않고 응답을 확인했다.

성공은 다음을 모두 만족할 때만 정의한다.

- HTTP 200, JSON object, `OutBlock_1` 배열 존재
- 모든 행의 `BAS_DD`가 요청한 **유효한 달력 날짜**와 정확히 일치
- `ISU_CD`가 6자리 대문자 영숫자이고 중복 `(BAS_DD, ISU_CD)`가 없음
- `ISU_NM`, `TDD_CLSPRC`, `NAV`, `ACC_TRDVOL`, `ACC_TRDVAL`이 모든 행에서 비공란
- 위 숫자 필드가 쉼표를 제거한 뒤 유한한 음이 아닌 수로 파싱 가능

## 운영 API 실측 결과

| 요청 `basDd`                    | HTTP | 행 수 / 중복 없는 `ISU_CD` | 날짜 결속        | 핵심 EOD 필드                                          | 판정                  |
| ------------------------------- | ---- | -------------------------- | ---------------- | ------------------------------------------------------ | --------------------- |
| `20260916` (최근 완료 거래일)   | 200  | 1,171 / 1,171              | 전 행 `20260916` | 가격·NAV·거래량·거래대금·순자산 전 행 비공란·숫자 형식 | 유효                  |
| `20260619` (과거 거래일)        | 200  | 1,140 / 1,140              | 전 행 `20260619` | 같은 핵심 필드 전 행 비공란·숫자 형식                  | 유효                  |
| `20260717`                      | 200  | 1,146 / 1,146              | 전 행 `20260717` | 가격·NAV·거래량·거래대금·순자산 전 행 공란             | 무효/결측             |
| `20260913` (일요일)             | 200  | 1,168 / 1,168              | 전 행 `20260913` | 가격·NAV·거래량·거래대금·순자산 전 행 공란             | 무효/결측             |
| `20260230` (존재하지 않는 날짜) | 200  | 1,073 / 1,073              | 전 행 `20260230` | 가격·NAV·거래량·거래대금·순자산 전 행 공란             | 입력 검증 실패로 거부 |

두 유효 snapshot에서 수치형 코드가 각각 863건·871건, 영숫자 코드가 308건·269건이었다. 따라서 KRX `ISU_CD`는 6자리 **대문자 영숫자**로 검증해야 하며, 숫자 6자리만 허용하거나 키움 코드로 추정 변환해서는 안 된다.

응답은 redirect 없이 `application/json; charset=utf-8`이고 최상위 키는 `OutBlock_1` 하나였다. 현재 실측된 필드는 다음과 같다.

| 범주       | 실제 필드                                                                        |
| ---------- | -------------------------------------------------------------------------------- |
| 식별·날짜  | `BAS_DD`, `ISU_CD`, `ISU_NM`                                                     |
| 가격·등락  | `TDD_CLSPRC`, `CMPPREVDD_PRC`, `FLUC_RT`, `TDD_OPNPRC`, `TDD_HGPRC`, `TDD_LWPRC` |
| NAV·유동성 | `NAV`, `ACC_TRDVOL`, `ACC_TRDVAL`                                                |
| 규모       | `MKTCAP`, `INVSTASST_NETASST_TOTAMT`, `LIST_SHRS`                                |
| 추적지수   | `IDX_IND_NM`, `OBJ_STKPRC_IDX`, `CMPPREVDD_IDX`, `FLUC_RT_IDX`                   |

## 실제 확보 범위와 활용 경계

| 요구 데이터                     | 현재 판정           | 근거와 제한                                                                           |
| ------------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| 기준일 EOD 시장 snapshot        | 가능                | 두 거래일에서 1,140건 이상, 날짜 결속·필드 충족·숫자 형식 확인                        |
| 과거 날짜 조회                  | 조건부 가능         | 약 3개월 전 거래일을 실측했으나, 전체 제공 시작일과 모든 날짜의 completeness는 미검증 |
| 키움 EOD 값 교차검증            | 가능                | 동일 기준일·공식 mapping이 있는 종목에 한정해 가격/NAV/거래량/거래대금 대조           |
| 비거래일·오류 날짜 탐지         | API 응답만으로 불가 | 200/행 존재 상태로 빈 값 반환; 클라이언트의 달력·field completeness 검증 필요         |
| ETF/ETN historical universe     | 불가                | 날짜별 행은 listing master나 eligibility history를 제공하지 않음                      |
| 분배금·total return             | 불가                | 금액·분배락일·기준일·지급일·재투자 규칙이 없음                                        |
| 키움 ticker 대체 또는 추정 매핑 | 불가                | KRX 영숫자 코드가 실제 존재하며 동일성의 공식 근거가 필요                             |

## 개선안

### P0 — fail-closed 수집·검증기

1. `basDd`를 호출 전 엄격한 `YYYYMMDD` 달력 날짜로 검증한다. `20260230`처럼 형식만 맞는 날짜도 요청하지 않는다.
2. API 응답 후 모든 행이 요청일과 일치하는지, 중복 키가 없는지, 핵심 EOD 필드가 전 행 비공란인지 검증한다.
3. 숫자 문자열은 쉼표를 제거해 `BigInt` 또는 정밀 decimal로 파싱한다. 빈 문자열·`NaN`·음수 거래량/거래대금은 실패 처리한다.
4. 어느 하나라도 실패하면 snapshot을 저장·덮어쓰기·downstream ranking에 전달하지 않고 `incomplete_market_snapshot`으로 기록한다.
5. 성공시에만 `(endpoint, basDd, fetchedAt, rowCount, SHA-256, transformVersion)` metadata를 기록한다. raw bytes와 key는 비공개 evidence storage에만 둔다.

특히 `OutBlock_1.length > 0`은 성공 조건이 아니다. 이번 실측에서 비거래일·잘못된 날짜도 1,000행 이상을 반환했지만 핵심 시장 데이터는 0행이었다.

### P0 — 거래일과 교차검증 계약

- 수집 대상일은 거래일 calendar 또는 전일의 유효 KRX snapshot으로 결정한다. API의 HTTP 결과로 거래일을 추정하지 않는다.
- 키움과 KRX 비교는 같은 `BAS_DD`의 공식적으로 연결된 식별자만 허용한다.
- 가격·NAV·거래량·거래대금은 단위와 허용 오차를 별도 계약으로 선언한다. 불일치 행은 source/date/field/value를 남기고 자동 선택에서 제외한다.
- KRX `ACC_TRDVAL`은 교차검증 값이다. 키움 기반 selection source나 historical universe의 대체값으로 사용하지 않는다.

### P1/P2 — 원천 역할 분리

- **KRX:** 기준일별 EOD snapshot과 키움 데이터의 독립 대조.
- **키움:** 현재 snapshot, 일별·장중 가격/NAV/유동성 관찰. 상세 제약은 [키움 ETF 리포트](kiwoom_api_report.md)를 따른다.
- **공식 historical master:** ETF/ETN 상태, 상장일, 레버리지·인버스, 특정 기준일 membership과 eligibility.
- **공식 분배금 이력:** 분배금·분배락일·기준일·지급일·total-return 규칙.

역사적 master와 분배금 evidence가 같은 `signalAsOf`에 결속되기 전에는 KRX snapshot만으로 적격 universe, 상위 종목, total return을 산출하지 않는다.

## 수용 기준

| 우선순위 | 완료 기준                                                                                 |
| -------- | ----------------------------------------------------------------------------------------- |
| P0       | 유효 거래일은 모든 핵심 EOD 필드와 날짜 결속을 통과한 snapshot만 저장                     |
| P0       | 비거래일·`20260230` 같은 오류 날짜는 HTTP 200이어도 `incomplete_market_snapshot`으로 거부 |
| P0       | `(BAS_DD, ISU_CD)` 중복, 필수 필드 공란, 숫자 파싱 실패를 테스트로 고정                   |
| P0       | key 없는 metadata·hash·수집 시각·변환 버전을 보존하고 raw/key는 Git에서 배제              |
| P1       | 공식 매핑이 있는 동일 종목/일자만 키움과 EOD 값 비교, 차이 행 자동 제외                   |
| P2       | historical master와 분배금 원천 전까지 final selection 잠금                               |

## 근거 및 정정

- API 명세: [ETF 일별매매정보\_Spec.docx](ETF%20일별매매정보_Spec.docx)
- 키움 원천의 역할·제약: [kiwoom_api_report.md](kiwoom_api_report.md)
- 본 문서의 수치는 2026-09-17 KST 운영 API read-only 실측 결과다.

이 저장소에는 이전 보고서가 언급하던 `src/lib/etf/*`, `scripts/capture-*`, `docs/plan/gates/*` 경로가 존재하지 않는다. 따라서 이전 capture/backfill·Gate 상태를 현 저장소의 검증 근거로 인용하지 않았으며, 본 문서는 현재 보관된 명세와 이번 운영 API 실측으로 대체한다.
