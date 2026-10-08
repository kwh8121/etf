# KR 신호 웹 열람 경로 설계 (기준일 라우트 + 방향 대비)

> 작성 2026-10-08. 상태: 설계 승인 완료, 구현 계획 미작성.
> 이 문서는 설계 정본이다. 제품 요구사항과 데이터 계약은 `docs/plans/ETF-signal-MVP-plan-v2.2.md`와 `docs/plans/ETF-signal-MVP-v2.2-ROADMAP.md`를 따르고, 실행 상태는 `docs/plans/NEXT.md`에 기록한다.

## 1. 배경과 문제

운영 Telegram 보고는 정상 수신되고 있으나 사람이 읽기 어렵다. 코드에서 확인한 원인은 다음과 같다.

- `sendTelegramMessages`가 `parse_mode` 없이 평문만 보낸다(`lib/notifications/telegram.ts`). 굵게·고정폭 강조가 불가능해 섹션 제목과 데이터 행의 서체가 같다.
- 고정 8유형의 섹션 제목이 "일간 상승 (전체)/(유동성)", "일간 하락 (전체)/(유동성)", "5거래일 …" 형태로 한두 글자만 다르다(`scripts/report-kr-signals.ts`의 `sectionTitle`). 강조가 없어 눈으로 스캔되지 않는다.
- 데이터 행에 방향 표시가 없다. 부호만 다르고 기호·색이 없다(`formatValue`).
- 80행 이상이 4096자 제한에 걸려 메시지가 2개 이상으로 분할되고, 조각마다 4줄 헤더가 반복된다(`splitTelegramText`). 분할 지점에서 현재 섹션 정보를 잃는다.
- ETF 이름이 길어 모바일에서 줄바꿈되면 순위·값 정렬이 깨진다.

웹 대시보드는 M4에서 이미 구현돼 있다(`app/protected/page.tsx`, `lib/dashboard/kr-signal-view.ts`, 테스트 `test/dashboard/`). Supabase SSR 인증과 `signal_run`·`signal_daily`의 `authenticated` SELECT 정책도 적용돼 있다. 빠진 것은 세 가지다.

1. 배포가 없어 어디서도 열 수 없다(`docs/guides/etf-signal-mvp-development-review-deployment-harness.md`의 웹 배포 플랫폼 항목은 "외부 확인 필요").
2. Telegram 메시지가 웹을 링크하지 않는다.
3. 페이지 자체에 방향 색·모바일 레이아웃·기준일 이동이 없다.

## 2. 목표와 성공 기준

매일 아침 Telegram 알림을 받은 뒤 링크를 눌러, 상승·하락을 되짚지 않고 바로 구분할 수 있는 화면에서 당일 신호를 검토한다.

- 한 화면에서 방향 구분에 다른 요소를 참조할 필요가 없다.
- Telegram 링크는 그날 기준일을 영구적으로 가리키며, 며칠 뒤 열어도 같은 화면이 나온다.
- 휴대폰에서 가로 스크롤 없이 읽힌다.

## 3. 확정된 결정

| 항목 | 결정 | 근거 |
| --- | --- | --- |
| 호스팅 | Vercel 배포 + Supabase 로그인 | 2026-10-08 사용자 선택. 기존 SSR 인증·RLS를 그대로 쓰고 휴대폰에서 링크로 바로 열람 |
| Telegram 변경 범위 | 링크 한 줄만 추가 | 2026-10-08 사용자 선택. M6 관측 7/20 진행 중이라 보고 내용 변경 위험을 피한다 |
| 화면 구조 | 기준일 라우트 + 방향 대비 레이아웃 | 2026-10-08 사용자 선택(A안). 링크가 그날을 가리켜야 의미가 있고 방향 구분이 레이아웃으로 해결된다 |
| 색 관행 | 상승 적색 / 하락 청색 | 2026-10-08 사용자 선택. 국내 관행 |
| 날짜 이동 | 전·후 거래일 버튼 | 캘린더 피커는 범위에서 제외 |

## 4. 범위

### 포함

- 기준일별 KR 신호 열람 라우트 신설과 기존 보호 경로의 리다이렉트 전환
- 기간·스크린 세그먼트와 상승·하락 대비 레이아웃, 방향 색·기호
- 가변 신호(`turnover_surge`, `new_listing`) 별도 섹션
- Telegram 보고에 기준일 웹 링크 한 줄 추가(환경 변수 미설정 시 생략)
- Vercel 배포와 배포 후 UI smoke 확인

### 제외

- 캘린더 날짜 피커
- 차트와 추세 표시
- 종목 상세 페이지
- 알림 설정 UI
- 과거 기준일 전체 목록 페이지
- Telegram 메시지 본문 구조 변경(M6 20/20 완료 후 재검토)
- US P1 화면 구조 변경(기존 플래그 분기와 하단 배치 유지)

## 5. 아키텍처

### 5.1 라우트

| 경로 | 역할 |
| --- | --- |
| `app/signals/kr/[basDd]/page.tsx` | 신설. 해당 기준일의 KR 신호를 렌더링한다 |
| `app/protected/page.tsx` | 최신 KR 기준일을 조회해 위 경로로 `redirect`한다. 기존 렌더링 코드는 신설 라우트로 이전한다 |

`/protected`를 리다이렉트로 남기는 이유는 로그인 후 착지 경로와 기존 북마크를 깨지 않기 위해서다.

`basDd`는 `YYYY-MM-DD`를 정본 형식으로 하고 `YYYYMMDD`도 정규화해 받는다. 두 형식 중 어느 것도 아니거나 실재하지 않는 날짜면 `notFound()`를 호출한다.

이 프로젝트의 Next.js에서 `params`는 Promise이므로 `await params`로 읽는다. `cacheComponents: true`가 켜져 있어 `export const instant = false`가 유효하며, 인증과 DB 조회를 하는 동적 경로이므로 기존 `app/protected/page.tsx`와 같이 `instant = false`와 `await connection()`을 유지한다.

### 5.2 인증과 데이터 접근

기존 패턴을 바꾸지 않는다.

- `lib/supabase/server.ts`의 `createClient()`와 `supabase.auth.getClaims()`를 쓰고, 실패하면 `/auth/login`으로 리다이렉트한다.
- UI 경로에 서비스 역할 클라이언트를 만들지 않는다(ROADMAP M4 규칙). 읽기는 전부 `authenticated` RLS 정책을 통과한다.

조회 순서는 다음과 같다.

1. `signal_run`에서 `market='KR'`, `strategy_version='m3-price-movers-v1'`, `bas_dd=<기준일>`로 1건을 가져온다. 같은 기준일에 여러 실행이 있으면 `completed_at` 내림차순, `id` 내림차순의 첫 건을 쓴다(기존 페이지의 정렬 규칙과 같다).
2. 1단계의 `id`로 `signal_daily`를 `signal_type`, `screen`, `rank` 순으로 조회한다.
3. 전·후 이동 대상은 `signal_run`에서 해당 기준일보다 작은/큰 `bas_dd` 중 가장 가까운 1건씩 조회한다. 신호 실행이 있는 날만 이동 대상이 되므로 빈 화면으로 이동하지 않는다. 없으면 버튼을 비활성화한다.

해당 기준일의 실행이 없으면 "해당 기준일의 신호 실행이 없습니다"를 보여주고, 전·후 이동은 계속 제공한다.

### 5.3 신호 유형 분류

`signal_type` 값에서 기간과 방향을 파생한다. 분류 로직은 `lib/dashboard/kr-signal-view.ts`에 순수 함수로 추가해 UI와 분리한다.

| `signal_type` | 기간 | 방향 |
| --- | --- | --- |
| `daily_price_gain` | `daily` | `gain` |
| `daily_price_loss` | `daily` | `loss` |
| `five_day_price_gain` | `five_day` | `gain` |
| `five_day_price_loss` | `five_day` | `loss` |
| `turnover_surge` | 해당 없음 | 해당 없음 |
| `new_listing` | 해당 없음 | 해당 없음 |

기간·방향이 없는 두 유형은 가변 신호다. 고정 8유형은 각 10건이 보장되지만 가변 신호는 그날 이벤트 수에 따라 0건 이상이다(`docs/plans/NEXT.md` Q-08의 신호 행 수 방법론). 따라서 총 행 수가 80을 넘는 것은 정상이며, 화면은 이를 전제로 만든다.

## 6. 화면 사양

### 6.1 구조

```
기준일 헤더: 2026-10-07 (수) · 상태 COMPLETED · 완료 시각
데이터 품질: 판정 문구 (기존 qualityMessage 규칙 유지)
전·후 이동: ‹ 이전 거래일          다음 거래일 ›
세그먼트 1: [ 일간 ] 5거래일
세그먼트 2: [ 전체 ] 유동성
방향 블록 A: ▲ 상승 10행 (적색)
방향 블록 B: ▼ 하락 10행 (청색)
가변 신호: 거래대금 급증 / 신규 상장 (0건이면 숨김)
고지 문구
US P1 섹션 (플래그 켜진 경우에만)
```

데이터 품질 판정은 기존 `qualityMessage` 규칙을 그대로 옮긴다. 상태가 `COMPLETED`이고 섹션이 있으면 완료 문구, 섹션이 0건이면 `검토 필요: 신호 항목이 없습니다`, 그 밖에는 실행 상태 확인 문구다. 현재 계약 테스트가 이 문자열을 검사하므로 문구를 바꾸지 않는다.

세그먼트 선택에 따라 상승·하락 각 10행만 남으므로 한 화면이 20행이다. 모바일은 상승·하락을 상하로, `md` 이상은 좌우 2열로 배치한다.

### 6.2 상호작용

세그먼트는 클라이언트 상태만 쓰는 작은 클라이언트 컴포넌트로 만든다. 서버 컴포넌트가 해당 기준일의 전체 행(80행 남짓)을 한 번에 넘기고 필터링만 클라이언트에서 한다. 재조회가 없으므로 전환이 즉시 일어나고 추가 쿼리도 없다.

세그먼트 선택 상태는 URL에 반영하지 않는다. Telegram 링크가 가리키는 기본 상태는 항상 "일간 · 전체"다.

### 6.3 색과 접근성

- 상승 적색, 하락 청색 토큰을 `app/globals.css`에 추가한다. 기존 shadcn/ui 테마 변수 패턴을 따르고 다크 모드 값을 함께 정의한다.
- 색만으로 구분하지 않는다. ▲/▼ 기호와 부호(`+`/`-`)를 항상 함께 표시한다. 색각 이상과 흑백 출력에서도 방향이 읽힌다.
- 숫자는 `tabular-nums` 고정폭으로 우측 정렬한다. 순위·값 칼럼 폭을 고정하고 이름만 최대 2줄로 줄바꿈해 가로 스크롤이 생기지 않게 한다.

### 6.4 유지해야 하는 문구

다음 두 고지는 문구를 바꾸지 않고 유지한다. ROADMAP R1 게이트의 "자동매매·추천 오인 가능성과 총수익률 오인 가능성이 UI·Telegram에서 차단된다" 항목 대상이다.

- `자동매매 또는 매수·매도 추천이 아닌 탐색 결과입니다.`
- `5거래일 값은 KRX 종가 기준 가격수익률이며 분배금·기업행동 조정 총수익률이 아닙니다.`

US P1 섹션의 `US_ETF_P1_DISCLOSURE`와 실험 구분 표기도 그대로 유지한다.

## 7. Telegram 링크 계약

`lib/notifications/telegram.ts`의 `TelegramReportInput`에 선택 필드 `webUrl?: string`을 추가한다. 값이 있으면 헤더의 마지막 줄에 `상세: <url>`을 덧붙인다.

헤더에 두는 이유는 메시지가 분할되어도 모든 조각이 링크를 갖게 하기 위해서다. 조각마다 약 60자가 늘어나므로 분할 경계가 달라질 수 있다. 이 동작은 테스트로 고정한다.

링크의 base URL은 비밀값이 아니므로 `lib/config/server-env.ts`의 `serverSecretEnvKeys`에 추가하지 않는다. 별도 환경 변수 `ETF_WEB_BASE_URL`로 읽고 다음 규칙을 적용한다.

- 값이 없거나 빈 문자열이면 `webUrl`을 넘기지 않아 **링크 줄을 생략한다**. 이때 출력은 현재 형식과 완전히 같다.
- 값이 있으면 `scripts/report-kr-signals.ts`가 `${base}/signals/kr/${basDd}` 형식으로 조립한다. 끝의 `/`는 정규화한다.

이 규칙 덕분에 코드를 병합해도 환경 변수를 설정하기 전까지 운영 보고는 바이트 단위로 동일하다. 환경 변수를 켜는 시점은 사용자가 정한다. M6 관측의 완전성 판정은 `signal_run`과 `signal_daily`를 대조하므로(`scripts/verify-kr-daily-candidate.ts`) 링크 줄은 판정에 영향을 주지 않는다.

## 8. 배포

배포는 외부 부작용이므로 코드가 완성된 뒤 증거와 함께 별도로 승인받는다.

- Vercel 프로젝트를 저장소에 연결하고 `main` 푸시를 배포 트리거로 둔다.
- 환경 변수는 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 설정한다. **`SUPABASE_SERVICE_ROLE_KEY`와 Kiwoom·KRX·Telegram 자격 증명은 웹 배포 환경에 넣지 않는다.**
- Supabase Auth의 Redirect URL 목록에 배포 도메인을 추가해야 로그인 콜백이 동작한다.
- GitHub Actions 쪽에 `ETF_WEB_BASE_URL`을 변수(비밀 아님)로 추가한다.
- 배포 후 `docs/guides/etf-signal-mvp-development-review-deployment-harness.md`의 Q7 UI Smoke를 수행한다. 비인증 접근이 `/auth/login`으로 리다이렉트되는지, 인증 후 필수 섹션이 보이는지, RLS 경계가 유지되는지 확인하고 배포 ID·URL·commit SHA를 기록한다.

## 9. 테스트 전략

TDD로 순수 함수부터 작성한다. RED → GREEN 순서를 지킨다.

| 대상 | 위치 | 확인 내용 |
| --- | --- | --- |
| 기간·방향 분류 | `test/dashboard/kr-signal-view.test.ts` | 고정 8유형이 올바른 기간·방향으로 분류되고, 가변 2유형은 분류 대상에서 제외된다 |
| `basDd` 정규화 | `test/dashboard/` 신규 | `2026-10-07`·`20261007`을 같은 값으로 정규화하고, 형식 오류·실재하지 않는 날짜를 거부한다 |
| Telegram 링크 포맷 | `test/notifications/telegram.test.ts` | `webUrl` 없으면 기존 출력과 동일하고, 있으면 헤더 마지막 줄에 한 번만 들어가며 모든 분할 조각에 포함된다 |
| Telegram 분할 경계 | `test/notifications/telegram.test.ts` | 링크 추가로 길이가 늘어난 경우에도 `maxLength`를 넘는 메시지가 생기지 않는다 |
| 라우트 계약 | `test/dashboard/protected-page-contract.test.ts` 이전 | 현재 검사 항목(`strategy_version` 한정, `completed_at` 정렬, `데이터 품질`, `신호 항목이 없습니다`, `isUsEtfP1Enabled()`, `market` US 한정, US P1 제목과 비차단 문구)이 신설 라우트 파일에서 유지된다. 고지 문구 2개 검사를 새로 추가한다 |
| 리다이렉트 | `test/dashboard/` 신규 | `app/protected/page.tsx`가 최신 기준일로 리다이렉트만 수행한다 |

기존 `test/dashboard/protected-page-contract.test.ts`는 `app/protected/page.tsx`의 **문자열을 읽어 검사**한다. 렌더링 코드를 신설 라우트로 옮기면 이 테스트가 깨지므로, 검사 대상 파일 경로를 신설 라우트로 이전하는 작업을 같은 커밋에 포함한다.

전체 게이트는 `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`를 모두 통과해야 한다. Node는 `.nvmrc`의 22.23.2를 쓴다.

## 10. 위험과 완화

| 위험 | 영향 | 완화 |
| --- | --- | --- |
| M6 관측 중 보고 형식 변경 | 남은 13거래일의 증거 오염 | 링크는 환경 변수가 설정될 때만 나타난다. 미설정 시 출력이 현재와 동일하다. 환경 변수 설정 시점을 사용자가 정한다 |
| 계약 테스트가 파일 경로에 묶여 있음 | 라우트 이전 시 테스트 실패 | 이전을 같은 커밋에 포함하고 검사 항목을 그대로 유지한다 |
| 링크 추가로 메시지 분할 경계 변화 | 메시지 수 증가 | 경계 테스트로 고정한다. DB 판정에는 영향이 없다 |
| 공개 URL 노출 | 미인증 접근 시도 | 데이터 조회는 전부 `authenticated` RLS를 통과한다. 미인증은 `/auth/login`으로 리다이렉트된다. 서비스 역할 키를 웹 환경에 두지 않는다 |
| 같은 기준일 다중 실행 | 어느 실행을 보여줄지 모호 | `completed_at`·`id` 내림차순 첫 건으로 고정한다(기존 페이지와 같은 규칙) |

## 11. 완료 정의

- [ ] `app/signals/kr/[basDd]/page.tsx`가 기준일별 신호를 방향 대비 레이아웃으로 렌더링한다
- [ ] `/protected`가 최신 기준일로 리다이렉트한다
- [ ] 상승·하락이 색과 기호로 모두 구분되고 모바일에서 가로 스크롤이 없다
- [ ] 전·후 거래일 이동이 신호 실행이 있는 날만 대상으로 동작한다
- [ ] 가변 신호 섹션이 0건일 때 숨겨진다
- [ ] 고지 문구 2개와 US P1 실험 구분 표기가 유지된다
- [ ] `ETF_WEB_BASE_URL` 미설정 시 Telegram 출력이 현재와 동일하다
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과
- [ ] (별도 승인 후) Vercel 배포 완료, Q7 UI Smoke 증거와 배포 ID·URL·commit SHA 기록
