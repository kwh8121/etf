import { describe, expect, it } from "vitest";

import { readAllRows } from "@/lib/supabase/read-all-rows";

interface Row {
  code: string;
  seq: number;
}

interface PageResponse {
  data: Row[] | null;
  error: { message: string } | null;
  count: number | null;
}

class FakeReadQuery {
  readonly orders: string[] = [];
  rangeStart = 0;
  rangeEnd = 999;

  constructor(private readonly response: () => PageResponse) {}

  order(column: string, options: { ascending?: boolean } = {}): this {
    this.orders.push(`${column}:${options.ascending ?? true}`);
    return this;
  }

  range(start: number, end: number): this {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }

  then<TResult1 = PageResponse, TResult2 = never>(
    onfulfilled?:
      | ((value: PageResponse) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.response()).then(onfulfilled, onrejected);
  }
}

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    code: `ETF${String(index + 1).padStart(4, "0")}`,
    seq: index + 1,
  }));
}

describe("readAllRows", () => {
  it("reads rows past Supabase's default 1000-row window with inclusive ranges and fresh queries", async () => {
    const sourceRows = rows(1001);
    const ranges: Array<[number, number]> = [];
    const orders: string[][] = [];
    let queryCount = 0;

    const result = await readAllRows<Row, FakeReadQuery>({
      operation: "read ETF rows",
      orderBy: [{ column: "code", ascending: true }],
      getKey: (row) => row.code,
      createQuery: () => {
        queryCount += 1;
        const queryRef: { current?: FakeReadQuery } = {};
        const query = new FakeReadQuery(() => {
          const activeQuery = queryRef.current;
          if (!activeQuery) throw new Error("Missing active query");
          return {
            data: sourceRows.slice(
              activeQuery.rangeStart,
              activeQuery.rangeEnd + 1,
            ),
            error: null,
            count: sourceRows.length,
          };
        });
        queryRef.current = query;
        return query;
      },
      onPage: (query) => {
        ranges.push([query.rangeStart, query.rangeEnd]);
        orders.push([...query.orders]);
      },
    });

    expect(result).toHaveLength(1001);
    expect(result.at(1000)).toEqual({ code: "ETF1001", seq: 1001 });
    expect(queryCount).toBe(2);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(orders).toEqual([["code:true"], ["code:true"]]);
  });

  it("handles exact page boundaries and empty results", async () => {
    const exactRows = rows(1000);

    await expect(
      readAllRows<Row>({
        operation: "read exact page",
        orderBy: [{ column: "code" }],
        getKey: (row) => row.code,
        createQuery: () =>
          new FakeReadQuery(() => ({
            data: exactRows,
            error: null,
            count: exactRows.length,
          })),
      }),
    ).resolves.toHaveLength(1000);

    await expect(
      readAllRows<Row>({
        operation: "read empty page",
        orderBy: [{ column: "code" }],
        getKey: (row) => row.code,
        createQuery: () =>
          new FakeReadQuery(() => ({ data: [], error: null, count: 0 })),
      }),
    ).resolves.toEqual([]);
  });

  it("fails closed on Supabase errors, missing exact counts, duplicate keys, count drift, and truncation", async () => {
    await expect(
      readAllRows<Row>({
        operation: "read errored page",
        orderBy: [{ column: "code" }],
        getKey: (row) => row.code,
        createQuery: () =>
          new FakeReadQuery(() => ({
            data: null,
            error: { message: "boom" },
            count: 1,
          })),
      }),
    ).rejects.toThrow("Supabase read errored page failed: boom");

    await expect(
      readAllRows<Row>({
        operation: "read missing count",
        orderBy: [{ column: "code" }],
        getKey: (row) => row.code,
        createQuery: () =>
          new FakeReadQuery(() => ({ data: [], error: null, count: null })),
      }),
    ).rejects.toThrow("Supabase read missing count returned no exact count");

    await expect(
      readAllRows<Row>({
        operation: "read duplicate keys",
        orderBy: [{ column: "code" }],
        getKey: (row) => row.code,
        createQuery: () =>
          new FakeReadQuery(() => ({
            data: [
              { code: "ETF0001", seq: 1 },
              { code: "ETF0001", seq: 2 },
            ],
            error: null,
            count: 2,
          })),
      }),
    ).rejects.toThrow("Supabase read duplicate keys returned duplicate key ETF0001");

    let page = 0;
    await expect(
      readAllRows<Row>({
        operation: "read drifting count",
        orderBy: [{ column: "code" }],
        getKey: (row) => row.code,
        createQuery: () =>
          new FakeReadQuery(() => {
            page += 1;
            return {
              data: rows(page === 1 ? 1000 : 1),
              error: null,
              count: page === 1 ? 1001 : 1002,
            };
          }),
      }),
    ).rejects.toThrow("Supabase read drifting count changed exact count");

    await expect(
      readAllRows<Row>({
        operation: "read truncated rows",
        orderBy: [{ column: "code" }],
        getKey: (row) => row.code,
        createQuery: () =>
          new FakeReadQuery(() => ({
            data: [],
            error: null,
            count: 1,
          })),
      }),
    ).rejects.toThrow("Supabase read truncated rows stopped before fetching all rows");
  });
});
