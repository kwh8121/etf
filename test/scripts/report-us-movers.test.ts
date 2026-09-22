import { beforeEach, describe, expect, it, vi } from "vitest";

const runQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
};
for (const query of [runQuery]) {
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
}
runQuery.limit.mockReturnValue(runQuery);
const rowRequests: Array<{
  signalType: string;
  selectOptions: unknown;
  orders: string[];
  limit: number | null;
}> = [];
const rowResults = new Map<
  string,
  {
    data: Array<{
      signal_type: string;
      name: string;
      value: number;
      rank: number;
    }>;
    count: number;
  }
>();
function createRowsQuery() {
  const request = {
    signalType: "",
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
      return query;
    }),
    order: vi.fn((column: string) => {
      request.orders.push(column);
      return query;
    }),
    limit: vi.fn(async (limit: number) => {
      request.limit = limit;
      return {
        data: rowResults.get(request.signalType)?.data ?? [],
        count: rowResults.get(request.signalType)?.count ?? 0,
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

import { formatExperimentalTelegramReport } from "../../lib/notifications/telegram";
import { reportLatestUsEtfMovers } from "../../scripts/report-us-movers";

describe("US P1 Telegram reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rowRequests.length = 0;
    rowResults.clear();
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
