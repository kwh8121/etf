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
  completeKrxSignalRun,
  persistKrxPriceSignals,
  persistKrxSignalRows,
} from "../lib/signals/kr-signal-repository.ts";
import { createKrxTurnoverSurges } from "../lib/signals/kr-turnover-surge.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";
import { readAllRows } from "../lib/supabase/read-all-rows.ts";

interface TradingCalendarRow {
  bas_dd: string;
  seq: number;
  source_snapshot_id: string | null;
}

interface EtfDailyDatabaseRow {
  bas_dd: string;
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

interface SourceSnapshotRow {
  id: string;
  row_count: number | null;
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
  const windowRows = (window ?? []) as TradingCalendarRow[];
  const snapshotRowCounts = await readSourceSnapshotRowCounts(
    client,
    windowRows.map((row) => requireSourceSnapshotId(row)),
  );
  const currentRows = await readEtfDailyRows(
    client,
    current.bas_dd,
    requireSnapshotRowCount(snapshotRowCounts, current),
  );
  const startRows = start
    ? await readEtfDailyRows(
        client,
        start.bas_dd,
        requireSnapshotRowCount(snapshotRowCounts, start),
      )
    : [];
  const signals = createKrxPriceMoverSignals(currentRows, {
    currentRows,
    startRows,
    currentSeq: current.seq,
    startSeq: fiveDayStartSeq,
    availableSeqs: (window ?? []).map((row) => row.seq),
  });
  const newListings = await readNewListingSignals(client, current.bas_dd);
  const priorCalendarRows = windowRows
    .filter((row) => row.seq < current.seq)
    .map((row) => ({
      row,
      expectedRowCount: requireSnapshotRowCount(snapshotRowCounts, row),
    }));
  const priorRows = (
    await Promise.all(
      priorCalendarRows.map(({ row, expectedRowCount }) =>
        readEtfDailyRows(client, row.bas_dd, expectedRowCount),
      ),
    )
  ).flat();
  const turnover = createKrxTurnoverSurges(
    currentRows,
    groupTurnoverRowsByCode(priorRows),
  );
  const inputSnapshotIds = [
    ...windowRows.map((row) => requireSourceSnapshotId(row)),
    ...newListings.sourceSnapshotIds,
  ];
  const runId = await persistKrxPriceSignals(client, {
    basDd: current.bas_dd,
    sourceSnapshotId,
    additionalSnapshotIds: inputSnapshotIds,
    signals,
    transformVersion: MARKET_DATA_TRANSFORM_VERSION,
    completeRun: false,
  });
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
  await completeKrxSignalRun(client, {
    runId,
    disclosure: signals.disclosure,
  });

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
  expectedRowCount: number,
) {
  const data = await readAllRows<EtfDailyDatabaseRow>({
    operation: `read ETF daily rows for ${basDd}`,
    createQuery: () =>
      client
        .from("etf_daily_kr")
        .select(
          "bas_dd,isu_cd,isu_nm,close_prc,fluc_rt,acc_trdval,acc_trdvol",
          { count: "exact" },
        )
        .eq("bas_dd", basDd),
    orderBy: [
      { column: "bas_dd", ascending: true },
      { column: "isu_cd", ascending: true },
    ],
    getKey: (row) => `${row.bas_dd}:${row.isu_cd}`,
  });
  if (data.length !== expectedRowCount) {
    throw new Error(
      `ETF daily rows for ${basDd} are incomplete: expected ${expectedRowCount} from source_snapshot.row_count, fetched ${data.length}`,
    );
  }
  return data.map(toSignalInputRow);
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
  const events = await readAllRows<ListingEventDatabaseRow>({
    operation: "read unalerted new listing events",
    createQuery: () =>
      client
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
  if (!events.length) return createKrxNewListingSignals([]);

  const codes = [...new Set(events.map((event) => event.code))];
  const masters = await readAllRows<{ code: string; name: string }>({
    operation: "read new listing master names",
    createQuery: () =>
      client
        .from("etf_master_kr")
        .select("code,name", { count: "exact" })
        .in("code", codes),
    orderBy: [{ column: "code", ascending: true }],
    getKey: (row) => row.code,
  });
  const names = new Map(
    masters.map((master) => [master.code, master.name]),
  );
  return createKrxNewListingSignals(
    events.flatMap((event) => {
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

async function readSourceSnapshotRowCounts(
  client: ReturnType<typeof createServiceRoleClient>,
  snapshotIds: readonly string[],
): Promise<ReadonlyMap<string, number>> {
  const uniqueSnapshotIds = [...new Set(snapshotIds)];
  if (uniqueSnapshotIds.length === 0) return new Map();
  const rows = await readAllRows<SourceSnapshotRow>({
    operation: "read source snapshot row counts",
    createQuery: () =>
      client
        .from("source_snapshot")
        .select("id,row_count", { count: "exact" })
        .in("id", uniqueSnapshotIds),
    orderBy: [{ column: "id", ascending: true }],
    getKey: (row) => row.id,
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (typeof row.row_count !== "number") {
      throw new Error(`Source snapshot ${row.id} has no row_count`);
    }
    counts.set(row.id, row.row_count);
  }
  for (const snapshotId of uniqueSnapshotIds) {
    if (!counts.has(snapshotId)) {
      throw new Error(`Missing source snapshot row_count for ${snapshotId}`);
    }
  }
  return counts;
}

function requireSourceSnapshotId(row: TradingCalendarRow): string {
  if (!row.source_snapshot_id) {
    throw new Error(`Trading day ${row.bas_dd} has no source snapshot`);
  }
  return row.source_snapshot_id;
}

function requireSnapshotRowCount(
  rowCounts: ReadonlyMap<string, number>,
  row: TradingCalendarRow,
): number {
  const snapshotId = requireSourceSnapshotId(row);
  const rowCount = rowCounts.get(snapshotId);
  if (rowCount === undefined) {
    throw new Error(`Missing source snapshot row_count for ${snapshotId}`);
  }
  return rowCount;
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
