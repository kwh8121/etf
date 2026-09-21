# ETF 신호 MVP v2.2 — M2 Kiwoom 수집 작업 기록

> 작업일: 2026-09-21 KST
> 범위: M2-04 OAuth·`ka10099` 마스터 수집, M2-05 `ka40004` 연속조회·429 재개
> 상태: 완료 — M2-06 영속화·멱등성으로 진행

## 구현 결과

- `lib/market-data/kiwoom.ts`에 Kiwoom `au10001` OAuth 토큰 발급과 ETF 전용 `ka10099(mrkt_tp="8")` 어댑터를 추가했다.
- 앱 키·비밀 키·발급 토큰은 요청 본문/헤더와 서버 메모리에서만 사용하며, 오류 메시지나 테스트 fixture에 기록하지 않는다.
- `return_code=0`, JSON content type, `code`, `name`, 실제 날짜인 `regDay`, 중복 코드, 연속 커서를 검증한다.
- 첫 운영 마스터 snapshot은 기준 코드 집합이 없으므로 전체 ETF를 신규 상장 이벤트로 만들지 않는 순수 계약을 추가했다.
- `lib/market-data/kiwoom-pagination.ts`에 `ka40004` 전체 ETF 시세의 페이지 수집을 추가했다. `cont-yn=N`에서 종료하고, 429는 `Retry-After` 및 1.25초 최소 간격을 지키면서 같은 `next-key`로 재시도한다.
- Next.js production build의 TypeScript CLI 설정 파싱 문제가 재현되어, TypeScript 5.9의 compiler API를 쓰도록 `experimental.useTypeScriptCli=false`를 설정했다. 타입 검사를 생략하거나 오류를 무시하지 않았으며 `npx tsc --noEmit`와 `next build` 모두 수행했다.

## 검증 증거

| 검증 | 결과 |
| --- | --- |
| Kiwoom 단위 테스트 | 2개 파일, 6개 테스트 통과 |
| 전체 Vitest | 7개 파일, 30개 테스트 통과 |
| TypeScript | `npx tsc --noEmit` 통과 |
| ESLint | `npm run lint` 통과 (경고 0) |
| production build | Node 22.23.2, `npm run build` 통과 |
| 연속성 하네스 | `npm run continuity:check` 및 `git diff --check` 통과 |

## 다음 작업: M2-06

1. service-role 전용 Supabase 클라이언트를 서버 경계에 추가한다.
2. KRX·Kiwoom 관측 메타데이터를 `source_snapshot`에 저장하고, KRX는 `trading_calendar_kr`·`etf_daily_kr`, Kiwoom은 `etf_master_kr`·`listing_event_kr`로 정규화 저장한다.
3. 같은 입력을 재실행해도 unique key/UPSERT 기준으로 중복 저장되지 않는 것을 실제 DB에서 검증한다.
4. 이후 M2-07의 25개 완전 거래일 backfill을 실행한다.

## 보안 원칙

- `.env`의 원문 값, OAuth token, KRX/Kiwoom 원본 응답, Supabase service-role key는 이 기록·Git·Linear에 남기지 않는다.
- `supabase/.temp/`는 CLI 로컬 상태이므로 커밋 대상이 아니다.
