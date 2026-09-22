# ETF 신호 MVP 다음 작업 큐

> 기준: 2026-09-22 KST. 실행 상태의 정본은 이 파일이며 제품·데이터 계약은 v2.2 계획서와 ROADMAP을 따른다.
> 완료 항목은 검증 증거와 커밋을 기록한다. 새 사실을 확인하면 라벨·해제 조건을 갱신한다.

## 큐 (위에서부터 실행)

- [ ] `APPROVE` Q-02 runner PC의 KR timer·독립 dispatch 설치본을 저장소의 09:30 방식으로 갱신
  - 승인 대상: 운영 PC의 설치 파일·systemd timer 변경 및 `Persistent=true`에 따른 즉시 실행 가능성
  - 완료 조건: 설치본 해시·timer 목록·journal을 대조하고 발화 시각을 기록
  - 근거: `docs/guides/etf-signal-mvp-e2e-configuration-guide.md` 4.4
  - 사전 확인(2026-09-22 17:40 KST): 설치본은 평일 19:15 KST, 다음 발화 19:15 KST, KR dispatch journal은 비어 있음. 저장소 원본은 평일 09:30 KST이며 timer·service·dispatch script SHA-256은 각각 `ba391713…`, `25bb03aa…`, `c23f2abb…`.
- [ ] `WAIT` Q-03 KR timer 첫 자동 경로 E2E 및 M6 관측 시작 판정
  - 해제: Q-02 승인·설치 후 실제 timer 발화 발생. 정시 발화와 다음 기동 따라잡기를 구분
  - 완료 조건: journal → GitHub run → KRX·신호 저장 결과 연결. 수동 실행과 과거 보충일은 완전 관측일로 자동 산입하지 않음
- [ ] `APPROVE` Q-04 US 새 상위 10건 보고 형식의 staging 실발송 1회 (KOR-57)
  - 승인 대상: staging 플래그 전환·수동 실행·그룹 발송·플래그 복귀
  - 완료 조건: 발송 결과와 플래그 복귀 확인
- [ ] `APPROVE` Q-05 KR·US 저장 실패·재시도 운영 E2E (KOR-59)
  - 승인 대상: 운영 경로의 실패 주입·재실행과 수반되는 데이터 쓰기·외부 호출
  - 완료 조건: 실패 상태·재시도·완료 경계의 실제 증거 기록
- [ ] `APPROVE` Q-06 US timer 설치본을 평일 09:40 KST 방식으로 갱신
  - 결정(2026-09-22): A안. 평일 09:40 KST에 직전 미국 거래일 장 마감 결과를 처리
  - 승인 대상: runner PC의 US timer·독립 dispatch 설치본 변경 및 `Persistent=true`에 따른 따라잡기 실행 가능성
  - 완료 조건: 설치본 해시·timer 목록·journal을 대조하고 실제 발화 시각을 기록
- [ ] `WAIT` Q-07 US 휴장 시간 동일 콘텐츠 중복 관측 실측 (KOR-56)
  - 해제: 미국 휴장 구간과 승인된 US 실행 경로가 마련된 때. 실행이 외부 쓰기·발송을 수반하면 별도 승인 필요
  - 완료 조건: 관측 행 2개·기준 콘텐츠 1개·중복 신호 없음 확인
- [ ] `WAIT` Q-08 M6 완전 거래일 20일 관측 (KOR-58)
  - 해제: Q-03 게이트 통과 후 각 KR 거래일의 실제 운영 결과 확인
  - 완료 조건: `docs/guides/etf-signal-mvp-m6-observation-runbook.md` 기준 20/20; 현재 0/20
- [ ] `WAIT` Q-09 M5-A 순설정·환매 추정 설계·착수
  - 결정(2026-09-22): A안. M6의 완전 거래일 20일 관측 완료 뒤 근거를 모아 설계·착수
  - 해제: Q-08 완료 및 M6 관측 근거·수치 계약 확정
  - 완료 조건: 별도 구현 계획과 임계값 계약을 정본에 반영

## 완료

- [x] `DONE` Q-01 Codex 연속 실행 운영 가이드를 현재 운영 상태·공식 기능 설명에 맞춰 개선
  - 검증: `npm test` 29개 파일·90개 테스트, `npm run lint`, `npm run build`, `npm run continuity:check`, `git diff --check` 통과
  - 커밋: 이 완료 기록과 가이드 변경을 함께 담은 Git 커밋 (`git log -1 --format=%h -- docs/plans/NEXT.md`로 확인)
