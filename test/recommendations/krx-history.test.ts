import { describe, expect, it } from "vitest";

import {
  buildHistoryRecord,
  weekdayRange,
} from "@/lib/recommendations/krx-history";

function rawRow(basDd: string, isuCd: string, close = "10,000") {
  return {
    BAS_DD: basDd,
    ISU_CD: isuCd,
    ISU_NM: `ETF ${isuCd}`,
    TDD_CLSPRC: close,
    NAV: "10,010",
    ACC_TRDVOL: "100",
    ACC_TRDVAL: "1,000,000",
    TDD_OPNPRC: "9,990",
  };
}

describe("weekdayRange", () => {
  it("주말을 제외하고 양 끝 날짜를 포함한다", () => {
    expect(weekdayRange("20261022", "20261027")).toEqual([
      "20261022",
      "20261023",
      "20261026",
      "20261027",
    ]);
  });

  it("시작이 종료보다 늦으면 빈 배열이다", () => {
    expect(weekdayRange("20261027", "20261022")).toEqual([]);
  });

  it("존재하지 않는 날짜는 거부한다", () => {
    expect(() => weekdayRange("20260230", "20260302")).toThrow();
  });
});

describe("buildHistoryRecord", () => {
  it("완전한 거래일은 행과 원문 해시를 보존한다", () => {
    const rows = [rawRow("20261022", "069500"), rawRow("20261022", "0000J0")];
    const record = buildHistoryRecord("20261022", rows, "2026-10-23T01:00:00Z");

    expect(record.status).toBe("TRADING_COMPLETE");
    expect(record.rowCount).toBe(2);
    expect(record.rows).toEqual(rows);
    expect(record.rawSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(record.fetchedAt).toBe("2026-10-23T01:00:00Z");
  });

  it("같은 입력은 같은 해시, 다른 입력은 다른 해시를 만든다", () => {
    const a = buildHistoryRecord("20261022", [rawRow("20261022", "069500")], "t");
    const b = buildHistoryRecord("20261022", [rawRow("20261022", "069500")], "t2");
    const c = buildHistoryRecord("20261022", [rawRow("20261022", "069500", "11,000")], "t");

    expect(a.rawSha256).toBe(b.rawSha256);
    expect(a.rawSha256).not.toBe(c.rawSha256);
  });

  it("핵심 값이 모두 공란이면 비거래일이며 행을 저장하지 않는다", () => {
    const blank = { BAS_DD: "20261024", ISU_CD: "069500", ISU_NM: "x" };
    const record = buildHistoryRecord("20261024", [blank], "t");

    expect(record.status).toBe("NON_TRADING");
    expect(record.rows).toEqual([]);
  });

  it("행이 불량이면 PARTIAL로 기록하고 사유를 남기며 행은 저장하지 않는다", () => {
    const bad = { ...rawRow("20261022", "069500"), NAV: "-" };
    const record = buildHistoryRecord("20261022", [bad], "t");

    expect(record.status).toBe("PARTIAL");
    expect(record.rows).toEqual([]);
    expect(record.reasons.length).toBeGreaterThan(0);
  });

  it("요청일과 다른 BAS_DD는 PARTIAL이다", () => {
    const record = buildHistoryRecord("20261022", [rawRow("20261021", "069500")], "t");

    expect(record.status).toBe("PARTIAL");
  });
});
