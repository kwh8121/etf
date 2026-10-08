# 2026-10-08 KR daily 관측

> 작업일: 2026-10-08 KST
> 상태: 완료(확정 누적 7/20)

## 결과

- 2026-10-07 09:30 KST KR daily run `37552295623`(기준일 2026-10-06)과 2026-10-08 09:30 KST run `37708092789`(기준일 2026-10-07)이 모두 성공했고, 자동 검증 `kr-verify` run `37552563962`·`37708430380`도 성공했다.
- 운영 DB 읽기 전용 대조(`npm run verify:kr-candidate`, Node 22.23.2): 두 기준일 모두 `ok:true`, `COMPLETED`, `kr_full_signal_complete=true`, 고정 P0 8유형 각 10건, run·보고 표식 각 1건, `TRADING_COMPLETE`.
  - 2026-10-06: run `181dab56-…`, 80행.
  - 2026-10-07: run `97182674-…`, 81행(`new_listing:raw` 1건은 가변 신호).
- Telegram 실수신은 사용자가 확인했다.

## 검증

- `npm run continuity:check`: 통과(세션 시작 시점).
- 로컬 기본 Node 24는 실행 옵션 불일치로 실패하므로 `nvm use`(22.23.2)로 실행해야 한다.

## 다음 작업

- 사용자(2026-10-08)가 두 기준일의 운영 Telegram 실수신을 확인했다("수신함"). 확정 누적을 **7/20**으로 승격했다.

1. 다음 KR timer 실행(2026-10-09는 휴장일, 10-12 이후) 뒤 기준일 2026-10-08의 run·검증·DB·Telegram 실수신을 대조한다.

## KR 신호 웹 열람 경로 구현 (Q-15 승인 · Q-16 완료)

> 상태: 구현 완료·검증 통과. 배포(Q-17)는 승인 대기.

- 배경: Telegram 평문 보고는 섹션 제목이 한두 글자만 달라 구분이 안 되고 상승·하락 표시가 부호뿐이며 80행이 메시지 2개 이상으로 나뉜다. 웹 대시보드는 M4에서 이미 구현돼 있었으나 배포·링크·방향 색이 없었다.
- 결정(사용자): Vercel 배포 + Supabase 로그인, Telegram은 링크 한 줄만(M6 7/20 진행 중이라 본문 불변), 기준일 라우트 + 방향 대비(A안), 상승 적색·하락 청색, 날짜 피커 대신 전·후 거래일 이동.
- 산출: 사양서 `docs/plans/implementation/kr-signal-web-view-design.md`, 구현 계획 `docs/plans/implementation/kr-signal-web-view-plan.md`, 구현 커밋 `de1a2f4`..`e5b01b6`.
- 최종 리뷰에서 나온 중요 발견(코드가 아니라 배포·승인 범위): ① `.github/workflows/kr-daily.yml` job `env:`에 `ETF_WEB_BASE_URL` 매핑이 없어 사양서대로 GitHub 변수만 만들면 링크가 영원히 붙지 않고 오류도 없다 → Q-17 승인 범위 ④로 추가. ② `/auth/sign-up`이 열려 있고 RLS가 `authenticated using (true)`라 가입자 누구나 신호를 읽을 수 있다 → 배포 전 가입 차단이 Q-17 승인 범위 ③. 호스팅 Supabase의 가입 설정값은 저장소에서 확인할 수 없다.
- 운영 영향 없음 확인: `ETF_WEB_BASE_URL`이 없으면 Telegram 출력이 변경 전과 바이트 동일하다(변경 전후 비교, 구 헤더 리터럴 테스트, 변이 2종 실패 확인, 운영 DB 기준일 2026-10-07 읽기 전용 실행에서 4경우 모두 1메시지). `.github/workflows/`와 `lib/notifications/telegram.ts` 본문은 이번 작업에서 바꾸지 않았다.

### 검증

- `npm test` 37파일·159테스트, `npx tsc --noEmit`, `npm run lint`, `npm run build`: 통과(Node 22.23.2).
- 미인증 `next start` smoke: 세 경로 모두 307 → `/auth/login`, 본문 데이터 0건.
- 독립 리뷰: 태스크 묶음별 5회, 전체 브랜치 최종 리뷰 1회(`Approved with required fixes`) 후 필수 수정 8건 반영, 재리뷰 통과(`merge-ready: yes`).
- 작업 중 `pkill -f "next start"`가 명령 문자열에 같은 문구가 있는 자기 셸을 종료했다(exit 144). 서버는 포트로 PID를 찾아 정리했고 서버 잔존 없음을 확인했다.

### 다음 작업

1. Q-17(`APPROVE`): Vercel 배포·가입 차단·워크플로 env 매핑·`ETF_WEB_BASE_URL` 설정. 순서와 주의는 `docs/plans/NEXT.md` Q-17.
2. Q-08: 다음 KR 거래일 결과를 대조해 확정 누적(7/20)을 이어간다.
