import { describe, expect, it, vi } from "vitest";

interface CalendarRow {
  bas_dd: string;
  seq: number;
  source_snapshot_id: string | null;
}

interface DailyRow {
  bas_dd: string;
  isu_cd: string;
  isu_nm: string;
  close_prc: number;
  fluc_rt: number | null;
  acc_trdval: number;
  acc_trdvol: number;
}

interface ListingEventRow {
  event_key: string;
  code: string;
  reg_day: string | null;
  first_seen: string;
  new_in_snapshot: boolean;
  first_alerted_at: string | null;
  source_snapshot_id: string | null;
}

interface GeneratorFixture {
  currentCalendar: CalendarRow;
  calendarWindow: CalendarRow[];
  snapshotRowCounts: Map<string, number | null>;
  dailyRowsByDate: Map<string, DailyRow[]>;
  listingEvents: ListingEventRow[];
  masterNames: Map<string, string>;
  signalRunWrites: Array<Record<string, unknown>>;
  signalDailyWrites: Array<{
    signalType: string;
    rows: Array<Record<string, unknown>>;
  }>;
  operationLog: string[];
}

let fixture: GeneratorFixture;

class FakeGeneratorQuery {
  private filters = new Map<string, unknown>();
  private inFilter: { column: string; values: unknown[] } | null = null;
  private lessThanOrEqual = new Map<string, unknown>();
  private rangeStart = 0;
  private rangeEnd = 999;
  private action: "delete" | "update" | "upsert" | null = null;
  private payload: unknown = null;

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

  lte(column: string, value: unknown) {
    this.lessThanOrEqual.set(column, value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.inFilter = { column, values };
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  range(start: number, end: number) {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  upsert(payload: unknown) {
    this.action = "upsert";
    this.payload = payload;
    if (this.table === "signal_run") {
      fixture.signalRunWrites.push(payload as Record<string, unknown>);
      fixture.operationLog.push(
        `signal_run:${String((payload as { status?: string }).status)}`,
      );
    } else if (this.table === "signal_daily") {
      const rows = Array.isArray(payload)
        ? (payload as Array<Record<string, unknown>>)
        : [payload as Record<string, unknown>];
      fixture.signalDailyWrites.push({
        signalType: String(rows[0]?.signal_type),
        rows,
      });
      fixture.operationLog.push(`signal_daily:${String(rows[0]?.signal_type)}`);
    }
    return this;
  }

  update(payload: unknown) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  single() {
    if (this.table === "trading_calendar_kr") {
      return { data: fixture.currentCalendar, error: null };
    }
    return { data: null, error: null };
  }

  maybeSingle() {
    if (this.table === "signal_run") {
      return {
        data: { notes: { telegram_reported_at: "2026-09-24T00:35:00.000Z" } },
        error: null,
      };
    }
    return { data: null, error: null };
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private resolve() {
    if (this.action === "delete") return { error: null };
    if (this.action === "upsert") return { error: null };
    if (this.action === "update") {
      if (this.table === "signal_run") {
        const payload = this.payload as Record<string, unknown>;
        fixture.signalRunWrites.push(payload);
        fixture.operationLog.push(`signal_run:${String(payload.status)}`);
      }
      return { error: null };
    }
    if (this.table === "trading_calendar_kr") {
      return { data: fixture.calendarWindow, error: null };
    }
    if (this.table === "source_snapshot") {
      const ids = this.inFilter?.values.map(String) ?? [];
      const rows = ids.flatMap((id) =>
        fixture.snapshotRowCounts.has(id)
          ? [{ id, row_count: fixture.snapshotRowCounts.get(id) ?? null }]
          : [],
      );
      return {
        data: rows.slice(this.rangeStart, this.rangeEnd + 1),
        error: null,
        count: rows.length,
      };
    }
    if (this.table === "etf_daily_kr") {
      const basDd = String(this.filters.get("bas_dd"));
      const rows = fixture.dailyRowsByDate.get(basDd) ?? [];
      return {
        data: rows.slice(this.rangeStart, this.rangeEnd + 1),
        error: null,
        count: rows.length,
      };
    }
    if (this.table === "listing_event_kr") {
      const maxFirstSeen = String(this.lessThanOrEqual.get("first_seen"));
      const rows = fixture.listingEvents.filter(
        (event) =>
          event.new_in_snapshot &&
          event.first_seen <= maxFirstSeen &&
          event.first_alerted_at === null,
      );
      return {
        data: rows.slice(this.rangeStart, this.rangeEnd + 1),
        error: null,
        count: rows.length,
      };
    }
    if (this.table === "etf_master_kr") {
      const codes = new Set(this.inFilter?.values.map(String) ?? []);
      const rows = [...codes].flatMap((code) => {
        const name = fixture.masterNames.get(code);
        return name ? [{ code, name }] : [];
      });
      return {
        data: rows.slice(this.rangeStart, this.rangeEnd + 1),
        error: null,
        count: rows.length,
      };
    }
    return { data: null, error: null, count: 0 };
  }
}

vi.mock("../../lib/supabase/service-role-core.ts", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => new FakeGeneratorQuery(table),
  }),
}));

import { generateKrxPriceSignals } from "../../scripts/generate-kr-price-signals";

describe("generateKrxPriceSignals", () => {
  it("fails closed before signal_run writes when daily rows do not match source snapshot row_count", async () => {
    fixture = createGeneratorFixture({ rowCount: 2, actualRowsPerDate: 1 });

    await expect(generateKrxPriceSignals()).rejects.toThrow(
      "ETF daily rows for 2026-09-21 are incomplete: expected 2 from source_snapshot.row_count, fetched 1",
    );
    expect(fixture.signalRunWrites).toEqual([]);
    expect(fixture.signalDailyWrites).toEqual([]);
  });

  it("loads current/start/prior rows beyond 1000, persists all KR families, records provenance, then completes", async () => {
    fixture = createGeneratorFixture({ rowCount: 1001, actualRowsPerDate: 1001 });

    const result = await generateKrxPriceSignals();

    expect(result.basDd).toBe("2026-09-21");
    expect(
      fixture.signalDailyWrites
        .flatMap((write) => write.rows)
        .filter((row) => row.code === "001001")
        .map((row) => row.signal_type),
    ).toEqual(
      expect.arrayContaining([
        "daily_price_gain",
        "five_day_price_gain",
        "turnover_surge",
        "new_listing",
      ]),
    );
    expect(
      fixture.signalDailyWrites.find(
        (write) => write.signalType === "turnover_surge",
      )?.rows,
    ).toContainEqual(
      expect.objectContaining({
        code: "001001",
        value: 4,
        meta: { prior_20_day_average_krw: 1_000_000_000 },
      }),
    );

    const pendingRun = fixture.signalRunWrites.find(
      (write) => write.status === "PENDING",
    );
    expect(pendingRun?.input_snapshot_ids).toEqual(
      expect.arrayContaining([
        "snapshot-001",
        "snapshot-016",
        "snapshot-021",
        "listing-snapshot",
      ]),
    );
    expect(new Set(pendingRun?.input_snapshot_ids as string[]).size).toBe(22);

    const completedIndex = fixture.operationLog.indexOf("signal_run:COMPLETED");
    expect(completedIndex).toBeGreaterThan(-1);
    for (const [index, operation] of fixture.operationLog.entries()) {
      if (operation.startsWith("signal_daily:")) {
        expect(index).toBeLessThan(completedIndex);
      }
    }
    expect(fixture.operationLog.at(-1)).toBe("signal_run:COMPLETED");
    expect(fixture.signalRunWrites.at(-1)).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        notes: expect.objectContaining({
          kr_full_signal_complete: true,
          telegram_reported_at: "2026-09-24T00:35:00.000Z",
        }),
      }),
    );
  });

  it("fails closed before signal_run writes when a calendar source snapshot row_count is missing", async () => {
    fixture = createGeneratorFixture({ rowCount: 1001, actualRowsPerDate: 1001 });
    fixture.snapshotRowCounts.delete("snapshot-016");

    await expect(generateKrxPriceSignals()).rejects.toThrow(
      "Missing source snapshot row_count for snapshot-016",
    );
    expect(fixture.signalRunWrites).toEqual([]);
    expect(fixture.signalDailyWrites).toEqual([]);
  });
});

function createGeneratorFixture(input: {
  rowCount: number;
  actualRowsPerDate: number;
}): GeneratorFixture {
  const calendarWindow = Array.from({ length: 21 }, (_, index) => {
    const seq = index + 1;
    return {
      bas_dd: `2026-09-${String(seq).padStart(2, "0")}`,
      seq,
      source_snapshot_id: `snapshot-${String(seq).padStart(3, "0")}`,
    };
  });
  const snapshotRowCounts = new Map(
    calendarWindow.map((row) => [row.source_snapshot_id, input.rowCount]),
  );
  const dailyRowsByDate = new Map(
    calendarWindow.map((row) => [
      row.bas_dd,
      createDailyRows(row.bas_dd, row.seq, input.actualRowsPerDate),
    ]),
  );
  snapshotRowCounts.set("listing-snapshot", 1);
  return {
    currentCalendar: calendarWindow.at(-1) as CalendarRow,
    calendarWindow,
    snapshotRowCounts,
    dailyRowsByDate,
    listingEvents: [
      {
        event_key: "KR:new_listing:001001:2026-09-21",
        code: "001001",
        reg_day: "2026-09-21",
        first_seen: "2026-09-21",
        new_in_snapshot: true,
        first_alerted_at: null,
        source_snapshot_id: "listing-snapshot",
      },
    ],
    masterNames: new Map([["001001", "ETF 001001"]]),
    signalRunWrites: [],
    signalDailyWrites: [],
    operationLog: [],
  };
}

function createDailyRows(
  basDd: string,
  seq: number,
  count: number,
): DailyRow[] {
  return Array.from({ length: count }, (_, index) => {
    const code = String(index + 1).padStart(6, "0");
    const target = code === "001001";
    return {
      bas_dd: basDd,
      isu_cd: code,
      isu_nm: `ETF ${code}`,
      close_prc: target && seq === 21 ? 200 : 100,
      fluc_rt: target && seq === 21 ? 99 : 0,
      acc_trdval: target ? (seq === 21 ? 4_000_000_000 : 1_000_000_000) : 10,
      acc_trdvol: target && seq === 21 ? 4_000 : 1,
    };
  });
}
