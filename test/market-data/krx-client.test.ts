import { describe, expect, it, vi } from "vitest";

import { KrxClient, KrxClientError } from "@/lib/market-data/krx-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

describe("KRX client", () => {
  it("rejects an invalid date before creating a request", async () => {
    const fetchFn = vi.fn();
    const client = new KrxClient({ authKey: "test-key", fetchFn });

    await expect(client.fetchDailySnapshot("20260230")).rejects.toThrow(
      "Invalid KRX request date",
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("requests the documented endpoint with AUTH_KEY and no redirect", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ OutBlock_1: [] }));
    const client = new KrxClient({ authKey: " test-key ", fetchFn });

    await expect(client.fetchDailySnapshot("20260916")).resolves.toEqual([]);

    expect(fetchFn).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd?basDd=20260916",
      }),
      { headers: { AUTH_KEY: "test-key" }, redirect: "error" },
    );
  });

  it("rejects non-JSON, HTTP failures, and malformed payloads", async () => {
    const client = new KrxClient({
      authKey: "test-key",
      fetchFn: vi
        .fn()
        .mockResolvedValueOnce(new Response("no", { status: 500 }))
        .mockResolvedValueOnce(new Response("text", { status: 200 }))
        .mockResolvedValueOnce(jsonResponse({ OutBlock_1: {} })),
    });

    await expect(client.fetchDailySnapshot("20260916")).rejects.toThrow(
      KrxClientError,
    );
    await expect(client.fetchDailySnapshot("20260916")).rejects.toThrow(
      "KRX response is not JSON",
    );
    await expect(client.fetchDailySnapshot("20260916")).rejects.toThrow(
      "KRX response does not contain OutBlock_1 array",
    );
  });
});
