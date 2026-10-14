import { beforeEach, describe, expect, it, vi } from "vitest";

const runQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
  lt: vi.fn(),
};
for (const query of [runQuery]) {
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
}
runQuery.lt.mockReturnValue(runQuery);
runQuery.limit.mockReturnValue(runQuery);
const rowRequests: Array<{
  signalType: string;
  runId: string;
  selectOptions: unknown;
  orders: string[];
  limit: number | null;
}> = [];
const rowResults = new Map<
  string,
  {
    data: Array<{
      signal_type: string;
      code?: string;
      name: string;
      value: number;
      rank: number;
    }>;
    count: number;
  }
>();
const previousRowResults = new Map<
  string,
  {
    data: Array<{ code: string; name: string; value: number; rank: number }>;
  }
>();
function createRowsQuery() {
  const request = {
    signalType: "",
    runId: "",
    selectOptions: null as unknown,
    orders: [] as string[],
    limit: null as number | null,
  };
  rowRequests.push(request);
  const query = {
    select: vi.fn((_columns: string, options: unknown) => {
      request.selectOptions = options;
      return query;
    }),
    eq: vi.fn((column: string, value: string) => {
      if (column === "signal_type") request.signalType = value;
      if (column === "run_id") request.runId = value;
      return query;
    }),
    order: vi.fn((column: string) => {
      request.orders.push(column);
      return query;
    }),
    limit: vi.fn(async (limit: number) => {
      request.limit = limit;
      const currentResult = rowResults.get(request.signalType);
      const result = request.runId === "previous-run"
        ? previousRowResults.get(request.signalType)
        : currentResult;
      return {
        data: result?.data ?? [],
        count: currentResult?.count ?? 0,
        error: null,
      };
    }),
  };
  return query;
}
const from = vi.fn((table: string) =>
  table === "signal_run" ? runQuery : createRowsQuery(),
);

vi.mock("../../lib/supabase/service-role-core.ts", () => ({
  createServiceRoleClient: () => ({ from }),
}));
vi.mock("../../lib/notifications/telegram.ts", () => ({
  formatExperimentalTelegramReport: vi.fn(() => ["report"]),
  sendTelegramMessages: vi.fn(),
}));
vi.mock("../../lib/config/server-env.ts", () => ({
  getRequiredServerSecret: vi.fn(),
}));
vi.mock("../../lib/signals/us-etf-signal-repository.ts", () => ({
  markUsTelegramReported: vi.fn(),
  US_ETF_STRATEGY_VERSION: "m5-us-etf-movers-p1-v1",
}));

import { formatExperimentalTelegramReport, sendTelegramMessages } from "../../lib/notifications/telegram";
import { markUsTelegramReported } from "../../lib/signals/us-etf-signal-repository.ts";
import { reportLatestUsEtfMovers } from "../../scripts/report-us-movers";

describe("US P1 Telegram reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rowRequests.length = 0;
    rowResults.clear();
    previousRowResults.clear();
  });

  it("reads only the dedicated US P1 run and can format without sending", async () => {
    runQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "us-run",
        observed_at: "2026-09-21T14:00:00.000Z",
        status: "COMPLETED",
      },
      error: null,
    });
    await expect(reportLatestUsEtfMovers(false)).resolves.toEqual({
      runId: "us-run",
      messageCount: 1,
    });
    expect(runQuery.eq).toHaveBeenCalledWith("market", "US");
    expect(runQuery.eq).toHaveBeenCalledWith(
      "strategy_version",
      "m5-us-etf-movers-p1-v1",
    );
    expect(rowRequests).toHaveLength(4);
  });

  it("passes the observation-day detail link only when ETF_WEB_BASE_URL is set", async () => {
    runQuery.maybeSingle.mockResolvedValue({
      data: { id: "us-run", observed_at: "2026-10-11T16:00:00.000Z", status: "COMPLETED" },
      error: null,
    });
    const previous = process.env.ETF_WEB_BASE_URL;
    try {
      delete process.env.ETF_WEB_BASE_URL;
      await reportLatestUsEtfMovers(false, "us-run");
      expect(vi.mocked(formatExperimentalTelegramReport).mock.calls.at(-1)?.[0]).not.toHaveProperty("webUrl");

      process.env.ETF_WEB_BASE_URL = "https://etf.example.app/";
      await reportLatestUsEtfMovers(false, "us-run");
      expect(vi.mocked(formatExperimentalTelegramReport).mock.calls.at(-1)?.[0]).toMatchObject({
        webUrl: "https://etf.example.app/signals/us/2026-10-12",
      });
    } finally {
      if (previous === undefined) delete process.env.ETF_WEB_BASE_URL;
      else process.env.ETF_WEB_BASE_URL = previous;
    }
  });

  it("records the Telegram report marker only after a real send succeeds", async () => {
    runQuery.maybeSingle.mockResolvedValue({
      data: { id: "us-run", observed_at: "2026-09-21T14:00:00.000Z", status: "COMPLETED" },
      error: null,
    });
    await reportLatestUsEtfMovers(false, "us-run");
    expect(markUsTelegramReported).not.toHaveBeenCalled();

    await reportLatestUsEtfMovers(true, "us-run");
    expect(markUsTelegramReported).toHaveBeenCalledTimes(1);
    expect(markUsTelegramReported).toHaveBeenCalledWith(expect.anything(), "us-run");
  });

  it("does not send again for a run that already has a report marker", async () => {
    runQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "us-run",
        observed_at: "2026-09-21T14:00:00.000Z",
        status: "COMPLETED",
        notes: { telegram_reported_at: "2026-09-21T14:01:00.000Z" },
      },
      error: null,
    });
    await expect(reportLatestUsEtfMovers(true, "us-run")).resolves.toEqual({
      runId: "us-run",
      messageCount: 0,
      alreadyReported: true,
    });
    expect(sendTelegramMessages).not.toHaveBeenCalled();
    expect(markUsTelegramReported).not.toHaveBeenCalled();
  });

  it("reports a marker write failure after a successful send as a distinct error", async () => {
    runQuery.maybeSingle.mockResolvedValue({
      data: { id: "us-run", observed_at: "2026-09-21T14:00:00.000Z", status: "COMPLETED" },
      error: null,
    });
    vi.mocked(markUsTelegramReported).mockRejectedValueOnce(new Error("db down"));
    await expect(reportLatestUsEtfMovers(true, "us-run")).rejects.toThrow(
      "US report sent but Telegram marker write failed for run us-run",
    );
    expect(sendTelegramMessages).toHaveBeenCalledTimes(1);
  });

  it("does not record the marker when sending fails", async () => {
    runQuery.maybeSingle.mockResolvedValue({
      data: { id: "us-run", observed_at: "2026-09-21T14:00:00.000Z", status: "COMPLETED" },
      error: null,
    });
    vi.mocked(sendTelegramMessages).mockRejectedValueOnce(new Error("telegram down"));
    await expect(reportLatestUsEtfMovers(true, "us-run")).rejects.toThrow("telegram down");
    expect(markUsTelegramReported).not.toHaveBeenCalled();
  });

  it("uses the newly created run identity when the workflow supplies it", async () => {
    runQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    await reportLatestUsEtfMovers(false, "new-us-run");
    expect(runQuery.eq).toHaveBeenCalledWith("id", "new-us-run");
  });

  it("reports at most ten ranked rows per type while showing each full count", async () => {
    runQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "us-run",
        observed_at: "2026-09-21T14:00:00.000Z",
        status: "COMPLETED",
      },
      error: null,
    });
    const types = [
      "daily_price_gain",
      "daily_price_loss",
      "five_day_price_gain",
      "five_day_price_loss",
    ];
    for (const [index, signalType] of types.entries()) {
      const count = [123, 51, 12, 0][index];
      rowResults.set(signalType, {
        count,
        data: Array.from({ length: Math.min(count, 10) }, (_, rank) => ({
          signal_type: signalType,
          name: `ETF ${rank + 1}`,
          value: rank + 1,
          rank: rank + 1,
        })),
      });
    }

    await reportLatestUsEtfMovers(false, "us-run");

    expect(rowRequests).toHaveLength(4);
    expect(rowRequests.every((request) => request.limit === 10)).toBe(true);
    expect(
      rowRequests.every(
        (request) =>
          JSON.stringify(request.selectOptions) ===
          JSON.stringify({ count: "exact" }),
      ),
    ).toBe(true);
    expect(
      rowRequests.every((request) => request.orders.join(",") === "rank,code"),
    ).toBe(true);
    expect(formatExperimentalTelegramReport).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: [
          expect.objectContaining({
            title: "일간 상승 (상위 10건 / 전체 123건)",
            lines: expect.any(Array),
          }),
          expect.objectContaining({
            title: "일간 하락 (상위 10건 / 전체 51건)",
            lines: expect.any(Array),
          }),
          expect.objectContaining({
            title: "5일 상승 (상위 10건 / 전체 12건)",
            lines: expect.any(Array),
          }),
        ],
      }),
    );
    const sections = vi.mocked(formatExperimentalTelegramReport).mock
      .calls[0][0].sections;
    expect(sections.map((section) => section.lines.length)).toEqual([
      10, 10, 10,
    ]);
  });

  it("shows rank-ins and rank-outs against the previous completed US run", async () => {
    runQuery.maybeSingle
      .mockResolvedValueOnce({
        data: {
          id: "us-run",
          observed_at: "2026-10-14T01:00:00.000Z",
          status: "COMPLETED",
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: "previous-run" }, error: null });
    rowResults.set("daily_price_gain", {
      count: 2,
      data: [
        { signal_type: "daily_price_gain", code: "NEW", name: "신규", value: 1.23, rank: 1 },
        { signal_type: "daily_price_gain", code: "STAY", name: "유지", value: 0.5, rank: 2 },
      ],
    });
    previousRowResults.set("daily_price_gain", {
      data: [
        { code: "STAY", name: "이전 유지", value: 1, rank: 1 },
        { code: "OUT", name: "이탈", value: 0.1, rank: 2 },
      ],
    });

    await reportLatestUsEtfMovers(false, "us-run");

    const sections = vi.mocked(formatExperimentalTelegramReport).mock.calls.at(-1)?.[0].sections;
    expect(sections?.[0]?.lines).toEqual([
      "1. 신규 · 1.23% · 랭크인",
      "2. 유지 · 0.50%",
      "랭크아웃",
      "2. 이탈",
    ]);
    expect(runQuery.lt).toHaveBeenCalledWith("observed_at", "2026-10-14T01:00:00.000Z");
  });

  it("keeps a section when every previously displayed US code ranks out", async () => {
    runQuery.maybeSingle
      .mockResolvedValueOnce({
        data: {
          id: "us-run",
          observed_at: "2026-10-14T01:00:00.000Z",
          status: "COMPLETED",
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: "previous-run" }, error: null });
    rowResults.set("daily_price_loss", { count: 0, data: [] });
    previousRowResults.set("daily_price_loss", {
      data: [{ code: "OUT", name: "이탈", value: -1, rank: 1 }],
    });

    await reportLatestUsEtfMovers(false, "us-run");

    const sections = vi.mocked(formatExperimentalTelegramReport).mock.calls.at(-1)?.[0].sections;
    expect(sections).toContainEqual({
      title: "일간 하락 (상위 0건 / 전체 0건)",
      lines: ["랭크아웃", "1. 이탈"],
    });
  });

  it("does not format or send a report when a ranked query is incomplete", async () => {
    runQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "us-run",
        observed_at: "2026-09-21T14:00:00.000Z",
        status: "COMPLETED",
      },
      error: null,
    });
    rowResults.set("daily_price_gain", { count: 11, data: [] });

    await expect(reportLatestUsEtfMovers(false)).rejects.toThrow(
      "incomplete count",
    );
    expect(formatExperimentalTelegramReport).not.toHaveBeenCalled();
  });
});
