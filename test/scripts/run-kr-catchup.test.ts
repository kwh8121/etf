import { describe, expect, it, vi } from "vitest";

import { catchUpKoreanTradingDays, missingWeekdays } from "../../scripts/run-kr-catchup";

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
