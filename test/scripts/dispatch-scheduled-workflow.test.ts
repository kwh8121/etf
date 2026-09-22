import { describe, expect, it } from "vitest";

import {
  buildDispatchArgs,
  latestKrSlotDate,
} from "../../scripts/dispatch-scheduled-workflow";

const kst = (iso: string) => new Date(`${iso}+09:00`);

describe("latestKrSlotDate", () => {
  it.each([
    ["2026-09-21T19:15:00", "20260921", "월요일 정시"],
    ["2026-09-22T01:27:00", "20260921", "자정을 넘긴 지연 실행"],
    ["2026-09-21T19:14:59", "20260918", "월요일 정시 직전은 직전 금요일"],
    ["2026-09-21T10:00:00", "20260918", "월요일 오전은 직전 금요일"],
    ["2026-09-26T12:00:00", "20260925", "토요일은 금요일"],
    ["2026-09-27T23:00:00", "20260925", "일요일은 금요일"],
    ["2026-09-25T20:00:00", "20260925", "금요일 밤"],
  ])("%s KST → %s (%s)", (at, expected) => {
    expect(latestKrSlotDate(kst(at))).toBe(expected);
  });
});

describe("buildDispatchArgs", () => {
  it("passes the KR slot date so a late or catch-up run keeps the intended market date", () => {
    expect(buildDispatchArgs("kr", kst("2026-09-22T01:27:00"))).toEqual([
      "workflow",
      "run",
      "kr-daily.yml",
      "-R",
      "kwh8121/etf",
      "--ref",
      "main",
      "-f",
      "market_date=20260921",
    ]);
  });

  it("dispatches the US workflow without inputs", () => {
    expect(buildDispatchArgs("us", kst("2026-09-22T07:30:00"))).toEqual([
      "workflow",
      "run",
      "us-etf-movers.yml",
      "-R",
      "kwh8121/etf",
      "--ref",
      "main",
    ]);
  });
});
