import { describe, expect, it } from "vitest";

import { formatBasDdLabel, normalizeBasDd } from "../../lib/dashboard/bas-dd";

describe("기준일 정규화", () => {
  it("정본 형식과 압축 형식을 같은 값으로 정규화한다", () => {
    expect(normalizeBasDd("2026-10-07")).toBe("2026-10-07");
    expect(normalizeBasDd("20261007")).toBe("2026-10-07");
  });

  it("형식이 틀린 값을 거부한다", () => {
    expect(normalizeBasDd("2026-10-7")).toBeNull();
    expect(normalizeBasDd("26-10-07")).toBeNull();
    expect(normalizeBasDd("latest")).toBeNull();
    expect(normalizeBasDd("")).toBeNull();
  });

  it("형식은 맞지만 실재하지 않는 날짜를 거부한다", () => {
    expect(normalizeBasDd("2026-02-30")).toBeNull();
    expect(normalizeBasDd("20261332")).toBeNull();
    expect(normalizeBasDd("2026-00-10")).toBeNull();
  });

  it("요일을 붙인 표시 라벨을 만든다", () => {
    expect(formatBasDdLabel("2026-10-07")).toBe("2026-10-07 (수)");
    expect(formatBasDdLabel("2026-10-09")).toBe("2026-10-09 (금)");
  });
});
