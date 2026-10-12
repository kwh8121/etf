# US ETF 등락 웹 열람 경로 설계 (한국 관측일 라우트)

> 작성 2026-10-12. 상태: 사양 초안, 구현 계획 미작성. Q-19 ④(웹 열람 키) 권장안을 가정한다. 다른 결정이 나오면 5.1절만 바뀐다.
> 제품·데이터 계약은 `docs/plans/ETF-signal-MVP-plan-v2.2.md`, 격리 원칙은 `docs/plans/implementation/M5-us-p1-adapter-plan.md`, KR 대응 설계는 `docs/plans/implementation/kr-signal-web-view-design.md`를 따른다. 실행 상태는 `docs/plans/NEXT.md`에 기록한다.

## 1. 배경과 KR과의 차이

KR 열람 경로(`/signals/kr/<기준일>`)는 구현·배포됐고 Telegram 헤더가 링크한다. US에는 이에 해당하는 화면이 없다. 기존 KR 화면 하단의 "미국 ETF 등락 · P1 실험" 카드는 웹 배포 환경의 `ENABLE_US_ETF_P1`로만 켜지며(Vercel에는 설정하지 않았다), 최신 run 한 건의 전체 행을 날짜 구분 없이 보여준다.

KR과 다른 점이 설계를 결정한다.

| 항목 | KR | US |
| --- | --- | --- |
| 날짜 키 | `bas_dd`(KRX 기준일) | 없음. `bas_dd`·`market_date`가 null이다. 응답에 공식 시장일이 없다 |
| 실행 시점 | 거래일 다음 영업일 09:30 | 화~토 07:30 KST 계획, 근무시간 PC 사정으로 지연 가능 |
| 신호 | 고정 8유형(raw·liquid) + 가변 2유형 | 4유형, 모두 `screen='raw'`, 가변 없음 |
| 행 수 | 80행 남짓 | 유형당 수백~수천 행(2026-09-23 실행: 3,143·1,795·5,610·1,430) |
| 보고 | 전체 | 유형별 상위 10건 |
| 순위 | 연속 | 같은 종목 반복·ETN 제외로 빈틈 있음 |

## 2. 목표

Telegram의 US 보고를 받은 뒤 링크를 눌러, 보고와 같은 상위 10건을 상승·하락 대비 화면에서 확인한다. 링크는 며칠 뒤 열어도 같은 화면을 가리킨다.

## 3. 확정된 결정과 가정

| 항목 | 내용 | 상태 |
| --- | --- | --- |
| 호스팅·인증 | KR과 같은 Vercel + Supabase 로그인, UI 경로에 서비스 역할 키 없음 | KR 결정 계승 |
| 색 관행 | 상승 적색 ▲ / 하락 청색 ▼, 기호 병기 | KR 결정 계승 |
| Telegram 변경 | 링크 한 줄만 추가, 환경 변수 미설정 시 생략 | KR 결정 계승 |
| 화면 키 | 한국 관측일 `YYYY-MM-DD`(run의 `observed_at`을 KST로 환산) | Q-19 ④ 권장안(미확정) |
| 표기 | "한국 시간 관측일"로 표기하고 미국 거래일처럼 쓰지 않는다 | 이 문서의 결정 |
| 표시 범위 | 유형별 상위 10건 + "전체 N건" | 보고와 일치시킨다 |

## 4. 범위

### 포함

- `app/signals/us/[obsDate]/page.tsx`: 한국 관측일 기준 US 신호 열람
- `app/signals/us/latest` 진입: 최신 관측일로 리다이렉트(Telegram 링크는 항상 날짜 고정 URL을 쓴다)
- 기간 세그먼트(일간·5일)와 상승·하락 대비 레이아웃, 전·후 관측일 이동
- US 보고 헤더에 `상세: <base>/signals/us/<관측일>` 한 줄(`ETF_WEB_BASE_URL` 미설정 시 생략)
- 고지 문구 `US_ETF_P1_DISCLOSURE`와 실험 표기 유지

### 제외

- 유형별 전체 행 목록(수천 행)과 페이징
- 스크린(raw·liquid) 세그먼트: US에는 `raw`뿐이다
- 기존 KR 화면 하단 US 카드 변경: 이번 범위에서는 그대로 둔다. 웹 환경에 플래그를 켜지 않으므로 노출되지 않는다
- 차트, 종목 상세, 캘린더 피커

## 5. 아키텍처

### 5.1 라우트와 키

| 경로 | 역할 |
| --- | --- |
| `app/signals/us/[obsDate]/page.tsx` | 신설. 해당 한국 관측일의 US 신호를 렌더링 |
| `app/signals/us/latest/page.tsx` | 최신 관측일을 조회해 위 경로로 `redirect` |

`obsDate`는 `YYYY-MM-DD`를 정본으로 하고 `YYYYMMDD`도 정규화한다. 형식 오류·실재하지 않는 날짜는 `notFound()`. KR의 정규화 함수(`lib/dashboard/bas-dd.ts`)를 재사용할 수 있는지 구현 계획에서 확인한다.

같은 관측일에 `COMPLETED` run이 여러 건이면 `completed_at` 내림차순, `id` 내림차순의 첫 건을 쓴다(KR과 같은 규칙). 이 경우 Telegram 링크는 같은 날짜를 가리키므로 화면은 마지막 run을 보여준다. 화면 헤더에 사용한 run의 관측 시각을 표시해 어떤 스냅샷인지 드러낸다.

### 5.2 조회

관측일 → UTC 구간(`[날짜 00:00 KST, +24h)`)으로 바꿔 `signal_run`을 조회한다. 구간 계산은 `scripts/verify-us-candidate.ts`의 `toKstDate`·`kstDayBoundsUtc`와 같은 규칙을 쓰되, UI는 서비스 역할 키가 없으므로 별도 순수 함수(`lib/dashboard/us-signal-view.ts`)로 구현하고 두 구현이 같은 결과를 내는 테스트를 둔다.

1. `signal_run`: `market='US'`, `strategy_version='m5-us-etf-movers-p1-v1'`, `status='COMPLETED'`, `observed_at` 구간, 정렬 후 1건.
2. 4유형 각각 `signal_daily`를 `run_id`·`signal_type`으로 조회해 `rank, code` 순 상위 10건과 `count: 'exact'`를 가져온다. 전체 행을 가져오지 않는다.
3. 전·후 관측일: `observed_at`이 구간보다 앞/뒤인 `COMPLETED` run 각 1건의 한국 날짜.

RLS는 `authenticated` SELECT를 쓴다. 한 유형의 조회가 실패하면 그 유형만 오류 문구를 보이고 나머지는 유지한다.

## 6. 화면 사양

```
헤더: 미국 ETF 등락 · P1 실험
      한국 시간 2026-10-12 관측 · 관측 시각 07:31 · 상태 COMPLETED
고지: US_ETF_P1_DISCLOSURE
전·후 이동: ‹ 이전 관측일          다음 관측일 ›
세그먼트: [ 일간 ] 5일
방향 블록 A: ▲ 상승 상위 10건 / 전체 N건 (적색)
방향 블록 B: ▼ 하락 상위 10건 / 전체 N건 (청색)
```

- 컴포넌트는 `components/kr-signal-board.tsx`의 세그먼트·방향 블록 패턴을 재사용한다. 스크린 세그먼트가 없으므로 구현 계획에서 공용 컴포넌트로 일반화할지 US 전용 컴포넌트로 둘지 정한다. KR 화면 동작과 기존 테스트는 바뀌면 안 된다.
- 값은 `+12.34%` 형식, 상승 ▲·하락 ▼ 기호와 색을 함께 쓴다. 숫자는 `tabular-nums`.
- 유형이 0건이면 해당 블록에 "해당 신호 없음"을 표시한다.
- 해당 관측일의 run이 없으면 "해당 관측일의 US 실행이 없습니다"를 보이고 전·후 이동은 유지한다.
- 이 화면은 미국 거래일을 의미하지 않는다. 헤더 보조문에 "Kiwoom 순위 기준, 미국 장중·장후 시점에 따라 값이 달라질 수 있습니다"를 둔다.

## 7. Telegram 링크 계약

`formatExperimentalTelegramReport`에 선택 필드 `webUrl?: string`을 추가해 값이 있으면 헤더 마지막 줄에 `상세: <url>`을 덧붙인다(KR `formatTelegramReport`의 방식을 따른다. 구현 계획에서 현재 시그니처를 확인한다). `scripts/report-us-movers.ts`가 `ETF_WEB_BASE_URL`이 있을 때만 `${base}/signals/us/${관측일}`을 조립해 넘긴다. 환경 변수가 없으면 출력은 현재와 바이트 단위로 같아야 하며 테스트로 고정한다. `.github/workflows/us-etf-movers.yml` env에 `ETF_WEB_BASE_URL: ${{ vars.ETF_WEB_BASE_URL }}` 매핑을 추가한다.

링크 활성화는 US 운영 전환(Q-21) 뒤의 별도 승인 항목이다. 값은 같은 `etf-signal-azure.vercel.app` 도메인이다.

## 8. 테스트 전략

TDD, 순수 함수부터.

| 대상 | 확인 내용 |
| --- | --- |
| 관측일 구간 변환 | KST↔UTC 경계(전날 15:00Z 이상 ~ 당일 15:00Z 미만), `verify-us-candidate`와 같은 결과 |
| `obsDate` 정규화 | `2026-10-12`·`20261012` 같은 값, 형식 오류·없는 날짜 거부 |
| 방향 분류 | US 4유형의 기간·방향 매핑 |
| 라우트 계약(문자열) | `strategy_version`·`market` US 한정, `COMPLETED` 한정, 서비스 역할 클라이언트 미사용, 고지 문구·`P1 실험` 표기, `count: 'exact'`와 limit 10 |
| Telegram 링크 | 미설정 시 기존 출력과 동일, 설정 시 헤더 마지막 줄에 한 번만, 분할 조각마다 포함 |
| 리다이렉트 | `latest` 경로가 최신 관측일로 이동만 수행 |

전체 게이트는 `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Node는 `.nvmrc`의 22.23.2.

## 9. 위험과 완화

| 위험 | 영향 | 완화 |
| --- | --- | --- |
| 관측일을 미국 거래일로 오인 | 잘못된 날짜 해석 | 모든 제목·보조문에 "한국 시간 관측일"을 쓰고 미국 거래일 표현을 쓰지 않는다 |
| 같은 관측일 다중 run | 링크가 마지막 run을 가리킴 | 사용한 run의 관측 시각을 화면에 표시한다. Telegram 중복 발송은 `verify:us-candidate`가 별도로 잡는다 |
| 링크 추가로 US 보고 분할 변화 | 메시지 수 증가 | 경계 테스트. US 보고는 통상 1메시지이고 약 60자 증가 |
| 수천 행 조회 | 느림·한도 | 유형당 상위 10건만 조회한다 |
| 공용 컴포넌트 일반화가 KR을 깨뜨림 | KR 화면 회귀 | KR 기존 계약 테스트를 그대로 통과시키고 필요하면 US 전용 컴포넌트로 분리한다 |
| 웹 환경에 `ENABLE_US_ETF_P1`을 켜면 KR 화면 하단 카드 노출 | 중복 노출 | 웹 환경에는 플래그를 설정하지 않는다는 점을 Q-21에 명시한다 |

## 10. 완료 정의

- [ ] `/signals/us/<관측일>`이 보고와 같은 상위 10건을 방향 대비로 렌더링한다
- [ ] `/signals/us/latest`가 최신 관측일로 리다이렉트한다
- [ ] 전·후 관측일 이동이 `COMPLETED` run이 있는 날만 대상으로 동작한다
- [ ] 고지 문구와 `P1 실험` 표기, "한국 시간 관측일" 표기가 있다
- [ ] `ETF_WEB_BASE_URL` 미설정 시 US Telegram 출력이 현재와 같다
- [ ] 비인증 접근이 `/auth/login`으로 리다이렉트된다(배포 후 smoke)
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과
