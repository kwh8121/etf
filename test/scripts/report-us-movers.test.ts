import { describe, expect, it, vi } from "vitest";

const runQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
};
const rowsQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
for (const query of [runQuery, rowsQuery]) {
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
}
runQuery.limit.mockReturnValue(runQuery);
const from = vi.fn((table: string) =>
  table === "signal_run" ? runQuery : rowsQuery,
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

import { reportLatestUsEtfMovers } from "../../scripts/report-us-movers";

describe("US P1 Telegram reporting", () => {
  it("reads only the dedicated US P1 run and can format without sending", async () => {
    runQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "us-run",
        observed_at: "2026-09-21T14:00:00.000Z",
        status: "COMPLETED",
      },
      error: null,
    });
    rowsQuery.order
      .mockReturnValueOnce(rowsQuery)
      .mockResolvedValueOnce({ data: [], error: null });

    await expect(reportLatestUsEtfMovers(false)).resolves.toEqual({
      runId: "us-run",
      messageCount: 1,
    });
    expect(runQuery.eq).toHaveBeenCalledWith("market", "US");
    expect(runQuery.eq).toHaveBeenCalledWith(
      "strategy_version",
      "m5-us-etf-movers-p1-v1",
    );
    expect(rowsQuery.eq).toHaveBeenCalledWith("market", "US");
  });

  it("uses the newly created run identity when the workflow supplies it", async () => {
    runQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    await reportLatestUsEtfMovers(false, "new-us-run");
    expect(runQuery.eq).toHaveBeenCalledWith("id", "new-us-run");
  });
});
