import type { SupabaseClient } from "@supabase/supabase-js";

import { readAllRows } from "../supabase/read-all-rows.ts";

const SOURCE_SNAPSHOT_BUCKET = "market-data-source-snapshots";

export interface SignalRunAuditRow {
  id: string;
  market: "KR" | "US";
  bas_dd: string | null;
  market_date: string | null;
  asof_at: string | null;
  status: string;
  strategy_version: string;
  transform_version: string;
  input_snapshot_ids: string[] | null;
  notes: Record<string, unknown> | null;
}

export interface AccuracySignalRow {
  run_id: string;
  market: "KR" | "US";
  signal_type: string;
  screen: string;
  code: string;
  name: string;
  rank: number;
  value: number | string | null;
  value_unit: string;
  meta: Record<string, unknown>;
  source_snapshot_id: string | null;
}

export interface SourceSnapshotAuditRow {
  id: string;
  market: string;
  api_id: string;
  market_date: string | null;
  asof_at: string | null;
  observed_at?: string | null;
  row_count: number | null;
  unique_key_count: number | null;
  page_count: number | null;
  sha256: string | null;
  object_path: string | null;
  duplicate_of_snapshot_id: string | null;
  status: string;
}

export interface TradingCalendarAuditRow {
  bas_dd: string;
  seq: number;
  status: string;
  source_snapshot_id: string | null;
}

export interface EtfDailyAuditRow {
  bas_dd: string;
  isu_cd: string;
  isu_nm: string;
  close_prc: number | string;
  fluc_rt: number | string | null;
  acc_trdval: number | string;
  acc_trdvol: number | string;
  source_snapshot_id: string | null;
}

export interface ListingEventAuditRow {
  event_key: string;
  code: string;
  reg_day: string | null;
  first_seen: string;
  new_in_snapshot: boolean;
  first_alerted_at: string | null;
  source_snapshot_id: string | null;
}

export interface EtfMasterAuditRow {
  code: string;
  name: string;
  reg_day?: string | null;
  first_seen?: string;
  last_seen?: string;
  source_snapshot_id?: string | null;
}

export interface DataAccuracyStore {
  readSignalRun(runId: string): Promise<SignalRunAuditRow | null>;
  readSignalRows(runId: string): Promise<AccuracySignalRow[]>;
  readSourceSnapshots(ids: readonly string[]): Promise<SourceSnapshotAuditRow[]>;
  downloadSourceSnapshot(objectPath: string): Promise<Uint8Array>;
  readKrTradingWindow(basDd: string): Promise<TradingCalendarAuditRow[]>;
  readKrDailyRows(basDd: string): Promise<EtfDailyAuditRow[]>;
  readKrListingEvents(basDd: string): Promise<ListingEventAuditRow[]>;
  readKrMasters(codes: readonly string[]): Promise<EtfMasterAuditRow[]>;
  readKrListingHistory?(): Promise<ListingEventAuditRow[]>;
  readKrMasterHistory?(): Promise<EtfMasterAuditRow[]>;
  readKrMasterSourceSnapshots?(): Promise<SourceSnapshotAuditRow[]>;
}

export class SupabaseDataAccuracyStore implements DataAccuracyStore {
  constructor(private readonly client: SupabaseClient) {}

  async readSignalRun(runId: string): Promise<SignalRunAuditRow | null> {
    const { data, error } = await this.client
      .from("signal_run")
      .select(
        "id,market,bas_dd,market_date,asof_at,status,strategy_version,transform_version,input_snapshot_ids,notes",
      )
      .eq("id", runId)
      .maybeSingle();
    throwIfError(error, "read signal run");
    return data as SignalRunAuditRow | null;
  }

  async readSignalRows(runId: string): Promise<AccuracySignalRow[]> {
    return readAllRows<AccuracySignalRow>({
      operation: `read signal rows for ${runId}`,
      createQuery: () =>
        this.client
          .from("signal_daily")
          .select(
            "run_id,market,signal_type,screen,code,name,rank,value,value_unit,meta,source_snapshot_id",
            { count: "exact" },
          )
          .eq("run_id", runId),
      orderBy: [
        { column: "signal_type", ascending: true },
        { column: "screen", ascending: true },
        { column: "code", ascending: true },
      ],
      getKey: (row) => `${row.signal_type}:${row.screen}:${row.code}`,
    });
  }

  async readSourceSnapshots(ids: readonly string[]): Promise<SourceSnapshotAuditRow[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];
    return readAllRows<SourceSnapshotAuditRow>({
      operation: "read source snapshots",
      createQuery: () =>
        this.client
          .from("source_snapshot")
          .select(
            "id,market,api_id,market_date,asof_at,observed_at,row_count,unique_key_count,page_count,sha256,object_path,duplicate_of_snapshot_id,status",
            { count: "exact" },
          )
          .in("id", uniqueIds),
      orderBy: [{ column: "id", ascending: true }],
      getKey: (row) => row.id,
    });
  }

  async downloadSourceSnapshot(objectPath: string): Promise<Uint8Array> {
    const { data, error } = await this.client.storage
      .from(SOURCE_SNAPSHOT_BUCKET)
      .download(objectPath);
    throwIfError(error, "download source snapshot");
    if (!data) throw new Error("Supabase source snapshot download returned no data");
    return new Uint8Array(await data.arrayBuffer());
  }

  async readKrTradingWindow(basDd: string): Promise<TradingCalendarAuditRow[]> {
    const { data, error } = await this.client
      .from("trading_calendar_kr")
      .select("bas_dd,seq,status,source_snapshot_id")
      .eq("bas_dd", basDd)
      .single();
    throwIfError(error, "read KR current calendar row");
    const current = data as TradingCalendarAuditRow;
    return readAllRows<TradingCalendarAuditRow>({
      operation: "read KR trading replay window",
      createQuery: () =>
        this.client
          .from("trading_calendar_kr")
          .select("bas_dd,seq,status,source_snapshot_id", { count: "exact" })
          .eq("status", "TRADING_COMPLETE")
          .gte("seq", current.seq - 20)
          .lte("seq", current.seq),
      orderBy: [{ column: "seq", ascending: true }],
      getKey: (row) => row.bas_dd,
    });
  }

  async readKrDailyRows(basDd: string): Promise<EtfDailyAuditRow[]> {
    return readAllRows<EtfDailyAuditRow>({
      operation: `read KR daily rows for ${basDd}`,
      createQuery: () =>
        this.client
          .from("etf_daily_kr")
          .select(
            "bas_dd,isu_cd,isu_nm,close_prc,fluc_rt,acc_trdval,acc_trdvol,source_snapshot_id",
            { count: "exact" },
          )
          .eq("bas_dd", basDd),
      orderBy: [
        { column: "bas_dd", ascending: true },
        { column: "isu_cd", ascending: true },
      ],
      getKey: (row) => `${row.bas_dd}:${row.isu_cd}`,
    });
  }

  async readKrListingEvents(basDd: string): Promise<ListingEventAuditRow[]> {
    return readAllRows<ListingEventAuditRow>({
      operation: "read KR listing events",
      createQuery: () =>
        this.client
          .from("listing_event_kr")
          .select(
            "event_key,code,reg_day,first_seen,new_in_snapshot,first_alerted_at,source_snapshot_id",
            { count: "exact" },
          )
          .eq("new_in_snapshot", true)
          .lte("first_seen", basDd)
          .is("first_alerted_at", null),
      orderBy: [{ column: "event_key", ascending: true }],
      getKey: (row) => row.event_key,
    });
  }

  async readKrMasters(codes: readonly string[]): Promise<EtfMasterAuditRow[]> {
    const uniqueCodes = [...new Set(codes)];
    if (uniqueCodes.length === 0) return [];
    return readAllRows<EtfMasterAuditRow>({
      operation: "read KR ETF masters",
      createQuery: () =>
        this.client
          .from("etf_master_kr")
          .select("code,name", { count: "exact" })
          .in("code", uniqueCodes),
      orderBy: [{ column: "code", ascending: true }],
      getKey: (row) => row.code,
    });
  }

  async readKrListingHistory(): Promise<ListingEventAuditRow[]> {
    return readAllRows<ListingEventAuditRow>({
      operation: "read KR listing event history",
      createQuery: () =>
        this.client
          .from("listing_event_kr")
          .select(
            "event_key,code,reg_day,first_seen,new_in_snapshot,first_alerted_at,source_snapshot_id",
            { count: "exact" },
          ),
      orderBy: [{ column: "event_key", ascending: true }],
      getKey: (row) => row.event_key,
    });
  }

  async readKrMasterHistory(): Promise<EtfMasterAuditRow[]> {
    return readAllRows<EtfMasterAuditRow>({
      operation: "read KR master history",
      createQuery: () =>
        this.client
          .from("etf_master_kr")
          .select("code,name,reg_day,first_seen,last_seen,source_snapshot_id", {
            count: "exact",
          }),
      orderBy: [{ column: "code", ascending: true }],
      getKey: (row) => row.code,
    });
  }

  async readKrMasterSourceSnapshots(): Promise<SourceSnapshotAuditRow[]> {
    return readAllRows<SourceSnapshotAuditRow>({
      operation: "read KR master source snapshots",
      createQuery: () =>
        this.client
          .from("source_snapshot")
          .select(
            "id,market,api_id,market_date,asof_at,observed_at,row_count,unique_key_count,page_count,sha256,object_path,duplicate_of_snapshot_id,status",
            { count: "exact" },
          )
          .eq("market", "KR")
          .eq("api_id", "ka10099")
          .eq("status", "COMPLETE"),
      orderBy: [
        { column: "observed_at", ascending: true },
        { column: "id", ascending: true },
      ],
      getKey: (row) => row.id,
    });
  }
}

function throwIfError(
  error: { message: string } | null,
  operation: string,
): void {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message}`);
}
