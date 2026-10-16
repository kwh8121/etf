import { describe, expect, it } from "vitest";

import {
  compareReportedRanks,
  formatReportedRankChangeLines,
} from "../../lib/signals/report-rank-changes";

describe("reported rank changes", () => {
  it("uses the supplied name formatter for rank-outs as well as current rows", () => {
    const lines = formatReportedRankChangeLines(
      [{ code: "CURRENT", name: "현재", rank: 1 }],
      [{ code: "OUT", name: "이탈", rank: 2 }],
      (row) => `${row.rank}. <a href="/${row.code}">${row.name}</a>`,
      (row) => `${row.rank}. <a href="/${row.code}">${row.name}</a>`,
    );
    expect(lines).toEqual([
      '1. <a href="/CURRENT">현재</a> · 랭크인', "랭크아웃", '2. <a href="/OUT">이탈</a>',
    ]);
  });
  it("marks only codes newly visible in the current section as rank-ins", () => {
    const result = compareReportedRanks(
      [
        { code: "CURRENT", name: "현재", rank: 1 },
        { code: "STAY", name: "유지", rank: 2 },
      ],
      [
        { code: "STAY", name: "이전 이름", rank: 1 },
        { code: "OUT", name: "이탈", rank: 2 },
      ],
    );

    expect(result.rankInCodes).toEqual(new Set(["CURRENT"]));
    expect(result.rankOut).toEqual([{ code: "OUT", name: "이탈", rank: 2 }]);
  });

  it("adds rank-in labels and appends rank-outs after the current rankings", () => {
    const lines = formatReportedRankChangeLines(
      [
        { code: "CURRENT", name: "현재", rank: 1 },
        { code: "STAY", name: "유지", rank: 2 },
      ],
      [
        { code: "STAY", name: "이전 이름", rank: 1 },
        { code: "OUT", name: "이탈", rank: 2 },
      ],
      (row) => `${row.rank}. ${row.name}`,
    );

    expect(lines).toEqual([
      "1. 현재 · 랭크인",
      "2. 유지",
      "랭크아웃",
      "2. 이탈",
    ]);
  });

  it("omits rank changes when there is no previous completed report", () => {
    const result = compareReportedRanks(
      [{ code: "CURRENT", name: "현재", rank: 1 }],
      null,
    );

    expect(result.rankInCodes).toEqual(new Set());
    expect(result.rankOut).toEqual([]);
  });
});
