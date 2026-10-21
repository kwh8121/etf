import { describe, expect, it, vi } from "vitest";

import { readKrRelativeStrengthMarketRows } from "../../lib/signals/kr-relative-strength-store";

const basDd = "2026-10-21";
const calendar = [
  { bas_dd: "2026-10-14", seq: 1, status: "TRADING_COMPLETE" },
  { bas_dd: "2026-10-15", seq: 2, status: "TRADING_COMPLETE" },
  { bas_dd: "2026-10-16", seq: 3, status: "TRADING_COMPLETE" },
  { bas_dd: "2026-10-19", seq: 4, status: "TRADING_COMPLETE" },
  { bas_dd: "2026-10-20", seq: 5, status: "TRADING_COMPLETE" },
  { bas_dd: basDd, seq: 6, status: "TRADING_COMPLETE" },
];

const marketRows = [
  {
    bas_dd: "2026-10-14",
    isu_cd: "069500",
    idx_nm: "KOSPI 200",
    idx_close: "400",
    idx_fluc_rt: "0.2",
  },
  {
    bas_dd: basDd,
    isu_cd: "069500",
    idx_nm: "KOSPI 200",
    idx_close: "408",
    idx_fluc_rt: "0.5",
  },
  {
    bas_dd: basDd,
    isu_cd: "102110",
    idx_nm: "KOSPI 200",
    idx_close: "408",
    idx_fluc_rt: null,
  },
];

class Query {
  private filters = new Map<string, unknown>();
  private ranges = new Map<string, { lower?: number; upper?: number }>();

  constructor(
    private readonly table: string,
    private readonly sourceCalendar: typeof calendar,
    private readonly sourceMarketRows: typeof marketRows,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  gte(column: string, value: number) {
    this.ranges.set(column, { ...this.ranges.get(column), lower: value });
    return this;
  }

  lte(column: string, value: number) {
    this.ranges.set(column, { ...this.ranges.get(column), upper: value });
    return this;
  }

  in(column: string, values: readonly unknown[]) {
    this.filters.set(`${column}:in`, values);
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  maybeSingle() {
    const row = this.sourceCalendar.find((candidate) =>
      this.matches(candidate as unknown as Record<string, unknown>),
    );
    return Promise.resolve({ data: row ?? null, error: null });
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const source =
      this.table === "trading_calendar_kr"
        ? this.sourceCalendar
        : this.sourceMarketRows;
    const data = source.filter((row) =>
      this.matches(row as unknown as Record<string, unknown>),
    );
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }

  private matches(row: Record<string, unknown>): boolean {
    for (const [key, value] of this.filters) {
      if (key.endsWith(":in")) {
        const column = key.slice(0, -3);
        if (!(value as readonly unknown[]).includes(row[column])) return false;
      } else if (row[key] !== value) {
        return false;
      }
    }
    for (const [column, range] of this.ranges) {
      const value = Number(row[column]);
      if (range.lower !== undefined && value < range.lower) return false;
      if (range.upper !== undefined && value > range.upper) return false;
    }
    return true;
  }
}

function createClient(sourceCalendar = calendar) {
  const from = vi.fn(
    (table: string) => new Query(table, sourceCalendar, marketRows),
  );
  return { client: { from }, from };
}

const fiveDaySignal = {
  code: "069500",
  signalType: "five_day_price_gain",
  value: 2,
  valueUnit: "percent",
};

describe("KR relative-strength market data reader", () => {
  it("reads only the current and five-session-start rows for ranked ETFs", async () => {
    const { client, from } = createClient();

    const result = await readKrRelativeStrengthMarketRows(
      client as never,
      basDd,
      [fiveDaySignal],
    );

    expect(result.currentRows).toEqual([
      {
        code: "069500",
        idxNm: "KOSPI 200",
        idxClose: "408",
        idxFlucRt: "0.5",
      },
    ]);
    expect(result.startRows).toEqual([
      {
        code: "069500",
        idxNm: "KOSPI 200",
        idxClose: "400",
        idxFlucRt: "0.2",
      },
    ]);
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("keeps daily data and omits a five-day start when the trading window has a gap", async () => {
    const incompleteCalendar = calendar.map((row, index) =>
      index === 2 ? { ...row, seq: 30 } : row,
    );
    const { client } = createClient(incompleteCalendar);

    const result = await readKrRelativeStrengthMarketRows(
      client as never,
      basDd,
      [
        fiveDaySignal,
        {
          code: "102110",
          signalType: "daily_price_gain",
          value: 1,
          valueUnit: "percent",
        },
      ],
    );

    expect(result.currentRows.map((row) => row.code)).toEqual([
      "069500",
      "102110",
    ]);
    expect(result.startRows).toEqual([]);
  });

  it("does not query the database when there are no price-mover signals", async () => {
    const { client, from } = createClient();

    const result = await readKrRelativeStrengthMarketRows(
      client as never,
      basDd,
      [
        {
          code: "069500",
          signalType: "turnover_surge",
          value: 3,
          valueUnit: "ratio",
        },
      ],
    );

    expect(result).toEqual({ currentRows: [], startRows: [] });
    expect(from).not.toHaveBeenCalled();
  });
});
