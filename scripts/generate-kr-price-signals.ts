import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertValidKrxRequestDate } from "../lib/market-data/krx-date.ts";
import { MARKET_DATA_TRANSFORM_VERSION } from "../lib/market-data/repository.ts";
import {
  createKrxPriceMoverSignals,
  type KrxSignalInputRow,
} from "../lib/signals/kr-price-movers.ts";
import {
  createKrxNewListingSignals,
  type KrxListingEventInput,
} from "../lib/signals/kr-new-listings.ts";
import {
  persistKrxPriceSignals,
  persistKrxSignalRows,
  readTelegramReportedAt,
} from "../lib/signals/kr-signal-repository.ts";
import { createKrxTurnoverSurges } from "../lib/signals/kr-turnover-surge.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";

interface TradingCalendarRow {
  bas_dd: string;
  seq: number;
  source_snapshot_id: string | null;
}

interface EtfDailyDatabaseRow {
  isu_cd: string;
  isu_nm: string;
  close_prc: number | string;
  fluc_rt: number | string | null;
  acc_trdval: number | string;
  acc_trdvol: number | string;
}

interface ListingEventDatabaseRow {
  event_key: string;
  code: string;
  reg_day: string | null;
  first_seen: string;
  new_in_snapshot: boolean;
  first_alerted_at: string | null;
  source_snapshot_id: string | null;
}

export async function generateKrxPriceSignals(requestedDate?: string): Promise<{
  basDd: string;
  runId: string;
  signalCount: number;
}> {
  const client = createServiceRoleClient();
  if (requestedDate) assertValidKrxRequestDate(requestedDate);
  let calendarQuery = client
    .from("trading_calendar_kr")
    .select("bas_dd,seq,source_snapshot_id")
    .eq("status", "TRADING_COMPLETE")
    .not("seq", "is", null);
  calendarQuery = requestedDate
    ? calendarQuery.eq(
        "bas_dd",
        `${requestedDate.slice(0, 4)}-${requestedDate.slice(4, 6)}-${requestedDate.slice(6, 8)}`,
      )
    : calendarQuery.order("seq", { ascending: false }).limit(1);
  const { data: currentCalendar, error: calendarError } =
    await calendarQuery.single();
  throwIfError(calendarError, "read latest complete trading day");
  if (!currentCalendar?.source_snapshot_id) {
    throw new Error("Latest complete trading day has no source snapshot");
  }

  const current = currentCalendar as TradingCalendarRow;
  const sourceSnapshotId = currentCalendar.source_snapshot_id;
  const fiveDayStartSeq = current.seq - 5;
  const turnoverStartSeq = current.seq - 20;
  const { data: window, error: windowError } = await client
    .from("trading_calendar_kr")
    .select("bas_dd,seq,source_snapshot_id")
    .eq("status", "TRADING_COMPLETE")
    .gte("seq", turnoverStartSeq)
    .lte("seq", current.seq)
    .order("seq", { ascending: true });
  throwIfError(windowError, "read five-day trading window");

  const start = (window ?? []).find((row) => row.seq === fiveDayStartSeq) as
    | TradingCalendarRow
    | undefined;
  const currentRows = await readEtfDailyRows(client, current.bas_dd);
  const startRows = start ? await readEtfDailyRows(client, start.bas_dd) : [];
  const signals = createKrxPriceMoverSignals(currentRows, {
    currentRows,
    startRows,
    currentSeq: current.seq,
    startSeq: fiveDayStartSeq,
    availableSeqs: (window ?? []).map((row) => row.seq),
  });
  const newListings = await readNewListingSignals(client, current.bas_dd);
  const runId = await persistKrxPriceSignals(client, {
    basDd: current.bas_dd,
    sourceSnapshotId,
    additionalSnapshotIds: newListings.sourceSnapshotIds,
    signals,
    transformVersion: MARKET_DATA_TRANSFORM_VERSION,
  });
  const priorDates = (window ?? [])
    .filter((row) => row.seq < current.seq)
    .map((row) => row.bas_dd);
  const priorRows = await readEtfDailyRowsForDates(client, priorDates);
  const turnover = createKrxTurnoverSurges(
    currentRows,
    groupTurnoverRowsByCode(priorRows),
  );
  await persistKrxSignalRows(client, {
    runId,
    basDd: current.bas_dd,
    sourceSnapshotId,
    signalType: "turnover_surge",
    signals: turnover.signals,
    valueUnit: "ratio",
    metaByCode: new Map(
      turnover.signals.map((signal) => [
        signal.code,
        { prior_20_day_average_krw: turnover.averageByCode.get(signal.code) },
      ]),
    ),
  });
  await persistKrxSignalRows(client, {
    runId,
    basDd: current.bas_dd,
    sourceSnapshotId,
    signalType: "new_listing",
    signals: newListings.signals,
    valueUnit: "event",
    metaByCode: newListings.metaByCode,
  });
  const reportedAt = await readTelegramReportedAt(client, runId);
  const { error: finishError } = await client.from("signal_run")
    .update({
      notes: {
        five_day_disclosure: signals.disclosure,
        kr_full_signal_complete: true,
        ...(reportedAt ? { telegram_reported_at: reportedAt } : {}),
      },
    })
    .eq("id", runId);
  throwIfError(finishError, "mark complete KR signal rows");

  return {
    basDd: current.bas_dd,
    runId,
    signalCount:
      signals.dailyGainers.length +
      signals.dailyLosers.length +
      signals.fiveDayGainers.length +
      signals.fiveDayLosers.length +
      turnover.signals.length +
      newListings.signals.length,
  };
}

async function readEtfDailyRows(
  client: ReturnType<typeof createServiceRoleClient>,
  basDd: string,
) {
  const { data, error } = await client
    .from("etf_daily_kr")
    .select("isu_cd,isu_nm,close_prc,fluc_rt,acc_trdval,acc_trdvol")
    .eq("bas_dd", basDd);
  throwIfError(error, `read ETF daily rows for ${basDd}`);
  return (data ?? []).map(toSignalInputRow);
}

async function readEtfDailyRowsForDates(
  client: ReturnType<typeof createServiceRoleClient>,
  basDds: string[],
) {
  if (basDds.length === 0) return [];
  const { data, error } = await client
    .from("etf_daily_kr")
    .select("isu_cd,isu_nm,close_prc,fluc_rt,acc_trdval,acc_trdvol")
    .in("bas_dd", basDds);
  throwIfError(error, "read prior ETF daily rows");
  return (data ?? []).map(toSignalInputRow);
}

function groupTurnoverRowsByCode(
  rows: readonly KrxSignalInputRow[],
): Map<string, number[]> {
  const valuesByCode = new Map<string, number[]>();
  for (const row of rows) {
    const values = valuesByCode.get(row.code) ?? [];
    values.push(row.accTrdval);
    valuesByCode.set(row.code, values);
  }
  return valuesByCode;
}

async function readNewListingSignals(
  client: ReturnType<typeof createServiceRoleClient>,
  basDd: string,
) {
  const { data: events, error: eventError } = await client
    .from("listing_event_kr")
    .select(
      "event_key,code,reg_day,first_seen,new_in_snapshot,first_alerted_at,source_snapshot_id",
    )
    .eq("new_in_snapshot", true)
    .lte("first_seen", basDd)
    .is("first_alerted_at", null);
  throwIfError(eventError, "read unalerted new listing events");
  if (!events?.length) return createKrxNewListingSignals([]);

  const codes = events.map((event) => event.code);
  const { data: masters, error: masterError } = await client
    .from("etf_master_kr")
    .select("code,name")
    .in("code", codes);
  throwIfError(masterError, "read new listing master names");
  const names = new Map(
    (masters ?? []).map((master) => [master.code, master.name]),
  );
  return createKrxNewListingSignals(
    (events as ListingEventDatabaseRow[]).flatMap((event) => {
      const name = names.get(event.code);
      return name
        ? [
            {
              eventKey: event.event_key,
              code: event.code,
              name,
              regDay: event.reg_day,
              firstSeen: event.first_seen,
              newInSnapshot: event.new_in_snapshot,
              firstAlertedAt: event.first_alerted_at,
              sourceSnapshotId: event.source_snapshot_id,
            } satisfies KrxListingEventInput,
          ]
        : [];
    }),
  );
}

function toSignalInputRow(row: EtfDailyDatabaseRow): KrxSignalInputRow {
  return {
    code: row.isu_cd,
    name: row.isu_nm,
    closePrc: Number(row.close_prc),
    flucRt: row.fluc_rt === null ? null : Number(row.fluc_rt),
    accTrdval: Number(row.acc_trdval),
    accTrdvol: Number(row.acc_trdvol),
  };
}

function throwIfError(
  error: { message: string } | null,
  operation: string,
): void {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message}`);
}

async function main(): Promise<void> {
  const result = await generateKrxPriceSignals();
  console.log(JSON.stringify(result));
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown price signal generation failure";
    console.error(`KR price signal generation failed: ${message}`);
    process.exitCode = 1;
  });
}
