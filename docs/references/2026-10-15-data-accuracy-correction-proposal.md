# 2026-10-15 데이터 정확성 정정 제안 — 읽기 전용

상태: **운영 미적용**. 감사 코드 `146cab8`에서 운영 DB SELECT·private Storage download만 수행했다. 수집 API·Telegram·DB 쓰기는 실행하지 않았다.

## 재현과 증거

```sh
npm run verify:data -- all --output /tmp/investment-data-accuracy-final-20261015.json
```

- 실행 환경: Node 22.23.2. 원래 checkout의 `.env`를 값 출력 없이 사용했다.
- 종료 코드: `1` — 기존 운영 KR 불일치와 전역 신규 판정 정정 필요를 정상적으로 탐지했다. 도구 시작 오류나 원천 다운로드 실패가 아니다.
- 전체 JSON: `/tmp/investment-data-accuracy-final-20261015.json`(권한 `0600`, 원천 payload·자격 증명 없음).
- SHA-256: `b7bd0fde2e04001259ed181990f63a34cd726a454db28675c8e59d9235015165`.
- JSON에는 run별 전체 added/removed/changed·source ID·보고 표식 보존 정책·과거 재현 caveat와 event/master 정정 키가 있다. 임시 파일은 영구 백업이 아니므로 실제 적용 직전 재생성·재대조한다.
- 이번 CLI가 사용한 고유 source ID는 50개이며 hash·row/page count 실패는 0개다. 앞선 독립 감사의 전체 115 metadata·74 고유 객체 검사와 범위가 다르다.

## 최종 대조 결과

| 대상 | 저장 범위 | 결과 |
| --- | --- | --- |
| KR | 17 run·1,583행 | 현재 정본 재계산과 17개 모두 차이 |
| US | 7 run·60,250행 | 원천 replay와 전부 일치 |
| 신규 판정 | 223 event | 더 이른 snapshot에 이미 존재한 false-positive 후보 214개 |
| master | 1,180개 | 더 이른 관측 근거가 있는 first_seen 보정 후보 214개 |

이 JSON을 생성한 `146cab8`의 `inaccurateRunCount:18`은 KR 17개와 전역 검사 실패 1개를 더한 값이다. 이후 `1dc1087`에서 `inaccurateRunCount`(run만)·`failedCheckCount`(전역 포함)·`listingAccuracyOk`를 분리했다. 원본 증거 파일·hash는 수정하지 않았으며 실제 부정확 run 수를 18개로 해석하지 않는다.

| KR 실행 | 저장 → 재계산 | 추가 / 제거 / 변경 |
| --- | --- | --- |
| 2026-10-14 `b5aa73c9-e51e-5b10-a577-7b37e15e99cf` | 80 → 93 | 27 / 14 / 16 |
| 2026-10-13 `c49670ec-5711-56cd-adb2-da909a3df7ee` | 102 → 117 | 23 / 8 / 9 |

최신 추가 27개는 고정 가격 신호 교체 14개와 turnover 13개다. 제거 14개는 잘못 선택된 가격 신호이며 공통 코드 16개의 순위가 바뀐다. US의 일치는 저장 원천 범위 내 재현 결과이지 전체 미국 ETF 포괄성의 증명이 아니다(`usa20931.stk_cnd=1` 경고 유지).

이 표는 전역 false-positive event를 제거하기 전의 독립 run replay다. 과거 신규 종목의 저장 구성을 우선 재현했으므로, event 정정과 결합한 최종 신호 수는 달라질 수 있다. 예컨대 직전 run의 거짓 신규 행을 그대로 둔 채 117행으로 덮어쓰는 적용안이 아니다. 실제 적용안은 event 참조를 함께 대조한 뒤 다시 고정한다.

## 확정 근거와 보류 구분

- 전역 event/master 후보는 이른 snapshot·코드·관측일이 확인돼 `approvalReady:true`다. 이것은 운영 쓰기 승인 또는 적용 성공을 뜻하지 않는다. 나머지 9개를 실제 IPO로 확정하지 않았다.
- 과거 KR run은 당시 전체 입력 source set이 기록되지 않아 `current_canonical_with_caveats`, `approvalReady:false`로 분리했다. 위 재계산 수치를 당시 상태의 완전한 복원이라고 표현하지 않는다.
- 초기 run `ff7d9d25-9a8d-5a32-a020-bc8ef566ca4c`는 현재 calendar window가 짧아 80→40으로 달라진다. `3c6c862b-1e87-57f9-a1ad-3bcd362acd01`은 현재 calendar source가 원 run 입력에 없다. 이들은 일괄 정정 대상에서 우선 보류한다.
- 신규 판정의 과거 run 구성 재현과 실제 false-positive 제거는 별개다. 전역 event 정정 때 해당 `meta.event_key`를 가진 과거 `signal_daily` 참조도 다시 조회해 함께 검토한다. 단순 generator 재실행은 사용하지 않는다.

## Q-27 승인 시 권장 순서

1. 위 214개 event·214개 master와 연결된 신호의 정확한 행 키·전후 값·보고 표식을 다시 읽어 제안 이후 변경이 없는지 대조한다. 비공개 백업과 복원 검증을 먼저 수행한다.
2. false-positive·최초 관측일의 확정 근거를 우선 정정한다. 과거 알림/관측 표식은 보존하며 Telegram을 재발송하지 않는다.
3. 최근 KR 신호는 **현재 정본 기준 재생성** 정책을 별도로 명시한 뒤 승인된 범위만 적용한다. 과거의 완전 재현이라고 표시하지 않는다. 초기 seq·교체 source가 불확실한 run은 보류한다.
4. 재계산·전역 검사·candidate·직전 비교 run을 모두 통과한 뒤 정상 보고 가능 상태를 재확인한다. 오류가 남으면 게이트를 우회하지 않는다.

실제 정정 도구·트랜잭션/부분 실패 복구는 아직 적용하지 않았다. 상세 운영 조건은 `docs/guides/etf-signal-mvp-data-correctness.md`, 승인 큐는 `docs/plans/NEXT.md`가 정본이다.
