import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const update = vi.fn();
  const listingQuery = { update, in: vi.fn(), is: vi.fn() };
  const signalsQuery = { select: vi.fn(), eq: vi.fn() };
  signalsQuery.select.mockReturnValue(signalsQuery);
  signalsQuery.eq.mockReturnValue(signalsQuery);
  listingQuery.update.mockReturnValue(listingQuery);
  listingQuery.in.mockReturnValue(listingQuery);
  listingQuery.is.mockResolvedValue({ error: null });
  return {
    reportLatestKrxSignals: vi.fn().mockResolvedValue(undefined),
    generateKrxPriceSignals: vi.fn().mockResolvedValue({
      basDd: "2026-09-18",
      runId: "generated-run",
      signalCount: 1,
    }),
    update,
    listingQuery,
    signalsQuery,
  };
});

vi.mock("../../lib/config/server-env.ts", () => ({
  getRequiredServerSecret: vi.fn(() => "test-secret"),
}));
vi.mock("../../lib/market-data/kiwoom.ts", () => ({
  KiwoomClient: class KiwoomClient {},
}));
vi.mock("../../lib/market-data/krx-client.ts", () => ({
  KrxClient: class KrxClient {},
}));
vi.mock("../../lib/market-data/repository.ts", () => ({
  SupabaseMarketDataRepository: class SupabaseMarketDataRepository {},
}));
vi.mock("../../lib/notifications/kr-daily-status.ts", () => ({
  createKoreanDailyStatusReport: vi.fn(),
  shouldSendKoreanDailyStatus: vi.fn(() => false),
}));
vi.mock("../../lib/notifications/telegram.ts", () => ({
  formatTelegramReport: vi.fn(),
  sendTelegramMessages: vi.fn(),
}));
vi.mock("../../lib/supabase/service-role-core.ts", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) =>
      table === "signal_daily" ? mocks.signalsQuery : mocks.listingQuery,
  }),
}));
vi.mock("../../scripts/generate-kr-price-signals.ts", () => ({
  generateKrxPriceSignals: mocks.generateKrxPriceSignals,
}));
vi.mock("../../scripts/ingest-kr.ts", () => ({
  runKoreanMarketIngestion: vi.fn().mockResolvedValue({
    krx: { status: "TRADING_COMPLETE", duplicate: false },
    kiwoom: { status: "TRADING_COMPLETE" },
  }),
}));
vi.mock("../../scripts/report-kr-signals.ts", () => ({
  reportLatestKrxSignals: mocks.reportLatestKrxSignals,
}));

import { runKoreanDailyWorkflow } from "../../scripts/run-kr-daily";

describe("KR daily workflow", () => {
  it("marks new listings only after reporting the generated run", async () => {
    let signalEqCount = 0;
    mocks.signalsQuery.eq.mockImplementation(() => {
      signalEqCount += 1;
      return signalEqCount === 2
        ? Promise.resolve({
            data: [
              { meta: { event_key: "event-123456" } },
              { meta: { event_key: "event-123456" } },
            ],
            error: null,
          })
        : mocks.signalsQuery;
    });

    await runKoreanDailyWorkflow("20260918");

    expect(mocks.reportLatestKrxSignals).toHaveBeenCalledWith(
      true,
      "generated-run",
    );
    expect(mocks.update).toHaveBeenCalledWith({
      first_alerted_at: expect.any(String),
    });
    expect(mocks.listingQuery.in).toHaveBeenCalledWith("event_key", [
      "event-123456",
    ]);
    expect(mocks.listingQuery.is).toHaveBeenCalledWith(
      "first_alerted_at",
      null,
    );
    expect(
      mocks.reportLatestKrxSignals.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.update.mock.invocationCallOrder[0]);
  });

  it("does not mark new listings when Telegram reporting fails", async () => {
    mocks.update.mockClear();
    mocks.listingQuery.in.mockClear();
    mocks.listingQuery.is.mockClear();
    mocks.reportLatestKrxSignals.mockRejectedValueOnce(
      new Error("Telegram send failed"),
    );

    await expect(runKoreanDailyWorkflow("20260918")).rejects.toThrow(
      "Telegram send failed",
    );

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.listingQuery.in).not.toHaveBeenCalled();
    expect(mocks.listingQuery.is).not.toHaveBeenCalled();
  });
});
