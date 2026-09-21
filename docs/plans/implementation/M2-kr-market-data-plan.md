# M2 국내 시장 데이터 구현 계획

> 상위 마일스톤: `ETF-signal-MVP-v2.2-ROADMAP.md`의 M2
> 선행 상태: M0–M1 로컬 구현 및 원격 Supabase 스키마·RLS 적용 완료.
> 상태: M2-01~05 완료. KRX 파서·완전성 계약·read-only probe, Kiwoom OAuth·`ka10099` 마스터 어댑터, `ka40004` 연속조회·429 동일 커서 재개를 구현·검증했다. 다음은 영속화 E2E(M2-06)다.

## 목표

KRX `etf_bydd_trd`를 국내 EOD의 권위 스냅샷으로 수집·검증하고, Kiwoom `ka10099`를 현재 ETF 마스터·신규 상장 원천으로 수집한다. 완전성에 실패한 데이터는 신호 생성이나 정규 테이블 저장으로 전달하지 않는다.

## 작업 순서

| ID | 결과 | 소유 파일 | 선행 조건 | 완료 증거 |
| --- | --- | --- | --- | --- |
| M2-01 | KRX 응답 타입·숫자 파서 | `lib/market-data/krx.ts`, fixture·테스트 | M0–M1 | 쉼표·부호·빈 값·영숫자 코드 테스트 |
| M2-02 | KRX 완전성 상태 판정 | `lib/market-data/krx-validation.ts`, 테스트 | M2-01 | 날짜·중복·필수값·98% 범위 테스트 |
| M2-03 | KRX read-only 클라이언트·probe | `lib/market-data/krx-client.ts`, `scripts/probe.ts` | M2-02, `KRX_API_KEY` | 유효 거래일 2개·비거래일 1개 마스킹 결과 |
| M2-04 | Kiwoom OAuth·`ka10099` 어댑터 | `lib/market-data/kiwoom.ts`, fixture·테스트 | Kiwoom 키 | 토큰 비로그·`regDay`·초기 스냅샷 계약 |
| M2-05 | `ka40004` 페이지·429 재개 | `lib/market-data/kiwoom-pagination.ts`, 테스트 | M2-04 | 같은 커서 재시도와 `cont-yn=N` 종료 |
| M2-06 | 스냅샷 저장·멱등성 | `lib/market-data/repository.ts`, `scripts/ingest-kr.ts` | Supabase URL·서비스 역할 키 | 실제 DB 적용·재실행 검증 |
| M2-07 | 25개 완전 거래일 backfill | `scripts/backfill.ts` | M2-06 | `TRADING_COMPLETE` 25일 또는 문서화된 예외 |

## 완료 기록: M2-04~05

2026-09-21 KST에 다음 계약을 테스트 우선으로 구현했다.

- `lib/market-data/kiwoom.ts`: `au10001` JSON OAuth 토큰 발급과 `ka10099(mrkt_tp="8")` 마스터 수집. Bearer/API-ID/연속조회 헤더를 고정하고, `return_code`, JSON 응답, 중복 코드, `code`·`name`·실제 달력일 `regDay`를 fail-closed 검증한다.
- 첫 마스터 관측은 기존 전 종목을 신규 상장으로 분류하지 않는다. 이전 코드 집합이 없을 때 신규 상장 후보는 빈 배열이어야 한다.
- `lib/market-data/kiwoom-pagination.ts`: `ka40004`를 `cont-yn=N`까지 수집하며, 페이지 간 최소 1.25초 간격을 둔다. HTTP 429에서는 `Retry-After`와 최소 간격 중 긴 시간만큼 대기한 뒤 동일 `next-key`로 재개한다.
- `test/market-data/kiwoom.test.ts`, `test/market-data/kiwoom-pagination.test.ts`로 OAuth 요청 비밀 비노출, 헤더·payload, 잘못된 `regDay`, 누락 커서, 429 동일 커서 재개, 초기 스냅샷 계약을 검증했다.

## KRX 상태 계약

| 상태 | 조건 | 후속 처리 |
| --- | --- | --- |
| `TRADING_COMPLETE` | 유효 날짜, 날짜 일치, 중복 0, 필수 필드 100%, 직전 완전 스냅샷 대비 행 수 98% 이상 | 저장·달력 `seq` 부여·신호 계산 가능 |
| `NON_TRADING` | 검증된 비거래일이고 핵심 값이 전 행 비어 있음 | 메타데이터만 저장, `seq` 없음 |
| `PUBLISH_PENDING` | 현재 목표일 공표 전으로 판단 | 재시도, 신호 계산 금지 |
| `PARTIAL` | 유효 날짜이나 완전성·포괄 범위 미달 | 메타데이터만 저장, 신호 계산 금지 |
| `FETCH_FAIL` | 인증·HTTP·JSON·계약 오류 | 재시도·실패 기록 |

## 필수 RED 사례

- `20260230`은 HTTP 요청 전에 거부한다.
- `OutBlock_1`만 존재하고 핵심 값이 비어 있으면 `TRADING_COMPLETE`가 아니다.
- 응답 행 `BAS_DD`가 요청일과 다르면 차단한다.
- 동일 `(BAS_DD, ISU_CD)`가 두 번이면 차단한다.
- `ISU_CD`는 숫자만이 아니라 6자리 대문자 영숫자를 허용한다.
- 직전 완전 스냅샷의 98%보다 행 수가 작으면 `PARTIAL`이다.
- `ka10099` 첫 운영 실행은 모든 기존 종목을 신규 상장 이벤트로 만들지 않는다.
- `ka40004` 429는 같은 `next-key`로 제한 시간 후 재개한다.

## 보안·관측 계약

- `AUTH_KEY`, Kiwoom OAuth token, 앱 키와 비밀 키는 요청 헤더·메모리에서만 사용한다.
- raw 응답 전문은 Git, 로그, Linear, 클라이언트 번들에 남기지 않는다.
- 관측마다 API ID, 요청일, 행 수, 페이지 수, SHA-256, 변환 버전, 마스킹된 오류 코드만 기록한다.
- KRX와 Kiwoom 코드가 숫자 형태라는 이유로 조인하거나 변환하지 않는다.

## M2 완료 게이트

```bash
npm test -- test/market-data
npm test
npx tsc --noEmit
npm run lint
npm run build
```

추가 E2E 증거:

- KRX 유효 거래일 2개·비거래일 1개 read-only probe
- 실제 Supabase 마이그레이션 적용 및 RLS 확인
- `ingest-kr` 재실행 멱등성
- 25개 완전 거래일 backfill 또는 문서화된 예외

## 초기 검증 기록

2026-09-18 KST에 비밀정보와 원문 응답을 출력하지 않는 read-only probe를 실행했다.

| 원천 | 요청 | 결과 |
| --- | --- | --- |
| KRX | `etf_bydd_trd?basDd=20260916` | HTTP 200, 1,171행, 전 행 날짜 일치, 필수 필드 완전 |
| KRX | `etf_bydd_trd?basDd=20260619` | HTTP 200, 1,140행, 전 행 날짜 일치, 핵심 필드 비공란 |
| KRX | `etf_bydd_trd?basDd=20260913` | HTTP 200, 1,168행, 전 행 날짜 일치, 핵심 필드 전 행 공란 — `NON_TRADING` 근거 |
| Kiwoom | `au10001` → `ka10099(mrkt_tp=8)` | 토큰 HTTP 200, 마스터 HTTP 200, `return_code=0`, `cont-yn=N`, 1,171행, 모든 `regDay`가 `YYYYMMDD` 형식 |

이 결과는 접근성과 응답 계약의 증거일 뿐, 저장·멱등성·RLS·25거래일 backfill 완료 증거는 아니다.
