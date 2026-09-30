# Q-07 미국 휴장 중복 관측 실행 지침

> 대상: `docs/plans/NEXT.md` Q-07(KOR-56). 작성일: 2026-09-30 KST.
> 목적: 미국 시장 휴장일에 코드의 동일 콘텐츠 중복 감지 경로(`persistUsEtfMoverSnapshot`)가
> 실제 운영 환경에서 계약대로 동작하는지 실측한다. 완료 조건은 관측 2건·기준 콘텐츠 1건·
> 신호 중복 0건 확인이다.

## 코드 준비 상태 (2026-09-30 확인, 추가 구현 불필요)

`lib/signals/us-etf-signal-repository.ts`의 `persistUsEtfMoverSnapshot()`은 이미 다음을 구현·테스트했다(`test/signals/us-etf-signal-repository.test.ts`):

- 새 콘텐츠의 sha256과 일치하는 완료된 스냅샷이 있으면 `duplicate: true`, `runId: null`을 반환하고 새 `signal_run`·`signal_daily`를 만들지 않는다.
- 새 스냅샷은 `status: "duplicate_observation"`으로만 저장되고 원본 스냅샷을 `duplicateOfSnapshotId`로 가리킨다.
- `scripts/ingest-us-movers.ts`가 `duplicate=true/false`를 GitHub Actions `GITHUB_OUTPUT`과 stdout JSON에 그대로 노출하므로 `gh run view --log`만으로 판정 가능하다.

즉 이번 준비에서 코드를 새로 고칠 필요는 없었다 — 남은 것은 실제 휴장일에 이 경로를 한 번 실측하는 것뿐이다.

## 다음 미국 시장 완전 휴장일 (2026-09-30 확인)

NYSE 공식 캘린더 기준, 2026년 남은 완전 휴장일은 두 번뿐이다.

- **2026-11-26 (목) 추수감사절** — 가장 이른 관측 기회
- **2026-12-25 (금) 크리스마스**

(2026-11-27 조기 폐장, 2026-12-24 조기 폐장은 완전 휴장이 아니므로 대상이 아니다.)

## 실행 절차 (해당 날짜가 오면)

1. **APPROVE 요청**: staging(또는 승인된 환경)의 `ENABLE_US_ETF_P1`을 `true`로 켠다. Q-04·Q-05와 동일하게 기능 플래그 전환은 매번 사용자 승인이 필요하다.
2. **관측 1회차**: `us-etf-movers.yml`을 `gh workflow run us-etf-movers.yml`로 수동 실행하거나, 평일 09:40 KST 정기 timer가 그날 자동 실행하도록 둔다. 완료 후 `gh run view <run-id> --log`에서 `duplicate=false`(최초 관측이므로 정상), `run_id` 값을 기록한다.
3. **관측 2회차**: 같은 휴장일 또는 휴장이 이어지는 다음 실행에서 동일 콘텐츠가 나오는지 다시 한 번 실행한다(연휴가 아니면 같은 날 두 번째 `workflow_dispatch`로 강제 실행). `gh run view --log`에서 `duplicate=true`, `run_id=`(공백 — 새 run이 만들어지지 않았음)을 확인한다.
4. **운영 DB 읽기 전용 대조**: `source_snapshot` 테이블에서 해당 기간 US 스냅샷이 정확히 1건은 `status=COMPLETE`, 1건은 `status=duplicate_observation`(같은 sha256, `duplicate_of_snapshot_id`가 원본을 가리킴)인지 확인한다. `signal_run`·`signal_daily`에 US 신호가 1세트만 있고 중복 행이 없는지 확인한다.
5. **플래그 원복**: 관측이 끝나면 사용자 승인 후 `ENABLE_US_ETF_P1`을 다시 `false`로 되돌린다(Q-04와 동일 패턴).
6. **기록**: `docs/plans/NEXT.md` Q-07을 관측 행 2개·기준 콘텐츠 1개·중복 신호 없음 근거와 함께 `DONE`으로 옮기고, 작업 기록을 `docs/jobs/`에 남긴다.

## 이번 세션에서 확인한 것 (2026-09-30)

- 위 코드 경로와 CLI 출력 형식을 읽고 추가 구현이 필요 없음을 확인했다(기존 단위 테스트 4건이 이미 이 경로를 커버).
- 다음 완전 휴장일 두 곳을 NYSE 공식 캘린더로 확인했다: 2026-11-26, 2026-12-25.
- 실행 자체(플래그 전환·워크플로 강제 실행)는 하지 않았다 — 해당 날짜가 되어야 의미 있는 관측이며, 매번 사용자 승인이 필요한 외부 부작용이다.
