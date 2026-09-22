# ETF 신호 MVP — US P1 보고 분량 작업 기록

> 작업일: 2026-09-22 KST
> 상태: 유형별 상위 10건 구현·로컬 검증 완료, staging 실발송 미검증

## 결정과 변경

- US P1 Telegram 보고는 일간 상승·하락, 5일 상승·하락의 각 상위 10건만 표시한다(최대 40행). 섹션 제목에는 표시 건수와 전체 건수를 함께 표시한다.
- `scripts/report-us-movers.ts`에서 신호 유형별로 `rank`, `code` 순서의 최대 10행과 정확한 전체 건수를 조회한다. 조회 결과가 불완전하면 전송하지 않고 실패 처리한다.
- 전체 US 신호의 수집·저장, KR 경로, `ENABLE_US_ETF_P1=false` 기본값은 변경하지 않았다. Telegram 길이 제한을 넘는 예외적인 경우 기존 분할 전송을 유지한다.

## 검증

- TDD 회귀 테스트: 유형별 상위 10건·전체 건수 표시·불완전 조회 실패, 통상 크기 단일 메시지와 긴 종목명의 안전한 분할을 확인했다.
- `npm test`: 28개 파일, 91개 테스트 통과. `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과.
- 운영 Supabase의 최신 완료 US 실행을 **읽기 전용**으로 집계했다. 일간 상승 814, 일간 하락 239, 5일 상승 1,091, 5일 하락 393건으로 총 2,537건이다. 각 유형의 순위 상위 10건이 존재한다. DB 데이터를 변경하거나 Telegram 메시지를 발송하지 않았다.

## 남은 확인

- 별도 staging 그룹에서 새 형식의 실제 전송 결과(통상 1건)를 확인한다. 기존 실행 재발송은 중복 알림이므로 이 작업에서는 하지 않았다.
- 미국 휴장 시간 중복 관측 실측, 저장 완료 경계 실측, KR timer 첫 자동 실행은 별도 과제로 추적한다.

## 14:29 KST 후속 읽기 전용 점검

- 운영 Supabase의 최신 US 완료 실행(`090b454e…`)을 `reportLatestUsEtfMovers(false)`로 조회·포맷했다. 결과는 `messageCount=1`이다. Telegram 발송과 DB 쓰기는 없었다.
- self-hosted runner 서비스와 KR·US systemd timer는 모두 `active`다. runner 최근 로그에는 GitHub 연결과 작업 대기·성공 이력이 있다. 다음 발화는 KR 9/22 19:15 KST, US 9/23 07:30 KST다.
- GitHub의 KR·US workflow는 모두 `active`다. staging의 `ENABLE_US_ETF_P1`은 `false`다. 9/22 14:29 현재 KR 첫 자동 timer 실행은 아직 발생하지 않았다.
- 새 형식의 staging Telegram 실발송은 여전히 미검증이다. dry-run 1건은 실제 발송 성공을 의미하지 않는다.
