import { describe, expect, it } from "vitest";

import { formatEtfDetailLink } from "../../lib/notifications/etf-detail-link";

describe("ETF detail links", () => {
  it("links a KR code without dropping leading zeros and escapes the name", () => {
    expect(formatEtfDetailLink("KR", "069500", 'KODEX S&P <200> "ETF"')).toBe(
      '<a href="https://m.stock.naver.com/domestic/stock/069500/total">KODEX S&amp;P &lt;200&gt; &quot;ETF&quot;</a>',
    );
  });

  it("preserves six-character KR codes containing letters", () => {
    expect(formatEtfDetailLink("KR", "0001A0", "ETF")).toContain(
      "/domestic/stock/0001A0/total",
    );
  });

  it("uses a direct quote URL for a US ticker", () => {
    expect(formatEtfDetailLink("US", "VOO", "Vanguard S&P 500")).toBe(
      '<a href="https://finance.yahoo.com/quote/VOO/">Vanguard S&amp;P 500</a>',
    );
  });

  it.each(["", "../069500", '069500\" onclick=\"x', "12345", " 069500"])(
    "renders invalid KR code %j as escaped text without a broken link",
    (code) => {
      expect(formatEtfDetailLink("KR", code, "ETF <unknown>")).toBe(
        "ETF &lt;unknown&gt;",
      );
    },
  );

  it("does not invent a US ticker from an exchange-qualified or malformed code", () => {
    expect(formatEtfDetailLink("US", "NASDAQ:VOO", "ETF & unknown")).toBe(
      "ETF &amp; unknown",
    );
  });

  it("keeps each name on one line so message splitting cannot break its anchor", () => {
    expect(formatEtfDetailLink("KR", "069500", "ETF\r\nname")).toBe(
      '<a href="https://m.stock.naver.com/domestic/stock/069500/total">ETF name</a>',
    );
  });
});
