# 승인된 KR 운영 데이터 정정 결과

## 승인과 실행 경계

2026-10-15 사용자는 Q-27 확정 근거 정정과 최근 KR run의 현재 정본 재계산을 승인했다. 최근 기준일 `2026-10-13`, `2026-10-14`만 전체 신호를 교체했고 이전 15 run의 가격·거래대금은 보류했다. 과거 Telegram은 재발송하지 않았다. 당시 전체 입력을 완전 복원한 결과라고 표현하지 않는다.

- 코드: 웹 완료 상태 보호 `dedbda9`, 정정·비교 도구 `6e3c14b`.
- 계획: `docs/plans/implementation/2026-10-15-approved-correction-plan.md`.
- 전체 백업·감사·보존 검사는 Git 제외 `.omx/private-backups/q27-20261015/`에 0600으로 보관한다. 비밀값·원천 payload를 이 문서에 남기지 않는다.

## 실제 변경과 보존

| 대상 | 결과 |
| --- | --- |
| false-positive listing event | 214개 제거, 잔존 0개 |
| 연결된 과거 false 신규 신호 | 214개 제거, 잔존 0개 |
| master.first_seen | 214개를 더 이른 snapshot 근거로 보정 |
| master.source_snapshot_id | 분담 실행이 바꾼 214개를 원본 값으로 복구 |
| 2026-10-14 run `b5aa73c9-e51e-5b10-a577-7b37e15e99cf` | 80→93행, 고정 80행+turnover 13행 |
| 2026-10-13 run `c49670ec-5711-56cd-adb2-da909a3df7ee` | false 신규 제거 후 84→99행 |
| KR 전체 신호 | 원 감사 1,583→false 신규 제거 1,369→최근 두 run 교체 1,397행 |

독립 SELECT와 고정 계획을 전체 필드로 대조했다. 최근 두 run 192행이 계획과 정확히 일치한다. 공통 기존 142행의 observed_at은 보존했고 추가 50행은 원 run observed_at을 쓴다. 이전 15 run의 나머지 1,205신호는 최근 교체 전과 정확히 같다. KR 17개 run의 전체 metadata(ID·상태·관측/시작/완료 시각·전체 notes·Telegram 보고 표식)는 교체 전과 정확히 같다. master 214개 전체 행은 원 백업에서 승인된 first_seen만 변경한 값과 같다.

## 운영 실행의 예외와 복구

Q-28 분담 에이전트가 범위를 벗어나 리더 선행 리뷰·웹 보호 배포 전에 listing/master-only 적용을 실행했다. 리더는 해당 에이전트를 중지하고 산출물·전체 백업을 보존한 뒤 독립 재조회했다. 이미 완료된 정정을 중복 적용하지 않았다. 이 실행을 정상 절차로 소급 표시하지 않는다.

해당 분담 실행이 함께 바꾼 master 출처 포인터는 source-only 복구로 되돌렸다. 첫 시도는 SDK mutation count 옵션 위치 문제로 1개 반영 후 중단됐다. 설치된 실제 SDK transport 회귀로 원인을 확인하고 수정·재검토 후 이미 완료된 1개를 건너뛰어 213개를 복구했다. 전체 행 사전검증·새 전체 백업·full-row CAS·read-back을 적용했다. 첫 백업은 덮어쓰지 않았다. 구체적 시점·근거는 당일 작업 기록에 남겼다.

최근 두 run 교체는 이후 검토된 도구로 수행했다. 완료 상태만 읽는 웹 보호 배포 `dpl_AerWtzKFtKyx7wNxmcYms3U6jGsV`의 Production READY·커밋 일치를 먼저 확인했고, 영향 run을 CORRECTION_PENDING으로 격리한 뒤 교체·read-back·원 완료 상태/시각 복귀를 완료했다. API 다중 쓰기는 하나의 DB 트랜잭션이 아니므로 향후에도 실행 중인 수집 workflow가 없는지 확인해야 한다.

## 고정 증거

- listing 정정 전 fresh 감사 SHA-256: `71029fb2da36c48e185c5969976364d14965e30f693ac80ee5260984d8b78fc5`.
- listing 정정 후 감사 SHA-256: `36dfc53ea1af9ba3895f6742fade4cbdcd0151ffeeadc5b6de4b8d5e9e703b51`.
- 최근 두 run planHash: `20e775909eb16d89d52ad365eadd46c5a9714957c02aaf640f2ad17d06d956a6`.
- 최근 두 run backupHash: `6e229cf1ebb931e2a36bcd73f282741231b686af30d58ed4ee6575b687623f83`.
- source 복구 첫 전체 백업 SHA-256: `2766a027afc1c60b7cd9aca48f4d30a3a92c0242352b5aaf13f48d293173aa2c`.

최신 `verify:kr-candidate -- 2026-10-14`는 정확성 diff 0·전역 listing 보정 후보 0·보고 표식 1건·93행으로 종료 0이었다. candidate는 현재 run 검사이며 보고 경로의 직전 run 검증과 구분한다. 잔존 신규 이벤트 9개는 저장 원천 replay·전역 이력 검사를 통과하더라도 실제 신규 상장 사실의 별도 보증을 뜻하지 않는다. M6 누적은 자동 승격하지 않는다.


## 최종 전수 감사와 남은 작업

최종 `verify:data all`은 24 run 중 최근 KR 2개·US 7개가 일치하고 과거 KR 15개는 `signal_diff`를 유지했다. 전역 listing 감사는 통과했다. 전체 결과는 `ok:false`, inaccurateRunCount 15·failedCheckCount 15로 종료 1이다. 이는 미해결 과거 데이터를 숨기지 않는 정상적인 차단 결과이며 전체 데이터 정상화 완료를 뜻하지 않는다.

최종 감사 SHA-256: `517af369bb530cec915f25a8c05e2d0728271fc10947bcf8cfed8cc5c567f983`. 13일 99→99·14일 93→93이며 추가·제거·변경 diff는 0이다. 이 두 run과 전역 이력의 통과가 최신 보고의 입력 검증 근거다. 이번에 과거 보고를 다시 실행하지 않았다.

사용자는 2026-10-15 `권장 사항대로 처리`로 NEXT Q-29의 기존 값 보존·콘텐츠 미검증/현재 정본 불일치 명시를 확정했다. 이전 15 run은 확대 정정 없이 보류하며, 새 근거·대상·별도 승인 없이 운영 값을 덮어쓰지 않는다. M6 누적 재확정은 Q-08을 따른다. 과거 9/20은 당시 행 수·보고 표식·실수신의 관측 기록으로 남기며 콘텐츠 정확성이 검증된 9일로 해석하지 않는다.
