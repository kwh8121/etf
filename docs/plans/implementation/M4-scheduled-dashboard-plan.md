# M4 예약 실행·인증 대시보드 구현 기록

> 상위 마일스톤: `ETF-signal-MVP-v2.2-ROADMAP.md`의 M4
> 작업일: 2026-09-21 ~ 2026-09-22 KST
> 상태: self-hosted runner·systemd timer 전환 완료 · 근무시간 제약으로 첫 KR timer 경로 검증 대기

## 구현 결과

- `.github/workflows/kr-daily.yml`은 Kiwoom 허용 IP가 등록된 self-hosted runner에서 수동 `workflow_dispatch`만 제공한다. GitHub `schedule`의 지연·누락을 피하기 위해 runner PC의 systemd timer가 평일 19:15 KST에 dispatch한다. 세부 운영 절차는 `docs/guides/etf-signal-mvp-e2e-configuration-guide.md` 4.3~4.4를 따른다.
- `scripts/run-kr-daily.ts`는 KRX 결과가 새 `TRADING_COMPLETE`일 때만 신호 생성과 신호 Telegram 보고를 잇는다. 중복 스냅샷·휴장·공표 대기·부분 결과에서는 신호를 재실행하지 않고, KRX·Kiwoom 상태를 Telegram 상태 메시지로 남긴다. `FETCH_FAIL`은 실패, `PARTIAL`은 부분 수집, `PUBLISH_PENDING`은 보류, 휴장·중복은 건너뜀으로 구분한다.
- `/protected`는 기존 Supabase SSR 인증 클라이언트로 현재 사용자의 claims를 확인한 뒤, RLS가 적용된 `signal_run`과 `signal_daily`만 읽는다. 서비스 역할 키·수집 키는 UI 경로에서 사용하지 않는다.
- 대시보드는 최근 기준일·상태와 일간/5거래일 등락, 거래대금 급증, 신규 상장을 `raw`/`liquid` 구분으로 표시한다. 자동매매·매수/매도 추천이 아니라는 고지 문구를 표시한다.
- Next.js 16 Cache Components 환경에서는 `instant = false`와 `connection()`을 사용해 인증 쿠키·DB 조회를 요청 시점에 안전하게 렌더링한다.

## 검증

- 전체 Vitest 45개, `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과
- `.github/workflows/kr-daily.yml`은 Prettier 검사 통과
- 대시보드 표시 모델의 raw/liquid 분리와 수치 표기 단위 테스트 통과
- 공개 키 익명 클라이언트의 `signal_run` 조회는 권한 오류·0행으로 끝났다. 익명 접근이 신호 데이터를 읽지 못함을 확인했다.
- Supabase 보안 권고의 유일한 정보 항목은 `source_snapshot`의 “RLS 활성화·정책 없음”이다. 이는 원본 스냅샷을 인증 사용자에게도 공개하지 않는 확정 설계와 일치하므로 정책을 추가하지 않는다.

## E2E 증거

1. GitHub `production` Environment Secret·Variable을 등록한 뒤 `workflow_dispatch` 재실행 `35564162887`이 성공했다. 중복 KRX 관측·Kiwoom `FETCH_FAIL`에서 신호 재실행 없이 Telegram 상태 알림 경로가 실행됐다.
2. 인증되지 않은 `/protected` 요청은 `/auth/login`으로 `307` 이동했다.
3. 인증된 Supabase 사용자로 `signal_run` RLS 조회는 200과 1행, `source_snapshot`은 200과 0행을 반환했다. 인증 사용자는 신호 데이터만 읽고 원본 스냅샷은 읽지 못한다.
4. R1 보완에서는 GitHub Actions 동시 실행을 단일 대기열로 제한하고, 대시보드가 `m3-price-movers-v1` 실행만 선택하도록 고정했다. 5거래일 가격수익률 고지는 UI와 Telegram 모두에 표시한다.
5. Kiwoom 허용 IP 제한으로 GitHub 호스팅 runner의 일일 수집이 실패한 것을 확인해, 등록 IP 회사 PC의 self-hosted runner로 전환했다. 2026-09-21 기준 보충 실행은 KRX·Kiwoom 수집과 Telegram 보고를 통과했다. 회사 PC는 근무시간에만 켤 수 있어 현 19:15 timer의 정시 발화를 전제할 수 없다. 첫 timer 경로의 정시 실행 또는 다음 기동 시 따라잡기 결과를 별도 확인한다.

토큰, chat ID, API 원문, 서비스 역할 키는 Git·Linear·작업 기록에 남기지 않는다.
