import { describe, expect, it } from "vitest";

import {
  createKrRelativeStrengthMap,
  formatKrRelativeStrength,
  krRelativeStrengthKey,
} from "../../lib/signals/kr-relative-strength";

describe("KR ETF relative strength", () => {
  it("calculates daily ETF return minus its tracked index return", () => {
    const values = createKrRelativeStrengthMap(
      [
        {
          code: "069500",
          signalType: "daily_price_gain",
          value: 3,
          valueUnit: "percent",
        },
      ],
      [
        {
          code: "069500",
          idxNm: "KOSPI 200",
          idxClose: 400,
          idxFlucRt: 2,
        },
      ],
    );

    expect(
      values.get(krRelativeStrengthKey("daily_price_gain", "069500")),
    ).toEqual({
      benchmarkName: "KOSPI 200",
      benchmarkReturn: 2,
      excessReturn: 1,
    });
  });

  it("calculates five-day relative return from matching tracked-index closes", () => {
    const values = createKrRelativeStrengthMap(
      [
        {
          code: "069500",
          signalType: "five_day_price_gain",
          value: 4,
          valueUnit: "percent",
        },
      ],
      [
        {
          code: "069500",
          idxNm: "KOSPI 200",
          idxClose: 408,
          idxFlucRt: 1,
        },
      ],
      [
        {
          code: "069500",
          idxNm: "KOSPI 200",
          idxClose: 400,
          idxFlucRt: -1,
        },
      ],
    );

    const value = values.get(
      krRelativeStrengthKey("five_day_price_gain", "069500"),
    );
    expect(value?.benchmarkName).toBe("KOSPI 200");
    expect(value?.benchmarkReturn).toBeCloseTo(2);
    expect(value?.excessReturn).toBeCloseTo(2);
  });

  it("marks a five-day comparison unavailable when the tracked index changed", () => {
    const values = createKrRelativeStrengthMap(
      [
        {
          code: "069500",
          signalType: "five_day_price_loss",
          value: -3,
          valueUnit: "percent",
        },
      ],
      [
        {
          code: "069500",
          idxNm: "KOSPI 200",
          idxClose: 388,
          idxFlucRt: 0,
        },
      ],
      [
        {
          code: "069500",
          idxNm: "KOSDAQ 150",
          idxClose: 400,
          idxFlucRt: 0,
        },
      ],
    );

    expect(
      values.get(krRelativeStrengthKey("five_day_price_loss", "069500")),
    ).toBeNull();
  });

  it("marks missing or invalid index data unavailable and ignores variable signals", () => {
    const values = createKrRelativeStrengthMap(
      [
        {
          code: "069500",
          signalType: "daily_price_gain",
          value: 3,
          valueUnit: "percent",
        },
        {
          code: "005930",
          signalType: "turnover_surge",
          value: 3,
          valueUnit: "ratio",
        },
      ],
      [
        {
          code: "069500",
          idxNm: "KOSPI 200",
          idxClose: 400,
          idxFlucRt: null,
        },
      ],
    );

    expect(
      values.get(krRelativeStrengthKey("daily_price_gain", "069500")),
    ).toBeNull();
    expect(values.has(krRelativeStrengthKey("turnover_surge", "005930"))).toBe(
      false,
    );
  });

  it("formats the benchmark label and percentage-point difference", () => {
    expect(
      formatKrRelativeStrength({
        benchmarkName: "KOSPI 200",
        benchmarkReturn: 2,
        excessReturn: 1.25,
      }),
    ).toBe("KOSPI 200 대비 +1.25%p");
    expect(formatKrRelativeStrength(null)).toBe("지수 비교 불가");
  });
});
