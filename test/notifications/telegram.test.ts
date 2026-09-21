import { describe, expect, it, vi } from "vitest";

import { formatTelegramReport, sendTelegramMessages } from "../../lib/notifications/telegram";

describe("Telegram reports", () => {
  it("preserves market, date, source, run, and status metadata in every split message", () => {
    const messages = formatTelegramReport({
      market: "KR",
      basDd: "2026-09-18",
      status: "COMPLETED",
      runId: "run-1",
      source: "KRX etf_bydd_trd",
      sections: [{ title: "일간 상승", lines: Array.from({ length: 20 }, (_, index) => `ETF ${index} +1.00%`) }],
    }, 150);

    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((message) => message.length <= 150)).toBe(true);
    expect(messages.every((message) => message.includes("[ETF 신호][KR][COMPLETED] 2026-09-18"))).toBe(true);
    expect(messages.every((message) => message.includes("원천: KRX etf_bydd_trd"))).toBe(true);
    expect(messages.every((message) => message.includes("실행: run-1"))).toBe(true);
  });

  it("posts each generated message through Telegram sendMessage", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await sendTelegramMessages({ token: "test-token", chatId: "test-chat", messages: ["first", "second"], fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenLastCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
