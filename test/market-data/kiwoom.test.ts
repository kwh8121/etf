import { describe, expect, it, vi } from "vitest";

import {
  KiwoomClient,
  KiwoomClientError,
  getNewListingCandidates,
} from "@/lib/market-data/kiwoom";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

const etfRow = {
  code: "123456",
  name: "테스트 ETF",
  regDay: "20260915",
  marketCode: "8",
  marketName: "ETF",
  state: "",
};

describe("Kiwoom client", () => {
  it("issues an OAuth token without exposing credentials", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        return_code: 0,
        token_type: "bearer",
        token: "issued-token",
        expires_dt: "20260921120000",
      }),
    );
    const client = new KiwoomClient({
      appKey: " app-key ",
      secretKey: " secret-key ",
      fetchFn,
    });

    await expect(client.issueAccessToken()).resolves.toEqual({
      token: "issued-token",
      tokenType: "bearer",
      expiresAt: "20260921120000",
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.kiwoom.com/oauth2/token",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json;charset=UTF-8" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          appkey: "app-key",
          secretkey: "secret-key",
        }),
        redirect: "error",
      }),
    );
  });

  it("requests the ETF master with a bearer token and validates records", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(
        { return_code: 0, return_msg: "정상", list: [etfRow] },
        200,
        { "cont-yn": "N" },
      ),
    );
    const client = new KiwoomClient({
      appKey: "app-key",
      secretKey: "secret-key",
      fetchFn,
    });

    await expect(client.fetchEtfMaster("issued-token")).resolves.toEqual({
      records: [
        {
          code: "123456",
          name: "테스트 ETF",
          regDay: "20260915",
          marketCode: "8",
          marketName: "ETF",
          state: "",
        },
      ],
      hasMore: false,
      nextKey: null,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.kiwoom.com/api/dostk/stkinfo",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer issued-token",
          "api-id": "ka10099",
          "cont-yn": "N",
          "next-key": "",
          "content-type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify({ mrkt_tp: "8" }),
        redirect: "error",
      }),
    );
  });

  it("rejects unsuccessful, malformed, and incomplete master responses", async () => {
    const client = new KiwoomClient({
      appKey: "app-key",
      secretKey: "secret-key",
      fetchFn: vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ return_code: 1 }, 200))
        .mockResolvedValueOnce(jsonResponse({ return_code: 0, list: [{ ...etfRow, regDay: "20260230" }] }))
        .mockResolvedValueOnce(jsonResponse({ return_code: 0, list: [etfRow] }, 200, { "cont-yn": "Y" })),
    });

    await expect(client.fetchEtfMaster("issued-token")).rejects.toThrow(
      KiwoomClientError,
    );
    await expect(client.fetchEtfMaster("issued-token")).rejects.toThrow(
      "Invalid Kiwoom regDay",
    );
    await expect(client.fetchEtfMaster("issued-token")).rejects.toThrow(
      "Kiwoom continuation response is missing next-key",
    );
  });
});

describe("Kiwoom master initial snapshot contract", () => {
  it("does not classify every existing ETF as newly listed on the initial snapshot", () => {
    expect(getNewListingCandidates(null, [etfRow])).toEqual([]);
    expect(getNewListingCandidates(new Set(["123456"]), [etfRow])).toEqual([]);
    expect(getNewListingCandidates(new Set<string>(), [etfRow])).toEqual([etfRow]);
  });
});
