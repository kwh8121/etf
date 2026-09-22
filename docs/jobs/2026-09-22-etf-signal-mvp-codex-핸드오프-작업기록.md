# ETF 신호 MVP — Claude Code → Codex 핸드오프 작업 기록

> 작업일: 2026-09-21 ~ 2026-09-22 KST (Claude Code 세션)
> 상태: 진행 중 · 운영 자동 실행(9/22 19:15 KR timer) 첫 검증 대기
> 기준 커밋: `c978b7b` (`main`, `origin/main`과 동일)

## 먼저 읽을 것

1. 이 문서
2. `docs/plans/implementation/M5-us-p1-adapter-plan.md`: staging 경계 결정, E2E 결과, 발견·수정 결함, 남은 과제
3. `docs/guides/etf-signal-mvp-e2e-configuration-guide.md`: 4.3 self-hosted runner, 4.4 systemd timer 예약 실행, 5.1 US P1 E2E
4. `docs/jobs/2026-09-21-etf-signal-mvp-m5-b-staging-readiness-작업기록.md`: 시간순 상세 기록과 실행 ID

## 현재 상태 (2026-09-22 09:20 KST 확인)

| 대상                         | 상태                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git                          | `main` = `origin/main` = `c978b7b`. 미추적 `supabase/.temp/`만 있음(사용자 로컬 파일, 커밋하지 않음)                                                          |
| Kiwoom workflow 2개          | `kr-daily.yml`, `us-etf-movers.yml` 모두 `schedule` 없음, `workflow_dispatch` 전용, `runs-on: [self-hosted, linux, x64, kiwoom]`                              |
| self-hosted runner           | `kohdekt-wsl` 온라인, WSL `Ubuntu-24.04`, systemd 사용자 서비스 `actions-runner-etf.service`                                                                  |
| 예약 실행                    | systemd 사용자 timer `etf-kr-daily-dispatch.timer`(월~금 19:15 KST), `etf-us-movers-dispatch.timer`(화~토 07:30 KST). 다음 실행: KR 9/22 19:15, US 9/23 07:30 |
| GitHub `staging` Environment | `ENABLE_US_ETF_P1=false`, 공개 변수 2개, Secret 5개                                                                                                           |
| 운영 DB(Supabase)            | KR `signal_run` 4건(최신 `fff45e52…`, `market_date=2026-09-21`, COMPLETED), US `signal_run` 3건·신호 7,358행·`source_snapshot` 3건                            |
| Linear / OpenViking          | 핸드오프 세션에서는 갱신하지 못했으나, Codex가 9/22에 KOR-53·KOR-55 상태 요약과 OpenViking 재개 메모리를 동기화함                                             |

## 이번 세션 결과

1. **Codex `gh` 실패 원인 규명·해소**: 토큰 무효가 아니었다. `gh` 토큰은 gnome-keyring에 있고 Codex sandbox 안에서는 keyring·네트워크를 쓸 수 없어 `hosts.yml`로 폴백하며 `token invalid`를 출력했다. `~/.codex/rules/default.rules`에 조회용 `gh` allow 규칙 7개를 추가해 sandbox 밖에서 실행되게 했다(`codex exec`로 검증).
2. **US P1 staging 경계 결정(사용자)**: 운영 Supabase(`market='US'` 격리) + 별도 Telegram 그룹 `ETF P1 staging`. 별도 Supabase 프로젝트는 만들지 않는다. KR 경로가 US 행을 읽지 않는 근거는 계획서에 있다.
3. **US P1 결함 2건 수정(`8ae0221`)**:
   - `usa20931` 응답에는 `rank`가 없어 모든 행이 malformed로 거부됐다 → 응답 순서(5일 하락률 정렬, 역전 0건 확인)를 순위로 사용.
   - Kiwoom 순위 목록의 같은 종목 반복(페이지 경계 중복 등)으로 `signal_daily` upsert가 같은 PK를 두 번 갱신해 실패 → 신호 유형별 종목당 최고 순위 1행 유지.
4. **Kiwoom 허용 IP 문제 → self-hosted runner(`bfef5b4`, `a27d65e`, `02e6c09`)**: Kiwoom은 등록 IP에서만 토큰을 발급해 GitHub 호스팅 러너에서는 KR daily도 매일 `kiwoomStatus: FETCH_FAIL`이었다. 등록 IP PC에 runner를 설치하고 두 workflow를 옮겼다. `setup-node`의 `cache: npm`은 사용자 전체 `~/.npm`(24GB)을 다루며 멈춰 제거했다. 한국→Telegram 연결이 node 기본 연결 시도 제한(250ms)을 넘어 `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=2000`을 workflow에 넣었다.
5. **GitHub 예약 실행 → systemd timer(`481fdf0`)**: GitHub `schedule`에서 KR 9/21 19:15 예약이 9/22 01:27에 실행(6시간 지연)되어 기준일이 9/22로 잡혔고(`PUBLISH_PENDING`, 9/21 신호 미생성), US 9/22 07:30 예약은 실행되지 않았다. `scripts/dispatch-scheduled-workflow.ts`가 KR에 "가장 최근 평일 19:15 KST 슬롯 날짜"를 `market_date`로 넘긴다. timer는 `Persistent=true`로 놓친 실행을 기동 후 따라잡는다.
6. **9/21 KR 보충(사용자 승인)**: `market_date=20260921` 수동 실행에서 `krxStatus: TRADING_COMPLETE`, `kiwoomStatus: COMPLETE`, 운영 chat 보고 발송. runner 전환 후 KRX·Kiwoom 모두 정상인 첫 운영 실행이다.

## 커밋 (`940726a` 이후)

| 커밋                                                             | 작성   | 내용                                                         |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------------ |
| `6c63665`, `fbd8d61`, `94a1cfd`, `424c46e`, `850df72`, `1193a73` | Codex  | Linear 하네스, US P1 어댑터, staging 경계 고정, 보류 기록    |
| `8ae0221`                                                        | Claude | US P1 Kiwoom 순위 파싱 결함 2건 수정                         |
| `423025e`                                                        | Claude | 로컬 E2E 결과·staging 경계 결정 문서                         |
| `bfef5b4`, `a27d65e`                                             | Claude | US workflow self-hosted 전환, `cache: npm` 제거              |
| `02e6c09`, `26da940`                                             | Claude | KR workflow self-hosted 전환, runner 운영 문서(가이드 4.3)   |
| `481fdf0`, `c978b7b`                                             | Claude | systemd timer 디스패치, 예약 전환·9/21 보충 문서(가이드 4.4) |

## Codex 실행 환경 주의

- **`gh`**: 조회 명령(`gh auth status`, `gh run list/view/watch`, `gh workflow list/view`, `gh pr list/view/diff/status/checks`, `gh issue list/view`, `gh repo view`)은 allow 규칙으로 sandbox 밖에서 실행된다. **단독으로 실행**해야 한다. `gh api` 같은 규칙 밖 명령을 `;`·`&&`·`|`로 섞으면 전체가 sandbox에서 실행되어 다시 `token invalid`가 나온다. 재인증은 필요 없다.
- `gh workflow run`, `gh api`, `gh variable/secret set`은 규칙에 없으므로 escalation 승인이 필요하다.
- Kiwoom·Supabase·Telegram을 호출하는 로컬 명령은 sandbox 네트워크 차단에 걸린다. 외부 부작용이 있으므로 사용자 승인 후 escalation으로만 실행한다.
- 로컬 `.env`는 **운영 값**이다(운영 Supabase·운영 Telegram chat).
- **운영 KR 수동 실행은 운영 Telegram chat 발송이 따른다.** 사용자 승인 없이 실행하지 않는다. 수동 실행 시에는 반드시 `-f market_date=YYYYMMDD`를 준다(`scripts/run-kr-daily.ts`는 입력이 없으면 실행 시점 KST 날짜를 쓴다).
- **US `ENABLE_US_ETF_P1=true` 전환**은 Kiwoom 호출·운영 DB 쓰기·staging 그룹 발송(보고 10~11건)을 일으킨다. 승인 후 수행하고 끝나면 `false`로 되돌린다.
- GitHub Secret 등록은 사용자가 직접 한다(에이전트 도구의 Secret 저장소 쓰기가 차단됨).
- 로컬에서 Telegram으로 보낼 때는 `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=2000`이 필요하다.

## 외부 상태

- **GitHub** `kwh8121/etf`
  - runner `kohdekt-wsl`(v2.337.0, label `kiwoom`)
  - Environment `production`(변경 없음), `staging`(재생성)
  - fork PR workflow 승인 정책 `all_external_contributors`(기존 `first_time_contributors`)
  - 주요 실행: US runner 검증 `35587186201`(DISABLED)·`35587346715`(Kiwoom·저장·staging 보고 성공), KR 지연 예약 `35625705875`(PUBLISH_PENDING), KR 보충 `35669324094`(TRADING_COMPLETE), timer 경로 검증 `35670349188`(US DISABLED)
- **Supabase 운영 DB**
  - US `signal_run`: `03d1d1cb…`, `bb55f68a…`(로컬 E2E), `090b454e…`(runner E2E)
  - KR `signal_run`: `fff45e52…`(9/21 보충)
  - 사용자 승인 후 삭제: 실패 실행이 남긴 US `signal_run` `ccf5a96a…`, `source_snapshot` `7688523e…`, 원본 객체 1개
- **Telegram**: staging 그룹 `ETF P1 staging`(chat ID는 staging Secret에만 있음)으로 P1 보고 3회. 운영 chat에는 9/22 01:28 발행 대기 알림과 9/21 보충 보고가 발송됨
- **runner PC**
  - `~/actions-runner-etf`(권한 700), 서비스 `actions-runner-etf.service`
  - timer·서비스 unit 원본 `ops/systemd/`, 설치본 `~/.config/systemd/user/`
  - 디스패치 설치본 `~/.local/lib/etf-ops/dispatch-scheduled-workflow.ts`(작업 사본과 분리)
  - Windows 작업 스케줄러 `WSL Autostart (Ubuntu-24.04)`(사용자 등록, 로그온 시 WSL 유지)

## 검증

- `npm test`: 28 파일·86 테스트 통과(`c978b7b` 기준)
- `npx tsc --noEmit`, `npm run lint`, `npm run continuity:check`: 통과
- `npm run build`: `8ae0221` 시점 통과. 이후 변경은 workflow·`scripts/`·문서라 재실행하지 않음
- 실측: 위 "외부 상태"의 실행 ID. KR 비간섭(US E2E 전후 KR 실행 불변) 확인
- 코드 리뷰: `8ae0221` 변경에 별도 리뷰어 승인(차단 이슈 없음)

## 차단·위험

1. **KR timer 첫 자동 운영 실행 미검증**: 9/22 19:15가 첫 실행이다. KR 디스패치 서비스는 운영 발송 때문에 수동 시험하지 않았다(US 서비스로 경로만 검증).
2. **디스크 I/O 포화**: 9/22 오전 WSL I/O 압력(PSI full)이 약 65%였다. checkout·`npm ci`가 수 분 걸렸고 `test/scripts/run-kr-daily.test.ts` 1건이 10초 시간 초과로 한 번 실패했다(부하 감소 후 통과). 원인 프로세스는 특정하지 못했다.
3. **저장 원자성**: US·KR 모두 `signal_run`을 `COMPLETED`로 먼저 쓰고 신호 행을 나중에 쓴다. 신호 저장 실패 시 "완료된 빈 실행"이 남고, US는 같은 내용 재관측을 중복으로 처리해 스스로 복구하지 못한다.
4. **중복 관측 실측 미검증**: 미국 프리마켓·장중에는 응답이 계속 바뀌어 두 번째 실행도 새 관측이 된다. 미국 휴장 시간(주말)에 2회 실행해야 한다.
5. **보고 분량**: US 보고가 전체 순위(약 2,400행)를 보내 10~11건으로 나뉜다. 상위 N개 제한 여부는 사용자 결정 대기.
6. **runner 권한**: 사용자 계정으로 실행되어 운영 `.env`·gh keyring·다른 프로젝트에 접근 가능하다. 비밀번호 없는 sudo가 없어 전용 사용자를 만들지 못했다.
7. **가동 의존성**: PC·WSL이 꺼져 있으면 실행이 늦어진다(두 슬롯 이상 놓치면 최근 슬롯만 실행). 공인 IP가 바뀌면 Kiwoom 허용 IP를 갱신해야 한다. unit의 Node 경로가 `v22.23.2`로 고정되어 `.nvmrc` 변경 시 함께 고쳐야 한다.
8. **문서 기준점 노후**: `AGENTS.md`의 "최신 작업 기록"과 `docs/guides/etf-signal-mvp-continuity-harness.md` 9장 "현재 기준점"이 이번 세션 이전 상태를 가리킨다.

## 다음 작업

1. 세션 시작: `git status --short --branch`, `npm run continuity:check`(최신 작업 기록이 이 문서인지 확인).
2. **Linear·OpenViking 동기화 완료**: Codex가 기존 `KOR-53`, `KOR-55`에 안전한 상태 요약을 추가하고 OpenViking에 재개 메모리를 저장했다. 이후 상태 전이·운영 검증 결과가 생길 때만 같은 항목을 갱신한다.
3. **9/22 19:15 이후 KR timer 결과 확인**: `journalctl --user -u etf-kr-daily-dispatch.service -n 20`, `gh run list -R kwh8121/etf --workflow kr-daily.yml -L 3`. 기대값은 `market_date=20260922`, `krxStatus: TRADING_COMPLETE`, `kiwoomStatus: COMPLETE`, `telegramSent: true`. 실패하면 job 로그(`gh run view <id> --log-failed`)로 원인을 기록한다.
4. **9/23 07:30 US timer 확인**: 플래그 `false`이므로 `DISABLED`로 끝나야 한다.
5. `AGENTS.md`의 최신 작업 기록 포인터와 연속성 하네스 9장 기준점을 이 문서 기준으로 갱신한다.
6. 사용자 결정이 필요한 항목을 정리해 묻는다: US 보고 분량, 저장 원자성 설계, runner 전용 사용자, 24GB npm 캐시 정리·디스크 I/O 원인 조사.
7. 사용자 승인 후 미국 휴장 시간에 US 중복 관측 실측(플래그 `true` → 2회 실행 → `false`).

## 자주 쓰는 확인 명령 (읽기 전용)

```bash
systemctl --user list-timers 'etf-*'
systemctl --user status actions-runner-etf --no-pager
gh api repos/kwh8121/etf/actions/runners --jq '.runners[] | "\(.name) \(.status) busy=\(.busy)"'
gh run list -R kwh8121/etf -L 5
gh api repos/kwh8121/etf/environments/staging/variables/ENABLE_US_ETF_P1 --jq .value
```
