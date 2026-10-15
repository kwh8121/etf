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
  type SignalRunAuditRow,
  type SourceSnapshotAuditRow,
  type TradingCalendarAuditRow,
} from "./data-accuracy-store.ts";
import {
  createKrxPriceMoverSignals,
  type KrxSignalInputRow,
  type RankedKrxSignal,
} from "./kr-price-movers.ts";
import { createKrxTurnoverSurges } from "./kr-turnover-surge.ts";
import {
  buildUsEtfMoverSignals,
  US_ETF_P1_DISCLOSURE,
  type UsEtfMoverSignals,
} from "./us-etf-movers.ts";

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
    approvalReady: boolean;
    historicalReproduction:
      | "faithful_source_replay"
      | "current_canonical_with_caveats"
      | "blocked_by_missing_evidence";
    evidenceReasons: string[];
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
      ? await replayKrRun(store, run, storedRows, krWindow, sourceSnapshots, payloads)
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
  const evidenceReasons = reasons.filter((reason) => reason !== "signal_diff");
  const historicalReproduction =
    evidenceReasons.length > 0
      ? "blocked_by_missing_evidence"
      : replay.provenanceCaveats.length > 0
        ? "current_canonical_with_caveats"
        : "faithful_source_replay";
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
      approvalReady:
        evidenceReasons.length === 0 && replay.provenanceCaveats.length === 0,
      historicalReproduction,
      evidenceReasons,
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
  const replayedMaster = await replayMasterFirstSeen(store, snapshots);
  const firstSeen = replayedMaster.firstSeen;
  const events = await store.readKrListingHistory();
  const masters = await store.readKrMasterHistory();
  const snapshotIds = new Set(snapshots.map((snapshot) => snapshot.id));
  const eventSourceFailures = events.flatMap((event) =>
    !event.source_snapshot_id || !snapshotIds.has(event.source_snapshot_id)
      ? ["listing_event_source_evidence_missing"]
      : [],
  );

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
  const sourceIntegrityCaveats = sourceIntegrityResults.flatMap((result) =>
    result.ok || !result.reason ? [] : [`source_${result.reason}:${result.id}`],
  );
  const evidenceFailures = [
    ...replayedMaster.failures,
    ...eventSourceFailures,
    ...sourceIntegrityCaveats,
  ];
  const uniqueEvidenceFailures = [...new Set(evidenceFailures)];
  const sourceOk = sourceIntegrityResults.every((result) => result.ok);

  return {
    ok:
      sourceOk &&
      uniqueEvidenceFailures.length === 0 &&
      falseListingEvents.length === 0 &&
      masterFirstSeenCorrections.length === 0,
    approvalReady: sourceOk && uniqueEvidenceFailures.length === 0,
    sourceIntegrity: sourceIntegrityResults,
    falseListingEvents,
    masterFirstSeenCorrections,
    caveats: [
      "earliest observations derive from ka10099 snapshot observed_at in Asia/Seoul",
      "equal timestamp snapshots are not treated as strict prior evidence",
      "unknown first appearances are not proven IPOs",
      ...uniqueEvidenceFailures,
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
): Promise<{
  firstSeen: Map<string, { observedAt: string; observedDate: string; sourceSnapshotId: string }>;
  failures: string[];
}> {
  const firstSeen = new Map<
    string,
    { observedAt: string; observedDate: string; sourceSnapshotId: string }
  >();
  const failures: string[] = [];
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
      failures.push(`master_source_unparseable:${snapshot.id}`);
      continue;
    }
    if (!Array.isArray(payload)) {
      failures.push(`master_source_malformed_payload:${snapshot.id}`);
      continue;
    }
    for (const rawRecord of payload) {
      const record = normalizeMasterRecord(rawRecord);
      if (!record) {
        failures.push(`master_source_malformed_row:${snapshot.id}`);
        continue;
      }
      if (firstSeen.has(record.code)) continue;
      firstSeen.set(record.code, {
        observedAt,
        observedDate: toKstDate(observedAt),
        sourceSnapshotId: snapshot.id,
      });
    }
  }
  return { firstSeen, failures: [...new Set(failures)] };
}

async function replayKrRun(
  store: DataAccuracyStore,
  run: SignalRunAuditRow,
  storedRows: readonly AccuracySignalRow[],
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
      reasons.push(...validateKrxDailyRows(day.bas_dd, rows, rawPayload, snapshot.id));
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
  const listings = await replayNewListings(
    store,
    run.bas_dd,
    storedNewListingEventKeys(storedRows),
  );
  const runInputSnapshotIds = new Set(run.input_snapshot_ids ?? []);
  const windowSourceIds = [
    ...new Set(window.flatMap((row) => (row.source_snapshot_id ? [row.source_snapshot_id] : []))),
  ];
  const provenanceCaveats = [
    ...(window.length < 21 ? ["historical_replay_partial_calendar_window"] : []),
    ...(!windowSourceIds.every((id) => runInputSnapshotIds.has(id))
      ? ["historical_replay_uses_current_canonical_calendar_sources_not_full_original_run_inputs"]
      : []),
    ...(current.source_snapshot_id && !runInputSnapshotIds.has(current.source_snapshot_id)
      ? ["current_calendar_source_snapshot_not_recorded_in_run_input_snapshot_ids"]
      : []),
    "historical_new_listing_replay_preserves_stored_event_membership_but_cannot_reconstruct_superseded_past_source_state",
  ];
  return {
    expectedRows: [
      ...krRows(run, current.source_snapshot_id, "daily_price_gain", "percent", price.dailyGainers),
      ...krRows(run, current.source_snapshot_id, "daily_price_loss", "percent", price.dailyLosers),
      ...krRows(
        run,
        current.source_snapshot_id,
        "five_day_price_gain",
        "percent",
        price.fiveDayGainers,
        disclosureMetaByCode(price.fiveDayGainers, price.disclosure),
      ),
      ...krRows(
        run,
        current.source_snapshot_id,
        "five_day_price_loss",
        "percent",
        price.fiveDayLosers,
        disclosureMetaByCode(price.fiveDayLosers, price.disclosure),
      ),
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
    provenanceCaveats: [...new Set(provenanceCaveats)],
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

async function replayNewListings(
  store: DataAccuracyStore,
  basDd: string,
  storedEventKeys: ReadonlySet<string>,
) {
  const events = await store.readKrListingEvents(basDd, [...storedEventKeys]);
  const codes = [...new Set(events.map((event) => event.code))];
  const masters = await store.readKrMasters(codes);
  const names = new Map(masters.map((master) => [master.code, master.name]));
  const candidates = events
    .filter(
      (event) =>
        event.new_in_snapshot &&
        (event.first_alerted_at === null || storedEventKeys.has(event.event_key)) &&
        names.has(event.code),
    )
    .sort(
      (left, right) =>
        left.first_seen.localeCompare(right.first_seen) ||
        left.code.localeCompare(right.code),
    );
  return {
    signals: candidates.map((event, index) => ({
      code: event.code,
      name: names.get(event.code) ?? event.code,
      rank: index + 1,
      value: 1,
      screen: "raw" as const,
    })),
    metaByCode: new Map(
      candidates.map((event) => [
        event.code,
        {
          event_key: event.event_key,
          reg_day: event.reg_day,
          first_seen: event.first_seen,
          new_in_snapshot: event.new_in_snapshot,
          first_alerted_at: storedEventKeys.has(event.event_key)
            ? null
            : event.first_alerted_at,
        },
      ]),
    ),
  };
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
      meta: { ...row.meta, disclosure: US_ETF_P1_DISCLOSURE },
      source_snapshot_id: sourceSnapshotId,
    })),
  );
}

function disclosureMetaByCode(
  rows: readonly Pick<RankedKrxSignal, "code">[],
  disclosure: string,
): Map<string, Record<string, unknown>> {
  return new Map(rows.map((row) => [row.code, { disclosure }]));
}

function validateKrxDailyRows(
  basDd: string,
  storedRows: readonly EtfDailyAuditRow[],
  rawPayload: unknown,
  expectedSourceSnapshotId: string,
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
  const storedCodes = new Set(storedRows.map((row) => row.isu_cd));
  for (const stored of storedRows) {
    const parsed = parsedRows.get(stored.isu_cd);
    if (!parsed) {
      reasons.push(`krx_raw_missing_code:${basDd}:${stored.isu_cd}`);
      continue;
    }
    if (
      parsed.basDd !== basDd.replaceAll("-", "") ||
      parsed.isuNm !== stored.isu_nm ||
      !numbersEqual(parsed.closePrc, Number(stored.close_prc)) ||
      !optionalNumbersEqual(parsed.raw.FLUC_RT, stored.fluc_rt) ||
      !numbersEqual(parsed.accTrdval, Number(stored.acc_trdval)) ||
      !numbersEqual(parsed.accTrdvol, Number(stored.acc_trdvol))
    ) {
      reasons.push(`krx_raw_daily_mismatch:${basDd}:${stored.isu_cd}`);
    }
    if (stored.source_snapshot_id !== expectedSourceSnapshotId) {
      reasons.push(`krx_daily_source_mismatch:${basDd}:${stored.isu_cd}`);
    }
  }
  for (const rawCode of parsedRows.keys()) {
    if (!storedCodes.has(rawCode)) {
      reasons.push(`krx_raw_extra_code:${basDd}:${rawCode}`);
    }
  }
  return reasons;
}

function storedNewListingEventKeys(storedRows: readonly AccuracySignalRow[]): Set<string> {
  return new Set(
    storedRows.flatMap((row) => {
      if (row.signal_type !== "new_listing") return [];
      const eventKey = row.meta?.event_key;
      return typeof eventKey === "string" && eventKey.trim() ? [eventKey] : [];
    }),
  );
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
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= 1e-8 * scale;
}

function optionalNumbersEqual(rawValue: string | undefined, storedValue: number | string | null): boolean {
  const raw = parseOptionalRawNumber(rawValue);
  const stored =
    storedValue === null
      ? null
      : typeof storedValue === "number"
        ? storedValue
        : storedValue.trim()
          ? Number(storedValue)
          : null;
  if (raw === null || stored === null || !Number.isFinite(stored)) return raw === stored;
  return numbersEqual(raw, stored);
}

function parseOptionalRawNumber(value: string | undefined): number | null {
  const normalized = value?.replaceAll(",", "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
      approvalReady: false,
      historicalReproduction: "blocked_by_missing_evidence",
      evidenceReasons: reasons,
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

function normalizeMasterRecord(value: unknown): { code: string; name: string; regDay: string | null } | null {
  if (!isRecord(value)) return null;
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const regDay = typeof value.regDay === "string" ? value.regDay.trim() : "";
  if (!code || !name) return null;
  if (regDay && !/^\d{8}$/.test(regDay)) return null;
  return { code, name, regDay: regDay || null };
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
