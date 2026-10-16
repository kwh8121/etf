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

## Telegram ETF별 웹 상세 링크 구현

- 사용자 `키움증권에서는 찾지 못하겠습니다. 아까 제시했던 네이버쪽을 처리하는것이 좋을것 같습니다.`로 조회 대상 방침을 바꿨다. 국내 네이버·미국 Yahoo 조합 적용 여부를 선택 질문으로 제시하고, 답변 전에도 이 조합을 기본 가정으로 명시해 가역적인 구현을 진행했다. 미국 네이버의 거래소 구분 주소를 기존 티커만으로 확정하지 못했으며 추가 매핑 수집·임의 접미사는 도입하지 않았다.
- 변경: 새 순수 함수 `lib/notifications/etf-detail-link.ts`로 URL 구성·HTML escape·유효 코드 검사. KR·US 보고의 현재·랭크아웃 이름에 링크를 붙이고 해당 보고만 HTML 모드를 명시한다. Telegram 미리보기는 현재 공식 `link_preview_options`로 비활성화한다. 일반 상태 알림은 기본 텍스트 전송이다. 단일 HTML 행 초과는 발송 전에 오류로 끝내고 나머지는 완전한 행 단위로 분할한다.
- TDD: URL/특수문자·메타데이터·HTML 옵션·랭크아웃·초과 행·보고 통합 테스트의 실패를 확인한 뒤 구현했다. 전체 검증(Node 22.23.2): 53파일·313테스트, `npx tsc --noEmit`, `.opencode/**` 제외 lint, production build(17개 정적 페이지) 통과. 기본 `npm run lint`는 기존 사용자 미추적 `.opencode/skills/mem0-mem0/scripts/mem0_doc_search.ts`의 `no-explicit-any` 4건으로 실패했고 해당 파일은 보존했다. 독립 code-reviewer 리뷰 APPROVE·지적 0건이다.
- 공식 Telegram 문서는 Context7로 HTML 링크·escape·길이 제한·미리보기 옵션을 확인했다. Chromium 실측: 네이버 069500은 360×800·1440×900에서 종목 일치·문서 폭 360·1440px. Yahoo VOO도 양쪽에서 종목 일치·문서 폭 364·1440px. Yahoo 작은 화면에는 4px 넘침이 있다. 실기기나 Telegram 내장 브라우저 검증 완료로 간주하지 않는다.
- 데이터 수집·운영 DB 쓰기·환경 변수·timer·수동 dispatch·시험 Telegram 발송을 추가하지 않았다. 다음 새 보고에 적용되며 이미 받은 메시지는 그대로다. 사용 안내 `docs/guides/etf-signal-mvp-etf-detail-links.md`와 NEXT Q-33을 갱신했고 키움 조사 문서는 이전 판단 이력으로 남겼다. Spec Kit constitution은 아직 템플릿이며 이번 기존 보고 포맷 변경에 새 운영 흐름을 적용하지 않았다.
- Linear KOR-68을 실제 구현·검증에 맞게 Done으로 동기화하고 read-back한다. Q-31의 메모리 저장 승인은 최소 정책 요약 한 차례로 소진됐으므로 이 작업을 OpenViking에 추가 전송하지 않는다. 다음 세션은 NEXT와 이 기록을 정본으로 사용한다.
- 종료 검증: `git diff --check`·`continuity:check` 통과. 브라우저를 닫고 이번 작업에서 만든 snapshot·console 로그만 정리했다. Q-32는 다음 시작 시 60초 설정 반영·재발 여부를 확인해야 하므로 WAIT를 유지한다. 최종 큐 `AUTO 0 / APPROVE 0 / DECIDE 0 / WAIT 5`; 고정 달력 대기는 2026-11-26이고 나머지 해제 시각은 미정이다. 변경 코드·테스트·문서를 원자적 main 커밋·푸시로 반영한다.

## 사용자 승인: 오늘 보고에 링크를 붙인 Telegram 시험 발송

- 사용자 `오늘 메시지에 url 입혀서 텔레그램으로 테스트 발송 해줘.`로 기존 채팅에 오늘 보고를 시험 전송하는 외부 부작용을 명시 승인했다. 승인 범위는 오늘 KR·US 보고 각각 한 차례이며 운영 수집·DB 쓰기·정규 재발송 표식 변경은 포함하지 않는다.
- 운영 DB GET 조회로 오늘 보고 표식을 확인했다. KR은 기준일 2026-10-15·오늘 09:35 KST 보고, US는 오늘 관측·09:56 KST 보고다. 기존 보고 코드를 임시 복사해 dry-run 결과 메시지만 추출했고 준비 단계 네트워크는 DB GET만 허용했다. 제품 원본·환경 변수는 수정하지 않았다.
- `[링크 테스트 · 오늘 보고 재전송]`을 각 메시지 앞에 붙였다. 준비 결과 KR 4개·149개 링크·최대 3,955자, US 2개·64개 링크·최대 3,598자로 길이 제한을 확인했다. 현재·랭크아웃 내용과 국내 네이버·미국 Yahoo 목적지를 유지했다.
- 실제 발송: 2026-10-16 12:29:57–12:30:00 KST, Telegram `ok:true` 총 6건. 메시지 ID 87–92, 응답 `text_link` 합계 213개로 전부 링크 entity로 처리됐다. 재시도는 없었고 발송 결과를 임시 ledger에 건별 기록했다. API 접수를 실수신·클릭 검증 완료로 표현하지 않는다.
- 두 운영 run의 전체 notes를 정렬한 JSON의 SHA-256은 발송 전후 동일했다. 운영 보고 표식·운영 DB를 바꾸지 않았으며 추가 시세 수집·workflow dispatch·timer 변경도 없다. 비밀값·채팅 ID·메시지 원문·환경 파일은 기록하지 않는다.
- 시작·종료 `continuity:check`, `git diff --check`로 문서 변경을 검증한다. 제품 코드가 바뀌지 않아 직전 구현의 313테스트·tsc·build 결과를 이번에 재실행한 것으로 기록하지 않는다. Experience 조회는 자동 승인 검토 기한 만료로 결과가 없어 적용하지 않았고, 메모리 저장 승인을 확대하지 않았다. NEXT Q-33·Linear KOR-68에 시험 결과를 추가하며 큐는 `AUTO 0 / APPROVE 0 / DECIDE 0 / WAIT 5`다.

## M6 정확성·관측 근거의 현재 확인 가능 범위 점검

- 사용자 `확인가능한 부분 확인해줘.`에 따라 현재 저장 신호·보관 원천·기존 workflow·runner journal을 읽기 전용으로 대조했다. 오늘 링크 시험 뒤의 사용자 `성공적으로 수신했습니다.`는 시험 재전송 수신 확인으로 기록한다. 자체 웹의 날짜·360px 표시나 과거 정규 원문 정확성까지 확인한 것으로 확대하지 않는다.
- 첫 임시 감사 실행 요청은 자동 승인 검토 기한 초과로 실행되지 않았다. 외부 부작용 승인이 필요한 것으로 해석하지 않고 기존 읽기 전용 `npm run verify:data -- all --output <비공개 결과 파일>`로 한 차례 다시 요청해 실행했다. Experience 검색도 직전 요청에서 검토 시간 만료로 결과가 없어 이전 메모리에 의존하지 않았다.
- 전수 감사: 총 26 run(KR 18·US 8), KR 최근 3개와 US 8개 일치, 과거 KR 15개 `signal_diff`, 전체 `ok:false`·종료 1. `selectionReasons=[]`, 전역 상장 이력 감사 통과·false listing/master 정정 후보 각각 0건. 과거 보존 Q-29·미국 범위 제한 Q-30은 그대로다. 원천 hash 통과를 원천 사실 정확성이나 계산기 독립 검증으로 표현하지 않는다.
- 최근 KR 후보는 기존 `verify:kr-candidate`로 10-13·10-14·10-15를 각각 실행해 모두 종료 0·`ok:true`를 확인했다. 순서대로 99·93·95행이며 고정 8유형 각 10행, 가변은 신규 4+거래대금 급증 15 / 급증 13 / 급증 15다. 추가·제거·변경 모두 0, 중복 run 없음·보고 표식 1건씩, 거래일 상태 `TRADING_COMPLETE`, 완전성 표식 true다. 원천 검사는 각각 22·21·21개로 모두 통과했다.
- 10-13·10-14는 사후 정정된 현재 DB 검증일이다. 신규 10-15에는 21일 원천이 run 입력에 모두 기록돼 현재 달력 원천 대체 경고가 없다. 과거 상장 이력 상태 복원 한계 경고는 남으며 당일 신규 상장 신호는 0건이다. 이 제한을 제거했다고 표현하지 않는다.
- 오늘 자동 운영: journal의 09:30:47 서비스 시작·09:30:49 KR dispatch와 GitHub `38829898321`(코드 `727d26c`, success)을 연결했다. Actions 로그 zip의 `report.reported=true`, 기준일 `20261015`, run `be5bb10a-…`, `kiwoomStatus=COMPLETE`, `blocked=null`을 확인했다. 자동 `kr-verify` `38830359178`도 success다. `gh run view --log`는 빈 출력이어서 근거로 쓰지 않고 공식 Actions 로그 endpoint zip을 읽었다.
- 판정: 최근 3일의 현재 DB 재계산 일치, 그중 사후 정정 2일과 신규 정상 운영 기술 후보 1일을 분리한다. 과거 운영 기록 9/20을 정확성 확인 9일로 사용하지 않는다. 최종 M6 관측일 승격·종료·Q-09 착수는 보류하며 이전 예상 종료일(10-27 기준일·10-28 처리일)을 더는 확정 일정으로 쓰지 않는다. 실제 거래일의 운영 관측과 아직 없는 원문/자체 웹 확인 증거가 남는다.
- 감사 보고: `docs/references/2026-10-16-m6-readonly-verification.md`. 비공개 증거는 Git 제외 `.omx/private-backups/m6-20261016-readonly/`에 0700 디렉터리·0600 파일로 보존했다. 전수 JSON SHA-256은 `347f294139d47dff89c2d63cd9132609f6c324aa0773e3bca74513f593f3f2c6`다. 운영 DB 수정·새 시세 API·Telegram 발송·timer/dispatch 실행·비밀값 기록은 없다.
- NEXT Q-08에 실제 검증 결과를 추가했다. Linear KOR-58의 오래된 7/20 설명보다 최신 감사·최종 승격 보류가 우선임을 명시해 동기화한다. OpenViking 저장은 기존 한 차례 승인 범위를 확대하지 않아 수행하지 않는다. 최종 큐는 `AUTO 0 / APPROVE 0 / DECIDE 0 / WAIT 5`이며 고정 달력 대기는 2026-11-26이다.
- 최종 검증(Node 22.23.2): 전체 53파일·313테스트, `npx tsc --noEmit`, `.opencode/**` 제외 lint, production build(17개 정적 페이지) 통과. 기본 lint는 기존 사용자 미추적 `.opencode/skills/mem0-mem0/scripts/mem0_doc_search.ts`의 `no-explicit-any` 4건으로 실패했고 수정하지 않았다. 독립 verifier가 NEXT의 정정 전 수치 표시 1건을 지적해 당시 102행과 현재 99행을 명시 구분했고 재검토 PASS·추가 지적 0건을 받았다. 감사 JSON·후보 JSON의 수치/무결성·큐 라벨 assertion, `git diff --check`, 종료 `continuity:check`도 통과했다. 문서 3개를 main 원자적 커밋·푸시로 기록한다.
