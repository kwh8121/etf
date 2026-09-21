# ETF 신호 MVP v2.2 — M2 수집·영속화 작업 기록

> 작업일: 2026-09-21 KST
> 범위: M2-04 OAuth·`ka10099` 마스터 수집, M2-05 `ka40004` 연속조회·429 재개, M2-06 영속화·멱등성
> 상태: 완료 — 다음은 M2-07 25개 완전 거래일 backfill

## 구현 결과

- `lib/market-data/kiwoom.ts`에 Kiwoom `au10001` OAuth 토큰 발급과 ETF 전용 `ka10099(mrkt_tp="8")` 어댑터를 추가했다.
- 앱 키·비밀 키·발급 토큰은 요청 본문/헤더와 서버 메모리에서만 사용하며, 오류 메시지나 테스트 fixture에 기록하지 않는다.
- `return_code=0`, JSON content type, `code`, `name`, 실제 날짜인 `regDay`, 중복 코드, 연속 커서를 검증한다.
- 첫 운영 마스터 snapshot은 기준 코드 집합이 없으므로 전체 ETF를 신규 상장 이벤트로 만들지 않는 순수 계약을 추가했다.
- `lib/market-data/kiwoom-pagination.ts`에 `ka40004` 전체 ETF 시세의 페이지 수집을 추가했다. `cont-yn=N`에서 종료하고, 429는 `Retry-After` 및 1.25초 최소 간격을 지키면서 같은 `next-key`로 재시도한다.
- Next.js production build의 TypeScript CLI 설정 파싱 문제가 재현되어, TypeScript 5.9의 compiler API를 쓰도록 `experimental.useTypeScriptCli=false`를 설정했다. 타입 검사를 생략하거나 오류를 무시하지 않았으며 `npx tsc --noEmit`와 `next build` 모두 수행했다.
- `lib/supabase/service-role.ts`에 애플리케이션용 `server-only` 서비스 역할 클라이언트를 추가했다. CLI는 별도 서버 전용 코어를 사용하며 브라우저 번들 경로에는 서비스 역할 키가 없다.
- `lib/market-data/repository.ts`와 `scripts/ingest-kr.ts`로 KRX·Kiwoom 관측을 SHA-256 기준으로 추적하고 정규 테이블에 UPSERT한다. 원문은 private Storage 버킷에만 보관하며 로그·Git·Linear에는 남기지 않는다.
- `supabase/migrations/20260921110000_add_private_source_snapshot_bucket.sql`로 private `market-data-source-snapshots` 버킷을 선언·원격 적용했다.
- 실제 `npm run ingest:kr -- 20260916`를 두 번 실행했다. 첫 실행은 KRX 1,171행·Kiwoom 마스터 1,171행을 저장했고, 재실행은 두 원천 모두 `duplicate_observation`으로 처리했다. 초기 마스터 실행에서는 상장 이벤트를 만들지 않았다.

## 검증 증거

| 검증 | 결과 |
| --- | --- |
| Kiwoom 단위 테스트 | 2개 파일, 6개 테스트 통과 |
| 저장소 단위 테스트 | KRX 완전·부분·중복 관측, Kiwoom 초기/신규 상장 계약 3개 통과 |
| 전체 Vitest | 8개 파일, 33개 테스트 통과 |
| TypeScript | `npx tsc --noEmit` 통과 |
| ESLint | `npm run lint` 통과 (경고 0) |
| production build | Node 22.23.2, `npm run build` 통과 |
| 실제 Supabase E2E | KRX 관측 2(중복 1), 일별 행 1,171, `TRADING_COMPLETE` 달력 1, Kiwoom 관측 2(중복 1), 마스터 1,171, private 버킷 확인 |

## 다음 작업: M2-07

1. 최근 과거 구간을 역순으로 탐색하여 `TRADING_COMPLETE` 25개를 확보하는 `scripts/backfill.ts`를 구현한다.
2. 각 날짜가 `PARTIAL`·`PUBLISH_PENDING`·`NON_TRADING`이면 정규 일별 행 없이 관측만 남기고 다음 날짜로 진행한다.
3. 25개 달력 행·중복 없는 `(bas_dd, isu_cd)`·재실행 멱등성을 실제 DB에서 확인한다.

## 보안 원칙

- `.env`의 원문 값, OAuth token, KRX/Kiwoom 원본 응답, Supabase service-role key는 이 기록·Git·Linear에 남기지 않는다.
- `supabase/.temp/`는 CLI 로컬 상태이므로 커밋 대상이 아니다.
