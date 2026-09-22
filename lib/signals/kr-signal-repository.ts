import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { KrxPriceMoverSignals, RankedKrxSignal } from "./kr-price-movers";

export const KR_PRICE_SIGNAL_STRATEGY_VERSION = "m3-price-movers-v1";

export interface PersistKrxPriceSignalsInput {
  basDd: string;
  sourceSnapshotId: string;
  additionalSnapshotIds?: readonly string[];
  signals: KrxPriceMoverSignals;
  transformVersion: string;
}

export interface PersistKrxSignalRowsInput {
  runId: string;
  basDd: string;
  sourceSnapshotId: string;
  signalType: string;
  signals: readonly RankedKrxSignal[];
  valueUnit: string;
  metaByCode?: ReadonlyMap<string, Record<string, unknown>>;
}

export function createDeterministicSignalRunId(input: {
  basDd: string;
  sourceSnapshotId: string;
  transformVersion: string;
}): string {
  const hex = createHash("sha256")
    .update(
      `KR|${KR_PRICE_SIGNAL_STRATEGY_VERSION}|${input.transformVersion}|${input.basDd}|${input.sourceSnapshotId}`,
    )
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function persistKrxPriceSignals(
  client: SupabaseClient,
  input: PersistKrxPriceSignalsInput,
): Promise<string> {
  const runId = createDeterministicSignalRunId(input);
  const run = {
    id: runId,
    market: "KR",
    bas_dd: input.basDd,
    market_date: input.basDd,
    strategy_version: KR_PRICE_SIGNAL_STRATEGY_VERSION,
    transform_version: input.transformVersion,
    input_snapshot_ids: [
      ...new Set([
        input.sourceSnapshotId,
        ...(input.additionalSnapshotIds ?? []),
      ]),
    ],
    notes: { five_day_disclosure: input.signals.disclosure },
  };
  const { error: runError } = await client
    .from("signal_run")
    .upsert(
      { ...run, status: "PENDING", completed_at: null },
      { onConflict: "id" },
    );
  throwIfError(runError, "upsert signal run");

  await Promise.all([
    persistKrxSignalRows(client, {
      runId,
      basDd: input.basDd,
      sourceSnapshotId: input.sourceSnapshotId,
      signalType: "daily_price_gain",
      signals: input.signals.dailyGainers,
      valueUnit: "percent",
    }),
    persistKrxSignalRows(client, {
      runId,
      basDd: input.basDd,
      sourceSnapshotId: input.sourceSnapshotId,
      signalType: "daily_price_loss",
      signals: input.signals.dailyLosers,
      valueUnit: "percent",
    }),
    persistKrxSignalRows(client, {
      runId,
      basDd: input.basDd,
      sourceSnapshotId: input.sourceSnapshotId,
      signalType: "five_day_price_gain",
      signals: input.signals.fiveDayGainers,
      valueUnit: "percent",
      metaByCode: new Map(
        input.signals.fiveDayGainers.map((signal) => [
          signal.code,
          { disclosure: input.signals.disclosure },
        ]),
      ),
    }),
    persistKrxSignalRows(client, {
      runId,
      basDd: input.basDd,
      sourceSnapshotId: input.sourceSnapshotId,
      signalType: "five_day_price_loss",
      signals: input.signals.fiveDayLosers,
      valueUnit: "percent",
      metaByCode: new Map(
        input.signals.fiveDayLosers.map((signal) => [
          signal.code,
          { disclosure: input.signals.disclosure },
        ]),
      ),
    }),
  ]);

  const { error: completeError } = await client
    .from("signal_run")
    .upsert(
      { ...run, status: "COMPLETED", completed_at: new Date().toISOString() },
      { onConflict: "id" },
    );
  throwIfError(completeError, "complete signal run");

  return runId;
}

export async function persistKrxSignalRows(
  client: SupabaseClient,
  input: PersistKrxSignalRowsInput,
): Promise<void> {
  if (input.signals.length === 0) return;
  const { error } = await client
    .from("signal_daily")
    .upsert(toSignalRows(input), {
      onConflict: "run_id,market,signal_type,screen,code",
    });
  throwIfError(error, `upsert ${input.signalType} signals`);
}

function toSignalRows(input: PersistKrxSignalRowsInput) {
  const observedAt = new Date().toISOString();
  return input.signals.map((signal) => ({
    run_id: input.runId,
    market: "KR",
    bas_dd: input.basDd,
    market_date: input.basDd,
    observed_at: observedAt,
    signal_type: input.signalType,
    code: signal.code,
    name: signal.name,
    screen: signal.screen,
    rank: signal.rank,
    value: signal.value,
    value_unit: input.valueUnit,
    liquidity_value: null,
    source_snapshot_id: input.sourceSnapshotId,
    meta: input.metaByCode?.get(signal.code) ?? {},
  }));
}

function throwIfError(
  error: { message: string } | null,
  operation: string,
): void {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message}`);
}
