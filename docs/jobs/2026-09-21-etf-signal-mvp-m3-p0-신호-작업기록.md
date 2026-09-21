# ETF 신호 MVP v2.2 — M3 P0 신호 작업 기록

> 작업일: 2026-09-21 KST
> 상태: P0 계산·저장·비발송 Telegram 보고서 완료, Telegram 실발송 E2E 대기

## 완료한 작업

- 국내 일간·5거래일 상승/하락 `raw`·`liquid` 결과를 계산하고 `signal_run`·`signal_daily`에 멱등 저장했다.
- 20거래일 평균 대비 3배 이상 거래대금 급증과 초기 마스터·기발송 이벤트를 제외한 신규 상장 후보 계산을 추가했다.
- Telegram 분할 포매터와 전송 함수를 추가했다. 모든 분할 메시지에 시장·기준일·원천·실행 ID·상태와 비추천 고지 문구를 보존한다.
- 최신 KRX 거래일을 `seq` 최대값으로 선택하던 오류를 발견했다. 과거 역순 백필에도 날짜 순 `seq`를 보장하도록 수집 저장 경로를 보정했고, 기존 원격 25개 거래일은 날짜 순 `1..25`로 재정렬했다.

## 증거

- 전체 Vitest: 14개 파일, 44개 테스트 통과
- `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과
- 실제 Supabase에서 `2026-09-18` 실행을 두 번 수행: 동일 실행 ID, `signal_run` 1건, 가격 신호 80건 유지
- `npm run report:kr-signals`: 비발송 보고서 1개 생성

## 보류·다음 작업

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` 설정 뒤 staging 대화에서 `npm run report:kr-signals -- --send`를 한 번 수행한다.
- 발송 성공 뒤 M3의 실발송 E2E를 마감하고, M4 예약 실행·인증 대시보드로 진행한다.

## 보안

토큰, chat ID, service-role key, 원본 API 응답은 이 기록·Git·Linear에 기록하지 않는다. `supabase/.temp/`는 로컬 CLI 상태이므로 커밋하지 않는다.
