import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { KiwoomEtfMasterRecord } from "@/lib/market-data/kiwoom";
import {
  persistKiwoomMasterSnapshot,
  persistKrxSnapshot,
  createKrxTradingSequenceUpdates,
  SupabaseMarketDataRepository,
  type EtfDailyRow,
  type EtfMasterRow,
  type ExistingMaster,
  type ListingEventRow,
  type MarketDataRepository,
  type SnapshotInsertInput,
  type SourceSnapshotRecord,
} from "@/lib/market-data/repository";
import { validateKrxSnapshot } from "@/lib/market-data/krx-validation";

const rawKrxRow = {
  BAS_DD: "20260916",
  ISU_CD: "A12345",
  ISU_NM: "테스트 ETF",
  TDD_CLSPRC: "10,000",
  NAV: "10,010",
  ACC_TRDVOL: "100",
  ACC_TRDVAL: "1,000,000",
  TDD_OPNPRC: "9,900",
  TDD_HGPRC: "10,100",
  TDD_LWPRC: "9,800",
  FLUC_RT: "1.2",
  MKTCAP: "1000000",
  INVSTASST_NETASST_TOTAMT: "1001000",
  LIST_SHRS: "100",
  IDX_IND_NM: "지수",
  OBJ_STKPRC_IDX: "1000",
  FLUC_RT_IDX: "0.5",
};

const masterRecords: KiwoomEtfMasterRecord[] = [
  {
    code: "123456",
    name: "테스트 ETF",
    regDay: "20260901",
    marketCode: "8",
    marketName: "ETF",
    state: "NORMAL",
  },
];

interface EtfMasterDatabaseRow {
  code: string;
  first_seen: string;
}

class FakeSupabaseRepositoryQuery {
  private selected = "";
  private rangeStart = 0;
  private rangeEnd = 999;
  private upsertPayload: unknown = null;

  constructor(
    private readonly table: string,
    private readonly state: {
      existingMasters: EtfMasterDatabaseRow[];
      masterUpserts: unknown[];
      listingEventUpserts: unknown[];
      sourceSnapshotUpserts: unknown[];
      uploadedPaths: string[];
    },
  ) {}

  select(columns: string): this {
    this.selected = columns;
    return this;
  }

  eq(): this {
    return this;
  }

  neq(): this {
    return this;
  }

  is(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  order(): this {
    return this;
  }

  range(start: number, end: number): this {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }

  upsert(payload: unknown): this {
    this.upsertPayload = payload;
    if (this.table === "etf_master_kr") {
      this.state.masterUpserts.push(payload);
    } else if (this.table === "listing_event_kr") {
      this.state.listingEventUpserts.push(payload);
    } else if (this.table === "source_snapshot") {
      this.state.sourceSnapshotUpserts.push(payload);
    }
    return this;
  }

  maybeSingle() {
    return { data: null, error: null };
  }

  single() {
    if (this.table === "source_snapshot" && this.upsertPayload) {
      return {
        data: {
          id: "snapshot-kiwoom",
          object_path: "kiwoom/ka10099/kiwoom-1.json",
        },
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
    if (this.table === "etf_master_kr" && this.selected === "code,first_seen") {
      return {
        data: this.state.existingMasters.slice(
          this.rangeStart,
          this.rangeEnd + 1,
        ),
        error: null,
        count: this.state.existingMasters.length,
      };
    }
    if (
      this.table === "etf_master_kr" ||
      this.table === "listing_event_kr" ||
      this.table === "source_snapshot"
    ) {
      return { error: null };
    }
    return { data: null, error: null, count: 0 };
  }
}

function createSupabaseRepositoryFixture(existingMasters: EtfMasterDatabaseRow[]) {
  const state = {
    existingMasters,
    masterUpserts: [] as unknown[],
    listingEventUpserts: [] as unknown[],
    sourceSnapshotUpserts: [] as unknown[],
    uploadedPaths: [] as string[],
  };
  const client = {
    from(table: string) {
      return new FakeSupabaseRepositoryQuery(table, state);
    },
    storage: {
      from() {
        return {
          upload(path: string) {
            state.uploadedPaths.push(path);
            return { error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;

  return { repository: new SupabaseMarketDataRepository(client), state };
}

function makeExistingMasterRows(count: number): EtfMasterDatabaseRow[] {
  return Array.from({ length: count }, (_, index) => ({
    code: String(index + 1).padStart(6, "0"),
    first_seen: "2026-01-01",
  }));
}

function makeKiwoomMasterRecord(code: string): KiwoomEtfMasterRecord {
  return {
    code,
    name: `ETF ${code}`,
    regDay: "20261015",
    marketCode: "8",
    marketName: "ETF",
    state: "NORMAL",
  };
}

class FakeRepository implements MarketDataRepository {
  existingSnapshot: SourceSnapshotRecord | null = null;
  existingMasters: ExistingMaster[] = [];
  uploadedPaths: string[] = [];
  snapshots: SnapshotInsertInput[] = [];
  calendars: Array<{ basDd: string; seq: number | null; status: string; sourceSnapshotId: string }> = [];
  dailyRows: EtfDailyRow[] = [];
  masterRows: EtfMasterRow[] = [];
  eventRows: ListingEventRow[] = [];

  async findSnapshotByContent(): Promise<SourceSnapshotRecord | null> {
    return this.existingSnapshot;
  }

  async insertSnapshot(input: SnapshotInsertInput): Promise<SourceSnapshotRecord> {
    this.snapshots.push(input);
    return { id: `snapshot-${this.snapshots.length}`, objectPath: input.objectPath };
  }

  async uploadRawSnapshot(path: string): Promise<void> {
    this.uploadedPaths.push(path);
  }

  async getLatestCompleteRowCount(): Promise<number | null> {
    return null;
  }

  async getCompleteTradingDayCount(): Promise<number> {
    return 0;
  }

  async getNextTradingSequence(): Promise<number> {
    return 7;
  }

  async getTradingSequence(): Promise<number | null> {
    return null;
  }

  async upsertTradingCalendar(input: {
    basDd: string;
    seq: number | null;
    status: "TRADING_COMPLETE" | "NON_TRADING" | "PUBLISH_PENDING" | "PARTIAL";
    sourceSnapshotId: string;
  }): Promise<void> {
    this.calendars.push(input);
  }

  async upsertEtfDaily(rows: readonly EtfDailyRow[]): Promise<void> {
    this.dailyRows.push(...rows);
  }

  async getExistingMasters(): Promise<ExistingMaster[]> {
    return this.existingMasters;
  }

  async upsertEtfMasters(rows: readonly EtfMasterRow[]): Promise<void> {
    this.masterRows.push(...rows);
  }

  async upsertListingEvents(rows: readonly ListingEventRow[]): Promise<void> {
    this.eventRows.push(...rows);
  }
}

describe("market data repository orchestration", () => {
  it("orders trading sequence by market date rather than descending backfill insertion order", () => {
    expect(createKrxTradingSequenceUpdates([
      { basDd: "2026-09-18" },
      { basDd: "2026-09-16" },
      { basDd: "2026-09-17" },
    ])).toEqual([
      { basDd: "2026-09-16", seq: 1 },
      { basDd: "2026-09-17", seq: 2 },
      { basDd: "2026-09-18", seq: 3 },
    ]);
  });

  it("persists only a complete KRX snapshot into daily data and assigns the next sequence", async () => {
    const repository = new FakeRepository();
    const validation = validateKrxSnapshot("20260916", [rawKrxRow]);

    const result = await persistKrxSnapshot(repository, {
      observationKey: "krx-1",
      requestedDate: "20260916",
      status: validation.status,
      rawRows: [rawKrxRow],
      rows: validation.rows,
    });

    expect(result).toEqual({ snapshotId: "snapshot-1", duplicate: false });
    expect(repository.uploadedPaths).toEqual(["krx/etf_bydd_trd/krx-1.json"]);
    expect(repository.dailyRows).toMatchObject([{ basDd: "2026-09-16", isuCd: "A12345" }]);
    expect(repository.calendars).toEqual([
      expect.objectContaining({ basDd: "2026-09-16", seq: 7, status: "TRADING_COMPLETE" }),
    ]);
  });

  it("records a duplicate observation without mutating daily data or calendar provenance", async () => {
    const repository = new FakeRepository();
    repository.existingSnapshot = { id: "original", objectPath: "krx/etf_bydd_trd/original.json" };
    const validation = validateKrxSnapshot("20260916", [rawKrxRow]);

    const result = await persistKrxSnapshot(repository, {
      observationKey: "krx-retry",
      requestedDate: "20260916",
      status: validation.status,
      rawRows: [rawKrxRow],
      rows: validation.rows,
    });

    expect(result).toEqual({ snapshotId: "snapshot-1", duplicate: true });
    expect(repository.uploadedPaths).toEqual([]);
    expect(repository.snapshots[0]).toMatchObject({
      status: "duplicate_observation",
      duplicateOfSnapshotId: "original",
      objectPath: "krx/etf_bydd_trd/original.json",
    });
    expect(repository.dailyRows).toEqual([]);
    expect(repository.calendars).toEqual([]);
  });

  it("initializes the Kiwoom master without listing alerts, then records only new codes", async () => {
    const repository = new FakeRepository();

    const initial = await persistKiwoomMasterSnapshot(repository, {
      observationKey: "kiwoom-1",
      observedDate: "20260916",
      records: masterRecords,
    });

    expect(initial.newListingCount).toBe(0);
    expect(repository.masterRows[0]).toMatchObject({ firstSeen: "2026-09-16", lastSeen: "2026-09-16" });
    expect(repository.eventRows).toEqual([]);

    repository.existingMasters = [{ code: "123456", firstSeen: "2026-09-16" }];
    repository.existingSnapshot = null;
    const subsequent = await persistKiwoomMasterSnapshot(repository, {
      observationKey: "kiwoom-2",
      observedDate: "20260917",
      records: [...masterRecords, { ...masterRecords[0], code: "654321", regDay: "20260917" }],
    });

    expect(subsequent.newListingCount).toBe(1);
    expect(repository.masterRows[1]).toMatchObject({ code: "123456", firstSeen: "2026-09-16" });
    expect(repository.eventRows).toEqual([
      expect.objectContaining({ eventKey: "KR:new_listing:654321:2026-09-17", newInSnapshot: true }),
    ]);
  });

  it("uses the Supabase adapter to page all 1180 existing masters and avoids false new-listing events past row 1000", async () => {
    const existingMasters = makeExistingMasterRows(1180);
    const { repository, state } = createSupabaseRepositoryFixture(existingMasters);

    const result = await persistKiwoomMasterSnapshot(repository, {
      observationKey: "kiwoom-1",
      observedDate: "20261015",
      records: [
        makeKiwoomMasterRecord("001176"),
        makeKiwoomMasterRecord("001181"),
      ],
    });

    expect(result.newListingCount).toBe(1);
    expect(state.listingEventUpserts).toHaveLength(1);
    expect(state.listingEventUpserts[0]).toEqual([
      expect.objectContaining({
        code: "001181",
        event_key: "KR:new_listing:001181:2026-10-15",
      }),
    ]);
    expect(state.masterUpserts[0]).toEqual([
      expect.objectContaining({
        code: "001176",
        first_seen: "2026-01-01",
      }),
      expect.objectContaining({
        code: "001181",
        first_seen: "2026-10-15",
      }),
    ]);
  });

  it("preserves existing first_seen at the Supabase adapter write boundary even when caller input is stale", async () => {
    const { repository, state } = createSupabaseRepositoryFixture([
      { code: "001176", first_seen: "2026-01-01" },
    ]);

    await repository.upsertEtfMasters([
      {
        code: "001176",
        name: "ETF 001176",
        regDay: "2026-10-15",
        marketCode: "8",
        marketName: "ETF",
        state: "NORMAL",
        firstSeen: "2026-10-15",
        lastSeen: "2026-10-15",
        sourceSnapshotId: "snapshot-kiwoom",
      },
    ]);

    expect(state.masterUpserts[0]).toEqual([
      expect.objectContaining({
        code: "001176",
        first_seen: "2026-01-01",
      }),
    ]);
  });
});
