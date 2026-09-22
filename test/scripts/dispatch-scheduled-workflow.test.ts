import { describe, expect, it } from "vitest";

import {
  buildDispatchArgs,
  isWorkHour,
} from "../../scripts/dispatch-scheduled-workflow";

const kst = (iso: string) => new Date(`${iso}+09:00`);

describe("isWorkHour", () => {
  it("allows KR dispatch only on weekdays with an hour of work time remaining", () => {
    expect(isWorkHour(kst("2026-09-22T09:00:00"))).toBe(true);
    expect(isWorkHour(kst("2026-09-22T16:59:00"))).toBe(true);
    expect(isWorkHour(kst("2026-09-22T17:00:00"))).toBe(false);
    expect(isWorkHour(kst("2026-09-22T18:00:00"))).toBe(false);
    expect(isWorkHour(kst("2026-09-26T10:00:00"))).toBe(false);
  });
});

describe("buildDispatchArgs", () => {
  it("dispatches the KR catch-up workflow without a single-date override", () => {
    expect(buildDispatchArgs("kr")).toEqual([
      "workflow",
      "run",
      "kr-daily.yml",
      "-R",
      "kwh8121/etf",
      "--ref",
      "main",
    ]);
  });

  it("dispatches the US workflow without inputs", () => {
    expect(buildDispatchArgs("us")).toEqual([
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
