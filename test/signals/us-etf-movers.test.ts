import { describe, expect, it } from "vitest";

import {
  US_ETF_P1_DISCLOSURE,
  buildUsEtfMoverSignals,
  isUsEtfP1Enabled,
} from "@/lib/signals/us-etf-movers";

describe("US ETF P1 feature flag", () => {
  it("is disabled unless explicitly enabled", () => {
    expect(isUsEtfP1Enabled({})).toBe(false);
    expect(isUsEtfP1Enabled({ ENABLE_US_ETF_P1: "false" })).toBe(false);
    expect(isUsEtfP1Enabled({ ENABLE_US_ETF_P1: "true" })).toBe(true);
  });
});

describe("US ETF mover adapter", () => {
  it("keeps only non-ETN universe members and normalizes signed prices", () => {
    const result = buildUsEtfMoverSignals({
      universe: [
        { code: "ETF1", etn: false },
        { code: "ETN1", etn: true },
      ],
      dailyGainers: [
        {
          code: "ETF1",
          name: "ETF one",
          rank: 1,
          returnPercent: 4.2,
          endPrice: "+10.5",
        },
        {
          code: "ETN1",
          name: "ETN one",
          rank: 2,
          returnPercent: 9.9,
          endPrice: "+20",
        },
      ],
      dailyLosers: [
        {
          code: "ETF1",
          name: "ETF one",
          rank: 1,
          returnPercent: -3.1,
          endPrice: "-9.5",
        },
      ],
      fiveDayGainers: [
        {
          code: "ETF1",
          name: "ETF one",
          rank: 1,
          startPrice: "-8",
          endPrice: "+10",
        },
      ],
      fiveDayLosers: [
        {
          code: "ETF1",
          name: "ETF one",
          rank: 1,
          startPrice: "-10",
          endPrice: "-8",
        },
      ],
    });

    expect(result.dailyGainers).toEqual([
      expect.objectContaining({
        code: "ETF1",
        value: 4.2,
        meta: { end_price: 10.5 },
      }),
    ]);
    expect(result.dailyLosers).toEqual([
      expect.objectContaining({
        code: "ETF1",
        value: -3.1,
        meta: { end_price: 9.5 },
      }),
    ]);
    expect(result.fiveDayGainers).toEqual([
      expect.objectContaining({
        code: "ETF1",
        value: 25,
        meta: { start_price: 8, end_price: 10 },
      }),
    ]);
    expect(result.fiveDayLosers).toEqual([
      expect.objectContaining({
        code: "ETF1",
        value: -20,
        meta: { start_price: 10, end_price: 8 },
      }),
    ]);
    expect(US_ETF_P1_DISCLOSURE).toContain("실험");
  });

  it("drops malformed values rather than creating an experimental signal", () => {
    const result = buildUsEtfMoverSignals({
      universe: [{ code: "ETF1", etn: false }],
      dailyGainers: [
        {
          code: "ETF1",
          name: "ETF one",
          rank: 1,
          returnPercent: Number.NaN,
          endPrice: "+10",
        },
      ],
      dailyLosers: [],
      fiveDayGainers: [],
      fiveDayLosers: [],
    });

    expect(result.dailyGainers).toEqual([]);
  });
});
