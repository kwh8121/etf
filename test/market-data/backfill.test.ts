import { describe, expect, it } from "vitest";

import { previousCalendarDate, runKoreanMarketBackfill } from "@/scripts/backfill";

describe("Korean market backfill", () => {
  it("stops exactly at the target complete-day count while skipping non-trading dates", async () => {
    const requestedDates: string[] = [];
    let completeDays = 23;
    const result = await runKoreanMarketBackfill(
      {
        repository: { getCompleteTradingDayCount: async () => completeDays },
        ingestKrx: async (requestedDate) => {
          requestedDates.push(requestedDate);
          if (requestedDate === "20260920") {
            return { status: "NON_TRADING" };
          }
          completeDays += 1;
          return { status: "TRADING_COMPLETE" };
        },
      },
      { startDate: "20260920", maxCalendarDays: 5 },
    );

    expect(result).toMatchObject({ initialCompleteDays: 23, completeDays: 25, reachedTarget: true });
    expect(requestedDates).toEqual(["20260920", "20260919", "20260918"]);
  });

  it("moves across month boundaries using UTC calendar dates", () => {
    expect(previousCalendarDate("20260301")).toBe("20260228");
    expect(previousCalendarDate("20260302")).toBe("20260301");
  });
});
