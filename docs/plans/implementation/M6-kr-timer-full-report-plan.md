# KR timer 경로 완전 보고 확장 구현 계획 (Q-10 A안)

> 상태(2026-09-23): 구현 완료. 리뷰 반영으로 ① 표식을 발송 직후·후속 단계 전에 기록 ② `persistKrxPriceSignals`·`generateKrxPriceSignals`가 기존 `telegram_reported_at`을 보존 ③ 수동 `daily:kr`도 `markTelegramReported`로 표식 기록 ④ `sendStatusIfNeeded(date, runId, kiwoom)` 시그니처로 변경했다. 아래 원 계획의 호출 순서·알려진 한계 문구는 이 상태 기록이 우선한다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 입력 없는 `kr-daily.yml`(timer 경로)이 누락일 보충 뒤 직전 거래일 1건에 대해 Kiwoom 마스터 동기화·신호 재생성·Telegram 보고를 한 번만 수행해 M6 완전 거래일 증거를 자동으로 남긴다.

**Architecture:** `scripts/run-kr-catchup.ts`에 의존성 주입형 `reportLatestCatchupDay()`를 추가하고 `main()`이 보충 성공(`blocked=null`) 뒤 호출한다. 중복 발송은 보고한 `signal_run.notes.telegram_reported_at` 표식으로 막는다. Telegram·새 상장 표시 로직은 `scripts/run-kr-daily.ts`의 기존 함수를 export해 재사용한다.

**Tech Stack:** Node 22.23.2, TypeScript strict, Vitest, Supabase JS

**Spec:** `docs/plans/NEXT.md` Q-10(2026-09-23 사용자 A안 결정), `docs/guides/etf-signal-mvp-m6-observation-runbook.md`

## Global Constraints

- 보고 대상은 `catchUpKoreanTradingDays()` 결과 `completed`의 마지막 날짜 1건뿐이다. 과거 보충일은 보고하지 않는다.
- `blocked`가 있으면 보고 단계를 실행하지 않는다(기존 종료 코드 1 유지).
- 같은 기준일에 `telegram_reported_at` 표식이 있는 KR 실행이 있으면 Kiwoom·재생성·발송을 모두 건너뛴다.
- Kiwoom 실패는 기존 `daily:kr`과 같이 신호 보고를 계속하고 상태 알림을 추가로 보낸다.
- Telegram 발송이 실패하면 표식을 남기지 않아 다음 timer 실행에서 재시도된다.
- 새 상장은 `first_seen <= 기준일` 규칙을 바꾸지 않는다. 다음 날 아침 동기화에서 처음 보인 종목은 다음 거래일 보고에 포함된다.
- 비밀값·수신처를 로그에 출력하지 않는다.

## 파일 구조

- Modify: `scripts/run-kr-daily.ts` — `markNewListingAlerts`, `sendKoreanDailyStatus` export
- Modify: `scripts/run-kr-catchup.ts` — `reportLatestCatchupDay()` 추가, `main()` 연결
- Test: `test/scripts/run-kr-catchup.test.ts`
- Docs: `docs/guides/etf-signal-mvp-e2e-configuration-guide.md`, `docs/guides/etf-signal-mvp-m6-observation-runbook.md`, `docs/plans/NEXT.md`

---

### Task 1: `reportLatestCatchupDay()` 순수 흐름

**Files:**
- Modify: `scripts/run-kr-catchup.ts`
- Test: `test/scripts/run-kr-catchup.test.ts`

**Interfaces:**
- Produces:

```ts
export interface LatestReportDependencies {
  alreadyReported(date: string): Promise<boolean>;
  syncKiwoom(): Promise<{ status: string }>;
  generate(date: string): Promise<{ runId: string }>;
  report(runId: string): Promise<void>;
  markListingAlerts(runId: string): Promise<void>;
  sendStatusIfNeeded(date: string, kiwoom: { status: string }): Promise<void>;
  markReported(runId: string): Promise<void>;
}
export type LatestReportResult =
  | { reported: true; date: string; runId: string; kiwoomStatus: string }
  | { reported: false; date: string | null; reason: "no_trading_day" | "already_reported" };
export async function reportLatestCatchupDay(
  completed: readonly string[],
  dependencies: LatestReportDependencies,
): Promise<LatestReportResult>;
```

- [ ] **Step 1: 실패 테스트 작성** — `test/scripts/run-kr-catchup.test.ts` 끝에 추가

```ts
describe("reportLatestCatchupDay", () => {
  function deps(overrides: Partial<LatestReportDependencies> = {}) {
    const calls: string[] = [];
    const base: LatestReportDependencies = {
      alreadyReported: vi.fn(async () => false),
      syncKiwoom: vi.fn(async () => { calls.push("kiwoom"); return { status: "COMPLETE" }; }),
      generate: vi.fn(async (date: string) => { calls.push(`generate:${date}`); return { runId: "run-1" }; }),
      report: vi.fn(async () => { calls.push("report"); }),
      markListingAlerts: vi.fn(async () => { calls.push("alerts"); }),
      sendStatusIfNeeded: vi.fn(async () => { calls.push("status"); }),
      markReported: vi.fn(async () => { calls.push("marked"); }),
      ...overrides,
    };
    return { base, calls };
  }

  it("syncs Kiwoom, regenerates, reports and marks only the latest completed day", async () => {
    const { base, calls } = deps();
    const result = await reportLatestCatchupDay(["20260922", "20260923"], base);
    expect(result).toEqual({ reported: true, date: "20260923", runId: "run-1", kiwoomStatus: "COMPLETE" });
    expect(calls).toEqual(["kiwoom", "generate:20260923", "report", "alerts", "status", "marked"]);
  });

  it("skips everything when the latest day was already reported", async () => {
    const { base, calls } = deps({ alreadyReported: vi.fn(async () => true) });
    const result = await reportLatestCatchupDay(["20260923"], base);
    expect(result).toEqual({ reported: false, date: "20260923", reason: "already_reported" });
    expect(calls).toEqual([]);
  });

  it("does nothing when no trading day completed", async () => {
    const { base, calls } = deps();
    expect(await reportLatestCatchupDay([], base)).toEqual({ reported: false, date: null, reason: "no_trading_day" });
    expect(base.alreadyReported).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("leaves the day unmarked when Telegram delivery fails so the next run retries", async () => {
    const { base } = deps({ report: vi.fn(async () => { throw new Error("telegram down"); }) });
    await expect(reportLatestCatchupDay(["20260923"], base)).rejects.toThrow("telegram down");
    expect(base.markReported).not.toHaveBeenCalled();
  });

  it("still reports signals and sends a status alert when Kiwoom fails", async () => {
    const { base } = deps({ syncKiwoom: vi.fn(async () => ({ status: "FETCH_FAIL" })) });
    const result = await reportLatestCatchupDay(["20260923"], base);
    expect(result).toMatchObject({ reported: true, kiwoomStatus: "FETCH_FAIL" });
    expect(base.sendStatusIfNeeded).toHaveBeenCalledWith("20260923", { status: "FETCH_FAIL" });
    expect(base.markReported).toHaveBeenCalledWith("run-1");
  });
});
```

import 줄을 `import { catchUpKoreanTradingDays, missingWeekdays, reportLatestCatchupDay, type LatestReportDependencies } from "../../scripts/run-kr-catchup";`로 바꾼다.

- [ ] **Step 2: 실패 확인** — `npx vitest run test/scripts/run-kr-catchup.test.ts` → `reportLatestCatchupDay is not a function` 류 실패

- [ ] **Step 3: 최소 구현** — `scripts/run-kr-catchup.ts`의 `catchUpKoreanTradingDays` 아래에 위 Interfaces의 타입과 함께 추가

```ts
export async function reportLatestCatchupDay(
  completed: readonly string[],
  dependencies: LatestReportDependencies,
): Promise<LatestReportResult> {
  const date = completed.at(-1);
  if (!date) return { reported: false, date: null, reason: "no_trading_day" };
  if (await dependencies.alreadyReported(date))
    return { reported: false, date, reason: "already_reported" };
  const kiwoom = await dependencies.syncKiwoom();
  const { runId } = await dependencies.generate(date);
  await dependencies.report(runId);
  await dependencies.markListingAlerts(runId);
  await dependencies.sendStatusIfNeeded(date, kiwoom);
  await dependencies.markReported(runId);
  return { reported: true, date, runId, kiwoomStatus: kiwoom.status };
}
```

- [ ] **Step 4: 통과 확인** — 같은 명령 PASS
- [ ] **Step 5: 커밋** — `feat: KR 보충 뒤 직전 거래일 보고 흐름 추가`

### Task 2: 운영 의존성 연결과 문서

**Files:**
- Modify: `scripts/run-kr-daily.ts` (두 함수 export)
- Modify: `scripts/run-kr-catchup.ts` (`main()`)
- Docs: 위 파일 구조의 문서 3개

**Interfaces:**
- Consumes: Task 1 `reportLatestCatchupDay`, `runKiwoomMasterSync(dependencies: IngestionDependencies)`(`scripts/ingest-kr.ts`), `reportLatestKrxSignals(send, runId)`, `generateKrxPriceSignals(date)`, `createKoreanDailyStatusReport`·`shouldSendKoreanDailyStatus`(`lib/notifications/kr-daily-status.ts`)
- Produces: `export async function markNewListingAlerts(runId: string): Promise<void>`, `export async function sendKoreanDailyStatus(requestedDate, ingestion)`(기존 시그니처 유지)

- [ ] **Step 1:** `scripts/run-kr-daily.ts`에서 `markNewListingAlerts`, `sendKoreanDailyStatus` 앞에 `export`만 붙인다. `npx vitest run test/scripts/run-kr-daily.test.ts` PASS 확인.
- [ ] **Step 2:** `scripts/run-kr-catchup.ts`의 `main()`에서 `console.log(JSON.stringify(result)); if (result.blocked) process.exitCode = 1;`를 아래로 바꾼다.

```ts
  if (result.blocked) {
    console.log(JSON.stringify({ ...result, report: null }));
    process.exitCode = 1;
    return;
  }
  const kiwoomClient = new KiwoomClient({
    appKey: getRequiredServerSecret("KIWOOM_APP_KEY"),
    secretKey: getRequiredServerSecret("KIWOOM_SECRET_KEY"),
  });
  const report = await reportLatestCatchupDay(result.completed, {
    async alreadyReported(date) {
      const { data, error } = await client.from("signal_run").select("id")
        .eq("market", "KR").eq("bas_dd", toIsoDate(date))
        .eq("strategy_version", KR_PRICE_SIGNAL_STRATEGY_VERSION)
        .not("notes->>telegram_reported_at", "is", null).limit(1);
      if (error) throw new Error(`KR report marker read failed: ${error.message}`);
      return (data ?? []).length > 0;
    },
    syncKiwoom: () => runKiwoomMasterSync({
      requestedDate: result.completed.at(-1)!, observedDate: today,
      observationKey: () => `kr-timer-${randomUUID()}`, repository, krxClient, kiwoomClient,
    }),
    generate: generateKrxPriceSignals,
    report: async (runId) => { await reportLatestKrxSignals(true, runId); },
    markListingAlerts: markNewListingAlerts,
    async sendStatusIfNeeded(date, kiwoom) {
      const ingestion = {
        krx: { status: "TRADING_COMPLETE", snapshotId: "", duplicate: false },
        kiwoom: kiwoom as Awaited<ReturnType<typeof runKiwoomMasterSync>>,
      };
      if (shouldSendKoreanDailyStatus(ingestion)) await sendKoreanDailyStatus(date, ingestion);
    },
    async markReported(runId) {
      const { data, error } = await client.from("signal_run").select("notes").eq("id", runId).single();
      if (error) throw new Error(`KR signal run notes read failed: ${error.message}`);
      const notes = typeof data?.notes === "object" && data.notes !== null ? data.notes : {};
      const { error: updateError } = await client.from("signal_run")
        .update({ notes: { ...notes, telegram_reported_at: new Date().toISOString() } }).eq("id", runId);
      if (updateError) throw new Error(`KR report marker write failed: ${updateError.message}`);
    },
  });
  console.log(JSON.stringify({ ...result, report }));
```

필요한 import(`KiwoomClient`, `runKiwoomMasterSync`, `reportLatestKrxSignals`, `markNewListingAlerts`, `sendKoreanDailyStatus`, `shouldSendKoreanDailyStatus`)를 추가한다. `shouldSendKoreanDailyStatus`의 실제 입력 타입을 확인해 `ingestion` 객체를 맞추고, 타입이 다르면 그 타입을 따르도록 조정한다.

- [ ] **Step 3:** `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build` 모두 통과 확인.
- [ ] **Step 4: 문서** — e2e 가이드의 timer 표·191행 설명, M6 런북 11행을 "보충 뒤 직전 거래일 1건은 Kiwoom 동기화·신호 재생성·Telegram 보고까지 수행하며 `telegram_reported_at`으로 1회만 보낸다. 이 실행은 완전 거래일 판정 대상이다"로 갱신. 알려진 한계: 같은 기준일을 나중에 동일 입력으로 재생성하면 notes가 덮여 표식이 사라질 수 있다(앞선 누락일을 뒤늦게 채우는 드문 경우).
- [ ] **Step 5: 커밋** — `feat: KR timer 경로에서 직전 거래일 완전 보고`
