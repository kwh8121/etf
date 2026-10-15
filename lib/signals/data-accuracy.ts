import type { SupabaseClient } from "@supabase/supabase-js";

import { parseKrxEtfRow, type KrxRawEtfRow } from "../market-data/krx.ts";
import { replayUsEtfMoverRawPayload } from "../market-data/kiwoom-us-movers.ts";
import {
  compareSignalRows,
  sourceIntegrity,
  verifySourceSnapshotBytes,
  type SanitizedSignalRow,
  type SignalDiffResult,
  type SourceIntegrityResult,
} from "./data-accuracy-core.ts";
import {
  SupabaseDataAccuracyStore,
  type AccuracySignalRow,
  type DataAccuracyStore,
  type EtfDailyAuditRow,
  type ListingEventAuditRow,
  type SignalRunAuditRow,
  type SourceSnapshotAuditRow,
  type TradingCalendarAuditRow,
} from "./data-accuracy-store.ts";
import {
  createKrxPriceMoverSignals,
  type KrxSignalInputRow,
  type RankedKrxSignal,
} from "./kr-price-movers.ts";
import {
  createKrxNewListingSignals,
  type KrxListingEventInput,
} from "./kr-new-listings.ts";
import { createKrxTurnoverSurges } from "./kr-turnover-surge.ts";
import { buildUsEtfMoverSignals, type UsEtfMoverSignals } from "./us-etf-movers.ts";

export {
  compareSignalRows,
  verifySourceSnapshotBytes,
  type AccuracySignalRow,
  type SourceSnapshotAuditRow,
};

export interface AuditRunAccuracyResult {
  ok: boolean;
  runId: string;
  market: "KR" | "US" | "UNKNOWN";
  reasons: string[];
  sourceIntegrity: SourceIntegrityResult[];
  diffs: SignalDiffResult;
  correctionProposal: {
    runId: string;
    added: SanitizedSignalRow[];
    removed: SanitizedSignalRow[];
    changed: SignalDiffResult["changed"];
    beforeCount: number;
    afterCount: number;
    preserveTelegramReportedAt: string | null;
    preserveObservedAt: true;
    resendHistoricalReport: false;
  };
  provenanceCaveats: string[];
  sourceIds: string[];
}

export interface KrListingCorrectionProposal {
  ok: boolean;
  approvalReady: boolean;
  sourceIntegrity: SourceIntegrityResult[];
  falseListingEvents: Array<{
    eventKey: string;
    code: string;
    storedFirstSeen: string;
    earliestObservedDate: string;
    eventSourceSnapshotId: string | null;
    earliestSourceSnapshotId: string;
  }>;
  masterFirstSeenCorrections: Array<{
    code: string;
    storedFirstSeen: string;
    proposedFirstSeen: string;
    sourceSnapshotId: string;
  }>;
  caveats: string[];
}

export async function auditRunAccuracy(
  client: SupabaseClient,
  runId: string,
  options: { store?: DataAccuracyStore } = {},
): Promise<AuditRunAccuracyResult> {
  const store = options.store ?? new SupabaseDataAccuracyStore(client);
  const run = await store.readSignalRun(runId);
  if (!run) return emptyResult(runId, "UNKNOWN", ["signal_run_not_found"]);
  if (run.status !== "COMPLETED") {
    return emptyResult(runId, run.market, [`run_status_not_completed:${run.status}`]);
  }

  const storedRows = await store.readSignalRows(run.id);
  const krWindow =
    run.market === "KR" && run.bas_dd
      ? await store.readKrTradingWindow(run.bas_dd)
      : [];
  const sourceIds = [
    ...new Set([
      ...(run.input_snapshot_ids ?? []),
      ...krWindow.flatMap((row) =>
        row.source_snapshot_id ? [row.source_snapshot_id] : [],
      ),
    ]),
  ];
  const sourceSnapshots = await store.readSourceSnapshots(sourceIds);
  const sourceIntegrityResults = await verifySources(store, sourceSnapshots);
  const payloads = await downloadSanitizedPayloads(store, sourceSnapshots);
  const replay =
    run.market === "KR"
      ? await replayKrRun(store, run, krWindow, sourceSnapshots, payloads)
      : replayUsRun(run, sourceSnapshots, payloads);
  const diffs = compareSignalRows(storedRows, replay.expectedRows);
  const reasons = [
    ...(sourceSnapshots.length === sourceIds.length ? [] : ["missing_source_snapshot"]),
    ...sourceIntegrityResults
      .filter((result) => !result.ok)
      .map((result) => `source_${result.reason}:${result.id}`),
    ...replay.reasons,
    ...(diffs.ok ? [] : ["signal_diff"]),
  ];
  const preserveTelegramReportedAt =
    typeof run.notes?.telegram_reported_at === "string"
      ? run.notes.telegram_reported_at
      : null;

  return {
    ok: reasons.length === 0,
    runId: run.id,
    market: run.market,
    reasons,
    sourceIntegrity: sourceIntegrityResults,
    diffs,
    correctionProposal: {
      runId: run.id,
      added: diffs.added,
      removed: diffs.removed,
      changed: diffs.changed,
      beforeCount: diffs.beforeCount,
      afterCount: diffs.afterCount,
      preserveTelegramReportedAt,
      preserveObservedAt: true,
      resendHistoricalReport: false,
    },
    provenanceCaveats: replay.provenanceCaveats,
    sourceIds,
  };
}

export async function auditKrListingCorrectionProposals(
  client: SupabaseClient,
  options: { store?: DataAccuracyStore } = {},
): Promise<KrListingCorrectionProposal> {
  const store = options.store ?? new SupabaseDataAccuracyStore(client);
  if (
    !store.readKrMasterSourceSnapshots ||
    !store.readKrListingHistory ||
    !store.readKrMasterHistory
  ) {
    return {
      ok: false,
      approvalReady: false,
      sourceIntegrity: [],
      falseListingEvents: [],
      masterFirstSeenCorrections: [],
      caveats: ["listing_history_store_methods_unavailable"],
    };
  }
  const snapshots = await store.readKrMasterSourceSnapshots();
  const sourceIntegrityResults = await verifySources(store, snapshots);
  const firstSeen = await replayMasterFirstSeen(store, snapshots);
  const events = await store.readKrListingHistory();
  const masters = await store.readKrMasterHistory();

  const falseListingEvents = events.flatMap((event) => {
    const earliest = firstSeen.get(event.code);
    if (!earliest || !event.source_snapshot_id) return [];
    const eventSnapshot = snapshots.find((snapshot) => snapshot.id === event.source_snapshot_id);
    if (!eventSnapshot) return [];
    const eventObservedAt = snapshotObservedAt(eventSnapshot);
    if (!eventObservedAt || earliest.observedAt >= eventObservedAt) return [];
    return [
      {
        eventKey: event.event_key,
        code: event.code,
        storedFirstSeen: event.first_seen,
        earliestObservedDate: earliest.observedDate,
        eventSourceSnapshotId: event.source_snapshot_id,
        earliestSourceSnapshotId: earliest.sourceSnapshotId,
      },
    ];
  });
  const masterFirstSeenCorrections = masters.flatMap((master) => {
    const earliest = firstSeen.get(master.code);
    if (!earliest || !master.first_seen || master.first_seen <= earliest.observedDate) return [];
    return [
      {
        code: master.code,
        storedFirstSeen: master.first_seen,
        proposedFirstSeen: earliest.observedDate,
        sourceSnapshotId: earliest.sourceSnapshotId,
      },
    ];
  });
  const sourceOk = sourceIntegrityResults.every((result) => result.ok);

  return {
    ok: sourceOk && falseListingEvents.length === 0 && masterFirstSeenCorrections.length === 0,
    approvalReady: sourceOk,
    sourceIntegrity: sourceIntegrityResults,
    falseListingEvents,
    masterFirstSeenCorrections,
    caveats: [
      "earliest observations derive from ka10099 snapshot observed_at in Asia/Seoul",
      "equal timestamp snapshots are not treated as strict prior evidence",
      "unknown first appearances are not proven IPOs",
    ],
  };
}

async function downloadSanitizedPayloads(
  store: DataAccuracyStore,
  sourceSnapshots: readonly SourceSnapshotAuditRow[],
): Promise<Map<string, unknown>> {
  const payloads = new Map<string, unknown>();
  for (const snapshot of sourceSnapshots) {
    if (!snapshot.object_path) continue;
    try {
      payloads.set(
        snapshot.id,
        JSON.parse(
          new TextDecoder().decode(
            await store.downloadSourceSnapshot(snapshot.object_path),
          ),
        ),
      );
    } catch {
      // Source integrity records JSON/download failures without raw payload values.
    }
  }
  return payloads;
}

async function replayMasterFirstSeen(
  store: DataAccuracyStore,
  snapshots: readonly SourceSnapshotAuditRow[],
): Promise<Map<string, { observedAt: string; observedDate: string; sourceSnapshotId: string }>> {
  const firstSeen = new Map<
    string,
    { observedAt: string; observedDate: string; sourceSnapshotId: string }
  >();
  const orderedSnapshots = [...snapshots].sort((left, right) =>
    (snapshotObservedAt(left) ?? "").localeCompare(snapshotObservedAt(right) ?? "") ||
    left.id.localeCompare(right.id),
  );
  for (const snapshot of orderedSnapshots) {
    if (!snapshot.object_path) continue;
    const observedAt = snapshotObservedAt(snapshot);
    if (!observedAt) continue;
    let payload: unknown;
    try {
      payload = JSON.parse(
        new TextDecoder().decode(
          await store.downloadSourceSnapshot(snapshot.object_path),
        ),
      );
    } catch {
      continue;
    }
    if (!Array.isArray(payload)) continue;
    for (const rawRecord of payload) {
      const record = normalizeMasterRecord(rawRecord);
      if (!record || firstSeen.has(record.code)) continue;
      firstSeen.set(record.code, {
        observedAt,
        observedDate: toKstDate(observedAt),
        sourceSnapshotId: snapshot.id,
      });
    }
  }
  return firstSeen;
}

async function replayKrRun(
  store: DataAccuracyStore,
  run: SignalRunAuditRow,
  window: readonly TradingCalendarAuditRow[],
  snapshots: readonly SourceSnapshotAuditRow[],
  payloads: ReadonlyMap<string, unknown>,
): Promise<{
  expectedRows: AccuracySignalRow[];
  reasons: string[];
  provenanceCaveats: string[];
}> {
  if (!run.bas_dd) {
    return { expectedRows: [], reasons: ["kr_run_missing_bas_dd"], provenanceCaveats: [] };
  }
  const current = window.find((row) => row.bas_dd === run.bas_dd);
  if (!current?.source_snapshot_id) {
    return { expectedRows: [], reasons: ["kr_current_calendar_missing_source"], provenanceCaveats: [] };
  }

  const dailyRowsByDate = new Map<string, KrxSignalInputRow[]>();
  const reasons: string[] = [];
  for (const day of window) {
    const rows = await store.readKrDailyRows(day.bas_dd);
    dailyRowsByDate.set(day.bas_dd, rows.map(toKrxSignalInputRow));
    const snapshot = snapshots.find((item) => item.id === day.source_snapshot_id);
    const rawPayload = day.source_snapshot_id
      ? payloads.get(day.source_snapshot_id)
      : undefined;
    if (snapshot && rawPayload) {
      reasons.push(...validateKrxDailyRows(day.bas_dd, rows, rawPayload));
    }
  }

  const startSeq = current.seq - 5;
  const start = window.find((row) => row.seq === startSeq);
  const currentRows = dailyRowsByDate.get(run.bas_dd) ?? [];
  const price = createKrxPriceMoverSignals(currentRows, {
    currentRows,
    startRows: start ? dailyRowsByDate.get(start.bas_dd) ?? [] : [],
    currentSeq: current.seq,
    startSeq,
    availableSeqs: window.map((row) => row.seq),
  });
  const priorRows = window
    .filter((row) => row.seq < current.seq)
    .flatMap((row) => dailyRowsByDate.get(row.bas_dd) ?? []);
  const turnover = createKrxTurnoverSurges(
    currentRows,
    groupTurnoverRowsByCode(priorRows),
  );
  const listings = await replayNewListings(store, run.bas_dd);
  return {
    expectedRows: [
      ...krRows(run, current.source_snapshot_id, "daily_price_gain", "percent", price.dailyGainers),
      ...krRows(run, current.source_snapshot_id, "daily_price_loss", "percent", price.dailyLosers),
      ...krRows(run, current.source_snapshot_id, "five_day_price_gain", "percent", price.fiveDayGainers),
      ...krRows(run, current.source_snapshot_id, "five_day_price_loss", "percent", price.fiveDayLosers),
      ...krRows(
        run,
        current.source_snapshot_id,
        "turnover_surge",
        "ratio",
        turnover.signals,
        new Map(
          turnover.signals.map((signal) => [
            signal.code,
            { prior_20_day_average_krw: turnover.averageByCode.get(signal.code) },
          ]),
        ),
      ),
      ...krRows(
        run,
        current.source_snapshot_id,
        "new_listing",
        "event",
        listings.signals,
        listings.metaByCode,
      ),
    ],
    reasons,
    provenanceCaveats:
      window.length < 21 ? ["historical_replay_partial_calendar_window"] : [],
  };
}

function replayUsRun(
  run: SignalRunAuditRow,
  snapshots: readonly SourceSnapshotAuditRow[],
  payloads: ReadonlyMap<string, unknown>,
): {
  expectedRows: AccuracySignalRow[];
  reasons: string[];
  provenanceCaveats: string[];
} {
  const snapshot = snapshots.find((item) => item.market === "US");
  const rawPayload = snapshot ? payloads.get(snapshot.id) : undefined;
  if (!snapshot || !isRecord(rawPayload)) {
    return { expectedRows: [], reasons: ["us_source_payload_missing"], provenanceCaveats: [] };
  }
  const replay = replayUsEtfMoverRawPayload(rawPayload);
  const signals = buildUsEtfMoverSignals(replay.input);
  return {
    expectedRows: usRows(run, snapshot.id, signals),
    reasons: [],
    provenanceCaveats: ["usa20931_stk_cnd_1_contract_warning"],
  };
}

async function verifySources(
  store: DataAccuracyStore,
  snapshots: readonly SourceSnapshotAuditRow[],
): Promise<SourceIntegrityResult[]> {
  const results: SourceIntegrityResult[] = [];
  for (const snapshot of snapshots) {
    if (!snapshot.object_path) {
      results.push(sourceIntegrity(snapshot, false, "missing_object_path", null, null));
      continue;
    }
    try {
      results.push(
        verifySourceSnapshotBytes(
          snapshot,
          await store.downloadSourceSnapshot(snapshot.object_path),
        ),
      );
    } catch {
      results.push(sourceIntegrity(snapshot, false, "download_failed", null, null));
    }
  }
  return results;
}

async function replayNewListings(store: DataAccuracyStore, basDd: string) {
  const events = await store.readKrListingEvents(basDd);
  const codes = [...new Set(events.map((event) => event.code))];
  const masters = await store.readKrMasters(codes);
  const names = new Map(masters.map((master) => [master.code, master.name]));
  return createKrxNewListingSignals(
    events.flatMap((event: ListingEventAuditRow) => {
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

function krRows(
  run: SignalRunAuditRow,
  sourceSnapshotId: string,
  signalType: string,
  valueUnit: string,
  rows: readonly RankedKrxSignal[],
  metaByCode: ReadonlyMap<string, Record<string, unknown>> = new Map(),
): AccuracySignalRow[] {
  return rows.map((row) => ({
    run_id: run.id,
    market: "KR",
    signal_type: signalType,
    screen: row.screen,
    code: row.code,
    name: row.name,
    rank: row.rank,
    value: row.value,
    value_unit: valueUnit,
    meta: metaByCode.get(row.code) ?? {},
    source_snapshot_id: sourceSnapshotId,
  }));
}

function usRows(
  run: SignalRunAuditRow,
  sourceSnapshotId: string,
  signals: UsEtfMoverSignals,
): AccuracySignalRow[] {
  const groups: Array<[string, UsEtfMoverSignals["dailyGainers"]]> = [
    ["daily_price_gain", signals.dailyGainers],
    ["daily_price_loss", signals.dailyLosers],
    ["five_day_price_gain", signals.fiveDayGainers],
    ["five_day_price_loss", signals.fiveDayLosers],
  ];
  return groups.flatMap(([signalType, rows]) =>
    rows.map((row) => ({
      run_id: run.id,
      market: "US",
      signal_type: signalType,
      screen: "raw",
      code: row.code,
      name: row.name,
      rank: row.rank,
      value: row.value,
      value_unit: "percent",
      meta: row.meta,
      source_snapshot_id: sourceSnapshotId,
    })),
  );
}

function validateKrxDailyRows(
  basDd: string,
  storedRows: readonly EtfDailyAuditRow[],
  rawPayload: unknown,
): string[] {
  if (!Array.isArray(rawPayload)) return [`krx_raw_payload_not_array:${basDd}`];
  const parsedRows = new Map<string, ReturnType<typeof parseKrxEtfRow>>();
  try {
    for (const raw of rawPayload) {
      if (!isKrxRawRow(raw)) return [`krx_raw_payload_malformed:${basDd}`];
      const parsed = parseKrxEtfRow(raw);
      parsedRows.set(parsed.isuCd, parsed);
    }
  } catch {
    return [`krx_raw_parse_failed:${basDd}`];
  }
  const reasons: string[] = [];
  for (const stored of storedRows) {
    const parsed = parsedRows.get(stored.isu_cd);
    if (!parsed) {
      reasons.push(`krx_raw_missing_code:${basDd}:${stored.isu_cd}`);
      continue;
    }
    if (
      parsed.isuNm !== stored.isu_nm ||
      !numbersEqual(parsed.closePrc, Number(stored.close_prc)) ||
      !numbersEqual(parsed.accTrdval, Number(stored.acc_trdval)) ||
      !numbersEqual(parsed.accTrdvol, Number(stored.acc_trdvol))
    ) {
      reasons.push(`krx_raw_daily_mismatch:${basDd}:${stored.isu_cd}`);
    }
  }
  return reasons;
}

function groupTurnoverRowsByCode(
  rows: readonly KrxSignalInputRow[],
): Map<string, number[]> {
  const values = new Map<string, number[]>();
  for (const row of rows) {
    const current = values.get(row.code) ?? [];
    current.push(row.accTrdval);
    values.set(row.code, current);
  }
  return values;
}

function toKrxSignalInputRow(row: EtfDailyAuditRow): KrxSignalInputRow {
  return {
    code: row.isu_cd,
    name: row.isu_nm,
    closePrc: Number(row.close_prc),
    flucRt: row.fluc_rt === null ? null : Number(row.fluc_rt),
    accTrdval: Number(row.acc_trdval),
    accTrdvol: Number(row.acc_trdvol),
  };
}

function numbersEqual(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= 1e-8 * scale;
}

function emptyResult(
  runId: string,
  market: "KR" | "US" | "UNKNOWN",
  reasons: string[],
): AuditRunAccuracyResult {
  const diffs = compareSignalRows([], []);
  return {
    ok: false,
    runId,
    market,
    reasons,
    sourceIntegrity: [],
    diffs,
    correctionProposal: {
      runId,
      added: [],
      removed: [],
      changed: [],
      beforeCount: 0,
      afterCount: 0,
      preserveTelegramReportedAt: null,
      preserveObservedAt: true,
      resendHistoricalReport: false,
    },
    provenanceCaveats: [],
    sourceIds: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isKrxRawRow(value: unknown): value is KrxRawEtfRow {
  return isRecord(value);
}

function normalizeMasterRecord(value: unknown): { code: string; name: string; regDay: string } | null {
  if (!isRecord(value)) return null;
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const regDay = typeof value.regDay === "string" ? value.regDay.trim() : "";
  if (!code || !name || !/^\d{8}$/.test(regDay)) return null;
  return { code, name, regDay };
}

function snapshotObservedAt(snapshot: SourceSnapshotAuditRow): string | null {
  return snapshot.observed_at ?? snapshot.asof_at ?? null;
}

function toKstDate(isoTimestamp: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoTimestamp));
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
