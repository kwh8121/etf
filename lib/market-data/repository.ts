import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { KiwoomEtfMasterRecord } from "./kiwoom.ts";
import { parseKrxNumber, type KrxEtfRow, type KrxRawEtfRow } from "./krx.ts";
import type { KrxSnapshotStatus } from "./krx-validation.ts";

export const MARKET_DATA_TRANSFORM_VERSION = "m2-2026-09-21";
const SOURCE_SNAPSHOT_BUCKET = "market-data-source-snapshots";

type SourceStatus = KrxSnapshotStatus | "FETCH_FAIL" | "duplicate_observation" | "COMPLETE";

export interface SourceSnapshotRecord {
  id: string;
  objectPath: string | null;
}

interface SourceSnapshotInput {
  observationKey: string;
  source: "krx" | "kiwoom";
  apiId: "etf_bydd_trd" | "ka10099";
  requestedAsOf: string | null;
  marketDate: string | null;
  status: SourceStatus;
  rowCount: number;
  uniqueKeyCount: number;
  pageCount: number;
  sha256: string;
  rawPayload: string | null;
  errorCode?: string;
  errorMessage?: string;
}

export interface SnapshotInsertInput extends SourceSnapshotInput {
  duplicateOfSnapshotId: string | null;
  objectPath: string | null;
}

export interface ExistingMaster {
  code: string;
  firstSeen: string;
}

export interface MarketDataRepository {
  findSnapshotByContent(input: {
    source: "krx" | "kiwoom";
    apiId: "etf_bydd_trd" | "ka10099";
    marketDate: string | null;
    sha256: string;
  }): Promise<SourceSnapshotRecord | null>;
  insertSnapshot(input: SnapshotInsertInput): Promise<SourceSnapshotRecord>;
  uploadRawSnapshot(path: string, payload: string): Promise<void>;
  getLatestCompleteRowCount(): Promise<number | null>;
  getCompleteTradingDayCount(): Promise<number>;
  getTradingSequence(basDd: string): Promise<number | null>;
  getNextTradingSequence(): Promise<number>;
  upsertTradingCalendar(input: {
    basDd: string;
    seq: number | null;
    status: KrxSnapshotStatus;
    sourceSnapshotId: string;
  }): Promise<void>;
  upsertEtfDaily(rows: readonly EtfDailyRow[]): Promise<void>;
  getExistingMasters(): Promise<ExistingMaster[]>;
  upsertEtfMasters(rows: readonly EtfMasterRow[]): Promise<void>;
  upsertListingEvents(rows: readonly ListingEventRow[]): Promise<void>;
}

export interface EtfDailyRow {
  basDd: string;
  isuCd: string;
  isuNm: string;
  openPrc: number | null;
  highPrc: number | null;
  lowPrc: number | null;
  closePrc: number;
  flucRt: number | null;
  nav: number;
  accTrdvol: number;
  accTrdval: number;
  mktcap: number | null;
  netAsset: number | null;
  listShrs: number | null;
  idxNm: string | null;
  idxClose: number | null;
  idxFlucRt: number | null;
  sourceSnapshotId: string;
}

export interface EtfMasterRow {
  code: string;
  name: string;
  regDay: string;
  marketCode: string | null;
  marketName: string | null;
  state: string | null;
  firstSeen: string;
  lastSeen: string;
  sourceSnapshotId: string;
}

export interface ListingEventRow {
  eventKey: string;
  code: string;
  regDay: string;
  firstSeen: string;
  newInSnapshot: boolean;
  sourceSnapshotId: string;
}

export interface PersistKrxSnapshotInput {
  observationKey: string;
  requestedDate: string;
  status: KrxSnapshotStatus;
  rawRows: KrxRawEtfRow[];
  rows: KrxEtfRow[];
}

export interface PersistResult {
  snapshotId: string;
  duplicate: boolean;
}

export function createKrxTradingSequenceUpdates(rows: readonly { basDd: string }[]) {
  return [...rows]
    .sort((left, right) => left.basDd.localeCompare(right.basDd))
    .map((row, index) => ({ basDd: row.basDd, seq: index + 1 }));
}

export function createPayloadSha256(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function persistKrxSnapshot(
  repository: MarketDataRepository,
  input: PersistKrxSnapshotInput,
): Promise<PersistResult> {
  const rawPayload = JSON.stringify(input.rawRows);
  const sha256 = createPayloadSha256(input.rawRows);
  const marketDate = toSqlDate(input.requestedDate);
  const snapshot = await createSourceSnapshot(repository, {
    observationKey: input.observationKey,
    source: "krx",
    apiId: "etf_bydd_trd",
    requestedAsOf: marketDate,
    marketDate,
    status: input.status,
    rowCount: input.rawRows.length,
    uniqueKeyCount: input.rows.length,
    pageCount: 1,
    sha256,
    rawPayload,
  });

  if (snapshot.duplicate) {
    return snapshot;
  }

  if (input.status !== "TRADING_COMPLETE") {
    await repository.upsertTradingCalendar({
      basDd: marketDate,
      seq: null,
      status: input.status,
      sourceSnapshotId: snapshot.snapshotId,
    });
    return snapshot;
  }

  await repository.upsertEtfDaily(
    input.rows.map((row) => toEtfDailyRow(row, snapshot.snapshotId)),
  );
  await repository.upsertTradingCalendar({
      basDd: marketDate,
      seq:
        (await repository.getTradingSequence(marketDate)) ??
        (await repository.getNextTradingSequence()),
    status: "TRADING_COMPLETE",
    sourceSnapshotId: snapshot.snapshotId,
  });

  return snapshot;
}

export async function persistKrxFetchFailure(
  repository: MarketDataRepository,
  input: { observationKey: string; requestedDate: string; errorCode: string },
): Promise<PersistResult> {
  const marketDate = toSqlDate(input.requestedDate);
  return createSourceSnapshot(repository, {
    observationKey: input.observationKey,
    source: "krx",
    apiId: "etf_bydd_trd",
    requestedAsOf: marketDate,
    marketDate,
    status: "FETCH_FAIL",
    rowCount: 0,
    uniqueKeyCount: 0,
    pageCount: 1,
    sha256: createPayloadSha256({ errorCode: input.errorCode }),
    rawPayload: null,
    errorCode: input.errorCode,
    errorMessage: "KRX snapshot fetch failed; inspect secured runtime logs.",
  });
}

export async function persistKiwoomMasterFetchFailure(
  repository: MarketDataRepository,
  input: { observationKey: string; errorCode: string },
): Promise<PersistResult> {
  return createSourceSnapshot(repository, {
    observationKey: input.observationKey,
    source: "kiwoom",
    apiId: "ka10099",
    requestedAsOf: null,
    marketDate: null,
    status: "FETCH_FAIL",
    rowCount: 0,
    uniqueKeyCount: 0,
    pageCount: 1,
    sha256: createPayloadSha256({ errorCode: input.errorCode }),
    rawPayload: null,
    errorCode: input.errorCode,
    errorMessage: "Kiwoom master fetch failed; inspect secured runtime logs.",
  });
}

export async function persistKiwoomMasterSnapshot(
  repository: MarketDataRepository,
  input: { observationKey: string; observedDate: string; records: KiwoomEtfMasterRecord[] },
): Promise<PersistResult & { newListingCount: number }> {
  const rawPayload = JSON.stringify(input.records);
  const snapshot = await createSourceSnapshot(repository, {
    observationKey: input.observationKey,
    source: "kiwoom",
    apiId: "ka10099",
    requestedAsOf: null,
    marketDate: null,
    status: "COMPLETE",
    rowCount: input.records.length,
    uniqueKeyCount: input.records.length,
    pageCount: 1,
    sha256: createPayloadSha256(input.records),
    rawPayload,
  });

  if (snapshot.duplicate) {
    return { ...snapshot, newListingCount: 0 };
  }

  const existingMasters = await repository.getExistingMasters();
  const existingByCode = new Map(existingMasters.map((master) => [master.code, master]));
  const firstSnapshot = existingMasters.length === 0;
  const observedDate = toSqlDate(input.observedDate);

  await repository.upsertEtfMasters(
    input.records.map((record) => ({
      code: record.code,
      name: record.name,
      regDay: toSqlDate(record.regDay),
      marketCode: nullIfEmpty(record.marketCode),
      marketName: nullIfEmpty(record.marketName),
      state: nullIfEmpty(record.state),
      firstSeen: existingByCode.get(record.code)?.firstSeen ?? observedDate,
      lastSeen: observedDate,
      sourceSnapshotId: snapshot.snapshotId,
    })),
  );

  const newRecords = firstSnapshot
    ? []
    : input.records.filter((record) => !existingByCode.has(record.code));
  await repository.upsertListingEvents(
    newRecords.map((record) => ({
      eventKey: `KR:new_listing:${record.code}:${toSqlDate(record.regDay)}`,
      code: record.code,
      regDay: toSqlDate(record.regDay),
      firstSeen: observedDate,
      newInSnapshot: true,
      sourceSnapshotId: snapshot.snapshotId,
    })),
  );

  return { ...snapshot, newListingCount: newRecords.length };
}

async function createSourceSnapshot(
  repository: MarketDataRepository,
  input: SourceSnapshotInput,
): Promise<PersistResult> {
  const existing = await repository.findSnapshotByContent({
    source: input.source,
    apiId: input.apiId,
    marketDate: input.marketDate,
    sha256: input.sha256,
  });
  const duplicate = existing !== null;
  let objectPath = existing?.objectPath ?? null;

  if (!duplicate && input.rawPayload !== null) {
    objectPath = `${input.source}/${input.apiId}/${input.observationKey}.json`;
    await repository.uploadRawSnapshot(objectPath, input.rawPayload);
  }

  const inserted = await repository.insertSnapshot({
    ...input,
    status: duplicate ? "duplicate_observation" : input.status,
    duplicateOfSnapshotId: existing?.id ?? null,
    objectPath,
  });

  return { snapshotId: inserted.id, duplicate };
}

function toEtfDailyRow(row: KrxEtfRow, sourceSnapshotId: string): EtfDailyRow {
  const raw = row.raw;
  return {
    basDd: toSqlDate(row.basDd),
    isuCd: row.isuCd,
    isuNm: row.isuNm,
    openPrc: parseOptionalNumber("TDD_OPNPRC", raw.TDD_OPNPRC),
    highPrc: parseOptionalNumber("TDD_HGPRC", raw.TDD_HGPRC),
    lowPrc: parseOptionalNumber("TDD_LWPRC", raw.TDD_LWPRC),
    closePrc: row.closePrc,
    flucRt: parseOptionalNumber("FLUC_RT", raw.FLUC_RT),
    nav: row.nav,
    accTrdvol: row.accTrdvol,
    accTrdval: row.accTrdval,
    mktcap: parseOptionalNumber("MKTCAP", raw.MKTCAP),
    netAsset: parseOptionalNumber("INVSTASST_NETASST_TOTAMT", raw.INVSTASST_NETASST_TOTAMT),
    listShrs: parseOptionalNumber("LIST_SHRS", raw.LIST_SHRS),
    idxNm: nullIfEmpty(raw.IDX_IND_NM),
    idxClose: parseOptionalNumber("OBJ_STKPRC_IDX", raw.OBJ_STKPRC_IDX),
    idxFlucRt: parseOptionalNumber("FLUC_RT_IDX", raw.FLUC_RT_IDX),
    sourceSnapshotId,
  };
}

function parseOptionalNumber(field: string, value: string | undefined): number | null {
  if (!value?.trim() || value.trim() === "-") {
    return null;
  }

  try {
    return parseKrxNumber(field, value);
  } catch {
    return null;
  }
}

function toSqlDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function nullIfEmpty(value: string | undefined): string | null {
  return value?.trim() || null;
}

export class SupabaseMarketDataRepository implements MarketDataRepository {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async findSnapshotByContent(input: {
    source: "krx" | "kiwoom";
    apiId: "etf_bydd_trd" | "ka10099";
    marketDate: string | null;
    sha256: string;
  }): Promise<SourceSnapshotRecord | null> {
    let query = this.client
      .from("source_snapshot")
      .select("id,object_path")
      .eq("market", "KR")
      .eq("source", input.source)
      .eq("api_id", input.apiId)
      .eq("sha256", input.sha256)
      .neq("status", "duplicate_observation")
      .limit(1);
    query = input.marketDate === null ? query.is("market_date", null) : query.eq("market_date", input.marketDate);
    const { data, error } = await query.maybeSingle();
    throwIfError(error, "find source snapshot");
    return data ? { id: data.id, objectPath: data.object_path } : null;
  }

  async insertSnapshot(input: SnapshotInsertInput): Promise<SourceSnapshotRecord> {
    const { data, error } = await this.client
      .from("source_snapshot")
      .upsert(
        {
          observation_key: input.observationKey,
          market: "KR",
          source: input.source,
          api_id: input.apiId,
          requested_asof: input.requestedAsOf,
          market_date: input.marketDate,
          asof_at: null,
          status: input.status,
          http_status: null,
          return_code: null,
          row_count: input.rowCount,
          unique_key_count: input.uniqueKeyCount,
          page_count: input.pageCount,
          sha256: input.sha256,
          duplicate_of_snapshot_id: input.duplicateOfSnapshotId,
          transform_version: MARKET_DATA_TRANSFORM_VERSION,
          object_path: input.objectPath,
          error_code: input.errorCode ?? null,
          error_message: input.errorMessage ?? null,
        },
        { onConflict: "observation_key" },
      )
      .select("id,object_path")
      .single();
    throwIfError(error, "insert source snapshot");
    if (!data) {
      throw new Error("Supabase insert source snapshot returned no row");
    }
    return { id: data.id, objectPath: data.object_path };
  }

  async uploadRawSnapshot(path: string, payload: string): Promise<void> {
    const { error } = await this.client.storage
      .from(SOURCE_SNAPSHOT_BUCKET)
      .upload(path, payload, { contentType: "application/json", upsert: false });
    throwIfError(error, "upload private source snapshot");
  }

  async getLatestCompleteRowCount(): Promise<number | null> {
    const { data, error } = await this.client
      .from("source_snapshot")
      .select("row_count")
      .eq("market", "KR")
      .eq("source", "krx")
      .eq("api_id", "etf_bydd_trd")
      .eq("status", "TRADING_COMPLETE")
      .order("market_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(error, "read previous KRX row count");
    return data?.row_count ?? null;
  }

  async getCompleteTradingDayCount(): Promise<number> {
    const { count, error } = await this.client
      .from("trading_calendar_kr")
      .select("*", { count: "exact", head: true })
      .eq("status", "TRADING_COMPLETE");
    throwIfError(error, "count complete KRX trading days");
    return count ?? 0;
  }

  async getNextTradingSequence(): Promise<number> {
    const { data, error } = await this.client
      .from("trading_calendar_kr")
      .select("seq")
      .not("seq", "is", null)
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(error, "read KRX trading sequence");
    return (data?.seq ?? 0) + 1;
  }

  async getTradingSequence(basDd: string): Promise<number | null> {
    const { data, error } = await this.client
      .from("trading_calendar_kr")
      .select("seq")
      .eq("bas_dd", basDd)
      .maybeSingle();
    throwIfError(error, "read existing KRX trading sequence");
    return data?.seq ?? null;
  }

  async upsertTradingCalendar(input: {
    basDd: string;
    seq: number | null;
    status: KrxSnapshotStatus;
    sourceSnapshotId: string;
  }): Promise<void> {
    const { error } = await this.client.from("trading_calendar_kr").upsert(
      {
        bas_dd: input.basDd,
        seq: input.seq,
        status: input.status,
        source_snapshot_id: input.sourceSnapshotId,
      },
      { onConflict: "bas_dd" },
    );
    throwIfError(error, "upsert KRX trading calendar");
    if (input.status === "TRADING_COMPLETE") {
      await this.resequenceCompleteTradingDays();
    }
  }

  private async resequenceCompleteTradingDays(): Promise<void> {
    const { data, error } = await this.client
      .from("trading_calendar_kr")
      .select("bas_dd")
      .eq("status", "TRADING_COMPLETE");
    throwIfError(error, "read complete KRX trading days for resequencing");
    const updates = createKrxTradingSequenceUpdates(
      (data ?? []).map((row) => ({ basDd: row.bas_dd })),
    );

    for (const update of updates) {
      const { error: temporaryError } = await this.client
        .from("trading_calendar_kr")
        .update({ seq: -1_000_000 - update.seq })
        .eq("bas_dd", update.basDd);
      throwIfError(temporaryError, "temporarily resequence KRX trading day");
    }
    for (const update of updates) {
      const { error: sequenceError } = await this.client
        .from("trading_calendar_kr")
        .update({ seq: update.seq })
        .eq("bas_dd", update.basDd);
      throwIfError(sequenceError, "resequence KRX trading day");
    }
  }

  async upsertEtfDaily(rows: readonly EtfDailyRow[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await this.client.from("etf_daily_kr").upsert(
      rows.map((row) => ({
        bas_dd: row.basDd,
        isu_cd: row.isuCd,
        isu_nm: row.isuNm,
        open_prc: row.openPrc,
        high_prc: row.highPrc,
        low_prc: row.lowPrc,
        close_prc: row.closePrc,
        fluc_rt: row.flucRt,
        nav: row.nav,
        acc_trdvol: row.accTrdvol,
        acc_trdval: row.accTrdval,
        mktcap: row.mktcap,
        net_asset: row.netAsset,
        list_shrs: row.listShrs,
        idx_nm: row.idxNm,
        idx_close: row.idxClose,
        idx_fluc_rt: row.idxFlucRt,
        quality: "ok",
        source_snapshot_id: row.sourceSnapshotId,
      })),
      { onConflict: "bas_dd,isu_cd" },
    );
    throwIfError(error, "upsert KRX ETF daily rows");
  }

  async getExistingMasters(): Promise<ExistingMaster[]> {
    const { data, error } = await this.client.from("etf_master_kr").select("code,first_seen");
    throwIfError(error, "read existing ETF masters");
    return (data ?? []).map((row) => ({ code: row.code, firstSeen: row.first_seen }));
  }

  async upsertEtfMasters(rows: readonly EtfMasterRow[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await this.client.from("etf_master_kr").upsert(
      rows.map((row) => ({
        code: row.code,
        name: row.name,
        reg_day: row.regDay,
        market_code: row.marketCode,
        market_name: row.marketName,
        state: row.state,
        first_seen: row.firstSeen,
        last_seen: row.lastSeen,
        source_snapshot_id: row.sourceSnapshotId,
      })),
      { onConflict: "code" },
    );
    throwIfError(error, "upsert ETF masters");
  }

  async upsertListingEvents(rows: readonly ListingEventRow[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await this.client.from("listing_event_kr").upsert(
      rows.map((row) => ({
        event_key: row.eventKey,
        code: row.code,
        reg_day: row.regDay,
        first_seen: row.firstSeen,
        new_in_snapshot: row.newInSnapshot,
        source_snapshot_id: row.sourceSnapshotId,
      })),
      { onConflict: "event_key", ignoreDuplicates: true },
    );
    throwIfError(error, "upsert listing events");
  }
}

function throwIfError(error: { message: string } | null, operation: string): void {
  if (error) {
    throw new Error(`Supabase ${operation} failed: ${error.message}`);
  }
}
