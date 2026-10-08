# KR 신호 웹 열람 경로 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기준일별 KR 신호를 상승·하락이 색과 기호로 즉시 구분되는 화면에서 열람하고, Telegram 보고가 그날 화면을 링크하게 한다.

**Architecture:** `app/signals/kr/[basDd]/page.tsx`를 신설해 기준일별로 `signal_run`·`signal_daily`를 읽고, 기간·스크린 세그먼트와 상승·하락 2열 대비를 담당하는 클라이언트 컴포넌트에 행을 넘긴다. 기존 `/protected`는 최신 기준일로 리다이렉트만 한다. 분류·정규화·URL 조립은 순수 함수로 분리해 단위 테스트로 고정하고, Telegram은 `webUrl` 선택 필드 한 줄만 추가한다.

**Tech Stack:** Node 22.23.2(`.nvmrc`), Next.js 16.3.5 App Router(`cacheComponents: true`), React 19, TypeScript strict, Tailwind 3.4 + shadcn/ui, Supabase SSR, Vitest 4(`environment: "node"`)

**Spec:** `docs/plans/implementation/kr-signal-web-view-design.md`

## Global Constraints

- Node는 `.nvmrc`의 `22.23.2`를 쓴다. 기본 Node 24에서는 스크립트 실행 옵션이 맞지 않는다.
- 전체 게이트는 `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` 전부 통과다.
- UI 경로에 서비스 역할 클라이언트를 만들지 않는다. 읽기는 전부 `authenticated` RLS 정책을 통과한다.
- 다음 두 고지 문구를 글자 그대로 유지한다: `자동매매 또는 매수·매도 추천이 아닌 탐색 결과입니다.` / `5거래일 값은 KRX 종가 기준 가격수익률이며 분배금·기업행동 조정 총수익률이 아닙니다.`
- 기존 계약 테스트가 검사하는 문자열을 바꾸지 않는다: `데이터 품질`, `신호 항목이 없습니다`, `아직 생성된 국내 신호 실행이 없습니다.`, `미국 ETF 등락 · P1 실험`, `국내 P0 신호에는 영향이`
- `.eq("strategy_version", "m3-price-movers-v1")`와 `.order("completed_at", { ascending: false })`는 상수로 추출하지 않고 리터럴로 둔다. 계약 테스트가 이 문자열을 검사한다.
- `ETF_WEB_BASE_URL`은 비밀값이 아니므로 `lib/config/server-env.ts`의 `serverSecretEnvKeys`에 추가하지 않는다.
- `ETF_WEB_BASE_URL`이 없으면 Telegram 출력은 현재와 바이트 단위로 동일해야 한다. M6 관측이 7/20 진행 중이다.
- Vitest는 `environment: "node"`이고 React Testing Library가 없다. UI는 기존 `protected-page-contract.test.ts` 방식의 문자열 계약 테스트로 고정하고, 테스트용 의존성을 새로 추가하지 않는다.
- 커밋 메시지는 `feat:`·`fix:`·`docs:`·`test:`·`chore:` 형식의 짧은 한국어 제목을 쓰고 `Co-Authored-By: Claude <모델명> <noreply@anthropic.com>` 트레일러로 끝낸다. 모델명은 실제로 그 커밋을 작성한 모델을 쓴다(이 저장소 이력도 커밋마다 작성 모델을 적고 있다).

## Review Focus

- `ETF_WEB_BASE_URL`에 후행 슬래시나 공백만 들어온 값 — 운영자가 손으로 넣는 값이라 `https://x.app/`이 `//signals/kr/...`를 만들거나 공백이 링크를 잘못 켠다. Task 3에서 테스트한다.
- 형식은 맞지만 실재하지 않는 날짜 `2026-02-30` — 정규식만 통과하면 조회 0건의 빈 화면이 된다. 404여야 한다. Task 1에서 테스트한다.
- 같은 기준일에 `signal_run`이 2건 이상 — 재실행한 날 과거 실행이 표시될 수 있다. `completed_at`·`id` 내림차순 첫 건으로 고정한다. Task 7에서 테스트한다.
- `signal_daily`의 `rank`가 `null`인 행 — 정렬에서 맨 앞으로 튀어나오면 순위가 어긋난다. 맨 뒤로 보낸다. Task 2에서 테스트한다.
- 링크 한 줄이 늘어 분할 경계를 넘는 경우 — `maxLength` 초과 메시지는 Telegram API가 거부한다. Task 4에서 테스트한다.

---

### Task 1: 기준일 정규화와 표시 라벨

**Files:**
- Create: `lib/dashboard/bas-dd.ts`
- Test: `test/dashboard/bas-dd.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `normalizeBasDd(input: string): string | null`, `formatBasDdLabel(basDd: string): string`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/dashboard/bas-dd.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatBasDdLabel, normalizeBasDd } from "../../lib/dashboard/bas-dd";

describe("기준일 정규화", () => {
  it("정본 형식과 압축 형식을 같은 값으로 정규화한다", () => {
    expect(normalizeBasDd("2026-10-07")).toBe("2026-10-07");
    expect(normalizeBasDd("20261007")).toBe("2026-10-07");
  });

  it("형식이 틀린 값을 거부한다", () => {
    expect(normalizeBasDd("2026-10-7")).toBeNull();
    expect(normalizeBasDd("26-10-07")).toBeNull();
    expect(normalizeBasDd("latest")).toBeNull();
    expect(normalizeBasDd("")).toBeNull();
  });

  it("형식은 맞지만 실재하지 않는 날짜를 거부한다", () => {
    expect(normalizeBasDd("2026-02-30")).toBeNull();
    expect(normalizeBasDd("20261332")).toBeNull();
    expect(normalizeBasDd("2026-00-10")).toBeNull();
  });

  it("요일을 붙인 표시 라벨을 만든다", () => {
    expect(formatBasDdLabel("2026-10-07")).toBe("2026-10-07 (수)");
    expect(formatBasDdLabel("2026-10-09")).toBe("2026-10-09 (금)");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/dashboard/bas-dd.test.ts`
Expected: FAIL — `Failed to resolve import "../../lib/dashboard/bas-dd"`

- [ ] **Step 3: 최소 구현 작성**

`lib/dashboard/bas-dd.ts`:

```ts
const CANONICAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPACT_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function normalizeBasDd(input: string): string | null {
  const match = CANONICAL_PATTERN.exec(input) ?? COMPACT_PATTERN.exec(input);
  if (!match) return null;
  const canonical = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${canonical}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Date는 2026-02-30을 3월 2일로 넘긴다. 왕복 비교로 걸러낸다.
  return parsed.toISOString().slice(0, 10) === canonical ? canonical : null;
}

export function formatBasDdLabel(basDd: string): string {
  const parsed = new Date(`${basDd}T00:00:00.000Z`);
  return `${basDd} (${WEEKDAY_LABELS[parsed.getUTCDay()]})`;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `npx vitest run test/dashboard/bas-dd.test.ts`
Expected: PASS — 4개 테스트

- [ ] **Step 5: 커밋**

```bash
git add lib/dashboard/bas-dd.ts test/dashboard/bas-dd.test.ts
git commit -m "feat: 기준일 정규화와 요일 라벨 함수 추가

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: 신호 유형 분류와 방향별 행 선택

**Files:**
- Modify: `lib/dashboard/kr-signal-view.ts` (파일 끝에 추가. 기존 `DashboardSignalRow`·`createDashboardSignalSections`·`formatDashboardSignalValue`는 바꾸지 않는다)
- Test: `test/dashboard/kr-signal-view.test.ts` (기존 `describe` 블록 아래에 새 `describe` 추가)

**Interfaces:**
- Consumes: `DashboardSignalRow`, `DashboardSignalSection`, `createDashboardSignalSections` (같은 파일의 기존 export)
- Produces: `type SignalPeriod = "daily" | "five_day"`, `type SignalDirection = "gain" | "loss"`, `classifyKrSignalType(signalType: string): { period: SignalPeriod; direction: SignalDirection } | null`, `selectDirectionRows(rows, period, screen, direction): DashboardSignalRow[]`, `selectVariableSections(rows): DashboardSignalSection[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/dashboard/kr-signal-view.test.ts`의 import 줄을 다음으로 바꾼다:

```ts
import {
  classifyKrSignalType,
  createDashboardSignalSections,
  formatDashboardSignalValue,
  selectDirectionRows,
  selectVariableSections,
} from "../../lib/dashboard/kr-signal-view";
```

파일 끝에 다음 `describe`를 추가한다:

```ts
describe("KR 신호 유형 분류", () => {
  it("고정 8유형의 기간과 방향을 분류한다", () => {
    expect(classifyKrSignalType("daily_price_gain")).toEqual({ period: "daily", direction: "gain" });
    expect(classifyKrSignalType("daily_price_loss")).toEqual({ period: "daily", direction: "loss" });
    expect(classifyKrSignalType("five_day_price_gain")).toEqual({ period: "five_day", direction: "gain" });
    expect(classifyKrSignalType("five_day_price_loss")).toEqual({ period: "five_day", direction: "loss" });
  });

  it("가변 신호와 알 수 없는 유형은 분류하지 않는다", () => {
    expect(classifyKrSignalType("turnover_surge")).toBeNull();
    expect(classifyKrSignalType("new_listing")).toBeNull();
    expect(classifyKrSignalType("unknown_type")).toBeNull();
  });

  it("기간·스크린·방향이 모두 맞는 행만 순위 순으로 고른다", () => {
    const rows = [
      { signalType: "daily_price_gain", screen: "raw" as const, name: "둘째", value: 1, valueUnit: "percent", rank: 2 },
      { signalType: "daily_price_gain", screen: "raw" as const, name: "첫째", value: 2, valueUnit: "percent", rank: 1 },
      { signalType: "daily_price_gain", screen: "liquid" as const, name: "유동성", value: 3, valueUnit: "percent", rank: 1 },
      { signalType: "daily_price_loss", screen: "raw" as const, name: "하락", value: -1, valueUnit: "percent", rank: 1 },
      { signalType: "five_day_price_gain", screen: "raw" as const, name: "5일", value: 4, valueUnit: "percent", rank: 1 },
      { signalType: "turnover_surge", screen: "raw" as const, name: "급증", value: 5, valueUnit: "ratio", rank: 1 },
    ];

    expect(selectDirectionRows(rows, "daily", "raw", "gain").map((row) => row.name)).toEqual(["첫째", "둘째"]);
    expect(selectDirectionRows(rows, "daily", "liquid", "gain").map((row) => row.name)).toEqual(["유동성"]);
    expect(selectDirectionRows(rows, "daily", "raw", "loss").map((row) => row.name)).toEqual(["하락"]);
    expect(selectDirectionRows(rows, "five_day", "raw", "gain").map((row) => row.name)).toEqual(["5일"]);
    expect(selectDirectionRows(rows, "five_day", "liquid", "loss")).toEqual([]);
  });

  it("rank가 null인 행을 맨 뒤로 보낸다", () => {
    const rows = [
      { signalType: "daily_price_gain", screen: "raw" as const, name: "순위없음", value: 1, valueUnit: "percent", rank: null },
      { signalType: "daily_price_gain", screen: "raw" as const, name: "1위", value: 2, valueUnit: "percent", rank: 1 },
    ];

    expect(selectDirectionRows(rows, "daily", "raw", "gain").map((row) => row.name)).toEqual(["1위", "순위없음"]);
  });

  it("가변 신호만 별도 섹션으로 묶는다", () => {
    const sections = selectVariableSections([
      { signalType: "daily_price_gain", screen: "raw", name: "고정", value: 1, valueUnit: "percent", rank: 1 },
      { signalType: "new_listing", screen: "raw", name: "신규", value: 1, valueUnit: "event", rank: 1 },
      { signalType: "turnover_surge", screen: "raw", name: "급증", value: 2.5, valueUnit: "ratio", rank: 1 },
    ]);

    expect(sections.map((section) => section.title)).toEqual(["신규 상장", "거래대금 급증"]);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/dashboard/kr-signal-view.test.ts`
Expected: FAIL — `classifyKrSignalType is not a function`

- [ ] **Step 3: 최소 구현 작성**

`lib/dashboard/kr-signal-view.ts` 끝에 추가한다:

```ts
export type SignalPeriod = "daily" | "five_day";
export type SignalDirection = "gain" | "loss";

export interface KrSignalClassification {
  period: SignalPeriod;
  direction: SignalDirection;
}

const FIXED_SIGNAL_TYPES: Record<string, KrSignalClassification> = {
  daily_price_gain: { period: "daily", direction: "gain" },
  daily_price_loss: { period: "daily", direction: "loss" },
  five_day_price_gain: { period: "five_day", direction: "gain" },
  five_day_price_loss: { period: "five_day", direction: "loss" },
};

export function classifyKrSignalType(signalType: string): KrSignalClassification | null {
  return FIXED_SIGNAL_TYPES[signalType] ?? null;
}

export function selectDirectionRows(
  rows: readonly DashboardSignalRow[],
  period: SignalPeriod,
  screen: "raw" | "liquid",
  direction: SignalDirection,
): DashboardSignalRow[] {
  return rows
    .filter((row) => {
      if (row.screen !== screen) return false;
      const classification = classifyKrSignalType(row.signalType);
      return classification?.period === period && classification.direction === direction;
    })
    .sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER));
}

export function selectVariableSections(
  rows: readonly DashboardSignalRow[],
): DashboardSignalSection[] {
  return createDashboardSignalSections(
    rows.filter((row) => classifyKrSignalType(row.signalType) === null),
  );
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `npx vitest run test/dashboard/kr-signal-view.test.ts`
Expected: PASS — 기존 1개 + 신규 5개

가변 섹션 제목 순서가 다르면 `selectVariableSections` 결과는 입력 순서를 따른다. 테스트의 입력 순서(`new_listing` → `turnover_surge`)와 기대값 순서를 맞춘 상태다.

- [ ] **Step 5: 커밋**

```bash
git add lib/dashboard/kr-signal-view.ts test/dashboard/kr-signal-view.test.ts
git commit -m "feat: 신호 유형 기간·방향 분류와 방향별 행 선택 추가

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: 웹 base URL 해석과 링크 조립

**Files:**
- Create: `lib/config/web-url.ts`
- Test: `test/config/web-url.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `resolveWebBaseUrl(env?: Readonly<Record<string, string | undefined>>): string | null`, `buildKrSignalUrl(baseUrl: string, basDd: string): string`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/config/web-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildKrSignalUrl, resolveWebBaseUrl } from "../../lib/config/web-url";

describe("웹 base URL 해석", () => {
  it("설정된 값을 그대로 돌려준다", () => {
    expect(resolveWebBaseUrl({ ETF_WEB_BASE_URL: "https://etf.example.app" })).toBe("https://etf.example.app");
  });

  it("후행 슬래시를 제거한다", () => {
    expect(resolveWebBaseUrl({ ETF_WEB_BASE_URL: "https://etf.example.app/" })).toBe("https://etf.example.app");
    expect(resolveWebBaseUrl({ ETF_WEB_BASE_URL: "https://etf.example.app///" })).toBe("https://etf.example.app");
  });

  it("앞뒤 공백을 제거한다", () => {
    expect(resolveWebBaseUrl({ ETF_WEB_BASE_URL: "  https://etf.example.app  " })).toBe("https://etf.example.app");
  });

  it("미설정·빈 문자열·공백만인 값은 null로 본다", () => {
    expect(resolveWebBaseUrl({})).toBeNull();
    expect(resolveWebBaseUrl({ ETF_WEB_BASE_URL: "" })).toBeNull();
    expect(resolveWebBaseUrl({ ETF_WEB_BASE_URL: "   " })).toBeNull();
  });

  it("기준일 링크를 조립한다", () => {
    expect(buildKrSignalUrl("https://etf.example.app", "2026-10-07")).toBe(
      "https://etf.example.app/signals/kr/2026-10-07",
    );
  });

  it("조립 단계에서도 후행 슬래시를 흘리지 않는다", () => {
    expect(buildKrSignalUrl("https://etf.example.app/", "2026-10-07")).toBe(
      "https://etf.example.app/signals/kr/2026-10-07",
    );
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/config/web-url.test.ts`
Expected: FAIL — `Failed to resolve import "../../lib/config/web-url"`

- [ ] **Step 3: 최소 구현 작성**

`lib/config/web-url.ts`:

```ts
type Environment = Readonly<Record<string, string | undefined>>;

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * 웹 열람 경로의 base URL. 비밀값이 아니므로 serverSecretEnvKeys에 두지 않는다.
 * 미설정이면 null을 돌려주고 호출부는 링크를 생략한다.
 */
export function resolveWebBaseUrl(env: Environment = process.env): string | null {
  const raw = env.ETF_WEB_BASE_URL?.trim();
  if (!raw) return null;
  const normalized = stripTrailingSlashes(raw);
  return normalized === "" ? null : normalized;
}

export function buildKrSignalUrl(baseUrl: string, basDd: string): string {
  return `${stripTrailingSlashes(baseUrl)}/signals/kr/${basDd}`;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `npx vitest run test/config/web-url.test.ts`
Expected: PASS — 6개 테스트

- [ ] **Step 5: 커밋**

```bash
git add lib/config/web-url.ts test/config/web-url.test.ts
git commit -m "feat: 웹 열람 base URL 해석과 기준일 링크 조립 추가

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Telegram 보고에 링크 한 줄 추가

**Files:**
- Modify: `lib/notifications/telegram.ts` (`TelegramReportInput`에 `webUrl` 추가, `formatTelegramReport`의 `header` 조립 변경)
- Modify: `scripts/report-kr-signals.ts` (`formatTelegramReport` 호출에 `webUrl` 전달)
- Test: `test/notifications/telegram.test.ts` (기존 `describe` 안에 테스트 추가)

**Interfaces:**
- Consumes: `resolveWebBaseUrl`, `buildKrSignalUrl` (Task 3)
- Produces: `TelegramReportInput.webUrl?: string`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/notifications/telegram.test.ts`의 `describe("Telegram reports", ...)` 안에 추가한다:

```ts
  it("webUrl이 없으면 기존 헤더와 완전히 같은 출력을 낸다", () => {
    const base = {
      market: "KR" as const,
      basDd: "2026-10-07",
      status: "COMPLETED" as const,
      runId: "run-1",
      source: "KRX etf_bydd_trd",
      sections: [{ title: "일간 상승", lines: ["1. ETF +1.00%"] }],
    };

    expect(formatTelegramReport(base)).toEqual(formatTelegramReport({ ...base, webUrl: undefined }));
    expect(formatTelegramReport(base)[0]).not.toContain("상세:");
  });

  it("webUrl이 있으면 모든 분할 조각의 헤더에 링크가 한 번씩 들어간다", () => {
    const messages = formatTelegramReport(
      {
        market: "KR",
        basDd: "2026-10-07",
        status: "COMPLETED",
        runId: "run-1",
        source: "KRX etf_bydd_trd",
        webUrl: "https://etf.example.app/signals/kr/2026-10-07",
        sections: [
          {
            title: "일간 상승",
            lines: Array.from({ length: 20 }, (_, index) => `ETF ${index} +1.00%`),
          },
        ],
      },
      300,
    );

    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((message) => message.length <= 300)).toBe(true);
    expect(
      messages.every(
        (message) =>
          message.split("상세: https://etf.example.app/signals/kr/2026-10-07").length === 2,
      ),
    ).toBe(true);
  });

  it("링크가 붙어도 maxLength를 넘는 메시지를 만들지 않는다", () => {
    const messages = formatTelegramReport(
      {
        market: "KR",
        basDd: "2026-10-07",
        status: "COMPLETED",
        runId: "run-1",
        source: "KRX etf_bydd_trd",
        webUrl: `https://etf.example.app/signals/kr/2026-10-07`,
        sections: [
          {
            title: "일간 상승",
            lines: Array.from({ length: 40 }, (_, index) => `${index}. ${"긴종목명".repeat(30)} +1.00%`),
          },
        ],
      },
      4096,
    );

    expect(messages.every((message) => message.length <= 4096)).toBe(true);
  });
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/notifications/telegram.test.ts`
Expected: FAIL — `webUrl`이 `TelegramReportInput`에 없어 타입 오류가 나고, 링크 포함 단정이 실패한다

- [ ] **Step 3: 최소 구현 작성**

`lib/notifications/telegram.ts`에서 `TelegramReportInput`에 필드를 추가한다:

```ts
export interface TelegramReportInput {
  market: "KR";
  basDd: string;
  status: "COMPLETED" | "PENDING" | "PARTIAL" | "FAILED" | "SKIPPED";
  runId: string;
  source: string;
  sections: readonly TelegramReportSection[];
  /** 기준일 웹 열람 링크. 없으면 헤더에 줄을 추가하지 않는다. */
  webUrl?: string;
}
```

`formatTelegramReport` 안의 `header` 조립을 다음으로 바꾼다. 기존 한 줄짜리 템플릿 리터럴을 지우고 배열 `join`으로 대체한다:

```ts
  const header = [
    `[ETF 신호][${input.market}][${input.status}] ${input.basDd}`,
    `원천: ${input.source}`,
    `실행: ${input.runId}`,
    disclosure,
    ...(input.webUrl ? [`상세: ${input.webUrl}`] : []),
  ].join("\n");
```

`splitTelegramText`는 바꾸지 않는다. 헤더가 길어지면 블록이 들어갈 공간이 줄어 분할 수가 늘 뿐, 길이 상한 로직은 그대로 유지된다.

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `npx vitest run test/notifications/telegram.test.ts`
Expected: PASS — 기존 3개 + 신규 3개

- [ ] **Step 5: 보고 스크립트 배선**

`scripts/report-kr-signals.ts`의 import에 추가한다:

```ts
import { buildKrSignalUrl, resolveWebBaseUrl } from "../lib/config/web-url.ts";
```

`formatTelegramReport` 호출을 다음으로 바꾼다:

```ts
  const webBaseUrl = resolveWebBaseUrl();
  const messages = formatTelegramReport({
    market: "KR",
    basDd: latest.bas_dd,
    status: latest.status,
    runId: latest.id,
    source: "KRX etf_bydd_trd, Kiwoom ka10099",
    sections: createSections(rows ?? []),
    webUrl: webBaseUrl ? buildKrSignalUrl(webBaseUrl, latest.bas_dd) : undefined,
  });
```

- [ ] **Step 6: 타입 검사와 전체 테스트**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 타입 오류 0, 전체 테스트 통과

- [ ] **Step 7: 커밋**

```bash
git add lib/notifications/telegram.ts scripts/report-kr-signals.ts test/notifications/telegram.test.ts
git commit -m "feat: Telegram 보고 헤더에 기준일 웹 링크 한 줄 추가

ETF_WEB_BASE_URL 미설정 시 링크 줄을 생략해 기존 출력과 동일하게 둔다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: 상승·하락 색 토큰

**Files:**
- Modify: `app/globals.css` (`:root`와 `.dark` 블록에 변수 2개씩 추가)
- Modify: `tailwind.config.ts` (`theme.extend.colors`에 `signal` 추가)
- Test: `test/dashboard/signal-color-token.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: Tailwind 클래스 `text-signal-gain`, `text-signal-loss`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/dashboard/signal-color-token.test.ts`:

```ts
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const globalsCss = readFileSync("app/globals.css", "utf8");
const tailwindConfig = readFileSync("tailwind.config.ts", "utf8");

describe("방향 색 토큰", () => {
  it("라이트와 다크 양쪽에 상승·하락 변수를 정의한다", () => {
    const lightBlock = globalsCss.slice(globalsCss.indexOf(":root"), globalsCss.indexOf(".dark"));
    const darkBlock = globalsCss.slice(globalsCss.indexOf(".dark"));

    for (const token of ["--signal-gain", "--signal-loss"]) {
      expect(lightBlock).toContain(token);
      expect(darkBlock).toContain(token);
    }
  });

  it("Tailwind가 signal.gain과 signal.loss를 변수로 노출한다", () => {
    expect(tailwindConfig).toContain("hsl(var(--signal-gain))");
    expect(tailwindConfig).toContain("hsl(var(--signal-loss))");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/dashboard/signal-color-token.test.ts`
Expected: FAIL — `--signal-gain`을 찾지 못한다

- [ ] **Step 3: 최소 구현 작성**

`app/globals.css`의 `:root` 블록에서 `--radius: 0.5rem;` 바로 위에 추가한다:

```css
    --signal-gain: 0 72% 45%;
    --signal-loss: 217 82% 45%;
```

`.dark` 블록의 `--chart-5: 340 75% 55%;` 바로 아래에 추가한다:

```css
    --signal-gain: 0 80% 66%;
    --signal-loss: 213 90% 68%;
```

`tailwind.config.ts`의 `colors` 안, `chart` 항목 바로 아래에 추가한다:

```ts
        signal: {
          gain: "hsl(var(--signal-gain))",
          loss: "hsl(var(--signal-loss))",
        },
```

- [ ] **Step 4: 테스트와 빌드 확인**

Run: `npx vitest run test/dashboard/signal-color-token.test.ts && npm run build`
Expected: 테스트 2개 PASS, 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add app/globals.css tailwind.config.ts test/dashboard/signal-color-token.test.ts
git commit -m "feat: 상승 적색·하락 청색 테마 토큰 추가

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: 방향 대비 보드 클라이언트 컴포넌트

**Files:**
- Create: `components/kr-signal-board.tsx`
- Test: `test/dashboard/kr-signal-board-contract.test.ts`

**Interfaces:**
- Consumes: `DashboardSignalRow`, `SignalPeriod`, `selectDirectionRows`, `formatDashboardSignalValue` (Task 2)
- Produces: `KrSignalBoard(props: { rows: readonly DashboardSignalRow[] }): JSX.Element`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/dashboard/kr-signal-board-contract.test.ts`:

```ts
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const board = readFileSync("components/kr-signal-board.tsx", "utf8");

describe("방향 대비 보드 계약", () => {
  it("클라이언트 컴포넌트로 선언된다", () => {
    expect(board.startsWith('"use client"')).toBe(true);
  });

  it("기간과 스크린 세그먼트를 모두 제공한다", () => {
    for (const label of ["일간", "5거래일", "전체", "유동성"]) {
      expect(board).toContain(label);
    }
  });

  it("색만으로 방향을 구분하지 않고 기호와 이름을 함께 쓴다", () => {
    expect(board).toContain("▲");
    expect(board).toContain("▼");
    expect(board).toContain("상승");
    expect(board).toContain("하락");
  });

  it("방향별 색 토큰을 적용한다", () => {
    expect(board).toContain("text-signal-gain");
    expect(board).toContain("text-signal-loss");
  });

  it("숫자를 고정폭으로 정렬하고 모바일에서 2열로 쌓는다", () => {
    expect(board).toContain("tabular-nums");
    expect(board).toContain("md:grid-cols-2");
  });

  it("해당 조건의 행이 없을 때를 처리한다", () => {
    expect(board).toContain("해당 조건의 신호가 없습니다.");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/dashboard/kr-signal-board-contract.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, open 'components/kr-signal-board.tsx'`

- [ ] **Step 3: 최소 구현 작성**

`components/kr-signal-board.tsx`:

```tsx
"use client";

import { useState } from "react";

import {
  formatDashboardSignalValue,
  selectDirectionRows,
  type DashboardSignalRow,
  type SignalDirection,
  type SignalPeriod,
} from "@/lib/dashboard/kr-signal-view";

const PERIOD_OPTIONS = [
  { value: "daily", label: "일간" },
  { value: "five_day", label: "5거래일" },
] as const;

const SCREEN_OPTIONS = [
  { value: "raw", label: "전체" },
  { value: "liquid", label: "유동성" },
] as const;

export function KrSignalBoard({ rows }: { rows: readonly DashboardSignalRow[] }) {
  const [period, setPeriod] = useState<SignalPeriod>("daily");
  const [screen, setScreen] = useState<"raw" | "liquid">("raw");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <SegmentedGroup
          label="기간"
          options={PERIOD_OPTIONS}
          value={period}
          onChange={(next) => setPeriod(next as SignalPeriod)}
        />
        <SegmentedGroup
          label="스크린"
          options={SCREEN_OPTIONS}
          value={screen}
          onChange={(next) => setScreen(next as "raw" | "liquid")}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <DirectionList direction="gain" rows={selectDirectionRows(rows, period, screen, "gain")} />
        <DirectionList direction="loss" rows={selectDirectionRows(rows, period, screen, "loss")} />
      </div>
    </div>
  );
}

function SegmentedGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded px-3 py-1.5 text-sm transition-colors ${
            value === option.value
              ? "bg-secondary font-semibold text-secondary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DirectionList({
  direction,
  rows,
}: {
  direction: SignalDirection;
  rows: readonly DashboardSignalRow[];
}) {
  const isGain = direction === "gain";
  const tone = isGain ? "text-signal-gain" : "text-signal-loss";

  return (
    <section className="rounded-lg border border-border p-3">
      <h3 className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${tone}`}>
        <span aria-hidden="true">{isGain ? "▲" : "▼"}</span>
        {isGain ? "상승" : "하락"}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">해당 조건의 신호가 없습니다.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li
              key={`${row.signalType}-${row.screen}-${row.name}-${row.rank}`}
              className="flex items-start gap-2 text-sm"
            >
              <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">
                {row.rank ?? "-"}
              </span>
              <span className="min-w-0 flex-1 break-keep">{row.name}</span>
              <span className={`shrink-0 font-medium tabular-nums ${tone}`}>
                {formatDashboardSignalValue(row)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 4: 테스트와 타입 검사**

Run: `npx vitest run test/dashboard/kr-signal-board-contract.test.ts && npx tsc --noEmit`
Expected: 테스트 6개 PASS, 타입 오류 0

- [ ] **Step 5: 커밋**

```bash
git add components/kr-signal-board.tsx test/dashboard/kr-signal-board-contract.test.ts
git commit -m "feat: 상승·하락 대비 보드 컴포넌트 추가

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: 기준일 라우트 신설과 계약 테스트 이전

**Files:**
- Create: `app/signals/kr/[basDd]/page.tsx`
- Create: `test/dashboard/kr-signal-page-contract.test.ts`
- Delete: `test/dashboard/protected-page-contract.test.ts` (검사 항목은 위 새 파일로 그대로 옮긴다)

**Interfaces:**
- Consumes: `normalizeBasDd`·`formatBasDdLabel` (Task 1), `selectVariableSections`·`formatDashboardSignalValue`·`DashboardSignalRow` (Task 2), `KrSignalBoard` (Task 6), 기존 `createClient`·`isUsEtfP1Enabled`·`US_ETF_P1_DISCLOSURE`
- Produces: `/signals/kr/<YYYY-MM-DD>` 경로

- [ ] **Step 1: 실패하는 테스트 작성**

`test/dashboard/kr-signal-page-contract.test.ts`:

```ts
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const signalPage = readFileSync("app/signals/kr/[basDd]/page.tsx", "utf8");

describe("기준일 신호 라우트 계약", () => {
  it("현재 KR 신호 전략으로 실행을 한정하고 재실행 시 최신 건을 고른다", () => {
    expect(signalPage).toContain('.eq("strategy_version", "m3-price-movers-v1")');
    expect(signalPage).toContain('.order("completed_at", { ascending: false })');
    expect(signalPage).toContain('.order("id", { ascending: false })');
  });

  it("경로의 기준일로 실행을 조회한다", () => {
    expect(signalPage).toContain('.eq("bas_dd", basDd)');
  });

  it("잘못된 기준일은 404로 처리하고 미인증은 로그인으로 보낸다", () => {
    expect(signalPage).toContain("normalizeBasDd");
    expect(signalPage).toContain("notFound()");
    expect(signalPage).toContain('redirect("/auth/login")');
  });

  it("데이터 품질 판정 문구를 유지한다", () => {
    expect(signalPage).toContain("데이터 품질");
    expect(signalPage).toContain("신호 항목이 없습니다");
  });

  it("고지 문구 두 개를 유지한다", () => {
    expect(signalPage).toContain("자동매매 또는 매수·매도 추천이 아닌 탐색 결과입니다.");
    expect(signalPage).toContain("분배금·기업행동 조정");
  });

  it("US P1 섹션을 기능 플래그와 독립 쿼리 뒤에 둔다", () => {
    expect(signalPage).toContain("isUsEtfP1Enabled()");
    expect(signalPage).toContain('.eq("market", "US")');
    expect(signalPage).toContain("미국 ETF 등락 · P1 실험");
    expect(signalPage).toContain("국내 P0 신호에는 영향이");
    expect(signalPage).toContain("없습니다.");
  });

  it("전·후 거래일 이동을 신호 실행이 있는 날로 제한한다", () => {
    expect(signalPage).toContain('.lt("bas_dd", basDd)');
    expect(signalPage).toContain('.gt("bas_dd", basDd)');
  });

  it("서비스 역할 클라이언트를 UI 경로에 만들지 않는다", () => {
    expect(signalPage).not.toContain("service-role");
    expect(signalPage).not.toContain("SERVICE_ROLE");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/dashboard/kr-signal-page-contract.test.ts`
Expected: FAIL — `ENOENT: ... 'app/signals/kr/[basDd]/page.tsx'`

- [ ] **Step 3: 최소 구현 작성**

`app/signals/kr/[basDd]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { KrSignalBoard } from "@/components/kr-signal-board";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBasDdLabel, normalizeBasDd } from "@/lib/dashboard/bas-dd";
import {
  createDashboardSignalSections,
  formatDashboardSignalValue,
  selectVariableSections,
  type DashboardSignalRow,
} from "@/lib/dashboard/kr-signal-view";
import {
  isUsEtfP1Enabled,
  US_ETF_P1_DISCLOSURE,
} from "@/lib/signals/us-etf-movers";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

interface SignalRunDatabaseRow {
  id: string;
  bas_dd: string | null;
  completed_at: string | null;
  status: string;
}

interface SignalDailyDatabaseRow {
  signal_type: string;
  screen: "raw" | "liquid";
  name: string;
  value: number | string | null;
  value_unit: string | null;
  rank: number | null;
}

interface AdjacentRunRow {
  bas_dd: string | null;
}

export default async function KrSignalDatePage({
  params,
}: {
  params: Promise<{ basDd: string }>;
}) {
  await connection();
  const { basDd: requestedBasDd } = await params;
  const basDd = normalizeBasDd(requestedBasDd);
  if (!basDd) notFound();

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) redirect("/auth/login");

  const { data: run, error: runError } = await supabase
    .from("signal_run")
    .select("id,bas_dd,completed_at,status")
    .eq("market", "KR")
    .eq("strategy_version", "m3-price-movers-v1")
    .eq("bas_dd", basDd)
    .order("completed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestRun = run as SignalRunDatabaseRow | null;

  const { data: signalRows, error: signalsError } = latestRun
    ? await supabase
        .from("signal_daily")
        .select("signal_type,screen,name,value,value_unit,rank")
        .eq("run_id", latestRun.id)
        .order("signal_type")
        .order("screen")
        .order("rank")
    : { data: [], error: null };

  const rows = ((signalRows ?? []) as SignalDailyDatabaseRow[]).map(
    toDashboardSignalRow,
  );
  const sections = createDashboardSignalSections(rows);
  const variableSections = selectVariableSections(rows);
  const qualityMessage =
    latestRun?.status === "COMPLETED" && sections.length > 0
      ? "완료된 신호 실행입니다."
      : sections.length === 0
        ? "검토 필요: 신호 항목이 없습니다."
        : "신호 실행 상태를 확인하세요.";

  const [previousResult, nextResult] = await Promise.all([
    supabase
      .from("signal_run")
      .select("bas_dd")
      .eq("market", "KR")
      .eq("strategy_version", "m3-price-movers-v1")
      .lt("bas_dd", basDd)
      .order("bas_dd", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("signal_run")
      .select("bas_dd")
      .eq("market", "KR")
      .eq("strategy_version", "m3-price-movers-v1")
      .gt("bas_dd", basDd)
      .order("bas_dd", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const previousBasDd = (previousResult.data as AdjacentRunRow | null)?.bas_dd ?? null;
  const nextBasDd = (nextResult.data as AdjacentRunRow | null)?.bas_dd ?? null;

  const usEnabled = isUsEtfP1Enabled();
  const { data: usRun, error: usRunError } = usEnabled
    ? await supabase
        .from("signal_run")
        .select("id,bas_dd,completed_at,status")
        .eq("market", "US")
        .eq("strategy_version", "m5-us-etf-movers-p1-v1")
        .eq("status", "COMPLETED")
        .order("completed_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };
  const latestUsRun = usRun as SignalRunDatabaseRow | null;
  const { data: usRows, error: usRowsError } = latestUsRun
    ? await supabase
        .from("signal_daily")
        .select("signal_type,screen,name,value,value_unit,rank")
        .eq("run_id", latestUsRun.id)
        .eq("market", "US")
        .order("signal_type")
        .order("rank")
    : { data: [], error: null };
  const usSections = createDashboardSignalSections(
    ((usRows ?? []) as SignalDailyDatabaseRow[]).map(toDashboardSignalRow),
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">ETF 신호 MVP · 국내 시장</p>
        <h1 className="text-3xl font-bold tracking-tight">
          {formatBasDdLabel(basDd)}
        </h1>
        <p className="text-sm text-muted-foreground">
          상태 {latestRun?.status ?? "실행 없음"} · 완료 시각{" "}
          {latestRun?.completed_at ?? "미정"}
        </p>
        <p className="text-sm text-muted-foreground">데이터 품질: {qualityMessage}</p>
        <nav className="flex items-center gap-4 text-sm">
          {previousBasDd ? (
            <Link className="underline" href={`/signals/kr/${previousBasDd}`}>
              ‹ 이전 거래일
            </Link>
          ) : (
            <span className="text-muted-foreground">‹ 이전 거래일</span>
          )}
          {nextBasDd ? (
            <Link className="underline" href={`/signals/kr/${nextBasDd}`}>
              다음 거래일 ›
            </Link>
          ) : (
            <span className="text-muted-foreground">다음 거래일 ›</span>
          )}
        </nav>
        <p className="text-sm text-muted-foreground">
          자동매매 또는 매수·매도 추천이 아닌 탐색 결과입니다.
        </p>
        <p className="text-sm text-muted-foreground">
          5거래일 값은 KRX 종가 기준 가격수익률이며 분배금·기업행동 조정
          총수익률이 아닙니다.
        </p>
      </header>

      {runError || signalsError ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            신호 결과를 불러오지 못했습니다. 잠시 후 다시 시도하세요.
          </CardContent>
        </Card>
      ) : !latestRun ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            해당 기준일의 신호 실행이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <>
          <KrSignalBoard rows={rows} />
          {variableSections.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {variableSections.map((section) => (
                <Card key={section.title}>
                  <CardHeader>
                    <CardTitle>{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-2 text-sm">
                      {section.rows.map((row) => (
                        <li
                          key={`${row.name}-${row.rank}`}
                          className="flex justify-between gap-3"
                        >
                          <span>
                            {row.rank ?? "-"}. {row.name}
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatDashboardSignalValue(row)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {usEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>미국 ETF 등락 · P1 실험</CardTitle>
            <CardDescription>{US_ETF_P1_DISCLOSURE}</CardDescription>
          </CardHeader>
          <CardContent>
            {usRunError || usRowsError ? (
              <p className="text-sm text-muted-foreground">
                실험 신호를 불러오지 못했습니다. 국내 P0 신호에는 영향이
                없습니다.
              </p>
            ) : !latestUsRun ? (
              <p className="text-sm text-muted-foreground">
                아직 생성된 미국 ETF 실험 신호가 없습니다.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {usSections.map((section) => (
                  <div key={section.title} className="space-y-2 text-sm">
                    <p className="font-medium">{section.title}</p>
                    <ol className="space-y-1">
                      {section.rows.map((row) => (
                        <li key={`${row.name}-${row.rank}`}>
                          {row.rank ?? "-"}. {row.name} ·{" "}
                          {formatDashboardSignalValue(row)}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function toDashboardSignalRow(row: SignalDailyDatabaseRow): DashboardSignalRow {
  return {
    signalType: row.signal_type,
    screen: row.screen,
    name: row.name,
    value: row.value === null ? null : Number(row.value),
    valueUnit: row.value_unit,
    rank: row.rank,
  };
}
```

- [ ] **Step 4: 레이아웃 연결**

`app/protected/layout.tsx`를 복사해 `app/signals/layout.tsx`로 만든다. 이 라우트가 `/protected` 밖에 있어 내비게이션·푸터·테마 스위처를 쓰려면 자체 레이아웃이 필요하다. 복사한 뒤 한 곳만 바꾼다: 내비게이션의 `<Link href={"/"}>Next.js Supabase Starter</Link>`를 `<Link href={"/"}>ETF 신호</Link>`로 고친다. 이 화면은 매일 보는 경로이므로 시작 템플릿 이름을 그대로 두지 않는다. 함수 이름은 `SignalsLayout`으로 바꾸고, `DeployButton` import와 사용은 삭제한다(시작 템플릿 전용 버튼이다).

- [ ] **Step 5: 기존 계약 테스트 제거**

```bash
git rm test/dashboard/protected-page-contract.test.ts
```

검사 항목은 Step 1의 새 파일로 모두 옮겼다. `/protected` 자체의 계약은 Task 8에서 새로 만든다.

- [ ] **Step 6: 테스트와 타입 검사**

Run: `npx vitest run test/dashboard/ && npx tsc --noEmit`
Expected: 신규 계약 테스트 8개 PASS, 타입 오류 0

- [ ] **Step 7: 커밋**

```bash
git add app/signals test/dashboard/kr-signal-page-contract.test.ts
git commit -m "feat: 기준일별 KR 신호 라우트 추가

계약 테스트를 protected-page-contract에서 kr-signal-page-contract로 이전했다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: `/protected`를 최신 기준일 리다이렉트로 전환

**Files:**
- Modify: `app/protected/page.tsx` (전체 교체)
- Test: `test/dashboard/protected-redirect-contract.test.ts`

**Interfaces:**
- Consumes: `createClient` (기존)
- Produces: 없음 (`/signals/kr/<최신 기준일>`로 리다이렉트)

- [ ] **Step 1: 실패하는 테스트 작성**

`test/dashboard/protected-redirect-contract.test.ts`:

```ts
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const protectedPage = readFileSync("app/protected/page.tsx", "utf8");

describe("보호 경로 리다이렉트 계약", () => {
  it("최신 KR 기준일을 조회해 신호 라우트로 보낸다", () => {
    expect(protectedPage).toContain('.eq("strategy_version", "m3-price-movers-v1")');
    expect(protectedPage).toContain('.order("bas_dd", { ascending: false })');
    expect(protectedPage).toContain("/signals/kr/");
    expect(protectedPage).toContain("redirect(");
  });

  it("미인증 접근을 로그인으로 보낸다", () => {
    expect(protectedPage).toContain('redirect("/auth/login")');
  });

  it("실행이 하나도 없을 때의 안내를 유지한다", () => {
    expect(protectedPage).toContain("아직 생성된 국내 신호 실행이 없습니다.");
  });

  it("신호 렌더링 코드를 더 들고 있지 않다", () => {
    expect(protectedPage).not.toContain("signal_daily");
    expect(protectedPage).not.toContain("isUsEtfP1Enabled");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run test/dashboard/protected-redirect-contract.test.ts`
Expected: FAIL — 현재 페이지에 `signal_daily`와 `isUsEtfP1Enabled`가 남아 있다

- [ ] **Step 3: 최소 구현 작성**

`app/protected/page.tsx` 전체를 다음으로 교체한다:

```tsx
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ProtectedPage() {
  await connection();
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) redirect("/auth/login");

  const { data: run } = await supabase
    .from("signal_run")
    .select("bas_dd")
    .eq("market", "KR")
    .eq("strategy_version", "m3-price-movers-v1")
    .not("bas_dd", "is", null)
    .order("bas_dd", { ascending: false })
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestBasDd = (run as { bas_dd: string | null } | null)?.bas_dd;
  if (!latestBasDd) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          아직 생성된 국내 신호 실행이 없습니다.
        </CardContent>
      </Card>
    );
  }

  redirect(`/signals/kr/${latestBasDd}`);
}
```

`redirect()`는 예외를 던져 제어를 넘기므로 `try`/`catch`로 감싸지 않는다.

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `npx vitest run test/dashboard/protected-redirect-contract.test.ts`
Expected: PASS — 4개 테스트

- [ ] **Step 5: 커밋**

```bash
git add app/protected/page.tsx test/dashboard/protected-redirect-contract.test.ts
git commit -m "feat: /protected를 최신 기준일 신호 라우트로 리다이렉트

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: 전체 게이트와 기록 갱신

**Files:**
- Modify: `docs/plans/NEXT.md` (Q-16 완료 처리, Q-17 해제 조건 갱신)
- Modify: `docs/guides/etf-signal-mvp-e2e-configuration-guide.md` (`ETF_WEB_BASE_URL` 항목 추가)
- Create: `docs/jobs/<오늘 날짜>-etf-signal-mvp-kr-신호-웹-열람.md` (같은 날 파일이 있으면 덧붙인다)

**Interfaces:**
- Consumes: Task 1~8의 결과
- Produces: 없음

- [ ] **Step 1: 전체 게이트 실행**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: 전부 통과. Node는 `nvm use`로 22.23.2를 쓴다.

- [ ] **Step 2: 링크 생략 동작을 직접 확인**

Run: `ETF_WEB_BASE_URL= npm run -s report:kr-signals`
Expected: `{"runId":"…","messageCount":N,"sent":false}`가 출력되고, 발송은 일어나지 않는다. `--send`를 붙이지 않는다.

이어서 base URL을 넣고 같은 명령을 실행해 `messageCount`를 비교한다.

Run: `ETF_WEB_BASE_URL=https://example.invalid npm run -s report:kr-signals`
Expected: 정상 종료. `messageCount`가 늘어났다면 링크 때문에 분할이 늘었다는 뜻이므로 작업 기록에 적는다.

- [ ] **Step 3: 미구현 흔적 점검**

Run: `rg -n "TODO|FIXME|test\.skip|it\.only|describe\.only" lib app components test scripts`
Expected: 출력 없음. 있으면 구현하거나 블로커로 보고한다.

- [ ] **Step 4: 기록 갱신**

`docs/plans/NEXT.md`에서 Q-16을 `DONE`으로 옮기고 검증 증거(명령·결과·커밋)를 적는다. Q-17의 해제 조건을 "Q-16 완료"에서 "충족"으로 바꾼다.

`docs/guides/etf-signal-mvp-e2e-configuration-guide.md`에 `ETF_WEB_BASE_URL` 항목을 추가한다. 비밀값이 아니고, 미설정 시 Telegram 링크 줄이 생략된다는 점을 적는다.

작업 기록 파일에 완료 항목·검증 명령·결과·남은 승인 대상을 적는다.

- [ ] **Step 5: 커밋과 푸시**

```bash
git add docs/plans/NEXT.md docs/guides/etf-signal-mvp-e2e-configuration-guide.md docs/jobs
git commit -m "docs: KR 신호 웹 열람 경로 구현 완료 기록

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git pull --rebase
git push origin main
```

- [ ] **Step 6: 리뷰 요청**

`superpowers:requesting-code-review`로 브랜치 전체 리뷰를 받는다. 지적이 나오면 `superpowers:receiving-code-review`를 따른다. 자기 승인은 하지 않는다.
