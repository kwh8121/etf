import { beforeEach, describe, expect, it, vi } from "vitest";

interface QueryResult {
  data: unknown;
  error: unknown;
  count?: number | null;
}

const accuracyMocks = vi.hoisted(() => ({
  auditRunAccuracy: vi.fn(),
  auditKrListingCorrectionProposals: vi.fn(),
}));

vi.mock("../../lib/signals/data-accuracy.ts", () => ({
  SupabaseDataAccuracyStore: class SupabaseDataAccuracyStore {},
  auditRunAccuracy: accuracyMocks.auditRunAccuracy,
  auditKrListingCorrectionProposals:
    accuracyMocks.auditKrListingCorrectionProposals,
}));

function createQuery(getResult: () => QueryResult, defaultCap = false) {
  let rangeStart = 0;
  let rangeEnd: number | null = defaultCap ? 999 : null;
  const applyRange = (result: QueryResult): QueryResult => {
    const data = Array.isArray(result.data) ? result.data : result.data;
    const count = result.count ?? (Array.isArray(result.data) ? result.data.length : null);
    if (!Array.isArray(data) || rangeEnd === null) return { ...result, count };
    return {
      ...result,
      data: data.slice(rangeStart, rangeEnd + 1),
      count,
    };
  };
  const query: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => unknown;
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    range: vi.fn((start: number, end: number) => {
      rangeStart = start;
      rangeEnd = end;
      return query;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(getResult())),
    then: (resolve, reject) => Promise.resolve(applyRange(getResult())).then(resolve, reject),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

let signalRunResult: QueryResult = { data: [], error: null };
let signalDailyResult: QueryResult = { data: [], error: null };
let calendarResult: QueryResult = { data: null, error: null };

const from = vi.fn((table: string) => {
  if (table === "signal_run") return createQuery(() => signalRunResult);
  if (table === "signal_daily") return createQuery(() => signalDailyResult, true);
  if (table === "trading_calendar_kr") return createQuery(() => calendarResult);
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("../../lib/supabase/service-role-core.ts", () => ({
  createServiceRoleClient: () => ({ from }),
}));

import {
  resolveLatestKrBasDd,
  verifyKrDailyCandidate,
} from "../../scripts/verify-kr-daily-candidate.ts";

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
  const rows: { signal_type: string; screen: "raw" | "liquid"; code: string; rank: number }[] = [];
  for (const key of FIXED_SECTION_KEYS) {
    const [signalType, screen] = key.split(":") as [string, "raw" | "liquid"];
    const count = overrides[key] ?? 10;
    for (let i = 0; i < count; i += 1)
      rows.push({
        signal_type: signalType,
        screen,
        code: `${signalType}-${screen}-${i}`,
        rank: i + 1,
      });
  }
  return rows;
}

function okRunAccuracy() {
  return {
    ok: true,
    reasons: [],
    sourceIntegrity: [{ ok: true }],
    diffs: { beforeCount: 82, afterCount: 82, added: [], removed: [], changed: [] },
    provenanceCaveats: [],
    sourceIds: ["source-1"],
  };
}

function okListingAccuracy() {
  return {
    ok: true,
    approvalReady: true,
    sourceIntegrity: [{ ok: true }],
    falseListingEvents: [],
    masterFirstSeenCorrections: [],
    caveats: [],
  };
}

describe("resolveLatestKrBasDd", () => {
  it("가장 최근 KR signal_run의 기준일을 반환한다", async () => {
    signalRunResult = { data: { bas_dd: "2026-09-30" }, error: null };

    await expect(resolveLatestKrBasDd()).resolves.toBe("2026-09-30");
  });

  it("KR signal_run이 하나도 없으면 null을 반환한다", async () => {
    signalRunResult = { data: null, error: null };

    await expect(resolveLatestKrBasDd()).resolves.toBeNull();
  });

  it("조회 오류는 예외로 전달한다", async () => {
    signalRunResult = { data: null, error: { message: "db unavailable" } };

    await expect(resolveLatestKrBasDd()).rejects.toThrow("db unavailable");
  });
});

describe("verifyKrDailyCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accuracyMocks.auditRunAccuracy.mockResolvedValue(okRunAccuracy());
    accuracyMocks.auditKrListingCorrectionProposals.mockResolvedValue(okListingAccuracy());
  });

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
      { signal_type: "new_listing", screen: "raw" as const, code: "NL1", rank: 1 },
      { signal_type: "new_listing", screen: "raw" as const, code: "NL2", rank: 2 },
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
    expect(result.accuracy).toMatchObject({ ok: true, beforeCount: 82, afterCount: 82 });
    expect(result.listingAccuracy).toMatchObject({ ok: true, falseListingEventCount: 0 });
  });

  it("signal_run을 찾을 수 없으면 실패 판정한다", async () => {
    signalRunResult = { data: [], error: null };
    signalDailyResult = { data: [], error: null };
    calendarResult = { data: null, error: null };

    const result = await verifyKrDailyCandidate("2026-09-29");

    expect(result.found).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.accuracy).toBeNull();
    expect(result.listingAccuracy).toBeNull();
    expect(result.reasons.some((reason) => reason.includes("찾을 수 없음"))).toBe(true);
  });

  it("정확한 행 수라도 내용 감사가 실패하면 후보를 실패 판정한다", async () => {
    accuracyMocks.auditRunAccuracy.mockResolvedValueOnce({
      ...okRunAccuracy(),
      ok: false,
      reasons: ["signal_diff"],
      diffs: {
        beforeCount: 82,
        afterCount: 82,
        added: [],
        removed: [],
        changed: [{ key: "daily_price_gain:raw:BAD", fields: ["rank", "value"] }],
      },
    });
    signalRunResult = {
      data: [
        {
          id: "run-diff",
          status: "COMPLETED",
          notes: { kr_full_signal_complete: true, telegram_reported_at: "t" },
        },
      ],
      error: null,
    };
    signalDailyResult = { data: completeDailyRows(), error: null };
    calendarResult = { data: { status: "TRADING_COMPLETE" }, error: null };

    const result = await verifyKrDailyCandidate("2026-09-29");

    expect(result.ok).toBe(false);
    expect(result.accuracy).toMatchObject({
      ok: false,
      reasons: ["signal_diff"],
      changedCount: 1,
    });
    expect(result.reasons).toContain("정확성 감사 실패: signal_diff");
  });

  it("상장 이력 전역 감사가 실패하면 Q27 보정 전 운영 보고 후보를 차단한다", async () => {
    accuracyMocks.auditKrListingCorrectionProposals.mockResolvedValueOnce({
      ...okListingAccuracy(),
      ok: false,
      approvalReady: true,
      falseListingEvents: Array.from({ length: 214 }, (_, index) => ({
        eventKey: `event-${index}`,
      })),
      masterFirstSeenCorrections: Array.from({ length: 214 }, (_, index) => ({
        code: `A${index}`,
      })),
      caveats: ["earlier ka10099 evidence exists"],
    });
    signalRunResult = {
      data: [
        {
          id: "run-listing-drift",
          status: "COMPLETED",
          notes: { kr_full_signal_complete: true, telegram_reported_at: "t" },
        },
      ],
      error: null,
    };
    signalDailyResult = { data: completeDailyRows(), error: null };
    calendarResult = { data: { status: "TRADING_COMPLETE" }, error: null };

    const result = await verifyKrDailyCandidate("2026-09-29");

    expect(result.ok).toBe(false);
    expect(result.listingAccuracy).toMatchObject({
      ok: false,
      falseListingEventCount: 214,
      masterFirstSeenCorrectionCount: 214,
    });
    expect(result.reasons).toContain("KR 상장 이력 감사 실패: falseListingEvents=214; masterFirstSeenCorrections=214");
  });

  it("가변 신호가 1000행을 넘어도 전체 행을 페이지네이션해 집계한다", async () => {
    signalRunResult = {
      data: [
        {
          id: "run-large",
          status: "COMPLETED",
          notes: { kr_full_signal_complete: true, telegram_reported_at: "t" },
        },
      ],
      error: null,
    };
    signalDailyResult = {
      data: [
        ...completeDailyRows(),
        ...Array.from({ length: 1_001 }, (_, index) => ({
          signal_type: "turnover_surge",
          screen: "raw" as const,
          code: `SURGE${String(index).padStart(4, "0")}`,
          rank: index + 1,
        })),
      ],
      error: null,
    };
    calendarResult = { data: { status: "TRADING_COMPLETE" }, error: null };

    const result = await verifyKrDailyCandidate("2026-09-29");

    expect(result.totalRows).toBe(1_081);
    expect(result.variableTypeCounts["turnover_surge:raw"]).toBe(1_001);
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
