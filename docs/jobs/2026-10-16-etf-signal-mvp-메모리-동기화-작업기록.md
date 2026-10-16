# ETF 신호 MVP 메모리 동기화 작업 기록 (2026-10-16)

## ETF별 키움 기본 상세 링크 검토

- 사용자 `키움을 기본으로 해서 진행`에 따라 기본 조회 대상을 키움으로 확정했다. 국내·미국 알림의 종목코드는 이미 있으므로 추가 상세 데이터 수집이 필요한 작업은 아니다.
- 공식 CLI 가이드·Telegram 문서·키움 WTS와 공개 JS를 확인했다. 로컬 CLI의 딥링크·URL spec 검색은 결과가 없었다. 공식 종목별 주소 규칙을 확보하지 못했으며 미지원으로 단정하지 않는다.
- 현재 세션에서 Playwright MCP 도구가 노출됐고 실제 `browser_navigate`와 `browser_evaluate`로 WTS 로그인 화면·공개 JS HTTP 200을 확인했다. 앞선 Q-32의 미노출 기록은 당시 사실이다. 다만 다음 시작 시 60초 설정 반영과 재발 여부는 이번 조사로 보증하지 않아 Q-32를 임의 완료하지 않았다.
- 상세 검토는 `docs/references/2026-10-16-kiwoom-etf-detail-links.md`, 실행 대기는 NEXT Q-33에 기록했다. 실제 키움 공유 URL 또는 공식 규칙을 확보하면 종목·기기 검증 뒤 구현한다. 사용자에게 공유 기능이 있다면 국내·미국 각 1개 URL을 요청했다.
- 제품 코드·환경 변수·운영 데이터·발송은 변경하지 않았다. 구현 완료·모바일/PC 호환 검증 완료를 주장하지 않는다. 메모리 최소 요약 1회 저장 승인을 이번 조사 전송으로 확대하지 않았다.
- Linear에서 관련 기존 이슈를 조회한 뒤 Q-33 전용 KOR-68을 Todo로 생성하고 read-back 조회로 제목·상태를 확인했다. 기존 완료 이슈나 M6 관측 누적은 변경하지 않았다.
- 검증(Node 22.23.2): production build·TypeScript 검사·17개 정적 페이지 생성 통과. 일반 `npm run lint`는 작업 전부터 있던 미추적 `.opencode/skills/mem0-mem0/scripts/mem0_doc_search.ts`의 `no-explicit-any` 4건으로 실패했다. 해당 사용자 파일은 수정하지 않았다. `npm run lint -- --ignore-pattern '.opencode/**'`는 통과했다. 제품 코드 변경이 없어 단위 테스트는 재실행하지 않았다. 문서 3개를 직접 대조해 요구사항·차단 조건·미구현 표기가 일치함을 확인했고 `git diff --check`·종료 `continuity:check`도 통과했다.
- 브라우저를 닫고 이번 조사가 만든 `.playwright-mcp/` snapshot·console 파일을 정리했다. 큐는 `AUTO 0 / APPROVE 0 / DECIDE 0 / WAIT 6`; Q-33 해제 시각은 미정이다.

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

## Playwright failed 후속 진단

- 사용자 `playwright mcp 가 failed 로 표시되는데 어떤 문제인가요 ?`에 따라 이번 Codex 시작 로그를 확인했다. 2026-10-16 00:22:04 UTC(09:22 KST)와 00:22:21 UTC에 Playwright 초기 연결이 약 15초 제한으로 실패했다. 직접 오류는 `timed out handshaking with MCP server after 14.9999986s`다. 앞선 브라우저 실행 오류와 다른 단계이며, 독립 호출 성공만으로 Codex 재연결 완료를 판단할 수 없다.
- 전역 `~/.codex/config.toml`의 `mcp_servers.playwright.startup_timeout_sec`만 15.0→60.0으로 변경했다. 전체 TOML 객체 전후 대조로 다른 설정이 같음을 확인했다. 기존 Chromium 실행 경로·`--isolated`는 유지했다. npm registry 조회는 91~281ms였으므로 네트워크 지연을 원인으로 단정하지 않는다. 동시 서버 시작 부하 등 초기화 지연의 근본 원인은 미확정이다.
- 저장 설정 기반 독립 검증은 초기화 5.05초·도구 25개 조회·`browser_navigate(about:blank)`·`browser_close` 모두 성공(종료 0)했다. 이는 다음 Codex 시작 시 타임아웃 재발이 없음을 보증하지 않는다.
- 공식 App Server 문서와 설치 CLI의 생성 프로토콜에서 reload/status 경로를 확인했다. 로컬 proxy를 통한 연결 시도는 두 번 모두 initialize 응답 제한을 넘겨 종료했으며 실제 reload 요청을 보내지 않았다. 현재 대화에는 Playwright 도구가 여전히 없으므로 세션 재연결은 미검증이다. 같은 경로의 재시도는 중단했다.
- Q-32를 WAIT로 정정했다. 해제 조건은 다음 Codex 연결에서 60초 설정 반영·도구 노출·실제 브라우저 호출 성공이다. 큐는 `AUTO 0 / APPROVE 0 / DECIDE 0 / WAIT 5`이며 Q-32·Q-23 해제 시각은 미정, 고정 달력 대기는 Q-07의 2026-11-26이다.
- 제품 코드·운영 데이터·다른 MCP 인증은 변경하지 않았다. 이 로컬 설정 기록은 Q-31 최소 정책 요약 1회 저장 승인 범위에 포함되지 않아 OpenViking 추가 전송은 하지 않는다. 제품 이슈의 외부 상태 변경도 수행하지 않는다.
- 이번 문서 변경 검증: Node 22.23.2 `npm run lint`·`npm run build`(TypeScript 포함)·`git diff --check`·`npm run continuity:check` 통과. 제품 코드 변경이 없어 단위 테스트는 재실행하지 않았다. 앞선 전체 검증 결과와 이번 진단 검증을 구분한다. 문서 2개를 직접 대조하고 main 원자적 커밋·푸시로 기록한다.
