# ETF 신호 MVP v2.2 — M5-B staging E2E 준비 작업 기록

> 작업일: 2026-09-21 KST
> 상태: 보류 · staging Environment 삭제 및 US workflow 비활성화

## 결과

- 미국 ETF P1 workflow가 문서의 staging 전용 원칙과 달리 `production` Environment를 사용하던 불일치를 발견했다.
- `.github/workflows/us-etf-movers.yml`의 실행 Environment를 `staging`으로 고정하고, `production` 문자열이 다시 들어가면 실패하는 회귀 테스트를 추가했다.
- 로컬 `.env`의 `ENABLE_US_ETF_P1`은 `true`가 아니어서, 이번 점검 중 Kiwoom·Supabase·Telegram 외부 호출은 발생하지 않았다.

## 검증

- Node `22.23.2`: `npm test -- test/scripts/us-movers-command.test.ts` 통과 (1 파일, 1 테스트)
- GitHub CLI 인증 점검: keyring 기반 로그인과 조회 권한이 정상이다. `gh api`를 조회 명령과 같은 줄에 섞으면 sandbox에서 실행되어 실패하므로, 허용된 조회 명령과 분리해야 한다.
- GitHub Actions 조회: `US ETF movers (P1 experimental)`은 0회 실행이며 workflow 목록에서 비활성 상태다. `KR daily ETF signals`만 active다.

## 외부 상태

- GitHub 원격: `kwh8121/etf`
- 외부 workflow 실행·Supabase 쓰기·Telegram 전송은 수행하지 않았다.

## 차단·다음 작업

1. staging E2E는 보류한다. 삭제된 staging Environment와 비활성 US workflow를 승인 없이 복구하거나 활성화하지 않는다.
2. 재개가 결정되면 별도 staging Supabase·Telegram 테스트 수신처·Kiwoom 자격증명을 등록하고 `ENABLE_US_ETF_P1=true`의 존재 여부만 확인한다.
3. 그 뒤 `us-etf-movers.yml`을 수동으로 2회 실행해 복합 관측 중복·단일 US `signal_run`·P1 Telegram 1건을 확인하고, `false` 복귀 및 국내 P0 비간섭을 기록한다.
