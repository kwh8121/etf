# ETF 신호 MVP 웹 현황판

- 링크: https://claude.ai/artifact/JKXpxdQzbryYcVLWWztTdB
- 공개 범위: 비공개(본인만 열람 가능한 Claude Artifact 링크)
- 생성일: 2026-09-29

## 보여주는 내용

- 실행 큐 요약: `docs/plans/NEXT.md`의 AUTO/APPROVE/DECIDE/WAIT 개수
- M6 완전 거래일 관측 진행률(n/20)과 확인된 기준일 목록
- 대기 항목(Q-07·Q-08·Q-09)별 설명·해제 조건·Linear 링크
- 최근 KR·US GitHub Actions 실행 이력(결과·시각·비고, run 링크 포함)
- Q-01~Q-11 완료 로그

## 갱신 방식

- Claude Code 세션이 확인할 때마다 아티팩트의 자체 DB(`ArtifactData`)를 갱신한다. 페이지를 다시 게시하지 않아도 열려 있는 화면에 실시간 반영된다.
- 정본은 여전히 `docs/plans/NEXT.md`이며, 이 현황판은 그 내용을 보기 쉽게 보여주는 읽기 전용 보조 화면이다. 두 문서가 다르면 `NEXT.md`를 기준으로 한다.
- KR daily timer 자동 실행을 감지해 `NEXT.md`를 갱신하는 세션 내 루프가 이 현황판도 함께 갱신하도록 설정되어 있다(세션 종료 시 루프도 멈춘다).
