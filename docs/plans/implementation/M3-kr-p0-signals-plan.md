# M3 국내 P0 신호·Telegram 구현 기록

> 상위 마일스톤: `ETF-signal-MVP-v2.2-ROADMAP.md`의 M3
> 작업일: 2026-09-21 KST
> 상태: 계산·저장·Telegram 보고 구현 및 GitHub Actions 실발송 E2E 완료. R1 품질 게이트 보완 진행 중.

## 구현 범위

- `lib/signals/kr-price-movers.ts`는 최근 완전 거래일의 `FLUC_RT`로 일간 상승·하락 상위 10개와 유동성 선별 결과를 만든다. 유동성 기준은 `ACC_TRDVAL >= 1,000,000,000 KRW` 및 `ACC_TRDVOL > 0`이다.
- 5거래일 수익률은 `seq`가 연속된 여섯 거래일과 양 끝점 종가가 모두 있을 때만 계산한다. 결과에는 KRX 종가 기준 가격수익률이고 분배금·기업행동 조정 총수익률이 아니라는 고지 문구를 메타데이터로 저장한다.
- `lib/signals/kr-turnover-surge.ts`는 현재일을 제외한 직전 20개 거래일의 종목별 평균 거래대금을 사용한다. 20개 행이 모두 있고 평균 10억 원 이상, 현재/평균이 3배 이상인 경우만 최대 15개를 만든다.
- `lib/signals/kr-new-listings.ts`는 최초 마스터 적재(`new_in_snapshot=false`), 이미 `first_alerted_at`이 있는 이벤트를 제외한다. 정상 신규 이벤트만 별도 신호 후보가 된다.
- `signal_run`은 기준일·KRX 스냅샷·변환 버전에서 안정적으로 만든 UUID로 UPSERT하며, `signal_daily`는 `(run_id, market, signal_type, screen, code)`으로 저장한다. 따라서 `raw`와 `liquid` 결과가 함께 존재하고 재실행에도 중복되지 않는다.
- `scripts/generate-kr-price-signals.ts`는 최신 `TRADING_COMPLETE` 거래일만 선택한다. `scripts/report-kr-signals.ts`는 기본적으로 비발송 포맷 검증만 하며 `--send`일 때만 Telegram 전송을 수행한다.

## 실제 검증 증거

- 최초 백필의 역순 삽입으로 `seq`가 날짜와 반대였던 문제를 발견해, 수집 저장 경로가 날짜 오름차순으로 순번을 다시 부여하도록 수정했다. 기존 원격 데이터는 `20260921123000_resequence_kr_trading_calendar.sql`로 한 번 재정렬했다.
- 원격 Supabase의 최신 완전 거래일은 `2026-09-18`, `seq=25`이며 완전 거래일은 25개(`seq 1..25`)다.
- `npm run signals:kr-price`를 두 번 실행했다. 두 번 모두 같은 실행 ID를 반환했고, `signal_run`은 1건, 가격 신호는 80건(4유형·`raw`/`liquid`)으로 유지됐다.
- 거래대금 급증과 신규 상장 후보는 이 기준일에 각각 0건이었다. 빈 결과는 조건 불충족 및 초기 마스터 상태에 대한 정상 결과다.
- `npm run report:kr-signals`는 실제 최신 실행을 읽어 비발송 메시지 1개를 생성했다.

## 검증 게이트

```bash
npm test                 # 14개 파일, 44개 테스트
npx tsc --noEmit
npm run lint
npm run build
npm run signals:kr-price # 서비스 역할 키가 있는 승인된 환경에서만
npm run report:kr-signals
```

모든 로컬 품질 명령은 Node `22.23.2`에서 통과했다. `npm run build`는 Webpack 경로로 성공했다.

## Telegram 발송 E2E 증거

- GitHub Actions `workflow_dispatch` 재실행 `35564162887`이 성공했다. 중복 KRX 관측과 Kiwoom `FETCH_FAIL`을 감지해 신호를 재생성하지 않았고, Telegram 상태 알림 전송 결과가 로그에 `telegramSent: true`로 남았다.
- 새 신호 보고와 상태 알림의 Telegram 비밀값·수신처·메시지 전문은 Git·Linear·작업 기록에 남기지 않았다.
- 로컬 Node `fetch`의 Telegram 연결 실패는 샌드박스 네트워크 경로 제한으로 분리했다. 같은 Bot API의 IPv4 HTTPS 확인이 성공했으며, 저장소 코드·토큰 형식 문제로 처리하지 않는다.

R1 보완에서는 생성 직후의 정확한 `signal_run.id`만 보고하도록 고정하고, 신호 Telegram 전송 성공 후에만 신규상장 `first_alerted_at`을 갱신한다. 해당 회귀 테스트와 최종 품질 증거는 R1 작업 기록에 남긴다.

```bash
npm run report:kr-signals -- --send
```

통과 증거는 `sent: true`, 실행 ID, 메시지 수만 기록한다. 토큰·chat ID·메시지 전문은 기록하지 않는다.
