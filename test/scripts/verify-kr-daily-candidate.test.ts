import { describe, expect, it, vi } from "vitest";

interface QueryResult {
  data: unknown;
  error: unknown;
}

function createQuery(getResult: () => QueryResult) {
  const query: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => unknown;
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(() => Promise.resolve(getResult())),
    then: (resolve, reject) => Promise.resolve(getResult()).then(resolve, reject),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

let signalRunResult: QueryResult = { data: [], error: null };
let signalDailyResult: QueryResult = { data: [], error: null };
let calendarResult: QueryResult = { data: null, error: null };

const from = vi.fn((table: string) => {
  if (table === "signal_run") return createQuery(() => signalRunResult);
  if (table === "signal_daily") return createQuery(() => signalDailyResult);
  if (table === "trading_calendar_kr") return createQuery(() => calendarResult);
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("../../lib/supabase/service-role-core.ts", () => ({
  createServiceRoleClient: () => ({ from }),
}));

import { verifyKrDailyCandidate } from "../../scripts/verify-kr-daily-candidate.ts";

const FIXED_SECTION_KEYS = [
  "daily_price_gain:raw",
  "daily_price_gain:liquid",
  "daily_price_loss:raw",
  "daily_price_loss:liquid",
  "five_day_price_gain:raw",
  "five_day_price_gain:liquid",
  "five_day_price_loss:raw",
  "five_day_price_loss:liquid",
];

function completeDailyRows(overrides: Record<string, number> = {}) {
  const rows: { signal_type: string; screen: "raw" | "liquid" }[] = [];
  for (const key of FIXED_SECTION_KEYS) {
    const [signalType, screen] = key.split(":") as [string, "raw" | "liquid"];
    const count = overrides[key] ?? 10;
    for (let i = 0; i < count; i += 1) rows.push({ signal_type: signalType, screen });
  }
  return rows;
}

describe("verifyKrDailyCandidate", () => {
  it("완전한 KR 완전 거래일 후보를 통과 판정한다", async () => {
    signalRunResult = {
      data: [
        {
          id: "run-1",
          status: "COMPLETED",
          notes: { kr_full_signal_complete: true, telegram_reported_at: "2026-09-30T00:33:17.034Z" },
        },
      ],
      error: null,
    };
    const rows = [
      ...completeDailyRows(),
      { signal_type: "new_listing", screen: "raw" as const },
      { signal_type: "new_listing", screen: "raw" as const },
    ];
    signalDailyResult = { data: rows, error: null };
    calendarResult = { data: { status: "TRADING_COMPLETE" }, error: null };

    const result = await verifyKrDailyCandidate("2026-09-29");

    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.runId).toBe("run-1");
    expect(result.fixedTypesOk).toBe(true);
    expect(result.totalRows).toBe(82);
    expect(result.variableTypeCounts).toEqual({ "new_listing:raw": 2 });
    expect(result.duplicateRunCount).toBe(1);
    expect(result.reportedMarkerCount).toBe(1);
  });

  it("signal_run을 찾을 수 없으면 실패 판정한다", async () => {
    signalRunResult = { data: [], error: null };
    signalDailyResult = { data: [], error: null };
    calendarResult = { data: null, error: null };

    const result = await verifyKrDailyCandidate("2026-09-29");

    expect(result.found).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("찾을 수 없음"))).toBe(true);
  });

  it("고정 P0 유형 행 수가 부족하면 실패 판정한다", async () => {
    signalRunResult = {
      data: [
        {
          id: "run-2",
          status: "COMPLETED",
          notes: { kr_full_signal_complete: true, telegram_reported_at: "2026-09-30T00:00:00Z" },
        },
      ],
      error: null,
    };
    signalDailyResult = { data: completeDailyRows({ "daily_price_gain:raw": 9 }), error: null };
    calendarResult = { data: { status: "TRADING_COMPLETE" }, error: null };

    const result = await verifyKrDailyCandidate("2026-09-29");

    expect(result.ok).toBe(false);
    expect(result.fixedTypesOk).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("daily_price_gain:raw"))).toBe(true);
  });

  it("같은 기준일에 signal_run이 중복이면 실패 판정한다", async () => {
    signalRunResult = {
      data: [
        { id: "run-3a", status: "COMPLETED", notes: { kr_full_signal_complete: true, telegram_reported_at: "t" } },
        { id: "run-3b", status: "COMPLETED", notes: { kr_full_signal_complete: true, telegram_reported_at: "t2" } },
      ],
      error: null,
    };
    signalDailyResult = { data: completeDailyRows(), error: null };
    calendarResult = { data: { status: "TRADING_COMPLETE" }, error: null };

    const result = await verifyKrDailyCandidate("2026-09-29");

    expect(result.ok).toBe(false);
    expect(result.duplicateRunCount).toBe(2);
    expect(result.reportedMarkerCount).toBe(2);
    expect(result.reasons.some((reason) => reason.includes("중복"))).toBe(true);
  });

  it("trading_calendar_kr 상태가 TRADING_COMPLETE가 아니면 실패 판정한다", async () => {
    signalRunResult = {
      data: [
        { id: "run-4", status: "COMPLETED", notes: { kr_full_signal_complete: true, telegram_reported_at: "t" } },
      ],
      error: null,
    };
    signalDailyResult = { data: completeDailyRows(), error: null };
    calendarResult = { data: { status: "PARTIAL" }, error: null };

    const result = await verifyKrDailyCandidate("2026-09-29");

    expect(result.ok).toBe(false);
    expect(result.tradingCalendarStatus).toBe("PARTIAL");
  });

  it("runId를 지정하면 해당 run만 대상으로 판정한다", async () => {
    signalRunResult = {
      data: [
        { id: "run-old", status: "COMPLETED", notes: { kr_full_signal_complete: true, telegram_reported_at: "t" } },
        { id: "run-new", status: "PENDING", notes: {} },
      ],
      error: null,
    };
    signalDailyResult = { data: completeDailyRows(), error: null };
    calendarResult = { data: { status: "TRADING_COMPLETE" }, error: null };

    const result = await verifyKrDailyCandidate("2026-09-29", "run-new");

    expect(result.runId).toBe("run-new");
    expect(result.status).toBe("PENDING");
    expect(result.ok).toBe(false);
  });
});
