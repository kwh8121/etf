# ETF 신호 MVP v2.2 — M5-B staging E2E 준비 작업 기록

> 작업일: 2026-09-21 KST
> 상태: 로컬 E2E 완료(중복 관측 실측 미검증) · GitHub Actions 실행은 Kiwoom 허용 IP로 차단 · 상세는 문서 끝 "재개 결과" 참조

## 결과

- 미국 ETF P1 workflow가 문서의 staging 전용 원칙과 달리 `production` Environment를 사용하던 불일치를 발견했다.
- `.github/workflows/us-etf-movers.yml`의 실행 Environment를 `staging`으로 고정하고, `production` 문자열이 다시 들어가면 실패하는 회귀 테스트를 추가했다.
- 로컬 `.env`의 `ENABLE_US_ETF_P1`은 `true`가 아니어서, 이번 점검 중 Kiwoom·Supabase·Telegram 외부 호출은 발생하지 않았다.

## 검증

- Node `22.23.2`: `npm test -- test/scripts/us-movers-command.test.ts` 통과 (1 파일, 1 테스트)
- GitHub CLI 인증 점검: keyring 기반 로그인과 조회 권한이 정상이다.
- GitHub Actions 조회: `US ETF movers (P1 experimental)`은 0회 실행이며 workflow 목록에서 비활성 상태다. `KR daily ETF signals`만 active다.

## 원인 정정

1. 최초 `gh` 실패는 인증 불량이 아니었다. sandbox 안에서는 keyring 토큰과 네트워크를 사용할 수 없어 `gh`가 `hosts.yml`로 폴백했고, 그 결과의 `token invalid` 메시지를 인증 문제로 잘못 해석했다. 조회 허용 명령은 sandbox 밖에서 실행해야 하며, 변경 가능성이 있는 `gh api`를 같은 명령에 섞지 않는다.
2. staging E2E의 실제 선행조건도 준비되지 않았다. GitHub에는 production Environment만 있었고 staging Environment는 없었으며, 별도 staging Supabase 프로젝트·Telegram 테스트 chat 값도 없었다. 현재 `.env`는 production 값이므로 로컬 P1 E2E에 사용하지 않는다.

## 외부 상태

- GitHub 원격: `kwh8121/etf`
- 외부 workflow 실행·Supabase 쓰기·Telegram 전송은 수행하지 않았다.

## 차단·다음 작업

1. staging E2E는 보류한다. 삭제된 staging Environment와 비활성 US workflow를 승인 없이 복구하거나 활성화하지 않는다.
2. 재개가 결정되면 별도 staging Supabase·Telegram 테스트 수신처·Kiwoom 자격증명을 준비하고 staging Environment에 등록한다. 운영 DB를 사용하기로 바꾸는 경우에는 먼저 정본의 staging 경계를 변경한다.
3. workflow 활성화와 외부 호출 실행에 필요한 sandbox 밖 권한을 확보한 뒤, `us-etf-movers.yml`을 수동으로 2회 실행해 복합 관측 중복·단일 US `signal_run`·P1 Telegram 1건을 확인하고, `false` 복귀 및 국내 P0 비간섭을 기록한다.

## 재개 결과 (2026-09-21 17:40–18:30 KST, Claude Code)

### 결정

- staging 경계: 운영 Supabase(`market='US'` 격리) + 별도 Telegram 그룹 `ETF P1 staging`. 별도 Supabase 프로젝트는 만들지 않는다.
- 실행 위치: GitHub Actions가 Kiwoom을 호출하지 못해 등록 IP의 로컬 PC에서 E2E를 수행했다.

### 외부 상태 변경

- GitHub `staging` Environment 재생성: 변수 3개(`ENABLE_US_ETF_P1=false`, Supabase 공개 변수 2개), Secret 5개(Supabase service role, Kiwoom 2개, Telegram 봇 토큰, staging chat ID). Secret은 사용자가 스크립트로 등록했다.
- `US ETF movers (P1 experimental)` workflow 재활성화. 수동 실행 1회(`35579789075`)는 Kiwoom 토큰 발급 단계에서 실패했고 DB 쓰기는 없었다.
- 운영 Supabase: US `signal_run` 2건(`03d1d1cb…` 2,406행, `bb55f68a…` 2,415행), `source_snapshot` 2건, 원본 객체 2개. 중간 실패로 생긴 빈 실행 1건과 스냅샷·원본 객체는 사용자 승인 후 ID 지정 삭제했다.
- Telegram: staging 그룹으로 P1 보고 2회(각 10건) 전송. 운영 chat 전송은 없다.

### 검증

- 코드 수정 후 `npm test`(26 파일, 75 테스트), `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과.
- KR 비간섭: 최신 KR `signal_run`과 KR 실행 수가 E2E 전후 동일.
- 플래그 off 시 로컬 `ingest`·`report` 모두 `DISABLED`.

### 남은 과제

`docs/plans/implementation/M5-us-p1-adapter-plan.md`의 "남은 과제"를 따른다. Kiwoom 실행 위치 결정, 휴장 시간 중복 관측 실측, 저장 원자성, 보고 분량 결정이다.

## self-hosted runner 전환 (2026-09-21 18:50–, Claude Code)

### 결정

- Kiwoom 실행 위치: 등록 IP PC(WSL2)의 GitHub self-hosted runner. Vercel은 상주 runner를 둘 수 없고 Static IPs가 Pro 요금제에 프로젝트당 월 $100라 제외했다.

### 외부 상태 변경

- runner `kohdekt-wsl`(v2.337.0, label `kiwoom`)을 `~/actions-runner-etf`에 설치하고 systemd 사용자 서비스 `actions-runner-etf.service`로 등록했다. 릴리스 SHA-256을 대조했다.
- 저장소 fork PR workflow 승인 정책을 `first_time_contributors`에서 `all_external_contributors`로 강화했다.
- `us-etf-movers.yml`: `runs-on: [self-hosted, linux, x64, kiwoom]`, `NODE_OPTIONS` 추가, `cache: npm` 제거(`bfef5b4`, `a27d65e`).
- US 실행: 첫 실행(`35585826513`)은 `cache: npm` 후처리가 24GB `~/.npm`을 다루며 멈춰 취소했다. 수정 후 플래그 `false` 실행(`35587186201`) 성공, 플래그 `true` 실행(`35587346715`)에서 Kiwoom 수집·US 실행 `090b454e…` 저장·staging 보고 11건 성공. 실행 후 플래그 `false` 복귀.
- `kr-daily.yml`: 같은 전환을 적용했다. 오늘 19:15 KST 예약 실행이 20:18까지 시작되지 않아 전환을 푸시했다. runner에서 도는 첫 KR 운영 실행은 다음 예약 실행이다.

### 확인된 위험

- **예약 실행 이력 0건**: 저장소 전체에 `schedule` 이벤트 실행이 한 번도 없다. KR workflow는 2026-09-21 13:18 KST에 추가되어 오늘 19:15가 첫 예약이었으나 1시간 넘게 시작되지 않았다. GitHub는 부하가 높을 때 예약 실행을 지연하거나 누락할 수 있다. 다음 예약 실행(평일 07:30 US, 19:15 KR)이 실제로 시작되는지 확인해야 한다.

## 예약 실행 전환과 9/21 보충 (2026-09-22 08:45–09:10 KST, Claude Code)

### 관찰

- KR 9/21 19:15 GitHub 예약 실행은 9/22 01:27 KST에 runner에서 실행됐다(6시간 지연, `35625705875`). `kiwoomStatus: COMPLETE`로 runner 전환 후 첫 운영 Kiwoom 수집이 성공했다. 그러나 기준일이 실행 시점 KST 날짜(9/22)로 잡혀 `krxStatus: PUBLISH_PENDING`, 9/21 신호가 생성되지 않았고 운영 chat에 발행 대기 알림이 발송됐다.
- US 9/22 07:30 GitHub 예약 실행은 08:47까지 실행되지 않았다.

### 조치 (사용자 승인)

- 9/21 보충: `market_date=20260921` 수동 실행(`35669324094`)에서 `krxStatus: TRADING_COMPLETE`, `kiwoomStatus: COMPLETE`, `signalRunId: fff45e52…`, 운영 chat 보고 발송. 디스크 I/O 포화(PSI full 약 65%)로 checkout·`npm ci`가 느렸다.
- 예약 실행을 runner PC systemd timer로 대체(`481fdf0`): KR 월~금 19:15, US 화~토 07:30, `Persistent=true`, KR은 가장 최근 평일 19:15 슬롯 날짜를 `market_date`로 전달. 두 workflow에서 `schedule` 트리거를 제거했다.
- timer 경로 검증: `etf-us-movers-dispatch.service` 수동 실행 → US workflow(`35670349188`)가 runner에서 `DISABLED`로 성공. KR 디스패치의 첫 실행은 9/22 19:15 timer다.
- Windows 작업 스케줄러 `WSL Autostart (Ubuntu-24.04)`는 사용자가 등록했다(로그온 시 WSL 유지). runner도 `Ubuntu-24.04`에 있다.
- 테스트: 28 파일·86 테스트, tsc, lint 통과. 디스크 부하가 높을 때 `run-kr-daily.test.ts` 1건이 10초 시간 초과로 실패했다가 부하 감소 후 통과했다.
