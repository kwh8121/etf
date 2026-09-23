import { describe, expect, it, vi } from "vitest";

import {
  catchUpKoreanTradingDays,
  missingWeekdays,
  reportLatestCatchupDay,
  type LatestReportDependencies,
} from "../../scripts/run-kr-catchup";

describe("missingWeekdays", () => {
  it("lists prior weekdays in order, excluding today", () => {
    expect(missingWeekdays("20260918", "20260922")).toEqual([
      "20260918", "20260921",
    ]);
  });
});

describe("catchUpKoreanTradingDays", () => {
  it("skips completed dates, handles holidays, and stops at an unresolved day", async () => {
    const status = vi.fn(async (date: string) =>
      date === "20260918" ? "TRADING_COMPLETE" : null,
    );
    const ingest = vi.fn(async (date: string) =>
      date === "20260921" ? "NON_TRADING" : "FETCH_FAIL",
    );
    const signalComplete = vi.fn(async () => false);
    const generate = vi.fn(async () => undefined);
    const result = await catchUpKoreanTradingDays(
      ["20260918", "20260921", "20260922", "20260923"],
      { status, ingest, signalComplete, generate },
    );
    expect(result).toEqual({ completed: ["20260918"], nonTrading: ["20260921"], blocked: "20260922" });
    expect(ingest).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith("20260918");
  });

  it("rechecks an empty weekday so a transient empty response cannot hide later KRX data", async () => {
    const ingest = vi.fn(async () => "TRADING_COMPLETE" as const);
    const generate = vi.fn(async () => undefined);
    const result = await catchUpKoreanTradingDays(["20260921"], {
      status: async () => "NON_TRADING",
      ingest,
      signalComplete: async () => false,
      generate,
    });
    expect(result.completed).toEqual(["20260921"]);
    expect(ingest).toHaveBeenCalledWith("20260921");
    expect(generate).toHaveBeenCalledWith("20260921");
  });

  it("recalculates later signal windows after filling an older missing trading day", async () => {
    const generate = vi.fn(async () => undefined);
    await catchUpKoreanTradingDays(["20260918", "20260921"], {
      status: async (date) => date === "20260921" ? "TRADING_COMPLETE" : null,
      ingest: async () => "TRADING_COMPLETE",
      signalComplete: async () => true,
      generate,
    });
    expect(generate.mock.calls).toEqual([["20260918"], ["20260921"]]);
  });
});

describe("reportLatestCatchupDay", () => {
  const kiwoomOk = { status: "COMPLETE", snapshotId: "kiwoom-1", duplicate: false, newListingCount: 0 };

  function deps(overrides: Partial<LatestReportDependencies> = {}) {
    const calls: string[] = [];
    const base: LatestReportDependencies = {
      alreadyReported: vi.fn(async () => false),
      syncKiwoom: vi.fn(async () => { calls.push("kiwoom"); return kiwoomOk; }),
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
    expect(base.alreadyReported).toHaveBeenCalledWith("20260923");
    expect(calls).toEqual(["kiwoom", "generate:20260923", "report", "marked", "alerts", "status"]);
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

  it("marks the day right after delivery so a later alert failure cannot cause a resend", async () => {
    const { base } = deps({ sendStatusIfNeeded: vi.fn(async () => { throw new Error("status down"); }) });
    await expect(reportLatestCatchupDay(["20260923"], base)).rejects.toThrow("status down");
    expect(base.markReported).toHaveBeenCalledWith("run-1");
  });

  it("still reports signals and passes a Kiwoom failure to the status alert", async () => {
    const failed = { status: "FETCH_FAIL", snapshotId: "kiwoom-fail", duplicate: false, newListingCount: 0 };
    const { base } = deps({ syncKiwoom: vi.fn(async () => failed) });
    const result = await reportLatestCatchupDay(["20260923"], base);
    expect(result).toMatchObject({ reported: true, kiwoomStatus: "FETCH_FAIL" });
    expect(base.sendStatusIfNeeded).toHaveBeenCalledWith("20260923", "run-1", failed);
    expect(base.markReported).toHaveBeenCalledWith("run-1");
  });
});
