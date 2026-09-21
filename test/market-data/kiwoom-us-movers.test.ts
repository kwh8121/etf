import { describe, expect, it, vi } from "vitest";

import { KiwoomUsEtfMoverClient } from "@/lib/market-data/kiwoom-us-movers";

function jsonResponse(body: unknown, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("Kiwoom US ETF mover client", () => {
  it("uses the four fixed API contracts and follows a universe cursor", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { return_code: 0, list: [{ stk_cd: "ETF1", etn: "N" }] },
          { "cont-yn": "Y", "next-key": "next-universe" },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ return_code: 0, list: [{ stk_cd: "ETN1", etn: "Y" }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ return_code: 0, result_list: [dailyRow("+2.5")] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ return_code: 0, result_list: [dailyRow("-2.5")] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          return_code: 0,
          result_list: [fiveDayRow("-10", "+12")],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          return_code: 0,
          result_list: [fiveDayLossRow("ETF1", "+12", "-10")],
        }),
      );
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const client = new KiwoomUsEtfMoverClient({
      fetchFn,
      sleepFn,
      minIntervalMs: 1,
    });

    const result = await client.fetchAll("issued-token");

    expect(result.universe).toEqual([
      { code: "ETF1", etn: false },
      { code: "ETN1", etn: true },
    ]);
    expect(result.dailyGainers[0]).toMatchObject({
      code: "ETF1",
      returnPercent: 2.5,
    });
    expect(result.fiveDayLosers[0]).toMatchObject({
      startPrice: "+12",
      endPrice: "-10",
    });
    expect(fetchFn).toHaveBeenCalledTimes(6);

    const requests = fetchFn.mock.calls.map(([, options]) => {
      const request = options as RequestInit;
      return {
        headers: request.headers as Record<string, string>,
        body: JSON.parse(String(request.body)),
      };
    });
    expect(requests[0]).toMatchObject({
      headers: expect.objectContaining({
        authorization: "Bearer issued-token",
        "api-id": "usa10104",
        "cont-yn": "N",
      }),
      body: { stex_tp: "%" },
    });
    expect(requests[1].headers).toMatchObject({
      "cont-yn": "Y",
      "next-key": "next-universe",
    });
    expect(requests[2]).toMatchObject({
      headers: expect.objectContaining({ "api-id": "usa20911" }),
      body: expect.objectContaining({ sort_tp: "1", trde_qty_tp: "" }),
    });
    expect(requests[3].body).toMatchObject({ sort_tp: "4" });
    expect(requests[4]).toMatchObject({
      headers: expect.objectContaining({ "api-id": "usa20511" }),
      body: expect.objectContaining({ tm: "5" }),
    });
    expect(requests[5]).toMatchObject({
      headers: expect.objectContaining({ "api-id": "usa20931" }),
      body: expect.objectContaining({ flu_tp: "2", tm_tp: "3", tm: "2" }),
    });
    expect(sleepFn).toHaveBeenCalledWith(1);
  });

  it("fails closed on malformed ranking rows and retryable 429 responses", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ return_code: 0, list: [] }))
      .mockResolvedValueOnce(jsonResponse({ return_code: 0, result_list: [] }))
      .mockResolvedValueOnce(jsonResponse({ return_code: 0, result_list: [] }))
      .mockResolvedValueOnce(jsonResponse({ return_code: 0, result_list: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ return_code: 0, result_list: [{ rank: "x" }] }),
      );
    const client = new KiwoomUsEtfMoverClient({
      fetchFn,
      sleepFn: vi.fn().mockResolvedValue(undefined),
      minIntervalMs: 0,
    });

    await expect(client.fetchAll("issued-token")).rejects.toThrow(
      "usa20931 result_list contains a malformed record",
    );
  });

  it("ranks usa20931 rows by response order across pages because the API returns no rank", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ return_code: 0, list: [] }))
      .mockResolvedValueOnce(jsonResponse({ return_code: 0, result_list: [] }))
      .mockResolvedValueOnce(jsonResponse({ return_code: 0, result_list: [] }))
      .mockResolvedValueOnce(jsonResponse({ return_code: 0, result_list: [] }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            return_code: 0,
            result_list: [
              fiveDayLossRow("LOSS1", "20", "10"),
              fiveDayLossRow("LOSS2", "20", "12"),
            ],
          },
          { "cont-yn": "Y", "next-key": "next-loss" },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          return_code: 0,
          result_list: [fiveDayLossRow("LOSS3", "20", "15")],
        }),
      );
    const client = new KiwoomUsEtfMoverClient({
      fetchFn,
      sleepFn: vi.fn().mockResolvedValue(undefined),
      minIntervalMs: 0,
    });

    const result = await client.fetchAll("issued-token");

    expect(
      result.fiveDayLosers.map(({ code, rank }) => ({ code, rank })),
    ).toEqual([
      { code: "LOSS1", rank: 1 },
      { code: "LOSS2", rank: 2 },
      { code: "LOSS3", rank: 3 },
    ]);
  });
});

function dailyRow(fluRt: string) {
  return {
    rank: "1",
    stk_cd: "ETF1",
    stk_nm: "ETF one",
    flu_rt: fluRt,
    cur_prc: "+10",
  };
}

function fiveDayRow(startPrice: string, endPrice: string) {
  return {
    rank: "1",
    stk_cd: "ETF1",
    stk_nm: "ETF one",
    stdt_base_pric: startPrice,
    endt_base_pric: endPrice,
    base_pric: startPrice,
    cur_prc: endPrice,
  };
}

// usa20931 실제 응답에는 rank 필드가 없다 (docs/references/kiwoom-rest-api-spec.json).
function fiveDayLossRow(code: string, basePrice: string, currentPrice: string) {
  return {
    stk_cd: code,
    stk_nm: `${code} name`,
    base_pric: basePrice,
    cur_prc: currentPrice,
  };
}
