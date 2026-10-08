import { describe, expect, it } from "vitest";

import {
  classifyKrSignalType,
  createDashboardSignalSections,
  formatDashboardSignalValue,
  selectDirectionRows,
  selectVariableSections,
} from "../../lib/dashboard/kr-signal-view";

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

describe("KR 신호 유형 분류", () => {
  it("고정 8유형의 기간과 방향을 분류한다", () => {
    expect(classifyKrSignalType("daily_price_gain")).toEqual({ period: "daily", direction: "gain" });
    expect(classifyKrSignalType("daily_price_loss")).toEqual({ period: "daily", direction: "loss" });
    expect(classifyKrSignalType("five_day_price_gain")).toEqual({ period: "five_day", direction: "gain" });
    expect(classifyKrSignalType("five_day_price_loss")).toEqual({ period: "five_day", direction: "loss" });
  });

  it("가변 신호와 알 수 없는 유형은 분류하지 않는다", () => {
    expect(classifyKrSignalType("turnover_surge")).toBeNull();
    expect(classifyKrSignalType("new_listing")).toBeNull();
    expect(classifyKrSignalType("unknown_type")).toBeNull();
  });

  it("기간·스크린·방향이 모두 맞는 행만 순위 순으로 고른다", () => {
    const rows = [
      { signalType: "daily_price_gain", screen: "raw" as const, name: "둘째", value: 1, valueUnit: "percent", rank: 2 },
      { signalType: "daily_price_gain", screen: "raw" as const, name: "첫째", value: 2, valueUnit: "percent", rank: 1 },
      { signalType: "daily_price_gain", screen: "liquid" as const, name: "유동성", value: 3, valueUnit: "percent", rank: 1 },
      { signalType: "daily_price_loss", screen: "raw" as const, name: "하락", value: -1, valueUnit: "percent", rank: 1 },
      { signalType: "five_day_price_gain", screen: "raw" as const, name: "5일", value: 4, valueUnit: "percent", rank: 1 },
      { signalType: "turnover_surge", screen: "raw" as const, name: "급증", value: 5, valueUnit: "ratio", rank: 1 },
    ];

    expect(selectDirectionRows(rows, "daily", "raw", "gain").map((row) => row.name)).toEqual(["첫째", "둘째"]);
    expect(selectDirectionRows(rows, "daily", "liquid", "gain").map((row) => row.name)).toEqual(["유동성"]);
    expect(selectDirectionRows(rows, "daily", "raw", "loss").map((row) => row.name)).toEqual(["하락"]);
    expect(selectDirectionRows(rows, "five_day", "raw", "gain").map((row) => row.name)).toEqual(["5일"]);
    expect(selectDirectionRows(rows, "five_day", "liquid", "loss")).toEqual([]);
  });

  it("rank가 null인 행을 맨 뒤로 보낸다", () => {
    const rows = [
      { signalType: "daily_price_gain", screen: "raw" as const, name: "순위없음", value: 1, valueUnit: "percent", rank: null },
      { signalType: "daily_price_gain", screen: "raw" as const, name: "1위", value: 2, valueUnit: "percent", rank: 1 },
    ];

    expect(selectDirectionRows(rows, "daily", "raw", "gain").map((row) => row.name)).toEqual(["1위", "순위없음"]);
  });

  it("가변 신호만 별도 섹션으로 묶는다", () => {
    const sections = selectVariableSections([
      { signalType: "daily_price_gain", screen: "raw", name: "고정", value: 1, valueUnit: "percent", rank: 1 },
      { signalType: "new_listing", screen: "raw", name: "신규", value: 1, valueUnit: "event", rank: 1 },
      { signalType: "turnover_surge", screen: "raw", name: "급증", value: 2.5, valueUnit: "ratio", rank: 1 },
    ]);

    expect(sections.map((section) => section.title)).toEqual(["신규 상장", "거래대금 급증"]);
  });
});
