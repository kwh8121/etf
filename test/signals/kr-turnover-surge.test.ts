import { describe, expect, it } from "vitest";

import { createKrxTurnoverSurges } from "../../lib/signals/kr-turnover-surge";

describe("KRX turnover surge signals", () => {
  it("uses exactly the prior 20 trading days and excludes the current day from its average", () => {
    const result = createKrxTurnoverSurges(
      [{ code: "A", name: "Alpha", accTrdval: 3_000_000_000 }],
      new Map([["A", Array.from({ length: 20 }, () => 1_000_000_000)]]),
    );

    expect(result.signals).toEqual([
      expect.objectContaining({ code: "A", value: 3, rank: 1, screen: "raw" }),
    ]);
    expect(result.averageByCode.get("A")).toBe(1_000_000_000);
  });

  it("excludes incomplete history and ratios below the fixed threshold", () => {
    const result = createKrxTurnoverSurges(
      [
        { code: "SHORT", name: "Short", accTrdval: 10_000_000_000 },
        { code: "LOW", name: "Low", accTrdval: 2_999_999_999 },
      ],
      new Map([
        ["SHORT", Array.from({ length: 19 }, () => 1_000_000_000)],
        ["LOW", Array.from({ length: 20 }, () => 1_000_000_000)],
      ]),
    );

    expect(result.signals).toEqual([]);
  });
});
