# M4 예약 실행·인증 대시보드 구현 기록

> 상위 마일스톤: `ETF-signal-MVP-v2.2-ROADMAP.md`의 M4
> 작업일: 2026-09-21 KST
> 상태: 예약 워크플로와 읽기 전용 대시보드 구현 완료, 실제 GitHub Actions·인증 브라우저 E2E 대기

## 구현 결과

- `.github/workflows/kr-daily.yml`은 평일 19:15 KST(10:15 UTC)와 수동 `workflow_dispatch`를 제공한다. production Environment의 KRX·Kiwoom·Supabase·Telegram Secret만 주입한다.
- `scripts/run-kr-daily.ts`는 KRX 결과가 새 `TRADING_COMPLETE`일 때만 신호 생성과 Telegram 발송을 잇는다. 중복 스냅샷·휴장·공표 대기·부분 결과는 신호와 알림을 재실행하지 않는다.
- `/protected`는 기존 Supabase SSR 인증 클라이언트로 현재 사용자의 claims를 확인한 뒤, RLS가 적용된 `signal_run`과 `signal_daily`만 읽는다. 서비스 역할 키·수집 키는 UI 경로에서 사용하지 않는다.
- 대시보드는 최근 기준일·상태와 일간/5거래일 등락, 거래대금 급증, 신규 상장을 `raw`/`liquid` 구분으로 표시한다. 자동매매·매수/매도 추천이 아니라는 고지 문구를 표시한다.
- Next.js 16 Cache Components 환경에서는 `instant = false`와 `connection()`을 사용해 인증 쿠키·DB 조회를 요청 시점에 안전하게 렌더링한다.

## 검증

- 전체 Vitest 45개, `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과
- `.github/workflows/kr-daily.yml`은 Prettier 검사 통과
- 대시보드 표시 모델의 raw/liquid 분리와 수치 표기 단위 테스트 통과

## 남은 E2E

1. GitHub `production` Environment에 설정 가이드의 Secret을 등록한다.
2. `workflow_dispatch`로 staging 또는 production에서 한 번 실행한다. 새 KRX 완전 스냅샷이면 신호·Telegram까지, 그렇지 않으면 중복 없는 보류 결과만 남는지 확인한다.
3. 인증 사용자와 비인증 사용자가 각각 `/protected`에 접근해 로그인 이동·최근 신호 표시·RLS 거부를 확인한다.
4. Telegram 실발송 전에는 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`를 staging 수신처로 설정한다.

토큰, chat ID, API 원문, 서비스 역할 키는 Git·Linear·작업 기록에 남기지 않는다.
