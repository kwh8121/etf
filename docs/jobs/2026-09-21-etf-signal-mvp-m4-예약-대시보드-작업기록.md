# ETF 신호 MVP v2.2 — M4 예약·대시보드 작업 기록

> 작업일: 2026-09-21 KST
> 상태: 구현·정적 품질 게이트 완료, 외부 E2E 대기

## 완료

- 새 완전 KRX 스냅샷에만 신호와 Telegram을 이어 붙이는 일일 실행기와 GitHub Actions schedule/workflow_dispatch를 추가했다.
- 신호를 생성하지 않는 실행도 무음으로 끝나지 않도록, KRX·Kiwoom의 `FETCH_FAIL`·`PARTIAL`·`PUBLISH_PENDING`·휴장·중복 상태를 Telegram 상태 메시지로 구분해 전송하도록 보완했다. 신호 계산은 새 `TRADING_COMPLETE`에만 허용한다.
- 인증된 사용자 전용 `/protected`를 국내 신호 대시보드로 교체했다. UI는 SSR 인증 클라이언트와 RLS 읽기 정책만 사용한다.
- Cache Components 프리렌더 오류를 `instant = false`와 `connection()`으로 해결했고 production build를 통과했다.

## 검증

- 상태 분류 단위 테스트(6건)를 추가했다. 최신 전체 게이트는 Vitest 16개 파일·51개 테스트, TypeScript, ESLint, Prettier, production build, 연속성 점검까지 통과했다.
- 공개 키 익명 클라이언트는 `signal_run`을 읽지 못했고 0행만 반환했다. RLS 익명 차단을 확인했다.
- Supabase security advisor의 유일한 정보 항목은 비공개 원본 테이블 `source_snapshot`의 무정책 RLS이며 의도된 설계다.

## 다음 작업

- Telegram staging 키 설정 후 M3 `KOR-52` 실발송 E2E
- GitHub Actions production Environment Secret 등록·수동 실행
- 인증/비인증 브라우저 E2E와 RLS 결과 기록

비밀값·원문 응답은 기록하지 않는다. `supabase/.temp/`는 커밋하지 않는다.
