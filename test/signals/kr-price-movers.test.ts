import { describe, expect, it } from "vitest";

import {
  createKrxPriceMoverSignals,
  KRX_FIVE_DAY_RETURN_DISCLOSURE,
} from "@/lib/signals/kr-price-movers";

const rows = [
  { code: "A", name: "A ETF", closePrc: 110, flucRt: 10, accTrdval: 2_000_000_000, accTrdvol: 1 },
  { code: "B", name: "B ETF", closePrc: 95, flucRt: -5, accTrdval: 500_000_000, accTrdvol: 1 },
  { code: "C", name: "C ETF", closePrc: 100, flucRt: null, accTrdval: 2_000_000_000, accTrdvol: 1 },
];

describe("KRX price mover signals", () => {
  it("ranks daily raw and liquid movers while excluding null rates", () => {
    const signals = createKrxPriceMoverSignals(rows, null);

    expect(signals.dailyGainers.filter((signal) => signal.screen === "raw")[0]).toMatchObject({
      code: "A",
      rank: 1,
      value: 10,
    });
    expect(signals.dailyGainers.filter((signal) => signal.screen === "liquid")[0]).toMatchObject({
      code: "A",
      rank: 1,
      value: 10,
    });
    expect(signals.dailyLosers.filter((signal) => signal.screen === "raw")[0]).toMatchObject({
      code: "B",
      rank: 1,
      value: -5,
    });
  });

  it("requires every sequence in a five-trading-day window", () => {
    const input = {
      currentRows: rows,
      startRows: rows.map((row) => ({ ...row, closePrc: 100 })),
      currentSeq: 10,
      startSeq: 5,
      availableSeqs: [5, 6, 7, 9, 10],
    };

    expect(createKrxPriceMoverSignals(rows, input).fiveDayGainers).toEqual([]);
    const signals = createKrxPriceMoverSignals(rows, { ...input, availableSeqs: [5, 6, 7, 8, 9, 10] });
    expect(signals.fiveDayGainers.filter((signal) => signal.screen === "raw")[0]).toMatchObject({
      code: "A",
      rank: 1,
    });
    expect(signals.fiveDayGainers.filter((signal) => signal.screen === "raw")[0]?.value).toBeCloseTo(10);
    expect(signals.fiveDayGainers.filter((signal) => signal.screen === "liquid")[0]?.value).toBeCloseTo(10);
    expect(signals.disclosure).toBe(KRX_FIVE_DAY_RETURN_DISCLOSURE);
  });
});
