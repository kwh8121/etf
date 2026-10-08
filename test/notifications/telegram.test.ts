import { describe, expect, it, vi } from "vitest";

import {
  formatExperimentalTelegramReport,
  formatTelegramReport,
  sendTelegramMessages,
} from "../../lib/notifications/telegram";

describe("Telegram reports", () => {
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

    expect(formatTelegramReport(base)).toEqual(formatTelegramReport({ ...base, webUrl: undefined }));
    expect(formatTelegramReport(base)[0]).not.toContain("상세:");
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
