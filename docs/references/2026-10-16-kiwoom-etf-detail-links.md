# Telegram ETF 종목별 키움 상세 링크 검토

> 확인일: 2026-10-16. 실행 상태와 해제 조건의 정본은 `docs/plans/NEXT.md` Q-33이다.

## 확정한 요구사항

- 사용자 `키움을 기본으로 해서 진행`에 따라 한국·미국 ETF의 기본 상세 조회 대상으로 키움을 선택한다.
- Telegram의 ETF별 링크가 해당 종목의 상세화면으로 연결돼야 한다. 모바일과 PC 모두 대상이며 앱 실행·로그인 화면 도착만으로 완료 처리하지 않는다.
- 기존 종목코드·티커로 링크를 구성한다. 상세 데이터 수집·저장, CLI 조회 결과를 보여주는 별도 상세 서비스는 추가하지 않는다.
- 네이버·Yahoo로 기본 대상을 임의 변경하지 않는다. 보조 웹 링크 제공 여부는 키움 연결 검증 뒤 결정한다.

## 확인한 사실

| 대상 | 확인 결과 | 증거 |
| --- | --- | --- |
| 국내 알림 | 현재·직전 신호에 `code,name`이 있다. 현재 이름은 평문이다. | `scripts/report-kr-signals.ts` |
| 미국 알림 | 현재·직전 신호에 `code,name`이 있다. 현재 이름은 평문이다. | `scripts/report-us-movers.ts` |
| 랭크아웃 | 공통 formatter에서 이름을 별도로 출력한다. 변경 시 현재 순위 행과 함께 처리해야 한다. | `lib/signals/report-rank-changes.ts` |
| Telegram 발송 | 현재 `sendMessage`에 평문만 전달한다. 이름을 클릭하게 하려면 entities 또는 안전하게 escape한 HTML 적용이 필요하다. | `lib/notifications/telegram.ts`, [공식 MessageEntity](https://core.telegram.org/bots/api#messageentity) |
| 키움 CLI | 공식 가이드는 OpenAPI용 명령행 클라이언트로 설명한다. 이번 로컬 `spec search 딥링크 --limit 5`와 `spec search URL --limit 5`는 모두 검색 결과가 없었다. | [공식 CLI 가이드](https://github.com/Kiwoom-Securities/Kiwoom-REST-API/blob/main/SETUP-CLI.md) |
| 키움 WTS | 공개 브라우저 접근 시 QR·숫자코드를 사용하는 로그인 화면이다. 특정 ETF로의 이동과 로그인 후 종목 유지 여부는 확인하지 못했다. | [공식 WTS](https://wts2.kiwoom.com/) |
| WTS 공개 코드 | `KiwoomWtsHelper.js`와 당시 `app.7726d27244af5f3a03fc.js`가 HTTP 200. 공개 소스에서 `location.search`, `URLSearchParams`, `stockCode`, `stk_cd`, `heromts` 검색으로 외부 종목 전달 규칙을 찾지 못했다. `/chart` 등 화면 경로의 존재는 종목별 링크 지원 증거가 아니다. | WTS 페이지가 로드한 `/wts/static/js/` 파일을 브라우저에서 읽기 전용 확인 |
| 문서 검색 | Context7에는 관련 제3자 REST wrapper만 조회됐다. 공식 종목 상세 딥링크 문서를 확보한 것으로 보지 않는다. | Context7 resolve 결과와 공식 웹 검색 |

`검색 결과 없음`은 키움의 지원 부재를 증명하지 않는다. 현재 확인한 공개 자료만으로 실제 동작하는 주소를 만들 수 없다는 뜻이다. 추정 앱 스킴이나 WTS 주소에 임의 쿼리를 붙여 배포하지 않는다.

## 연결 검증 기준

1. 키움의 공식 종목 공유 URL 또는 공식 파라미터 문서를 확보한다. 공유 기능의 존재 자체도 아직 확정하지 않았다.
2. 국내·미국 각 2종목 이상을 비교해 종목 식별 방식과 URL 재사용 가능 여부를 확인한다. 공유 단축주소·서버 토큰이면 티커로 URL을 합성할 수 있다고 추정하지 않는다.
3. Telegram 모바일 앱의 내부·외부 브라우저와 PC에서 해당 종목이 열리는지 확인한다. 로그인 후 대상 종목이 보존되는지도 확인한다. iOS·Android 검증 범위를 구분한다.
4. 공식 HTTPS 링크로 충분하면 직접 연결한다. 앱 전용 스킴만 지원하면 Telegram 지원과 PC 대안을 먼저 확인하고 중계 페이지 필요 여부를 판단한다. 앱 실행 실패는 브라우저에서 신뢰성 있게 자동 감지된다고 가정하지 않는다.
5. 연결 규칙이 확보되면 TDD로 코드 생성·escape·종목코드 보존·미지원 코드·랭크아웃·메시지 분할을 검증하고 KR·US 보고에 적용한다. 실제 시험 발송은 별도 승인 대상이다.

## 공식 참고자료

- [영웅문S# 공식 앱 설명](https://play.google.com/store/apps/details?hl=ko&id=com.kiwoom.heromts): 국내·해외 주식과 종목홈 등 앱 기능. 외부 종목별 링크 규칙을 설명하는 문서는 아니다.
- [Telegram InlineKeyboardButton](https://core.telegram.org/bots/api#inlinekeyboardbutton): URL 버튼의 문서상 지원은 HTTP 또는 `tg://`다. 임의 앱 스킴의 호환성을 이 문서로 보증하지 않는다.

제품 코드·환경 변수·운영 DB·Telegram 발송은 변경하지 않았다. 구현 완료나 모바일·PC 동작 검증 완료로 해석하지 않는다.
