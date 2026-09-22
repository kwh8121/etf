# M5-B — 격리된 미국 ETF 등락 어댑터 구현 계획

> 시작일: 2026-09-21 KST
> 상태: 구현 완료 · self-hosted runner E2E 완료(중복 관측 실측 미검증)

## 정본 결정

`ETF-signal-MVP-plan-v2.2.md`의 ADR 선택지 B를 따른다. 미국 ETF 등락은 국내 P0와 독립된 P1 실험 어댑터이며, 기능 플래그 기본값은 `off`다.

## 완료 순서

1. `lib/signals/us-etf-movers.ts`에서 ETN 제외, 부호 가격 절댓값 정규화, 5일 수익률 재계산, 기본 `off` 플래그를 단위 테스트로 고정한다. 완료.
2. Kiwoom `usa10104`, `usa20911`, `usa20511(tm=5)`, `usa20931(flu_tp=2, tm_tp=3, tm=2)`의 인증·연속조회·응답 계약을 구현한다. 완료.
3. 미국 전용 복합 source snapshot·중복 관측·US `signal_run`/`signal_daily` 저장 경로를 구현한다. 미국 응답에 공식 시장일이 없으면 `market_date=null`을 유지한다. 완료.
4. 별도 수동/예약 workflow와 실험 전용 Telegram·대시보드 섹션을 추가한다. 국내 P0 실행 경로를 import하거나 변경하지 않는다. 완료.
5. 고정 응답 기반으로 중복 관측, ETN 제외, P1 실패 비간섭, RLS 보호 대시보드 경로, 기능 플래그 `off`를 검증한다. 완료. 실제 Kiwoom·Supabase·Telegram E2E는 `ENABLE_US_ETF_P1=true`인 staging에서 한 번 실행해 별도 증거를 남긴다. 미국 workflow는 `staging` Environment로 고정했다.

## staging 경계 결정 (2026-09-21)

사용자 결정으로 P1 staging은 **운영 Supabase + 별도 Telegram 테스트 그룹**을 사용한다. 별도 Supabase 프로젝트는 만들지 않는다.

- 운영 DB 격리 근거: KR 실행·보고·대시보드는 `market="KR"`과 `strategy_version="m3-price-movers-v1"`으로 실행을 고른 뒤 `run_id`로만 신호를 읽는다. US 행은 `market='US'`로 구분되어 삭제로 되돌릴 수 있다.
- Telegram: staging 그룹 `ETF P1 staging`의 chat ID를 GitHub `staging` Environment의 `TELEGRAM_CHAT_ID`로 등록했다. 운영 chat과 다름을 등록 시 검사했다.
- GitHub `staging` Environment: `ENABLE_US_ETF_P1=false`(기본), Supabase 공개 변수, Supabase service role·Kiwoom·Telegram Secret 5개.

## staging E2E 결과 (2026-09-21)

| 단계                        | 결과                                                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Actions 수동 실행    | 실패. Kiwoom 토큰 발급이 `return_code != 0`. 같은 키가 로컬에서는 성공하고, KR daily도 Actions에서 `kiwoomStatus: FETCH_FAIL`이다. Kiwoom 앱 키의 허용 IP 제한으로 판단한다(Actions가 받은 `return_msg`는 로그에 남지 않아 미확인).            |
| 로컬 1차(수정 전)           | `usa20931 result_list contains a malformed record`로 수집 실패. 저장 전 실패라 DB 변화 없음.                                                                                                                                                   |
| 로컬 1차(`rank` 수정 후)    | 저장 중 `ON CONFLICT DO UPDATE command cannot affect row a second time`. `signal_run`이 `COMPLETED`로 남고 신호 0건. 사용자 승인 후 해당 3건(run·snapshot·원본 객체)을 ID 지정 삭제했다.                                                       |
| 로컬 1차(중복 코드 수정 후) | 새 관측, US `signal_run` 1건(신호 2,406행), `market_date=null`. Telegram 보고 10건이 staging 그룹으로 전송됐다.                                                                                                                                |
| 로컬 2차                    | 중복 관측이 아니라 새 관측(신호 2,415행)과 보고 10건. 실행 시각(KST 18시대)에 미국 프리마켓이 열려 있어 응답 내용이 계속 바뀌었다.                                                                                                             |
| 플래그 off                  | 로컬 `ingest`·`report` 모두 `DISABLED`, GitHub staging 플래그 `false`.                                                                                                                                                                         |
| KR 비간섭                   | 최신 KR `signal_run`(`d1ea739a…`)과 KR 실행 수(3)가 E2E 전후 동일하다.                                                                                                                                                                         |
| self-hosted runner          | 등록 IP PC의 runner(`kohdekt-wsl`, label `kiwoom`)에서 플래그 `false` 실행(`35587186201`)은 `DISABLED`, 플래그 `true` 실행(`35587346715`)은 Kiwoom 수집·저장(`090b454e…`)·staging 보고 11건까지 성공했다. 실행 후 플래그를 `false`로 되돌렸다. |

### 발견·수정한 결함

1. `usa20931` 응답에는 `rank` 필드가 없다(명세 `responseIo`와 실제 응답 13개 필드가 일치). 응답이 5일 하락률(`cur_prc/base_pric`) 순으로 정렬되어 오므로(362행 중 역전 0건) 응답 순서를 순위로 쓴다.
2. Kiwoom 순위 목록은 같은 종목을 반복한다. 페이지 경계(25행 단위)에서 같은 행을 반복하는 경우와, 다른 순위에 다른 값으로 한 번 더 나오는 경우가 있다. 신호 유형마다 종목당 최고 순위 1행만 남긴다.

### 남은 과제

- **Kiwoom 실행 위치(결정·전환 완료)**: GitHub 호스팅 러너는 Kiwoom 허용 IP에 등록할 수 없어, 등록 IP PC의 self-hosted runner로 전환했다. 운영 절차는 `docs/guides/etf-signal-mvp-e2e-configuration-guide.md` 4.3에 있다. PC와 WSL이 예약 시각에 켜져 있어야 하고, 공인 IP가 바뀌면 Kiwoom 허용 IP를 갱신해야 한다. 상시 가동이 필요해지면 고정 IP 서버로 runner를 옮긴다. GitHub `schedule`이 지연·누락되어 예약 실행은 runner PC의 systemd timer가 `workflow_dispatch`로 한다(가이드 4.4).
- **중복 관측 실측**: 미국 장이 완전히 닫힌 시간(주말 등)에 2회 실행해 `duplicate_observation`과 보고 생략을 확인한다. 단위 테스트는 통과했다.
- **저장 원자성**: US·KR 모두 `signal_run`을 `COMPLETED`로 먼저 쓰고 신호 행을 나중에 쓴다. 신호 저장이 실패하면 완료된 빈 실행이 남고, US는 같은 내용 재관측을 중복으로 처리해 스스로 복구하지 못한다.
- **보고 분량**: 전체 순위(약 2,400행)를 보내 한 번에 Telegram 메시지 10건이 된다. 가이드의 "P1 전용 메시지 1건" 기대와 다르므로 상위 N개 제한 여부를 정해야 한다.
- 로컬에서 Telegram으로 보낼 때 node 기본 연결 시도 제한(250ms)을 넘어 `ETIMEDOUT`이 난다. 로컬 실행에는 `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=2000`이 필요하다.

## 복합 관측 결정

한 번의 미국 어댑터 실행은 네 API 응답과 요청 계약을 `api_id=us_etf_movers`의 하나의 원본 객체로 저장한다. 따라서 같은 복합 콘텐츠를 두 번 관측하면 `source_snapshot` 관측 행은 2개(기준 1개, `duplicate_observation` 1개), 원본 객체와 신호 실행은 각각 1개다. 원본 객체 안에는 `usa10104`, `usa20911` 상승·하락, `usa20511`, `usa20931` 응답이 구분되어 보존된다.

GitHub Actions는 새 US `run_id`가 생겼을 때만 P1 Telegram 보고 단계를 실행한다. 따라서 동일 콘텐츠 재관측은 알림도 재전송하지 않는다.

## M5-A 보류 사유

순설정·환매 추정의 “큰 기업행동 의심”과 “강한 항등 이상” 제외 임계값은 정본에 수치로 정의되지 않았다. 기준을 임의로 선택하면 실험 결과의 해석을 왜곡할 수 있으므로, 수치 계약을 확정한 뒤 별도 작업으로 구현한다.
