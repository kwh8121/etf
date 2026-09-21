# M5-B — 격리된 미국 ETF 등락 어댑터 구현 계획

> 시작일: 2026-09-21 KST
> 상태: 구현 완료 · staging E2E 보류

## 정본 결정

`ETF-signal-MVP-plan-v2.2.md`의 ADR 선택지 B를 따른다. 미국 ETF 등락은 국내 P0와 독립된 P1 실험 어댑터이며, 기능 플래그 기본값은 `off`다.

## 완료 순서

1. `lib/signals/us-etf-movers.ts`에서 ETN 제외, 부호 가격 절댓값 정규화, 5일 수익률 재계산, 기본 `off` 플래그를 단위 테스트로 고정한다. 완료.
2. Kiwoom `usa10104`, `usa20911`, `usa20511(tm=5)`, `usa20931(flu_tp=2, tm_tp=3, tm=2)`의 인증·연속조회·응답 계약을 구현한다. 완료.
3. 미국 전용 복합 source snapshot·중복 관측·US `signal_run`/`signal_daily` 저장 경로를 구현한다. 미국 응답에 공식 시장일이 없으면 `market_date=null`을 유지한다. 완료.
4. 별도 수동/예약 workflow와 실험 전용 Telegram·대시보드 섹션을 추가한다. 국내 P0 실행 경로를 import하거나 변경하지 않는다. 완료.
5. 고정 응답 기반으로 중복 관측, ETN 제외, P1 실패 비간섭, RLS 보호 대시보드 경로, 기능 플래그 `off`를 검증한다. 완료. 실제 Kiwoom·Supabase·Telegram E2E는 `ENABLE_US_ETF_P1=true`인 staging에서 한 번 실행해 별도 증거를 남긴다. 미국 workflow는 `staging` Environment로 고정했다.

## staging E2E 재개 조건

- 현재 GitHub `staging` Environment는 삭제되었고 US ETF movers workflow는 비활성화되어 있다. 따라서 staging E2E는 의도적으로 보류한다.
- 재개 전 별도 staging Supabase 프로젝트와 Telegram 테스트 chat을 준비한다. 현재 로컬 `.env`는 production 값이므로 P1 E2E에 사용하지 않는다.
- staging Environment에 해당 Supabase·Telegram·Kiwoom 자격증명과 `ENABLE_US_ETF_P1`을 등록한 뒤 workflow를 다시 활성화한다.
- GitHub Actions 수동 실행 또는 로컬에서 `ENABLE_US_ETF_P1=true`로 실행하면 외부 Kiwoom·Supabase·Telegram 부작용이 생긴다. 실행 환경의 sandbox 외부 권한과 명시적 실행 승인을 확보한 뒤에만 수행한다.
- `ENABLE_US_ETF_P1=true`로 수동 실행을 2회 수행해 새 관측 1회·중복 관측 1회·US `signal_run` 1회를 확인한 뒤, 플래그를 `false`로 되돌린다.

## 복합 관측 결정

한 번의 미국 어댑터 실행은 네 API 응답과 요청 계약을 `api_id=us_etf_movers`의 하나의 원본 객체로 저장한다. 따라서 같은 복합 콘텐츠를 두 번 관측하면 `source_snapshot` 관측 행은 2개(기준 1개, `duplicate_observation` 1개), 원본 객체와 신호 실행은 각각 1개다. 원본 객체 안에는 `usa10104`, `usa20911` 상승·하락, `usa20511`, `usa20931` 응답이 구분되어 보존된다.

GitHub Actions는 새 US `run_id`가 생겼을 때만 P1 Telegram 보고 단계를 실행한다. 따라서 동일 콘텐츠 재관측은 알림도 재전송하지 않는다.

## M5-A 보류 사유

순설정·환매 추정의 “큰 기업행동 의심”과 “강한 항등 이상” 제외 임계값은 정본에 수치로 정의되지 않았다. 기준을 임의로 선택하면 실험 결과의 해석을 왜곡할 수 있으므로, 수치 계약을 확정한 뒤 별도 작업으로 구현한다.
