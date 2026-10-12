import { beforeEach, describe, expect, it, vi } from "vitest";

interface RunRow {
  id: string;
  status: string;
  observed_at: string;
  completed_at: string | null;
  notes: Record<string, unknown> | null;
}

const runEqCalls: Array<[string, unknown]> = [];
const runRangeCalls: Array<[string, string, unknown]> = [];
let latestRunResult: { data: RunRow | null; error: unknown };
let runByIdResult: { data: RunRow | null; error: unknown };
let sameDayRunsResult: { data: RunRow[]; error: unknown };
let typeResults: Record<string, { count: number; ranks: number[]; error?: unknown }>;

function createRunQuery() {
  const filters: Record<string, unknown> = {};
  let ranged = false;
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => {
      filters[column] = value;
      runEqCalls.push([column, value]);
      return query;
    }),
    gte: vi.fn((column: string, value: unknown) => {
      ranged = true;
      runRangeCalls.push(["gte", column, value]);
      return query;
    }),
    lt: vi.fn((column: string, value: unknown) => {
      runRangeCalls.push(["lt", column, value]);
      return query;
    }),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(() =>
      Promise.resolve("id" in filters ? runByIdResult : latestRunResult),
    ),
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(ranged ? sameDayRunsResult : latestRunResult).then(resolve, reject),
  };
  return query;
}

function createDailyQuery() {
  let signalType = "";
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: string) => {
      if (column === "signal_type") signalType = value;
      return query;
    }),
    order: vi.fn(() => query),
    limit: vi.fn(() => {
      const result = typeResults[signalType] ?? { count: 0, ranks: [] };
      return Promise.resolve({
        data: result.ranks.map((rank) => ({ rank })),
        count: result.count,
        error: result.error ?? null,
      });
    }),
  };
  return query;
}

const from = vi.fn((table: string) => {
  if (table === "signal_run") return createRunQuery();
  if (table === "signal_daily") return createDailyQuery();
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("../../lib/supabase/service-role-core.ts", () => ({
  createServiceRoleClient: () => ({ from }),
}));

import { verifyUsCandidate } from "../../scripts/verify-us-candidate.ts";

const TYPES = [
  "daily_price_gain",
  "daily_price_loss",
  "five_day_price_gain",
  "five_day_price_loss",
];
const ranks10 = Array.from({ length: 10 }, (_, i) => i + 1);

function completeRun(overrides: Partial<RunRow> = {}): RunRow {
  return {
    id: "us-run-1",
    status: "COMPLETED",
    observed_at: "2026-10-12T01:00:00.000Z",
    completed_at: "2026-10-12T01:00:30.000Z",
    notes: { telegram_reported_at: "2026-10-12T01:01:00.000Z" },
    ...overrides,
  };
}

function setCompleteTypes(counts: Record<string, number> = {}) {
  typeResults = Object.fromEntries(
    TYPES.map((type) => {
      const count = counts[type] ?? 120;
      return [type, { count, ranks: ranks10.slice(0, Math.min(count, 10)) }];
    }),
  );
}

describe("verifyUsCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runEqCalls.length = 0;
    runRangeCalls.length = 0;
    const run = completeRun();
    latestRunResult = { data: run, error: null };
    runByIdResult = { data: run, error: null };
    sameDayRunsResult = { data: [run], error: null };
    setCompleteTypes();
  });

  it("passes a complete, reported US run and derives the KST observation date", async () => {
    const result = await verifyUsCandidate("latest");

    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.runId).toBe("us-run-1");
    expect(result.observedKstDate).toBe("2026-10-12");
    expect(result.typeCounts).toEqual({
      daily_price_gain: 120,
      daily_price_loss: 120,
      five_day_price_gain: 120,
      five_day_price_loss: 120,
    });
    expect(result.telegramReportedAt).toBe("2026-10-12T01:01:00.000Z");
    expect(result.sameDayRunCount).toBe(1);
    expect(result.sameDayReportedMarkerCount).toBe(1);
  });

  it("restricts every run lookup to the dedicated US P1 strategy and the KST day window", async () => {
    await verifyUsCandidate("latest");

    expect(runEqCalls).toContainEqual(["market", "US"]);
    expect(runEqCalls).toContainEqual(["strategy_version", "m5-us-etf-movers-p1-v1"]);
    expect(runEqCalls).toContainEqual(["status", "COMPLETED"]);
    // 2026-10-12 KST 하루 = 2026-10-11T15:00Z 이상, 2026-10-12T15:00Z 미만
    expect(runRangeCalls).toContainEqual(["gte", "observed_at", "2026-10-11T15:00:00.000Z"]);
    expect(runRangeCalls).toContainEqual(["lt", "observed_at", "2026-10-12T15:00:00.000Z"]);
  });

  it("uses the KST calendar date, not the UTC date", async () => {
    const run = completeRun({ observed_at: "2026-10-11T16:00:00.000Z" });
    latestRunResult = { data: run, error: null };
    sameDayRunsResult = { data: [run], error: null };

    const result = await verifyUsCandidate("latest");

    expect(result.observedKstDate).toBe("2026-10-12");
  });

  it("looks the run up by id when an id is given", async () => {
    const result = await verifyUsCandidate("us-run-1");

    expect(result.ok).toBe(true);
    expect(result.runId).toBe("us-run-1");
  });

  it("fails when no US run exists", async () => {
    latestRunResult = { data: null, error: null };

    const result = await verifyUsCandidate("latest");

    expect(result.found).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain("찾을 수 없음");
  });

  it("fails when the latest run is still PENDING", async () => {
    const run = completeRun({ status: "PENDING", completed_at: null });
    latestRunResult = { data: run, error: null };
    sameDayRunsResult = { data: [run], error: null };

    const result = await verifyUsCandidate("latest");

    expect(result.ok).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("COMPLETED 아님"))).toBe(true);
  });

  it("fails when the Telegram report marker is missing", async () => {
    const run = completeRun({ notes: {} });
    latestRunResult = { data: run, error: null };
    sameDayRunsResult = { data: [run], error: null };

    const result = await verifyUsCandidate("latest");

    expect(result.ok).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("telegram_reported_at 없음"))).toBe(true);
  });

  it("fails when a signal type has fewer than ten rows", async () => {
    setCompleteTypes({ five_day_price_loss: 7 });

    const result = await verifyUsCandidate("latest");

    expect(result.ok).toBe(false);
    expect(result.typeCounts.five_day_price_loss).toBe(7);
    expect(result.reasons.some((reason) => reason.includes("five_day_price_loss=7"))).toBe(true);
  });

  it("accepts rank gaps such as an excluded ETN at rank 1", async () => {
    typeResults.daily_price_gain = { count: 120, ranks: [2, 3, 5, 6, 7, 8, 9, 10, 11, 13] };

    const result = await verifyUsCandidate("latest");

    expect(result.ok).toBe(true);
  });

  it("fails when ranks are not positive and ascending", async () => {
    typeResults.daily_price_gain = { count: 120, ranks: [1, 2, 2, 4, 5, 6, 7, 8, 9, 10] };

    const result = await verifyUsCandidate("latest");

    expect(result.ok).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("daily_price_gain") && reason.includes("오름차순"))).toBe(true);
  });

  it("reports the run age without judging it", async () => {
    const result = await verifyUsCandidate("latest");

    expect(typeof result.ageHours).toBe("number");
    expect(result.ok).toBe(true);
  });

  it("flags more than one report marker on the same KST day as a duplicate send", async () => {
    const second = completeRun({ id: "us-run-2", observed_at: "2026-10-12T02:00:00.000Z" });
    sameDayRunsResult = { data: [completeRun(), second], error: null };

    const result = await verifyUsCandidate("latest");

    expect(result.ok).toBe(false);
    expect(result.sameDayRunCount).toBe(2);
    expect(result.sameDayReportedMarkerCount).toBe(2);
    expect(result.reasons.some((reason) => reason.includes("중복 발송 의심"))).toBe(true);
  });

  it("throws on database errors", async () => {
    typeResults.daily_price_loss = { count: 0, ranks: [], error: { message: "db unavailable" } };

    await expect(verifyUsCandidate("latest")).rejects.toThrow("db unavailable");
  });
});
