# ETF 신호 MVP v2.2 — M4 예약·대시보드 작업 기록

> 작업일: 2026-09-21 KST
> 상태: 구현·정적 품질 게이트 완료, 외부 E2E 대기

## 완료

- 새 완전 KRX 스냅샷에만 신호와 Telegram을 이어 붙이는 일일 실행기와 GitHub Actions schedule/workflow_dispatch를 추가했다.
- 인증된 사용자 전용 `/protected`를 국내 신호 대시보드로 교체했다. UI는 SSR 인증 클라이언트와 RLS 읽기 정책만 사용한다.
- Cache Components 프리렌더 오류를 `instant = false`와 `connection()`으로 해결했고 production build를 통과했다.

## 검증

- Vitest 45개, TypeScript, ESLint, Prettier workflow 검사, production build 통과

## 다음 작업

- Telegram staging 키 설정 후 M3 `KOR-52` 실발송 E2E
- GitHub Actions production Environment Secret 등록·수동 실행
- 인증/비인증 브라우저 E2E와 RLS 결과 기록

비밀값·원문 응답은 기록하지 않는다. `supabase/.temp/`는 커밋하지 않는다.
