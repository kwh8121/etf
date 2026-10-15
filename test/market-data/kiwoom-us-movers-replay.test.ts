import { describe, expect, it } from "vitest";

import { replayUsEtfMoverRawPayload } from "../../lib/market-data/kiwoom-us-movers.ts";
import { buildUsEtfMoverSignals } from "../../lib/signals/us-etf-movers.ts";

describe("replayUsEtfMoverRawPayload", () => {
  it("reuses the Kiwoom US parser contract for raw stored pages", () => {
    const replay = replayUsEtfMoverRawPayload({
      usa10104: {
        request: { stex_tp: "%" },
        pages: [
          [
            { stk_cd: "SPY", etn: "N" },
            { stk_cd: "ETN1", etn: "Y" },
          ],
        ],
      },
      usa20911_daily_gain: {
        request: { sort_tp: "1" },
        pages: [
          [
            { stk_cd: "SPY", stk_nm: "SPDR S&P 500 ETF", rank: "2", flu_rt: "1.25", cur_prc: "+512.34" },
            { stk_cd: "ETN1", stk_nm: "Filtered ETN", rank: "1", flu_rt: "9.99", cur_prc: "10" },
          ],
        ],
      },
      usa20911_daily_loss: {
        request: { sort_tp: "4" },
        pages: [[{ stk_cd: "SPY", stk_nm: "SPDR S&P 500 ETF", rank: "3", flu_rt: "-0.5", cur_prc: "-500" }]],
      },
      usa20511_five_day_gain: {
        request: { tm: "5" },
        pages: [[{ stk_cd: "SPY", stk_nm: "SPDR S&P 500 ETF", rank: "5", stdt_base_pric: "500", endt_base_pric: "525" }]],
      },
      usa20931_five_day_loss: {
        request: { stk_cnd: "1", tm: "2" },
        pages: [[{ stk_cd: "SPY", stk_nm: "SPDR S&P 500 ETF", base_pric: "525", cur_prc: "-500" }]],
      },
    });

    expect(replay.rowCount).toBe(7);
    expect(replay.pageCount).toBe(5);
    expect(buildUsEtfMoverSignals(replay.input)).toEqual({
      dailyGainers: [
        {
          code: "SPY",
          name: "SPDR S&P 500 ETF",
          rank: 2,
          value: 1.25,
          meta: { end_price: 512.34 },
        },
      ],
      dailyLosers: [
        {
          code: "SPY",
          name: "SPDR S&P 500 ETF",
          rank: 3,
          value: -0.5,
          meta: { end_price: 500 },
        },
      ],
      fiveDayGainers: [
        {
          code: "SPY",
          name: "SPDR S&P 500 ETF",
          rank: 5,
          value: 5,
          meta: { start_price: 500, end_price: 525 },
        },
      ],
      fiveDayLosers: [
        {
          code: "SPY",
          name: "SPDR S&P 500 ETF",
          rank: 1,
          value: -4.761905,
          meta: { start_price: 525, end_price: 500 },
        },
      ],
    });
  });

  it("fails closed when a stored US request object does not match the expected source schema", () => {
    expect(() =>
      replayUsEtfMoverRawPayload({
        usa10104: {
          request: {},
          pages: [[{ stk_cd: "SPY", etn: "N" }]],
        },
        usa20911_daily_gain: { request: { sort_tp: "1" }, pages: [] },
        usa20911_daily_loss: { request: { sort_tp: "4" }, pages: [] },
        usa20511_five_day_gain: { request: { tm: "5" }, pages: [] },
        usa20931_five_day_loss: { request: { stk_cnd: "1", tm: "2" }, pages: [] },
      }),
    ).toThrow("Stored Kiwoom usa10104 request is malformed");
  });
});
