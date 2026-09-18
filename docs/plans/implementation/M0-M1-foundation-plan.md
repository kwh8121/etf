# M0–M1 기반 구축 구현 계획

> 상위 마일스톤: `ETF-signal-MVP-v2.2-ROADMAP.md`의 M0, M1
> 상태: 완료 — Supabase 원격 적용·RLS 검증 완료
> Linear: [`ETF 일일 신호 시스템 MVP v2.2`](https://linear.app/koreatimes/project/etf-일일-신호-시스템-mvp-v22-7eb5f1754b76)에 M0–M6, R1, R2 마일스톤과 M0–M2 현재 이슈를 구성했다. 로컬 구현의 정본은 Git과 이 문서다.

## 목표 결과

국내 ETF 데이터 수집 기능을 안전하게 시작할 수 있도록 테스트 실행 명령, 민감정보 경계, KRX 요청일 검증, Supabase 핵심 스키마 및 읽기 RLS 계약을 제공한다.

## 비목표

- 실제 KRX/Kiwoom HTTP 호출과 수집기는 M2에서 구현한다.
- 실제 Supabase 프로젝트에 마이그레이션을 적용하지 않는다. 연결 정보와 승인된 실행 환경이 준비된 뒤 별도 E2E 검증한다.
- P0 신호, Telegram, 예약 워크플로, UI는 구현하지 않는다.

## 작업 순서

| ID | 작업 | 소유 파일 | RED 증거 | 완료 증거 |
| --- | --- | --- | --- | --- |
| FND-01 | Vitest Node 테스트 하네스 | `package.json`, `vitest.config.mts` | 첫 테스트 실행 실패 | `npm test` 통과 |
| FND-02 | 서버 환경변수 계약과 마스킹 | `lib/config/server-env.ts`, `test/config/server-env.test.ts` | 누락 비밀값·마스킹 테스트 실패 | 대상 테스트 통과 |
| FND-03 | KRX 요청일 사전 검증 | `lib/market-data/krx-date.ts`, `test/market-data/krx-date.test.ts` | 잘못된 날짜 거부 테스트 실패 | 잘못된 날짜가 HTTP 호출 전에 거부됨 |
| FND-04 | 핵심 데이터 스키마와 RLS | `supabase/migrations/20260918080411_market_data_foundation.sql`, `test/database/schema-migration.test.ts` | 테이블·키·정책 계약 테스트 실패 | 정적 스키마 계약 통과 |
| FND-05 | fixture 안전 규칙 | `test/fixtures/README.md` | 문서 검토 | 비밀정보·원본 응답 금지 명시 |

## 계약

- KRX 요청일은 `YYYYMMDD` 형식의 실제 Gregorian 달력 날짜여야 한다. 유효하지 않으면 호출자에게 전달하기 전에 오류를 낸다.
- `source_snapshot.observation_key`는 고유하고, 콘텐츠 해시는 반복 관측을 허용한다.
- `signal_daily`의 기본 키는 `screen`을 포함해 `raw`와 `liquid` 결과가 공존한다.
- `source_snapshot`은 인증 사용자에게 공개하지 않는다. 인증된 대시보드는 일별 ETF, 마스터, 상장 이벤트, 실행과 신호 결과만 읽는다.
- 서비스 역할 키·Kiwoom·KRX·Telegram 비밀정보는 서버 실행 경로에서만 읽고 마스킹된 형태 외에는 로그로 보내지 않는다.

## 검증 게이트

```bash
npm test
npm run lint
npm run build
```

`npm run build`가 코드와 무관한 Google Fonts 네트워크 장애로 실패하면 오류 출력과 실행 환경을 기록하고, 네트워크가 가능한 환경에서 재검증한다.

## 후속 조건

M2 착수 전 실제 Supabase 프로젝트에 마이그레이션을 적용해 RLS와 제약을 검증하고, KRX/Kiwoom fixture 계약을 확정한다.

## 검증 기록

| 항목 | 결과 | 증거 또는 제한 |
| --- | --- | --- |
| Vitest | 통과 | 5개 테스트 파일, 24개 테스트 통과 |
| TypeScript | 통과 | `npx tsc --noEmit` 종료 코드 0 |
| ESLint | 통과 | `npm run lint` 종료 코드 0 |
| production build | 통과 | Node `22.23.2`에서 공식 Webpack 경로(`next build --webpack`)로 실행한 `npm run build` 종료 코드 0 |
| 실제 Supabase 적용 | 통과 | 원격 ETF 프로젝트에 핵심 스키마·함수 권한 회수·외래 키 인덱스 migration 3건을 적용하고 테이블·RLS·정책을 재검증 |
| Linear 프로젝트·마일스톤·초기 이슈 생성 | 통과 | 프로젝트·M0–M6·R1·R2와 `KOR-46`~`KOR-51`을 생성했고, M0–M1 이슈를 완료 처리 |
