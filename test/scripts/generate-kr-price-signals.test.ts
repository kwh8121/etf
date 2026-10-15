import { describe, expect, it, vi } from "vitest";

const signalRunTouches: string[] = [];

class FakeQuery {
  private filters = new Map<string, unknown>();
  private rangeStart = 0;
  private rangeEnd = 999;

  constructor(private readonly table: string) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  not() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  gte() {
    return this;
  }

  lte() {
    return this;
  }

  in() {
    return this;
  }

  is() {
    return this;
  }

  range(start: number, end: number) {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }

  upsert() {
    signalRunTouches.push(`${this.table}:upsert`);
    return { error: null };
  }

  update() {
    signalRunTouches.push(`${this.table}:update`);
    return { eq: () => ({ error: null }) };
  }

  delete() {
    signalRunTouches.push(`${this.table}:delete`);
    return { eq: () => this };
  }

  single() {
    if (this.table !== "trading_calendar_kr") {
      return { data: null, error: null };
    }
    return {
      data: {
        bas_dd: "2026-10-14",
        seq: 10,
        source_snapshot_id: "snapshot-current",
      },
      error: null,
    };
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private resolve() {
    if (this.table === "trading_calendar_kr") {
      return {
        data: [
          {
            bas_dd: "2026-10-14",
            seq: 10,
            source_snapshot_id: "snapshot-current",
          },
        ],
        error: null,
      };
    }
    if (this.table === "source_snapshot") {
      return {
        data: [{ id: "snapshot-current", row_count: 2 }].slice(
          this.rangeStart,
          this.rangeEnd + 1,
        ),
        error: null,
        count: 1,
      };
    }
    if (this.table === "etf_daily_kr") {
      const basDd = this.filters.get("bas_dd");
      return {
        data: [
          {
            bas_dd: basDd,
            isu_cd: "A000001",
            isu_nm: "테스트 ETF",
            close_prc: 1000,
            fluc_rt: 1,
            acc_trdval: 1_000_000_000,
            acc_trdvol: 1000,
          },
        ].slice(this.rangeStart, this.rangeEnd + 1),
        error: null,
        count: 1,
      };
    }
    if (this.table === "listing_event_kr" || this.table === "etf_master_kr") {
      return { data: [], error: null, count: 0 };
    }
    signalRunTouches.push(`${this.table}:read`);
    return { data: null, error: null, count: 0 };
  }
}

vi.mock("../../lib/supabase/service-role-core.ts", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => new FakeQuery(table),
  }),
}));

import { generateKrxPriceSignals } from "../../scripts/generate-kr-price-signals";

describe("generateKrxPriceSignals", () => {
  it("fails closed before signal_run writes when daily rows do not match source snapshot row_count", async () => {
    signalRunTouches.length = 0;

    await expect(generateKrxPriceSignals()).rejects.toThrow(
      "ETF daily rows for 2026-10-14 are incomplete: expected 2 from source_snapshot.row_count, fetched 1",
    );
    expect(signalRunTouches).toEqual([]);
  });
});
