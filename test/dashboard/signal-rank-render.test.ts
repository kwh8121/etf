import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DirectionList,
  KrSignalBoard,
  SignalRankList,
} from "../../components/kr-signal-board";
import { UsSignalBoard } from "../../components/us-signal-board";
import {
  selectVariableSections,
  type DashboardSignalRow,
} from "../../lib/dashboard/kr-signal-view";

function row(
  code: string,
  name: string,
  rank = 1,
  signalType = "daily_price_gain",
): DashboardSignalRow {
  return {
    code,
    name,
    rank,
    signalType,
    screen: "raw",
    value: 1,
    valueUnit: "percent",
  };
}

describe("웹 랭크 변동 표시", () => {
  it("ETF 수익률과 함께 추적지수 대비 차이를 표시한다", () => {
    const html = renderToStaticMarkup(
      createElement(SignalRankList, {
        rows: [
          {
            ...row("ETF", "ETF 이름"),
            relativeStrength: {
              benchmarkName: "KOSPI 200",
              benchmarkReturn: 2,
              excessReturn: 1.25,
            },
          },
        ],
      }),
    );

    expect(html).toContain("KOSPI 200 대비 +1.25%p");
  });

  it("비교값이 없을 때도 ETF 신호와 함께 비교 불가를 표시한다", () => {
    const html = renderToStaticMarkup(
      createElement(SignalRankList, {
        rows: [{ ...row("ETF", "ETF 이름"), relativeStrength: null }],
      }),
    );

    expect(html).toContain("지수 비교 불가");
    expect(html).toContain("ETF 이름");
  });

  it("이름이 바뀌어도 종목 코드가 같으면 유지하고 새 진입과 이탈만 표시한다", () => {
    const html = renderToStaticMarkup(
      createElement(DirectionList, {
        direction: "gain",
        rows: [row("NEW", "신규"), row("STAY", "변경된 이름", 2)],
        previousRows: [row("STAY", "이전 이름"), row("OUT", "이탈 종목", 3)],
      }),
    );
    expect(html.match(/랭크인/g)).toHaveLength(1);
    expect(html).toContain("랭크아웃");
    expect(html).toMatch(/3[\s\S]*이탈 종목/);
    expect(html).not.toContain("이전 이름");
  });

  it("첫 관측에는 랭크 변동을 표시하지 않는다", () => {
    const html = renderToStaticMarkup(
      createElement(DirectionList, {
        direction: "gain",
        rows: [row("NEW", "신규")],
        previousRows: null,
      }),
    );
    expect(html).not.toContain("랭크인");
    expect(html).not.toContain("랭크아웃");
  });

  it.each(["KR", "US"])(
    "%s 보드에서 현재 0건이어도 직전 종목의 랭크아웃을 보인다",
    (market) => {
      const props = {
        rows: [],
        previousRows: [row("OUT", "전부 이탈")],
        totals: {},
        errors: [],
      };
      const html =
        market === "KR"
          ? renderToStaticMarkup(createElement(KrSignalBoard, props))
          : renderToStaticMarkup(createElement(UsSignalBoard, props));
      expect(html).toContain("랭크아웃");
      expect(html).toContain("전부 이탈");
    },
  );

  it("다른 스크린과 기간의 종목은 현재 섹션 비교에 섞지 않는다", () => {
    const html = renderToStaticMarkup(
      createElement(KrSignalBoard, {
        rows: [row("NEW", "신규")],
        previousRows: [
          { ...row("NEW", "유동성 전용"), screen: "liquid" },
          row("FIVE", "5일 전용", 1, "five_day_price_gain"),
        ],
      }),
    );
    expect(html).toContain("랭크인");
    expect(html).not.toContain("유동성 전용");
    expect(html).not.toContain("5일 전용");
  });

  it("현재 가변 신호가 사라져도 랭크아웃 섹션을 유지한다", () => {
    const previous = row("OUT", "급증 종료", 1, "turnover_surge");
    const sections = selectVariableSections([], [previous]);
    expect(sections).toEqual([
      { title: "거래대금 급증", rows: [], previousRows: [previous] },
    ]);
  });
});
