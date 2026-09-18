import { describe, expect, it } from "vitest";

import { parseKrxEtfRow, parseKrxNumber } from "@/lib/market-data/krx";
import { validateKrxSnapshot } from "@/lib/market-data/krx-validation";

const completeRow = {
  BAS_DD: "20260916",
  ISU_CD: "A12345",
  ISU_NM: "테스트 ETF",
  TDD_CLSPRC: "10,000",
  NAV: "10,010.5",
  ACC_TRDVOL: "100",
  ACC_TRDVAL: "1,000,000",
};

describe("KRX ETF parser", () => {
  it("parses comma-separated numeric values and alphanumeric issue codes", () => {
    expect(parseKrxNumber("TDD_CLSPRC", "1,234.50")).toBe(1234.5);
    expect(parseKrxEtfRow(completeRow)).toMatchObject({
      isuCd: "A12345",
      closePrc: 10000,
      nav: 10010.5,
    });
  });

  it("rejects missing core values and non-alphanumeric issue codes", () => {
    expect(() => parseKrxEtfRow({ ...completeRow, NAV: "" })).toThrow(
      "Invalid KRX NAV",
    );
    expect(() => parseKrxEtfRow({ ...completeRow, ISU_CD: "12345-" })).toThrow(
      "Invalid KRX ISU_CD",
    );
  });
});

describe("KRX snapshot validation", () => {
  it("accepts a complete, date-bound snapshot", () => {
    expect(validateKrxSnapshot("20260916", [completeRow])).toMatchObject({
      status: "TRADING_COMPLETE",
      reasons: [],
    });
  });

  it("rejects a mismatched date and duplicate code as partial", () => {
    expect(
      validateKrxSnapshot("20260916", [
        { ...completeRow, BAS_DD: "20260915" },
        completeRow,
        { ...completeRow },
      ]),
    ).toMatchObject({ status: "PARTIAL" });
  });

  it("does not treat rows with blank core fields as complete trading data", () => {
    expect(
      validateKrxSnapshot(
        "20260913",
        [{ ...completeRow, BAS_DD: "20260913", NAV: "", TDD_CLSPRC: "", ACC_TRDVOL: "", ACC_TRDVAL: "" }],
      ),
    ).toMatchObject({ status: "NON_TRADING" });
  });

  it("marks an undersized snapshot as partial", () => {
    expect(
      validateKrxSnapshot("20260916", [completeRow], {
        previousCompleteRowCount: 200,
      }),
    ).toMatchObject({ status: "PARTIAL" });
  });
});
