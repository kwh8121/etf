import { describe, expect, it } from "vitest";

import { createKoreanDailyStatusReport } from "../../lib/notifications/kr-daily-status";

describe("Korean daily status reports", () => {
  it.each([
    ["FETCH_FAIL", false, "COMPLETE", false, "FAILED"],
    ["PARTIAL", false, "COMPLETE", false, "PARTIAL"],
    ["PUBLISH_PENDING", false, "COMPLETE", false, "PENDING"],
    ["NON_TRADING", false, "COMPLETE", false, "SKIPPED"],
    ["TRADING_COMPLETE", true, "COMPLETE", false, "SKIPPED"],
    ["TRADING_COMPLETE", false, "FETCH_FAIL", false, "FAILED"],
  ] as const)(
    "maps KRX %s and Kiwoom %s to %s",
    (krxStatus, krxDuplicate, kiwoomStatus, kiwoomDuplicate, status) => {
      const report = createKoreanDailyStatusReport({
        requestedDate: "20260921",
        krx: {
          status: krxStatus,
          duplicate: krxDuplicate,
          snapshotId: "krx-snapshot",
        },
        kiwoom: {
          status: kiwoomStatus,
          duplicate: kiwoomDuplicate,
          snapshotId: "kiwoom-snapshot",
        },
      });

      expect(report).toMatchObject({
        market: "KR",
        basDd: "2026-09-21",
        status,
        runId: "krx-snapshot",
        source: "KRX etf_bydd_trd, Kiwoom ka10099",
      });
      expect(report.sections).toEqual([
        {
          title: "일일 수집 상태",
          lines: [
            `KRX: ${krxStatus}${krxDuplicate ? " (중복 관측)" : ""}`,
            `Kiwoom: ${kiwoomStatus}${kiwoomDuplicate ? " (중복 관측)" : ""}`,
          ],
        },
      ]);
    },
  );
});
