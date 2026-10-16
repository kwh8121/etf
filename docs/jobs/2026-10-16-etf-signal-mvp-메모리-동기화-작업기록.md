# ETF 신호 MVP 메모리 동기화 작업 기록 (2026-10-16)

## 승인 범위와 실행 결과

- 사용자 `저장 승인`은 NEXT Q-31의 내부 경로·비밀값을 제외한 최소 요약을 OpenViking에 한 차례 저장하는 승인이다. 운영 데이터 정정·Kiwoom API 호출·Telegram 발송·수집 계약 변경은 포함하지 않았다.
- Q-31에 제시한 문구 그대로 `remember`에 메시지 1건을 전송했다. 응답은 `Stored 1 message(s) and committed for memory extraction.`이며 오류 표시는 false였다. 저장과 추출 접수만 성공으로 기록하고 비동기 장기 메모리 추출 완료를 주장하지 않는다.
- 정본 NEXT Q-31을 DONE으로 전환했다. Q-29 KR 15 run 보존·미검증/불일치 명시, Q-30 US 현행 `stk_cnd=1`과 전체 ETF 포괄성 미확인 제한은 그대로다. 과거 KR 불일치나 M6 주의가 해결된 것은 아니다.
- 2026-10-15 최초 자동 승인 거절 기록은 보존한다. 이번에는 사용자가 구체적 최소 요약 전송을 승인한 뒤 한 차례 성공했다. 승인 범위를 넓힌 추가 메모리는 전송하지 않는다.

## 연속성과 검증

- 시작 `npm run continuity:check` 통과. 기존 사용자 미추적 파일을 보존하고 격리 worktree에서 문서만 반영한다.
- Linear 도구는 이 세션에 제공되지 않아 Q-31 완료 상태를 동기화하지 못했다. 연결 복구 시 기존 프로젝트·이슈를 먼저 조회하고 NEXT와 이 기록을 근거로 중복 없이 반영한다.
- 저장된 세션 재개용 `resume_agent` 도구도 제공되지 않아 기존 에이전트를 다시 열지 못했다. 새 에이전트를 생성하지 않고 root에서 처리했다.
- 최종 큐: `AUTO 0 / APPROVE 0 / DECIDE 0 / WAIT 4`. Q-23 사용자 화면 확인 시각은 미정, Q-07 고정 달력 대기는 2026-11-26 미국 휴장 관측이다. Q-08 콘텐츠 정확성 기준 M6 재확정과 Q-09 의존 대기는 유지한다.
- 최종 검증(Node 22.23.2): `npm test` 52파일·296테스트 통과, `npx tsc --noEmit`·격리 `npm run lint`·`npm run build` 통과. `git diff --check`·NEXT 큐 라벨 검사·종료 `npm run continuity:check`도 통과했다. 변경은 NEXT와 이 작업 기록 2개뿐이며 main 원자적 커밋·푸시로 체크포인트를 남긴다.

## Codex Playwright MCP 복구

- 사용자 요청: `playwright mcp 문제 해결해주세요.` 전역 Codex MCP의 로컬 설정·브라우저 실행만 대상으로 진단했다. 운영 DB·Kiwoom·Telegram·서비스 배포는 호출하지 않았다.
- 원인 재현: 기존 등록은 `npx @playwright/mcp@latest`, 시작 제한 15초였다. MCP 초기화(3.46초)·도구 25개 조회는 성공했으나 `browser_navigate`가 `/opt/google/chrome/chrome` 부재로 실패했다. 따라서 `Auth: Unsupported`는 OAuth 미지원 표시이며 이 오류의 원인이 아니다. 로그의 resources/list·templates/list `Method not found`도 tools 전용 서버의 경고로 분리했다.
- 기존 Chromium 실행 경로를 지정한 재검증 중 기본 프로필의 `Browser is already in use` 오류도 확인했다. 공유 프로필·기존 사용자 브라우저를 지우거나 종료하지 않고 `--isolated`로 진단 세션을 분리했다. 화면 모드를 유지하며 headless·no-sandbox·제한 완화 옵션은 추가하지 않았다.
- 수정: 전역 `~/.codex/config.toml`의 `mcp_servers.playwright.args`에 기존 Chromium 1243 실행 파일을 가리키는 `--executable-path`와 `--isolated`만 추가했다. 다른 MCP·설정·15초 제한은 그대로다. TOML 파싱·전후 전체 객체 대조로 변경 범위를 확인했고, 기존 Playwright 블록만 `/tmp/playwright-mcp-before-20261016.json`(0600)에 보존했다. Chromium 캐시를 정리하거나 업데이트하면 실행 경로를 재확인해야 한다. isolated 모드는 실행 종료 후 로그인 상태를 보존하지 않는다.
- 최종 실측: 저장된 설정을 다시 읽어 실제 등록 명령으로 `initialize` 3.01초, `tools/list` 25개, `browser_navigate(about:blank)`와 `browser_close` 모두 성공·종료 0. 진단이 만든 빈 snapshot 3개는 파일명·크기를 대조해 제거했다. 임시 진단 프로세스만 정리했고 기존 사용자 미추적 파일은 보존했다.
- 현재 대화의 MCP 카탈로그에는 Playwright가 여전히 노출되지 않는다. 서버 수정·독립 MCP 호출 검증은 완료했으나 기존 Codex 세션의 도구 재연결은 재시작 후 확인해야 한다. 현재 세션에서 도구를 호출했다고 기록하지 않는다.
- 연속성: 시작 `continuity:check` 통과. 제품의 KR/US 데이터 계약·WAIT 4건·Q-29/Q-30 정책은 그대로다. Q-31 저장 승인은 정책 요약 1회에 한정되므로 이번 로컬 설정 진단을 OpenViking에 추가 전송하지 않았다.
- 복구 기록 검증: Node 22.23.2에서 `npm test` 52파일·296테스트, `npx tsc --noEmit`, 격리 `npm run lint`, `npm run build`, `git diff --check`, NEXT 큐 검사, 종료 `continuity:check`가 통과했다. 문서 2개를 직접 대조한 뒤 원자적 main 커밋·푸시로 기록한다. 전역 Codex 설정은 저장소 Git에 포함하지 않는다.
