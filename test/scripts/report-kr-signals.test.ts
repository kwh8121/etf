import { describe, expect, it, vi } from "vitest";

const runQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  single: vi.fn(),
};
const rowsQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
};

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
  formatTelegramReport: () => ["report"],
  sendTelegramMessages: vi.fn(),
}));
vi.mock("../../lib/config/server-env.ts", () => ({
  getRequiredServerSecret: vi.fn(),
}));

import { reportLatestKrxSignals } from "../../scripts/report-kr-signals";

describe("KR signal reporting", () => {
  it("reports the requested generated signal run instead of a newer run", async () => {
    runQuery.single.mockResolvedValue({
      data: { id: "generated-run", bas_dd: "2026-09-18", status: "COMPLETED" },
      error: null,
    });
    let rowOrderCount = 0;
    rowsQuery.order.mockImplementation(() => {
      rowOrderCount += 1;
      return rowOrderCount === 3
        ? Promise.resolve({ data: [], error: null })
        : rowsQuery;
    });

    const result = await reportLatestKrxSignals(false, "generated-run");

    expect(result.runId).toBe("generated-run");
    expect(runQuery.eq).toHaveBeenCalledWith("id", "generated-run");
    expect(runQuery.order).not.toHaveBeenCalledWith("bas_dd", {
      ascending: false,
    });
  });

  it("breaks same-date latest-run ties by completion time and id", async () => {
    runQuery.order.mockClear();
    runQuery.single.mockResolvedValue({
      data: { id: "latest-run", bas_dd: "2026-09-18", status: "COMPLETED" },
      error: null,
    });
    let rowOrderCount = 0;
    rowsQuery.order.mockImplementation(() => {
      rowOrderCount += 1;
      return rowOrderCount === 3
        ? Promise.resolve({ data: [], error: null })
        : rowsQuery;
    });

    await reportLatestKrxSignals();

    expect(runQuery.order).toHaveBeenNthCalledWith(1, "bas_dd", {
      ascending: false,
    });
    expect(runQuery.order).toHaveBeenNthCalledWith(2, "completed_at", {
      ascending: false,
    });
    expect(runQuery.order).toHaveBeenNthCalledWith(3, "id", {
      ascending: false,
    });
  });
});
