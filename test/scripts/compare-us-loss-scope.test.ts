import { readFile, stat } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  compareUsLossScope,
  fiveDayLossBody,
  parseCompareUsLossScopeArgs,
  writePrivateJson,
} from "../../scripts/compare-us-loss-scope.ts";

describe("parseCompareUsLossScopeArgs", () => {
  it("requires output and caps pages per condition at the approved 20", () => {
    expect(() => parseCompareUsLossScopeArgs([])).toThrow(
      "--output is required",
    );
    expect(() =>
      parseCompareUsLossScopeArgs([
        "--output",
        "/tmp/us-loss.json",
        "--pages-per-condition",
        "21",
      ]),
    ).toThrow("integer from 1 to 20");
  });

  it("parses the private output path and optional page cap", () => {
    expect(
      parseCompareUsLossScopeArgs([
        "--output",
        "/tmp/us-loss.json",
        "--pages-per-condition",
        "2",
      ]),
    ).toEqual({ outputPath: "/tmp/us-loss.json", pagesPerCondition: 2 });
  });
});

describe("fiveDayLossBody", () => {
  it("matches the production usa20931 contract except the compared stk_cnd", () => {
    expect(fiveDayLossBody("1")).toMatchObject({
      stk_cnd: "1",
      flu_tp: "2",
      tm_tp: "3",
      tm: "2",
    });
    expect(fiveDayLossBody("0")).toMatchObject({
      stk_cnd: "0",
      flu_tp: "2",
      tm_tp: "3",
      tm: "2",
    });
  });
});

describe("compareUsLossScope", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("interleaves both conditions and reports partial page-cap results without DB writes", async () => {
    const calls: Array<{ stkCnd: string; contYn: string }> = [];
    const result = await compareUsLossScope({
      accessToken: "token",
      pagesPerCondition: 1,
      sleepFn: async () => {},
      now: fixedClock(),
      fetchFn: async (_url, init) => {
        const headers = new Headers(init?.headers);
        const body = JSON.parse(String(init?.body)) as Record<string, string>;
        calls.push({
          stkCnd: body.stk_cnd,
          contYn: headers.get("cont-yn") ?? "",
        });
        return new Response(
          JSON.stringify({
            return_code: 0,
            result_list: [
              {
                stk_cd: `${body.stk_cnd}-AAA`,
                stk_nm: `Name ${body.stk_cnd}`,
                base_pric: "10.00",
                cur_prc: "9.00",
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "cont-yn": "Y",
              "next-key": `next-${body.stk_cnd}`,
            },
          },
        );
      },
    });

    expect(calls).toEqual([
      { stkCnd: "0", contYn: "N" },
      { stkCnd: "1", contYn: "N" },
    ]);
    expect(result.requestCount).toBe(2);
    expect(result.conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stkCnd: "0", stoppedByPageCap: true }),
        expect.objectContaining({ stkCnd: "1", stoppedByPageCap: true }),
      ]),
    );
    expect(result.caveats.join(" ")).toContain("No operational DB writes");
    expect(result.caveats.join(" ")).toContain(
      "do not prove full ETF universe coverage",
    );
  });

  it("enforces the approved 40-call cap with a single global interval across interleaved conditions", async () => {
    let currentTime = 0;
    vi.spyOn(Date, "now").mockImplementation(() => currentTime);

    const calls: Array<{ stkCnd: string; at: number }> = [];
    const sleeps: number[] = [];
    const result = await compareUsLossScope({
      accessToken: "token",
      pagesPerCondition: 20,
      sleepFn: async (milliseconds) => {
        sleeps.push(milliseconds);
        currentTime += milliseconds;
      },
      now: fixedClock(),
      fetchFn: async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, string>;
        calls.push({ stkCnd: body.stk_cnd, at: currentTime });
        return new Response(
          JSON.stringify({
            return_code: 0,
            result_list: [
              {
                stk_cd: `${body.stk_cnd}-${calls.length}`,
                stk_nm: `Name ${body.stk_cnd}`,
                base_pric: "10.00",
                cur_prc: "9.00",
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "cont-yn": "Y",
              "next-key": `next-${calls.length}`,
            },
          },
        );
      },
    });

    expect(calls).toHaveLength(40);
    expect(calls.map((call) => call.stkCnd).slice(0, 6)).toEqual([
      "0",
      "1",
      "0",
      "1",
      "0",
      "1",
    ]);
    expect(sleeps).toHaveLength(39);
    expect(sleeps.every((milliseconds) => milliseconds >= 1_250)).toBe(true);
    expect(
      calls
        .slice(1)
        .every((call, index) => call.at - calls[index].at >= 1_250),
    ).toBe(true);
    expect(result.requestCount).toBe(40);
    expect(result.conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stkCnd: "0",
          requestCount: 20,
          complete: false,
          stoppedByPageCap: true,
        }),
        expect.objectContaining({
          stkCnd: "1",
          requestCount: 20,
          complete: false,
          stoppedByPageCap: true,
        }),
      ]),
    );
  });

  it("fails malformed continuation before producing a misleading comparison", async () => {
    await expect(
      compareUsLossScope({
        accessToken: "token",
        pagesPerCondition: 1,
        sleepFn: async () => {},
        now: fixedClock(),
        fetchFn: async () =>
          new Response(JSON.stringify({ return_code: 0, result_list: [] }), {
            status: 200,
            headers: {
              "content-type": "application/json",
              "cont-yn": "Y",
            },
          }),
      }),
    ).rejects.toThrow("continuation is missing next-key");
  });

  it("compares full observed code sets separately from the top-20 ranks", async () => {
    const result = await compareUsLossScope({
      accessToken: "token",
      pagesPerCondition: 2,
      sleepFn: async () => {},
      now: fixedClock(),
      fetchFn: async (_url, init) => {
        const headers = new Headers(init?.headers);
        const body = JSON.parse(String(init?.body)) as Record<string, string>;
        const page = headers.get("cont-yn") === "Y" ? 2 : 1;
        const codePrefix = body.stk_cnd === "0" ? "A" : "B";
        return okPage(
          page === 1
            ? Array.from({ length: 20 }, (_, index) => ({
                stk_cd: `SHARED-${index + 1}`,
                stk_nm: "Shared",
                base_pric: "10.00",
                cur_prc: "9.00",
              }))
            : [
                {
                  stk_cd: `${codePrefix}-PAGE-2-ONLY`,
                  stk_nm: "Name",
                  base_pric: "10.00",
                  cur_prc: "9.00",
                },
              ],
          page === 1 ? { contYn: "Y", nextKey: `next-${body.stk_cnd}` } : {},
        );
      },
    });

    expect(result.comparison).toMatchObject({
      topRankDifferenceCount: 0,
      observedCodeDifferenceCount: 2,
      onlyInStkCnd0ObservedCodes: ["A-PAGE-2-ONLY"],
      onlyInStkCnd1ObservedCodes: ["B-PAGE-2-ONLY"],
    });
  });

  it("rejects reused continuation tokens immediately on the next hit", async () => {
    const calls: string[] = [];

    await expect(
      compareUsLossScope({
        accessToken: "token",
        pagesPerCondition: 20,
        sleepFn: async () => {},
        now: fixedClock(),
        fetchFn: async (_url, init) => {
          const headers = new Headers(init?.headers);
          const body = JSON.parse(String(init?.body)) as Record<string, string>;
          calls.push(`${body.stk_cnd}:${headers.get("next-key") ?? ""}`);
          return okPage(
            [
              {
                stk_cd: `${body.stk_cnd}-${calls.length}`,
                stk_nm: "Name",
                base_pric: "10.00",
                cur_prc: "9.00",
              },
            ],
            { contYn: "Y", nextKey: "same-next-key" },
          );
        },
      }),
    ).rejects.toThrow("reused continuation next-key");

    expect(calls).toEqual(["0:", "1:", "0:same-next-key"]);
  });

  it("stops immediately without retrying when Kiwoom returns an error page", async () => {
    const calls: string[] = [];

    await expect(
      compareUsLossScope({
        accessToken: "token",
        pagesPerCondition: 20,
        sleepFn: async () => {
          throw new Error("sleep should not be reached");
        },
        now: fixedClock(),
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as Record<string, string>;
          calls.push(body.stk_cnd);
          return new Response(JSON.stringify({ return_code: -1 }), {
            status: 429,
            headers: { "content-type": "application/json" },
          });
        },
      }),
    ).rejects.toThrow("failed with HTTP 429");

    expect(calls).toEqual(["0"]);
  });

  it("rejects duplicate codes immediately and stops before the other condition", async () => {
    const calls: string[] = [];

    await expect(
      compareUsLossScope({
        accessToken: "secret-token",
        pagesPerCondition: 20,
        sleepFn: async () => {},
        now: fixedClock(),
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as Record<string, string>;
          calls.push(body.stk_cnd);
          return okPage([
            {
              stk_cd: "DUP",
              stk_nm: "Duplicate",
              base_pric: "10.00",
              cur_prc: "9.00",
            },
            {
              stk_cd: "DUP",
              stk_nm: "Duplicate",
              base_pric: "10.00",
              cur_prc: "9.00",
            },
          ]);
        },
      }),
    ).rejects.toThrow("duplicate code DUP");

    expect(calls).toEqual(["0"]);
  });

  it("rejects nonnumeric prices and makes no further calls", async () => {
    const calls: string[] = [];

    await expect(
      compareUsLossScope({
        accessToken: "token",
        pagesPerCondition: 20,
        sleepFn: async () => {},
        now: fixedClock(),
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as Record<string, string>;
          calls.push(body.stk_cnd);
          return okPage([
            {
              stk_cd: "BAD",
              stk_nm: "Bad price",
              base_pric: "not-a-number",
              cur_prc: "9.00",
            },
          ]);
        },
      }),
    ).rejects.toThrow("invalid base_pric");

    expect(calls).toEqual(["0"]);
  });

  it("does not include access tokens or raw result lists in successful output", async () => {
    const result = await compareUsLossScope({
      accessToken: "secret-token",
      pagesPerCondition: 1,
      sleepFn: async () => {},
      now: fixedClock(),
      fetchFn: async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, string>;
        return okPage([
          {
            stk_cd: `${body.stk_cnd}-AAA`,
            stk_nm: "Name",
            base_pric: "10.00",
            cur_prc: "9.00",
          },
        ]);
      },
    });

    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(JSON.stringify(result)).not.toContain("result_list");
  });
});

describe("writePrivateJson", () => {
  it("writes JSON with owner-only permissions", async () => {
    const path = `/tmp/q28-private-${process.pid}.json`;

    await writePrivateJson(path, { ok: true });

    await expect(readFile(path, "utf8")).resolves.toBe('{\n  "ok": true\n}\n');
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});

function fixedClock() {
  let index = 0;
  const values = [
    new Date("2026-10-15T00:00:00.000Z"),
    new Date("2026-10-15T00:00:01.000Z"),
    new Date("2026-10-15T00:00:02.000Z"),
    new Date("2026-10-15T00:00:03.000Z"),
    new Date("2026-10-15T00:00:04.000Z"),
  ];
  return () => values[Math.min(index++, values.length - 1)];
}

function okPage(
  resultList: RawRecord[],
  options: { contYn?: "N" | "Y"; nextKey?: string } = {},
) {
  return new Response(
    JSON.stringify({ return_code: 0, result_list: resultList }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cont-yn": options.contYn ?? "N",
        ...(options.nextKey ? { "next-key": options.nextKey } : {}),
      },
    },
  );
}

type RawRecord = Record<string, unknown>;
