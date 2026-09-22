# ETF 신호 MVP M6 운영 관측 절차

> 기준: `docs/plans/ETF-signal-MVP-v2.2-ROADMAP.md`의 M6
>
> 시작 전 상태(2026-09-22 14:39 KST): runner·KR timer 활성, 설치된 KR timer 다음 예정 시각 19:15 KST. 회사 PC는 근무시간에만 운영 가능하므로 정시 실행은 보장되지 않는다. 첫 timer 경로 실행 전이며 누적 완전 거래일 0/20

## 시작 게이트

1. KR `etf-kr-daily-dispatch.timer`가 `etf-kr-daily-dispatch.service`를 실행했는지 사용자 systemd journal에서 확인한다. 예정 시각 19:15 KST 정시 실행인지 다음 근무일 PC 기동 시 `Persistent=true` 따라잡기인지 구분한다. PC가 꺼져 있어 아직 발화하지 않았다면 게이트는 미통과다.
2. 해당 발화와 GitHub Actions `kr-daily.yml`의 `workflow_dispatch` 실행 ID·성공 여부를 연결한다. 성공한 수동 실행은 timer 경로 검증을 대신하지 않는다.
3. 실행 로그의 `krxStatus`, `kiwoomStatus`, `signalRunId`, `telegramSent`를 확인하고 해당 날짜의 저장 행을 읽기 전용으로 대조한다.
4. 위 항목을 실제로 확인한 뒤에만 KOR-58의 관측 시작을 기록한다. 검증 전에는 0/20으로 둔다.

## 일별 기록 계약

완전 거래일마다 `docs/jobs/YYYY-MM-DD-etf-signal-mvp-m6-관측기록.md`에 아래 항목을 남긴다. 비밀값, Telegram 수신처, 원천 API 응답은 기록하지 않는다.

| 항목        | 기록할 값                                                                |
| ----------- | ------------------------------------------------------------------------ |
| 기준일·실행 | KST 날짜, timer 발화 시각, GitHub run ID·결과, 실행 시간·재시도 수       |
| 국내 수집   | KRX 상태·행 수·검증 경고, Kiwoom 상태·불일치 코드 수, 429·공표 지연 여부 |
| 신호        | `signal_run` 상태와 P0 유형별 `raw`/`liquid` 행 수                       |
| 보고        | Telegram 성공·실패 및 메시지 분할 수. 확인할 수 없으면 `미수집`          |
| P1          | 기본 `off` 여부. 켠 날에만 신호 수·중복 관측 수를 기록                   |
| 사용자 반응 | 조사 건수. 계측하지 못하면 0이 아닌 `미수집`                             |
| 판정        | 완전 거래일 포함/제외, 이유, 누적 `n/20`                                 |

`KRX=TRADING_COMPLETE`, `Kiwoom=COMPLETE`, 국내 신호 실행 `COMPLETED`, 보고 성공을 확인하고 같은 기준일이 아직 집계되지 않았을 때만 1일을 더한다. `PARTIAL`, `FETCH_FAIL`, 중복 실행, 증거 누락은 포함하지 않고 원인과 재확인 절차를 기록한다. 장애는 재현 테스트를 먼저 추가한다.

## 일별 최소 템플릿

```markdown
# ETF 신호 MVP M6 관측 — YYYY-MM-DD

- 기준일 / 자동 실행 시각 / GitHub run ID:
- KRX 상태·행 수·경고 / Kiwoom 상태·불일치 코드 수:
- P0 유형별 raw·liquid 행 수:
- Telegram 성공 여부·메시지 수:
- 실행 시간·재시도·429·공표 지연·장애:
- P1 플래그 / 켠 경우 신호 수·중복 관측 수:
- 사람이 연 조사 건수: 미수집
- 완전 거래일 포함 여부·근거 / 누적: n/20
```

20개 완전 거래일 전에는 거래대금·유동성 임계값이나 P1 지위를 조정하지 않는다. R2 결정에는 누적 기간·신호량 분포·품질 경고·대표 사례·미수집 지표를 함께 제출한다.
