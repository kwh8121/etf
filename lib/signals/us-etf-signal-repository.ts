import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  US_ETF_P1_DISCLOSURE,
  type UsEtfMoverSignals,
} from "./us-etf-movers.ts";

const SOURCE_SNAPSHOT_BUCKET = "market-data-source-snapshots";
const STRATEGY_VERSION = "m5-us-etf-movers-p1-v1";
const TRANSFORM_VERSION = "m5-2026-09-21";

export interface UsEtfMoverRepository {
  findSnapshotByContent(input: {
    sha256: string;
  }): Promise<{ id: string; objectPath: string | null; asofAt: string } | null>;
  findSignalRunBySnapshot(
    snapshotId: string,
  ): Promise<{ id: string; status: string } | null>;
  uploadRawSnapshot(path: string, payload: string): Promise<void>;
  insertSnapshot(
    input: Record<string, unknown>,
  ): Promise<{ id: string; objectPath: string | null }>;
  upsertSignalRun(input: Record<string, unknown>): Promise<void>;
  upsertSignalRows(rows: readonly Record<string, unknown>[]): Promise<void>;
}

export async function persistUsEtfMoverSnapshot(
  repository: UsEtfMoverRepository,
  input: {
    observationKey: string;
    observedAt: string;
    rawPayload: Record<string, unknown>;
    pageCount: number;
    signals: UsEtfMoverSignals;
  },
): Promise<{ snapshotId: string; runId: string | null; duplicate: boolean }> {
  const rawPayload = JSON.stringify(input.rawPayload);
  const sha256 = createHash("sha256").update(rawPayload).digest("hex");
  const existing = await repository.findSnapshotByContent({ sha256 });
  const existingRun = existing
    ? await repository.findSignalRunBySnapshot(existing.id)
    : null;
  const duplicate = existingRun?.status === "COMPLETED";
  const objectPath =
    existing?.objectPath ?? `kiwoom/us_etf_movers/${input.observationKey}.json`;
  if (!existing) await repository.uploadRawSnapshot(objectPath, rawPayload);
  const inserted =
    existing && !duplicate
      ? existing
      : await repository.insertSnapshot({
          observationKey: input.observationKey,
          market: "US",
          source: "kiwoom",
          apiId: "us_etf_movers",
          requestedAsof: null,
          marketDate: null,
          asofAt: input.observedAt,
          status: duplicate ? "duplicate_observation" : "COMPLETE",
          rowCount: countRawRows(input.rawPayload),
          uniqueKeyCount: uniqueSignalCodeCount(input.signals),
          pageCount: input.pageCount,
          sha256,
          duplicateOfSnapshotId: existing?.id ?? null,
          objectPath,
        });
  if (duplicate)
    return { snapshotId: inserted.id, runId: null, duplicate: true };

  const observedAt = existing?.asofAt ?? input.observedAt;
  const runId = existingRun?.id ?? deterministicRunId(inserted.id, observedAt);
  const run = {
    id: runId,
    market: "US",
    basDd: null,
    marketDate: null,
    asofAt: observedAt,
    strategyVersion: STRATEGY_VERSION,
    transformVersion: TRANSFORM_VERSION,
    inputSnapshotIds: [inserted.id],
    notes: {
      disclosure: US_ETF_P1_DISCLOSURE,
      source_api_ids: ["usa10104", "usa20911", "usa20511", "usa20931"],
    },
  };
  await repository.upsertSignalRun({
    ...run,
    status: "PENDING",
    completedAt: null,
  });
  await repository.upsertSignalRows(
    toSignalRows(runId, inserted.id, observedAt, input.signals),
  );
  await repository.upsertSignalRun({
    ...run,
    status: "COMPLETED",
    completedAt: new Date().toISOString(),
  });
  return { snapshotId: inserted.id, runId, duplicate: false };
}

export class SupabaseUsEtfMoverRepository implements UsEtfMoverRepository {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async findSnapshotByContent(input: { sha256: string }) {
    const { data, error } = await this.client
      .from("source_snapshot")
      .select("id,object_path,asof_at")
      .eq("market", "US")
      .eq("source", "kiwoom")
      .eq("api_id", "us_etf_movers")
      .eq("sha256", input.sha256)
      .neq("status", "duplicate_observation")
      .is("market_date", null)
      .limit(1)
      .maybeSingle();
    throwIfError(error, "find US source snapshot");
    if (!data) return null;
    if (!data.asof_at) throw new Error("US source snapshot has no asof_at");
    return { id: data.id, objectPath: data.object_path, asofAt: data.asof_at };
  }

  async findSignalRunBySnapshot(snapshotId: string) {
    const { data, error } = await this.client
      .from("signal_run")
      .select("id,status")
      .eq("market", "US")
      .eq("strategy_version", STRATEGY_VERSION)
      .contains("input_snapshot_ids", [snapshotId])
      .limit(1)
      .maybeSingle();
    throwIfError(error, "find US signal run");
    return data ?? null;
  }

  async uploadRawSnapshot(path: string, payload: string) {
    const { error } = await this.client.storage
      .from(SOURCE_SNAPSHOT_BUCKET)
      .upload(path, payload, {
        contentType: "application/json",
        upsert: false,
      });
    throwIfError(error, "upload US source snapshot");
  }

  async insertSnapshot(input: Record<string, unknown>) {
    const { data, error } = await this.client
      .from("source_snapshot")
      .upsert(
        {
          observation_key: input.observationKey,
          market: input.market,
          source: input.source,
          api_id: input.apiId,
          requested_asof: input.requestedAsof,
          market_date: input.marketDate,
          asof_at: input.asofAt,
          status: input.status,
          row_count: input.rowCount,
          unique_key_count: input.uniqueKeyCount,
          page_count: input.pageCount,
          sha256: input.sha256,
          duplicate_of_snapshot_id: input.duplicateOfSnapshotId,
          transform_version: TRANSFORM_VERSION,
          object_path: input.objectPath,
        },
        { onConflict: "observation_key" },
      )
      .select("id,object_path")
      .single();
    throwIfError(error, "insert US source snapshot");
    if (!data)
      throw new Error("Supabase insert US source snapshot returned no row");
    return { id: data.id, objectPath: data.object_path };
  }

  async upsertSignalRun(input: Record<string, unknown>) {
    const { error } = await this.client.from("signal_run").upsert(
      {
        id: input.id,
        market: input.market,
        bas_dd: input.basDd,
        market_date: input.marketDate,
        asof_at: input.asofAt,
        strategy_version: input.strategyVersion,
        transform_version: input.transformVersion,
        status: input.status,
        input_snapshot_ids: input.inputSnapshotIds,
        completed_at: input.completedAt,
        notes: input.notes,
      },
      { onConflict: "id" },
    );
    throwIfError(error, "upsert US signal run");
  }

  async upsertSignalRows(rows: readonly Record<string, unknown>[]) {
    if (rows.length === 0) return;
    const { error } = await this.client.from("signal_daily").upsert(
      rows.map((row) => ({
        run_id: row.runId,
        market: row.market,
        bas_dd: row.basDd,
        market_date: row.marketDate,
        observed_at: row.observedAt,
        asof_at: row.asofAt,
        signal_type: row.signalType,
        code: row.code,
        name: row.name,
        screen: row.screen,
        rank: row.rank,
        value: row.value,
        value_unit: row.valueUnit,
        liquidity_value: null,
        is_experimental: row.isExperimental,
        source_snapshot_id: row.sourceSnapshotId,
        meta: row.meta,
      })),
      { onConflict: "run_id,market,signal_type,screen,code" },
    );
    throwIfError(error, "upsert US signals");
  }
}

function toSignalRows(
  runId: string,
  sourceSnapshotId: string,
  observedAt: string,
  signals: UsEtfMoverSignals,
): Record<string, unknown>[] {
  const groups: Array<[string, typeof signals.dailyGainers]> = [
    ["daily_price_gain", signals.dailyGainers],
    ["daily_price_loss", signals.dailyLosers],
    ["five_day_price_gain", signals.fiveDayGainers],
    ["five_day_price_loss", signals.fiveDayLosers],
  ];
  return groups.flatMap(([signalType, rows]) =>
    rows.map((row) => ({
      runId,
      market: "US",
      basDd: null,
      marketDate: null,
      observedAt,
      asofAt: observedAt,
      signalType,
      code: row.code,
      name: row.name,
      screen: "raw",
      rank: row.rank,
      value: row.value,
      valueUnit: "percent",
      isExperimental: true,
      sourceSnapshotId,
      meta: { ...row.meta, disclosure: US_ETF_P1_DISCLOSURE },
    })),
  );
}
function deterministicRunId(snapshotId: string, observedAt: string): string {
  const hex = createHash("sha256")
    .update(`US|${STRATEGY_VERSION}|${snapshotId}|${observedAt}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function countRawRows(payload: Record<string, unknown>): number {
  return Object.values(payload).reduce<number>((total, value) => {
    if (!isRecord(value) || !Array.isArray(value.pages)) return total;
    return (
      total +
      value.pages.reduce(
        (count, page) => count + (Array.isArray(page) ? page.length : 0),
        0,
      )
    );
  }, 0);
}
function uniqueSignalCodeCount(signals: UsEtfMoverSignals): number {
  return new Set(
    [
      ...signals.dailyGainers,
      ...signals.dailyLosers,
      ...signals.fiveDayGainers,
      ...signals.fiveDayLosers,
    ].map((row) => row.code),
  ).size;
}
function throwIfError(error: { message: string } | null, operation: string) {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message}`);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
