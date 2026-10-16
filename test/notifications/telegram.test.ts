import { describe, expect, it, vi } from "vitest";

import {
  formatExperimentalTelegramReport,
  formatTelegramReport,
  sendTelegramMessages,
} from "../../lib/notifications/telegram";

describe("Telegram reports", () => {
  it("escapes report metadata in opt-in HTML mode and preserves complete row links across chunks", () => {
    const anchor = '<a href="https://m.stock.naver.com/domestic/stock/069500/total">S&amp;P ETF</a>';
    const messages = formatTelegramReport({
      market: "KR", basDd: "2026-10-16", status: "COMPLETED",
      source: "KRX & Kiwoom", runId: "run<test>", html: true,
      webUrl: "https://example.com/?a=1&b=2",
      sections: [{ title: "상승 <전체>", lines: Array.from({ length: 70 }, (_, i) => `${i + 1}. ${anchor} +1.00%`) }],
    });
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((message) => message.length <= 4096)).toBe(true);
    expect(messages.every((message) => message.includes("KRX &amp; Kiwoom") && message.includes("run&lt;test&gt;"))).toBe(true);
    expect(messages.join("\n")).toContain("상승 &lt;전체&gt;");
    expect(messages[0]).toContain("?a=1&amp;b=2");
    expect(messages.join("\n").match(/<a href=/g)).toHaveLength(70);
    for (const message of messages) {
      expect(message.match(/<a href=/g)?.length ?? 0).toBe(message.match(/<\/a>/g)?.length ?? 0);
    }
  });

  it("escapes US metadata when HTML links are enabled", () => {
    const messages = formatExperimentalTelegramReport({
      title: "US <ETF>", observedAt: "today", runId: "run&1",
      disclosure: "A & B", html: true,
      sections: [{ title: "상승 <10>", lines: ['1. <a href="https://finance.yahoo.com/quote/VOO/">S&amp;P</a>'] }],
    });
    expect(messages[0]).toContain("US &lt;ETF&gt;");
    expect(messages[0]).toContain("run&amp;1");
    expect(messages[0]).toContain("A &amp; B");
    expect(messages[0]).toContain("상승 &lt;10&gt;");
    expect(messages[0]).toContain('<a href="https://finance.yahoo.com/quote/VOO/">S&amp;P</a>');
  });

  it("rejects an oversized HTML row before sending rather than breaking its anchor", () => {
    expect(() => formatExperimentalTelegramReport({
      title: "US", observedAt: "today", runId: "run", disclosure: "info", html: true,
      sections: [{ title: "ETF", lines: [`<a href="https://example.com/">${"X".repeat(4100)}</a>`] }],
    })).toThrow("Telegram message");
  });

  it("opts into HTML only for linked reports and disables link previews", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await sendTelegramMessages({ token: "test-token", chatId: "test-chat", messages: ["S&P <status>"], fetchFn });
    await sendTelegramMessages({ token: "test-token", chatId: "test-chat", messages: ['<a href="https://example.com/">ETF</a>'], parseMode: "HTML", fetchFn });
    const bodies = fetchFn.mock.calls.map((call) => JSON.parse(call[1].body));
    expect(bodies[0]).not.toHaveProperty("parse_mode");
    expect(bodies[0].text).toBe("S&P <status>");
    expect(bodies[1]).toMatchObject({ parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  });

  it("fits a typical four-category US top-ten report in one message and still splits long names", () => {
    const sections = ["일간 상승", "일간 하락", "5일 상승", "5일 하락"].map(
      (title) => ({
        title: `${title} (상위 10건 / 전체 600건)`,
        lines: Array.from(
          { length: 10 },
          (_, index) => `${index + 1}. ETF ${index + 1} · 1.23%`,
        ),
      }),
    );
    const report = {
      title: "미국 ETF 등락 (P1 실험)",
      observedAt: "2026-09-22T00:00:00.000Z",
      runId: "us-run",
      sections,
      disclosure: "실험 항목",
    };
    expect(formatExperimentalTelegramReport(report)).toHaveLength(1);

    const longReport = formatExperimentalTelegramReport({
      ...report,
      sections: sections.map((section) => ({
        ...section,
        lines: section.lines.map((line) => `${line} ${"긴종목명".repeat(40)}`),
      })),
    });
    expect(longReport.length).toBeGreaterThan(1);
    expect(longReport.every((message) => message.length <= 4096)).toBe(true);
  });

  it("adds the US detail link to every split message only when a web URL is given", () => {
    const sections = [
      { title: "일간 상승", lines: Array.from({ length: 10 }, (_, i) => `${i + 1}. ETF ${i} · 1.23%`) },
    ];
    const base = { title: "미국 ETF 등락 (P1 실험)", observedAt: "2026-10-12T01:00:00.000Z", runId: "us-run", sections, disclosure: "실험 항목" };
    const without = formatExperimentalTelegramReport(base);
    const withUrl = formatExperimentalTelegramReport({ ...base, webUrl: "https://etf.example.app/signals/us/2026-10-12" });

    expect(without.join("\n")).not.toContain("상세:");
    expect(withUrl).toHaveLength(1);
    expect(withUrl[0].match(/상세: /g)).toHaveLength(1);
    expect(withUrl[0]).toContain("상세: https://etf.example.app/signals/us/2026-10-12");
    // 링크 줄을 빼면 기존 출력과 같다.
    expect(withUrl[0].replace(/\n상세: [^\n]+/, "")).toBe(without[0]);

    const longSections = sections.map((s) => ({ ...s, lines: s.lines.map((l) => `${l} ${"긴종목명".repeat(200)}`) }));
    const split = formatExperimentalTelegramReport({ ...base, sections: longSections, webUrl: "https://etf.example.app/signals/us/2026-10-12" });
    expect(split.length).toBeGreaterThan(1);
    expect(split.every((m) => m.includes("상세: https://etf.example.app/signals/us/2026-10-12") && m.length <= 4096)).toBe(true);
  });

  it("preserves market, date, source, run, and status metadata in every split message", () => {
    const messages = formatTelegramReport(
      {
        market: "KR",
        basDd: "2026-09-18",
        status: "COMPLETED",
        runId: "run-1",
        source: "KRX etf_bydd_trd",
        sections: [
          {
            title: "일간 상승",
            lines: Array.from(
              { length: 20 },
              (_, index) => `ETF ${index} +1.00%`,
            ),
          },
        ],
      },
      150,
    );

    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((message) => message.length <= 150)).toBe(true);
    expect(
      messages.every((message) =>
        message.includes("[ETF 신호][KR][COMPLETED] 2026-09-18"),
      ),
    ).toBe(true);
    expect(
      messages.every((message) => message.includes("원천: KRX etf_bydd_trd")),
    ).toBe(true);
    expect(messages.every((message) => message.includes("실행: run-1"))).toBe(
      true,
    );
    expect(
      messages.every((message) =>
        message.includes("분배금·기업행동 조정 총수익률이 아닙니다."),
      ),
    ).toBe(true);
  });

  it("webUrl이 없으면 기존 헤더와 완전히 같은 출력을 낸다", () => {
    const base = {
      market: "KR" as const,
      basDd: "2026-10-07",
      status: "COMPLETED" as const,
      runId: "run-1",
      source: "KRX etf_bydd_trd",
      sections: [{ title: "일간 상승", lines: ["1. ETF +1.00%"] }],
    };

    const legacyHeader = [
      "[ETF 신호][KR][COMPLETED] 2026-10-07",
      "원천: KRX etf_bydd_trd",
      "실행: run-1",
      "5거래일 값은 KRX 종가 기준 가격수익률이며 분배금·기업행동 조정 총수익률이 아닙니다.",
    ].join("\n");
    const expected = [
      `${legacyHeader}\n\n일간 상승\n1. ETF +1.00%\n\n자동매매 또는 매수·매도 추천이 아닌 탐색 결과입니다.`,
    ];

    expect(formatTelegramReport(base)).toEqual(expected);
    expect(formatTelegramReport({ ...base, webUrl: undefined })).toEqual(expected);
  });

  it("webUrl이 있으면 모든 분할 조각의 헤더에 링크가 한 번씩 들어간다", () => {
    const messages = formatTelegramReport(
      {
        market: "KR",
        basDd: "2026-10-07",
        status: "COMPLETED",
        runId: "run-1",
        source: "KRX etf_bydd_trd",
        webUrl: "https://etf.example.app/signals/kr/2026-10-07",
        sections: [
          {
            title: "일간 상승",
            lines: Array.from({ length: 20 }, (_, index) => `ETF ${index} +1.00%`),
          },
        ],
      },
      300,
    );

    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((message) => message.length <= 300)).toBe(true);
    expect(
      messages.every(
        (message) =>
          message.split("상세: https://etf.example.app/signals/kr/2026-10-07").length === 2,
      ),
    ).toBe(true);
  });

  it("링크가 붙어도 maxLength를 넘는 메시지를 만들지 않는다", () => {
    const messages = formatTelegramReport(
      {
        market: "KR",
        basDd: "2026-10-07",
        status: "COMPLETED",
        runId: "run-1",
        source: "KRX etf_bydd_trd",
        webUrl: `https://etf.example.app/signals/kr/2026-10-07`,
        sections: [
          {
            title: "일간 상승",
            lines: Array.from({ length: 40 }, (_, index) => `${index}. ${"긴종목명".repeat(30)} +1.00%`),
          },
        ],
      },
      4096,
    );

    expect(messages.every((message) => message.length <= 4096)).toBe(true);
  });

  it("posts each generated message through Telegram sendMessage", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    await sendTelegramMessages({
      token: "test-token",
      chatId: "test-chat",
      messages: ["first", "second"],
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenLastCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
