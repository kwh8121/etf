import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  auditKrListingCorrectionProposals,
  auditRunAccuracy,
  compareSignalRows,
  verifySourceSnapshotBytes,
  type AccuracySignalRow,
  type SourceSnapshotAuditRow,
} from "../../lib/signals/data-accuracy.ts";

const completeSnapshot = {
  id: "snapshot-current",
  market: "KR",
  api_id: "etf_bydd_trd",
  market_date: "2026-10-14",
  asof_at: null,
  observed_at: "2026-10-14T01:00:00.000Z",
  row_count: 2,
  unique_key_count: 2,
  page_count: 1,
  sha256:
    "12651604bd9cf917d7cb3a0d9d508e98a761e67e7676ec455b2eaa40cfb12f52",
  object_path: "krx/current.json",
  duplicate_of_snapshot_id: null,
  status: "TRADING_COMPLETE",
} satisfies SourceSnapshotAuditRow;

describe("compareSignalRows", () => {
  it("reports literal code/name/rank/value/unit mismatches even when row counts match", () => {
    const stored: AccuracySignalRow[] = [
      row({ code: "A001", name: "Wrong name", rank: 2, value: 7, value_unit: "ratio" }),
    ];
    const expected: AccuracySignalRow[] = [
      row({ code: "A002", name: "Right name", rank: 1, value: 3.5, value_unit: "percent" }),
    ];

    const diff = compareSignalRows(stored, expected);

    expect(diff.ok).toBe(false);
    expect(diff.beforeCount).toBe(1);
    expect(diff.afterCount).toBe(1);
    expect(diff.added).toEqual([
      {
        signal_type: "daily_price_gain",
        screen: "raw",
        code: "A002",
        name: "Right name",
        rank: 1,
        value: 3.5,
        value_unit: "percent",
        meta: {},
        source_snapshot_id: "snapshot-current",
      },
    ]);
    expect(diff.removed).toEqual([
      {
        signal_type: "daily_price_gain",
        screen: "raw",
        code: "A001",
        name: "Wrong name",
        rank: 2,
        value: 7,
        value_unit: "ratio",
        meta: {},
        source_snapshot_id: "snapshot-current",
      },
    ]);
  });

  it("uses numeric tolerance for tiny replay differences", () => {
    const stored = [row({ value: 10.0000000001 })];
    const expected = [row({ value: 10 })];

    expect(compareSignalRows(stored, expected).ok).toBe(true);
  });

  it("does not coerce structural null or blank values to expected zero and checks source ids", () => {
    const stored = [
      row({
        value: null,
        source_snapshot_id: "wrong-source",
      } as Partial<AccuracySignalRow>),
      row({
        code: "A002",
        value: "",
      } as Partial<AccuracySignalRow>),
    ];
    const expected = [
      row({ value: 0, source_snapshot_id: "snapshot-current" }),
      row({ code: "A002", value: 0 }),
    ];

    expect(compareSignalRows(stored, expected).changed).toEqual([
      expect.objectContaining({
        key: "daily_price_gain:raw:A001",
        fields: ["value", "source_snapshot_id"],
      }),
      expect.objectContaining({
        key: "daily_price_gain:raw:A002",
        fields: ["value"],
      }),
    ]);
  });
});

describe("verifySourceSnapshotBytes", () => {
  it("fails closed on sha256 mismatches without exposing raw payload", () => {
    const result = verifySourceSnapshotBytes(
      completeSnapshot,
      new TextEncoder().encode('[{"BAS_DD":"20261014"}]'),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("sha256_mismatch");
    expect(JSON.stringify(result)).not.toContain("BAS_DD");
  });

  it("verifies raw row and page counts from the downloaded payload", () => {
    const payload = new TextEncoder().encode(
      JSON.stringify([
        { BAS_DD: "20261014", ISU_CD: "A001" },
        { BAS_DD: "20261014", ISU_CD: "A002" },
      ]),
    );

    expect(
      verifySourceSnapshotBytes(
        {
          ...completeSnapshot,
          sha256:
            "b1e818aace06bd2982f0c16bd10ecbb30765653eded519976eb7934c79dc47b0",
        },
        payload,
      ),
    ).toMatchObject({
      ok: true,
      rawRowCount: 2,
      rawPageCount: 1,
    });
  });
});

describe("auditRunAccuracy", () => {
  it("reads more than 1000 stored signal rows, recalculates from sources, and never invokes write methods", async () => {
    const client = createReadonlyClient({
      signal_run: [
        {
          id: "run-kr",
          market: "KR",
          bas_dd: "2026-10-14",
          market_date: "2026-10-14",
          asof_at: null,
          status: "COMPLETED",
          strategy_version: "m3-price-movers-v1",
          transform_version: "m2-2026-09-21",
          input_snapshot_ids: ["snapshot-current"],
          notes: { telegram_reported_at: "2026-10-14T02:00:00.000Z" },
        },
      ],
      signal_daily: [
        ...Array.from({ length: 1001 }, (_, index) =>
          row({
            code: `Z${String(index).padStart(4, "0")}`,
            name: `Noise ${index}`,
            rank: index + 1,
            run_id: "other-run",
          }),
        ),
        row({ run_id: "run-kr", code: "A001", name: "Stored wrong", rank: 1, value: 9 }),
      ],
      source_snapshot: [completeSnapshot],
      trading_calendar_kr: [
        { bas_dd: "2026-10-14", seq: 21, status: "TRADING_COMPLETE", source_snapshot_id: "snapshot-current" },
      ],
      etf_daily_kr: [
        {
          bas_dd: "2026-10-14",
          isu_cd: "A001",
          isu_nm: "Alpha",
          close_prc: 110,
          fluc_rt: 10,
          acc_trdval: 2_000_000_000,
          acc_trdvol: 1000,
          source_snapshot_id: "snapshot-current",
        },
        {
          bas_dd: "2026-10-14",
          isu_cd: "A002",
          isu_nm: "Beta",
          close_prc: 90,
          fluc_rt: -5,
          acc_trdval: 500_000_000,
          acc_trdvol: 100,
          source_snapshot_id: "snapshot-current",
        },
      ],
      listing_event_kr: [],
      etf_master_kr: [],
    }, {
      "krx/current.json": JSON.stringify([
        {
          BAS_DD: "20261014",
          ISU_CD: "A001",
          ISU_NM: "Alpha",
          TDD_CLSPRC: "110",
          FLUC_RT: "10",
          NAV: "110",
          ACC_TRDVAL: "2000000000",
          ACC_TRDVOL: "1000",
        },
        {
          BAS_DD: "20261014",
          ISU_CD: "A002",
          ISU_NM: "Beta",
          TDD_CLSPRC: "90",
          FLUC_RT: "-5",
          NAV: "90",
          ACC_TRDVAL: "500000000",
          ACC_TRDVOL: "100",
        },
      ]),
    });

    const result = await auditRunAccuracy(client as never, "run-kr");

    expect(result.ok).toBe(false);
    expect(result.market).toBe("KR");
    expect(result.sourceIntegrity.every((item) => item.ok)).toBe(true);
    expect(result.diffs.changed).toContainEqual(
      expect.objectContaining({
        before: expect.objectContaining({
          signal_type: "daily_price_gain",
          code: "A001",
          name: "Stored wrong",
          value: 9,
        }),
        after: expect.objectContaining({
          signal_type: "daily_price_gain",
          code: "A001",
          name: "Alpha",
          rank: 1,
          value: 10,
          value_unit: "percent",
        }),
        fields: ["name", "value"],
      }),
    );
    expect(client.writeCalls).toEqual([]);
  });
});

describe("auditKrListingCorrectionProposals", () => {
  it("reports confirmed false listing events and master first_seen candidates from strict earlier snapshots", async () => {
    const earlyPayload = JSON.stringify([
      { code: "A001", name: "Alpha", regDay: "20200101", marketCode: "", marketName: "", state: "" },
    ]);
    const latePayload = JSON.stringify([
      { code: "A001", name: "Alpha", regDay: "20200101", marketCode: "", marketName: "", state: "" },
      { code: "A002", name: "Beta", regDay: "20261010", marketCode: "", marketName: "", state: "" },
    ]);
    const store = {
      async readSignalRun() { return null; },
      async readSignalRows() { return []; },
      async readSourceSnapshots() { return []; },
      async readKrTradingWindow() { return []; },
      async readKrDailyRows() { return []; },
      async readKrListingEvents() { return []; },
      async readKrMasters() { return []; },
      async readKrMasterSourceSnapshots() {
        return [
          masterSnapshot("master-early", "2026-10-10T01:00:00.000Z", "master/early.json", earlyPayload),
          masterSnapshot("master-late", "2026-10-15T01:00:00.000Z", "master/late.json", latePayload),
        ];
      },
      async readKrListingHistory() {
        return [
          {
            event_key: "KR:new_listing:A001:20200101",
            code: "A001",
            reg_day: "2020-01-01",
            first_seen: "2026-10-15",
            new_in_snapshot: true,
            first_alerted_at: "2026-10-15T02:00:00.000Z",
            source_snapshot_id: "master-late",
          },
        ];
      },
      async readKrMasterHistory() {
        return [
          {
            code: "A001",
            name: "Alpha",
            first_seen: "2026-10-15",
            source_snapshot_id: "master-late",
          },
        ];
      },
      async downloadSourceSnapshot(path: string) {
        return new TextEncoder().encode(
          path === "master/early.json" ? earlyPayload : latePayload,
        );
      },
    };

    await expect(
      auditKrListingCorrectionProposals({} as never, { store }),
    ).resolves.toMatchObject({
      ok: false,
      approvalReady: true,
      falseListingEvents: [
        {
          eventKey: "KR:new_listing:A001:20200101",
          code: "A001",
          storedFirstSeen: "2026-10-15",
          earliestObservedDate: "2026-10-10",
          eventSourceSnapshotId: "master-late",
          earliestSourceSnapshotId: "master-early",
        },
      ],
      masterFirstSeenCorrections: [
        {
          code: "A001",
          storedFirstSeen: "2026-10-15",
          proposedFirstSeen: "2026-10-10",
          sourceSnapshotId: "master-early",
        },
      ],
    });
  });
});

function row(
  overrides: Partial<AccuracySignalRow> = {},
): AccuracySignalRow & Record<string, unknown> {
  return {
    run_id: overrides.run_id ?? "run",
    market: "KR",
    signal_type: "daily_price_gain",
    screen: "raw",
    code: "A001",
    name: "Alpha",
    rank: 1,
    value: 1,
    value_unit: "percent",
    meta: {},
    source_snapshot_id: "snapshot-current",
    ...overrides,
  } as AccuracySignalRow & Record<string, unknown>;
}

class FakeQuery {
  private readonly filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private readonly orders: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private rangeStart = 0;
  private rangeEnd: number | null = null;

  constructor(
    private readonly rows: readonly Record<string, unknown>[],
    private readonly table: string,
  ) {}

  select() { return this; }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column: string, values: readonly unknown[]) {
    const set = new Set(values);
    this.filters.push((row) => set.has(row[column]));
    return this;
  }
  contains(column: string, values: readonly unknown[]) {
    this.filters.push((row) => {
      const actual = row[column];
      return Array.isArray(actual) && values.every((value) => actual.includes(value));
    });
    return this;
  }
  not(column: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) {
      this.filters.push((row) => row[column] !== null && row[column] !== undefined);
    }
    return this;
  }
  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push((row) => Number(row[column]) >= Number(value));
    return this;
  }
  lte(column: string, value: unknown) {
    this.filters.push((row) => Number(row[column]) <= Number(value));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }
  limit(count: number) {
    this.limitCount = count;
    return this;
  }
  range(start: number, end: number) {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }
  single() {
    const result = this.result(false);
    const rows = result.data ?? [];
    return Promise.resolve({
      data: rows.length === 1 ? rows[0] : null,
      error: rows.length === 1 ? null : { message: `${this.table} expected one row` },
      count: result.count,
    });
  }
  maybeSingle() {
    const result = this.result(false);
    const rows = result.data ?? [];
    return Promise.resolve({
      data: rows[0] ?? null,
      error: rows.length > 1 ? { message: `${this.table} returned multiple rows` } : null,
      count: result.count,
    });
  }
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.result(false)).then(onfulfilled, onrejected);
  }
  private result(requireSingle: boolean) {
    let data = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    for (const order of [...this.orders].reverse()) {
      data = [...data].sort((left, right) => {
        const compared = String(left[order.column] ?? "").localeCompare(String(right[order.column] ?? ""));
        return order.ascending ? compared : -compared;
      });
    }
    const count = data.length;
    if (this.limitCount !== null) data = data.slice(0, this.limitCount);
    if (this.rangeEnd !== null) data = data.slice(this.rangeStart, this.rangeEnd + 1);
    if (requireSingle && data.length !== 1) {
      return { data: null, error: { message: `${this.table} expected one row` }, count };
    }
    return { data, error: null, count };
  }
}

function createReadonlyClient(
  tables: Record<string, readonly Record<string, unknown>[]>,
  objects: Record<string, string>,
) {
  const client = {
    writeCalls: [] as string[],
    from(table: string) {
      return {
        select: () => new FakeQuery(tables[table] ?? [], table),
        insert: () => {
          client.writeCalls.push(`${table}.insert`);
          throw new Error("write forbidden");
        },
        upsert: () => {
          client.writeCalls.push(`${table}.upsert`);
          throw new Error("write forbidden");
        },
        update: () => {
          client.writeCalls.push(`${table}.update`);
          throw new Error("write forbidden");
        },
        delete: () => {
          client.writeCalls.push(`${table}.delete`);
          throw new Error("write forbidden");
        },
      };
    },
    storage: {
      from() {
        return {
          async download(path: string) {
            const payload = objects[path];
            return payload
              ? { data: new Blob([payload], { type: "application/json" }), error: null }
              : { data: null, error: { message: "missing object" } };
          },
        };
      },
    },
  };
  return client;
}

function masterSnapshot(
  id: string,
  observedAt: string,
  objectPath: string,
  payload: string,
): SourceSnapshotAuditRow {
  return {
    id,
    market: "KR",
    api_id: "ka10099",
    market_date: null,
    asof_at: null,
    observed_at: observedAt,
    row_count: JSON.parse(payload).length as number,
    unique_key_count: JSON.parse(payload).length as number,
    page_count: 1,
    sha256: createHash("sha256").update(payload).digest("hex"),
    object_path: objectPath,
    duplicate_of_snapshot_id: null,
    status: "COMPLETE",
  };
}
