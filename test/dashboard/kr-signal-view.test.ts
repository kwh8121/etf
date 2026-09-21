import { describe, expect, it } from "vitest";

import { createDashboardSignalSections, formatDashboardSignalValue } from "../../lib/dashboard/kr-signal-view";

describe("KR signal dashboard view", () => {
  it("groups raw and liquid rows separately and formats displayed values", () => {
    const sections = createDashboardSignalSections([
      { signalType: "daily_price_gain", screen: "liquid", name: "Liquid", value: 1.2, valueUnit: "percent", rank: 2 },
      { signalType: "daily_price_gain", screen: "raw", name: "Raw", value: 2.3, valueUnit: "percent", rank: 1 },
    ]);

    expect(sections).toEqual([
      expect.objectContaining({ title: "일간 상승 (유동성)" }),
      expect.objectContaining({ title: "일간 상승 (전체)" }),
    ]);
    expect(formatDashboardSignalValue(sections[0].rows[0])).toBe("+1.20%");
  });
});
