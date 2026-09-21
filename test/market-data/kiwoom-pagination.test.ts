import { describe, expect, it, vi } from "vitest";

import { KiwoomPaginationClient } from "@/lib/market-data/kiwoom-pagination";

function jsonResponse(
  body: unknown,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

describe("Kiwoom ka40004 pagination", () => {
  it("retries HTTP 429 with the same cursor and ends on cont-yn=N", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { return_code: 0, etfall_mrpr: [{ stk_cd: "111111" }] },
          { "cont-yn": "Y", "next-key": "cursor-1" },
        ),
      )
      .mockResolvedValueOnce(new Response("busy", { status: 429, headers: { "retry-after": "1" } }))
      .mockResolvedValueOnce(
        jsonResponse(
          { return_code: 0, etfall_mrpr: [{ stk_cd: "222222" }] },
          { "cont-yn": "N" },
        ),
      );
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const client = new KiwoomPaginationClient({ fetchFn, sleepFn });

    await expect(client.fetchAllEtfQuotes("issued-token")).resolves.toEqual({
      pages: [
        [{ stk_cd: "111111" }],
        [{ stk_cd: "222222" }],
      ],
      pageCount: 2,
    });

    expect(fetchFn.mock.calls.map(([, options]) => (options as RequestInit).headers)).toEqual([
      expect.objectContaining({ "cont-yn": "N", "next-key": "" }),
      expect.objectContaining({ "cont-yn": "Y", "next-key": "cursor-1" }),
      expect.objectContaining({ "cont-yn": "Y", "next-key": "cursor-1" }),
    ]);
    expect(sleepFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenNthCalledWith(1, 1250);
    expect(sleepFn).toHaveBeenNthCalledWith(2, 1250);
  });

  it("fails closed when a continuation response has no cursor", async () => {
    const client = new KiwoomPaginationClient({
      fetchFn: vi.fn().mockResolvedValue(
        jsonResponse({ return_code: 0, etfall_mrpr: [] }, { "cont-yn": "Y" }),
      ),
      sleepFn: vi.fn(),
    });

    await expect(client.fetchAllEtfQuotes("issued-token")).rejects.toThrow(
      "Kiwoom ka40004 continuation response is missing next-key",
    );
  });
});
