import { describe, expect, it } from "vitest";

import { classifyKrSignalType } from "../../lib/dashboard/kr-signal-view";
import { US_ETF_SIGNAL_TYPES } from "../../lib/signals/us-etf-constants";
import {
  formatKstTime,
  formatObsDateLabel,
  kstDayBoundsUtc,
  normalizeObsDate,
  toKstDate,
  usSignalType,
} from "../../lib/dashboard/us-signal-view";

describe("US 한국 관측일 변환", () => {
  it("UTC 시각을 한국 날짜로 바꾼다", () => {
    expect(toKstDate("2026-10-12T01:00:00.000Z")).toBe("2026-10-12");
    expect(toKstDate("2026-10-11T15:00:00.000Z")).toBe("2026-10-12");
    expect(toKstDate("2026-10-11T14:59:59.999Z")).toBe("2026-10-11");
  });

  it("한국 하루를 UTC 반열린 구간으로 바꾼다", () => {
    expect(kstDayBoundsUtc("2026-10-12")).toEqual({
      from: "2026-10-11T15:00:00.000Z",
      to: "2026-10-12T15:00:00.000Z",
    });
  });

  it("구간의 양 끝이 같은 한국 날짜 경계와 맞는다", () => {
    const { from, to } = kstDayBoundsUtc("2026-10-12");
    expect(toKstDate(from)).toBe("2026-10-12");
    expect(toKstDate(to)).toBe("2026-10-13");
  });
});

describe("관측일 정규화와 표기", () => {
  it("두 표기를 같은 값으로 정규화하고 잘못된 값을 거부한다", () => {
    expect(normalizeObsDate("2026-10-12")).toBe("2026-10-12");
    expect(normalizeObsDate("20261012")).toBe("2026-10-12");
    expect(normalizeObsDate("2026-02-30")).toBeNull();
    expect(normalizeObsDate("latest")).toBeNull();
  });

  it("미국 거래일이 아니라 한국 시간 관측일임을 라벨에 드러낸다", () => {
    expect(formatObsDateLabel("2026-10-12")).toBe("한국 시간 2026-10-12 (월) 관측");
  });
});

describe("관측 시각 표기와 신호 유형", () => {
  it("관측 시각을 한국 시간 HH:mm로 표기한다", () => {
    expect(formatKstTime("2026-10-11T22:31:05.123+00:00")).toBe("07:31");
    expect(formatKstTime("2026-10-12T15:00:00.000Z")).toBe("00:00");
  });

  it("기간·방향 조합이 US 4유형과 1:1로 대응하고 모두 KR 분류로 읽힌다", () => {
    const built = (["daily", "five_day"] as const).flatMap((period) =>
      (["gain", "loss"] as const).map((direction) => usSignalType(period, direction)),
    );
    expect([...built].sort()).toEqual([...US_ETF_SIGNAL_TYPES].sort());
    for (const type of US_ETF_SIGNAL_TYPES) {
      expect(classifyKrSignalType(type)).not.toBeNull();
    }
  });
});
