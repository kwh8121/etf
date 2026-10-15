import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  auditKrListingCorrectionProposals,
  auditRunAccuracy,
} from "../lib/signals/data-accuracy.ts";
import { SupabaseDataAccuracyStore } from "../lib/signals/data-accuracy-store.ts";
import {
  applyKrDataCorrectionPlan,
  buildKrDataCorrectionPlan,
  restoreKrDataCorrectionBackup,
  type KrCorrectionBackup,
  type KrCorrectionEvidenceRecord,
  type KrCorrectionEvidenceState,
  type KrCorrectionInput,
  type KrCorrectionPlan,
  type KrCorrectionStore,
  type MasterFirstSeenUpdate,
  type RunQuarantine,
  type SignalRowKey,
} from "../lib/signals/kr-data-correction.ts";
import { readAllRows } from "../lib/supabase/read-all-rows.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";

export { SupabaseKrCorrectionStore };

const DEFAULT_ELIGIBLE_BAS_DD = ["2026-10-13", "2026-10-14"] as const;
const DEFAULT_PRIVATE_DIR =
  "/home/kwh8121/projects/investment/.omx/private-backups/q27-20261015";
const ALLOWED_RECENT_CAVEATS = new Set([
  "historical_replay_uses_current_canonical_calendar_sources_not_full_original_run_inputs",
  "historical_new_listing_replay_preserves_stored_event_membership_but_cannot_reconstruct_superseded_past_source_state",
]);

export type CorrectKrDataArgs =
  | {
      command: "plan";
      auditFile: string;
      expectedAuditSha256: string;
      planOutput: string;
      backupOutput: string;
      eligibleBasDd: string[];
    }
  | {
      command: "apply";
      planFile: string;
      expectedPlanHash: string;
      apply: boolean;
    }
  | {
      command: "restore";
      backupFile: string;
      apply: boolean;
    };

interface VerifyDataAccuracyOutput {
  results?: unknown[];
  krListingCorrectionProposal?: unknown;
}

export function parseCorrectKrDataArgs(argv: readonly string[]): CorrectKrDataArgs {
  const command = argv[0];
  if (command !== "plan" && command !== "apply" && command !== "restore") {
    throw new Error("Usage: correct-kr-data.ts <plan|apply|restore> [options]");
  }
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      flags.add(arg);
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`Unknown correct-kr-data argument: ${arg}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
    values.set(arg, value);
    index += 1;
  }

  if (command === "plan") {
    const auditFile = required(values, "--audit-file");
    const expectedAuditSha256 =
      values.get("--expected-audit-sha256") ?? (awaitedHashNotAllowed());
    const planOutput =
      values.get("--plan-output") ?? `${DEFAULT_PRIVATE_DIR}/correction-plan.json`;
    const backupOutput =
      values.get("--backup-output") ?? `${DEFAULT_PRIVATE_DIR}/correction-backup.json`;
    const eligibleBasDd = values.get("--eligible-bas-dd")
      ? values.get("--eligible-bas-dd")?.split(",").map((value) => value.trim()).filter(Boolean) ?? []
      : [...DEFAULT_ELIGIBLE_BAS_DD];
    assertFixedEligibleBasDd(eligibleBasDd);
    return { command, auditFile, expectedAuditSha256, planOutput, backupOutput, eligibleBasDd };
  }

  if (command === "apply") {
    return {
      command,
      planFile: required(values, "--plan-file"),
      expectedPlanHash: required(values, "--plan-hash"),
      apply: flags.has("--apply"),
    };
  }

  return {
    command,
    backupFile: required(values, "--backup-file"),
    apply: flags.has("--apply"),
  };
}

export async function buildCorrectionInputFromAudit(
  client: SupabaseClient,
  args: Extract<CorrectKrDataArgs, { command: "plan" }>,
): Promise<KrCorrectionInput> {
  const auditBytes = await readFile(args.auditFile);
  const auditSha256 = createHash("sha256").update(auditBytes).digest("hex");
  const audit = JSON.parse(auditBytes.toString("utf8")) as VerifyDataAccuracyOutput;
  const completedRuns = await readCompletedKrRuns(client);
  const runsById = new Map(completedRuns.map((run) => [String(run.id), run]));
  const accuracyStore = new SupabaseDataAccuracyStore(client);
  await assertFreshAuditMatchesFile(client, accuracyStore, audit, completedRuns, args.eligibleBasDd);
  const runAudits = (audit.results ?? [])
    .filter(isRecord)
    .filter((result) => result.market === "KR" && typeof result.runId === "string")
    .map((result) => {
      const runId = String(result.runId);
      const run = runsById.get(runId);
      if (!run) throw new Error(`audit references missing KR run ${result.runId}`);
      if (args.eligibleBasDd.includes(String(run.bas_dd))) assertRecentRunAuditAllowed(result);
      return {
        runId,
        ok: result.ok === true,
        correctionProposal: asCorrectionProposal(result.correctionProposal),
      };
    });

  return {
    auditSha256,
    expectedAuditSha256: args.expectedAuditSha256,
    eligibleBasDd: args.eligibleBasDd,
    preflightEvidence: await readCorrectionEvidenceState(client, completedRuns, args.eligibleBasDd),
    completedRuns: completedRuns as never,
    signalRows: (await readKrSignalRows(client)) as never,
    listingEvents: (await readListingEvents(client)) as never,
    masterRows: (await readMasterRows(client)) as never,
    listingProposal: asListingProposal(audit.krListingCorrectionProposal),
    runAudits,
  };
}

async function main(): Promise<void> {
  const args = parseCorrectKrDataArgs(process.argv.slice(2));
  const client = createServiceRoleClient();
  if (args.command === "plan") {
    const input = await buildCorrectionInputFromAudit(client, args);
    const plan = buildKrDataCorrectionPlan(input);
    await writePrivateJson(args.planOutput, plan);
    await writePrivateJson(args.backupOutput, plan.backup);
    console.log(JSON.stringify({
      status: "PLANNED",
      planHash: plan.planHash,
      backupHash: plan.backupHash,
      runReplacementCount: plan.runReplacements.length,
      falseListingEventCount: plan.listingEventKeysToDelete.length,
      masterFirstSeenUpdateCount: plan.masterFirstSeenUpdates.length,
      planOutput: resolve(args.planOutput),
      backupOutput: resolve(args.backupOutput),
    }));
    return;
  }

  if (args.command === "apply") {
    const plan = JSON.parse(await readFile(args.planFile, "utf8")) as KrCorrectionPlan;
    const store = new SupabaseKrCorrectionStore(client, dirname(resolve(args.planFile)));
    const result = await applyKrDataCorrectionPlan(store, plan, {
      apply: args.apply,
      expectedPlanHash: args.expectedPlanHash,
    });
    console.log(JSON.stringify({ status: result.status, planHash: result.planHash }));
    return;
  }

  const backup = JSON.parse(await readFile(args.backupFile, "utf8")) as KrCorrectionBackup;
  if (!args.apply) {
    console.log(JSON.stringify({ status: "DRY_RUN", backupFile: resolve(args.backupFile) }));
    return;
  }
  await restoreKrDataCorrectionBackup(
    new SupabaseKrCorrectionStore(client, dirname(resolve(args.backupFile))),
    backup,
  );
  console.log(JSON.stringify({ status: "RESTORED", backupFile: resolve(args.backupFile) }));
}

class SupabaseKrCorrectionStore implements KrCorrectionStore {
  private readonly client: SupabaseClient;
  private readonly backupDir: string;
  private backupScope: KrCorrectionBackup | null = null;

  constructor(client: SupabaseClient, backupDir: string) {
    this.client = client;
    this.backupDir = backupDir;
  }

  async writeBackup(backup: KrCorrectionBackup): Promise<void> {
    this.backupScope = backup;
    await writePrivateJson(`${this.backupDir}/apply-backup-${Date.now()}.json`, backup);
  }

  async readPreflightEvidence(expected: KrCorrectionEvidenceState): Promise<KrCorrectionEvidenceState> {
    return readEvidenceStateForExpectedRecords(this.client, expected);
  }

  async updateRunStatus(runId: string, status: string, completedAt: string | null): Promise<void> {
    const { error } = await this.client
      .from("signal_run")
      .update({ status, completed_at: completedAt })
      .eq("id", runId);
    throwIfError(error, `update signal_run ${runId} status`);
  }

  async replaceSignalRows(runId: string, rows: readonly Record<string, unknown>[]): Promise<void> {
    const deleteResult = await this.client.from("signal_daily").delete().eq("run_id", runId);
    throwIfError(deleteResult.error, `delete signal_daily rows for ${runId}`);
    if (rows.length === 0) return;
    const upsertResult = await this.client.from("signal_daily").upsert(rows, {
      onConflict: "run_id,market,signal_type,screen,code",
    });
    throwIfError(upsertResult.error, `upsert corrected signal_daily rows for ${runId}`);
  }

  async deleteSignalRows(keys: readonly SignalRowKey[]): Promise<void> {
    for (const key of keys) {
      const { error } = await this.client
        .from("signal_daily")
        .delete()
        .eq("run_id", key.run_id)
        .eq("market", key.market)
        .eq("signal_type", key.signal_type)
        .eq("screen", key.screen)
        .eq("code", key.code);
      throwIfError(error, `delete false listing signal ${key.run_id}:${key.code}`);
    }
  }

  async deleteListingEvents(eventKeys: readonly string[]): Promise<void> {
    for (const eventKey of eventKeys) {
      const { error } = await this.client
        .from("listing_event_kr")
        .delete()
        .eq("event_key", eventKey);
      throwIfError(error, `delete listing_event_kr ${eventKey}`);
    }
  }

  async updateMasterFirstSeen(updates: readonly MasterFirstSeenUpdate[]): Promise<void> {
    for (const update of updates) {
      const { error } = await this.client
        .from("etf_master_kr")
        .update({
          first_seen: update.to,
        })
        .eq("code", update.code)
        .eq("first_seen", update.from);
      throwIfError(error, `update etf_master_kr ${update.code} first_seen`);
    }
  }

  async completeRuns(quarantines: readonly RunQuarantine[]): Promise<void> {
    for (const quarantine of quarantines) {
      const { error } = await this.client
        .from("signal_run")
        .update({
          status: quarantine.originalStatus,
          completed_at: quarantine.originalCompletedAt,
        })
        .eq("id", quarantine.runId);
      throwIfError(error, `restore signal_run ${quarantine.runId} status`);
    }
  }

  async restoreBackup(backup: KrCorrectionBackup): Promise<void> {
    this.backupScope = backup;
    const runIds = [
      ...new Set([
        ...backup.signalRuns.map((row) => String(row.id)),
        ...backup.signalRows.map((row) => String(row.run_id)),
      ]),
    ];
    for (const runId of runIds) {
      const { error } = await this.client.from("signal_daily").delete().eq("run_id", runId);
      throwIfError(error, `delete current signal_daily rows for restore ${runId}`);
    }
    if (backup.signalRows.length > 0) {
      const { error } = await this.client.from("signal_daily").upsert(backup.signalRows, {
        onConflict: "run_id,market,signal_type,screen,code",
      });
      throwIfError(error, "restore signal_daily backup");
    }
    if (backup.masterRows.length > 0) {
      const { error } = await this.client.from("etf_master_kr").upsert(backup.masterRows);
      throwIfError(error, "restore etf_master_kr backup");
    }
    if (backup.listingEvents.length > 0) {
      const { error } = await this.client.from("listing_event_kr").upsert(backup.listingEvents);
      throwIfError(error, "restore listing_event_kr backup");
    }
    if (backup.signalRuns.length > 0) {
      const { error } = await this.client.from("signal_run").upsert(backup.signalRuns);
      throwIfError(error, "restore signal_run backup");
    }
  }

  async readBack(): Promise<KrCorrectionBackup> {
    if (!this.backupScope) throw new Error("backup scope missing for readback");
    const runIds = [
      ...new Set([
        ...this.backupScope.signalRuns.map((row) => String(row.id)),
        ...this.backupScope.signalRows.map((row) => String(row.run_id)),
      ]),
    ];
    const signalRunIds = runIds;
    const eventKeys = this.backupScope.listingEvents.map((row) => String(row.event_key));
    const masterCodes = this.backupScope.masterRows.map((row) => String(row.code));
    return {
      signalRuns: await readRowsByValues(this.client, "signal_run", "id", runIds, [
        { column: "id", ascending: true },
      ]),
      signalRows: await readRowsByValues(this.client, "signal_daily", "run_id", signalRunIds, [
        { column: "run_id", ascending: true },
        { column: "signal_type", ascending: true },
        { column: "screen", ascending: true },
        { column: "code", ascending: true },
      ]),
      listingEvents: await readRowsByValues(this.client, "listing_event_kr", "event_key", eventKeys, [
        { column: "event_key", ascending: true },
      ]),
      masterRows: await readRowsByValues(this.client, "etf_master_kr", "code", masterCodes, [
        { column: "code", ascending: true },
      ]),
    };
  }
}

async function readCompletedKrRuns(client: SupabaseClient): Promise<Record<string, unknown>[]> {
  return readAllRows({
    operation: "read completed KR signal runs for correction",
    createQuery: () =>
      client
        .from("signal_run")
        .select("*", { count: "exact" })
        .eq("market", "KR")
        .eq("status", "COMPLETED"),
    orderBy: [
      { column: "bas_dd", ascending: true },
      { column: "id", ascending: true },
    ],
    getKey: (row: Record<string, unknown>) => String(row.id),
  });
}

async function assertFreshAuditMatchesFile(
  client: SupabaseClient,
  store: SupabaseDataAccuracyStore,
  audit: VerifyDataAccuracyOutput,
  completedRuns: readonly Record<string, unknown>[],
  eligibleBasDd: readonly string[],
): Promise<void> {
  const fileResults = new Map(
    (audit.results ?? [])
      .filter(isRecord)
      .filter((result) => typeof result.runId === "string")
      .map((result) => [String(result.runId), result]),
  );
  for (const run of completedRuns) {
    if (!eligibleBasDd.includes(String(run.bas_dd))) continue;
    const runId = String(run.id);
    const fileResult = fileResults.get(runId);
    if (!fileResult) throw new Error(`fresh audit check missing file result for ${runId}`);
    const fresh = await auditRunAccuracy(client, runId, { store });
    assertSameJson(
      fresh.correctionProposal,
      fileResult.correctionProposal,
      `fresh audit correctionProposal mismatch for ${runId}`,
    );
    assertSameJson(fresh.sourceIds, fileResult.sourceIds, `fresh audit sourceIds mismatch for ${runId}`);
  }
  const freshListing = await auditKrListingCorrectionProposals(client, { store });
  assertSameJson(
    freshListing,
    audit.krListingCorrectionProposal,
    "fresh listing audit proposal mismatch",
  );
}

async function readCorrectionEvidenceState(
  client: SupabaseClient,
  completedRuns: readonly Record<string, unknown>[],
  eligibleBasDd: readonly string[],
): Promise<KrCorrectionEvidenceState> {
  const windows = await readEligibleCalendarWindows(client, completedRuns, eligibleBasDd);
  const basDds = [...new Set(windows.map((row) => String(row.bas_dd)))].sort();
  const sourceIds = [
    ...new Set([
      ...completedRuns
        .filter((run) => eligibleBasDd.includes(String(run.bas_dd)))
        .flatMap((run) => (Array.isArray(run.input_snapshot_ids) ? run.input_snapshot_ids.map(String) : [])),
      ...windows.flatMap((row) =>
        typeof row.source_snapshot_id === "string" ? [row.source_snapshot_id] : [],
      ),
    ]),
  ].sort();
  const [sources, dailyRows] = await Promise.all([
    readRowsByValues(client, "source_snapshot", "id", sourceIds, [{ column: "id", ascending: true }]),
    readDailyRowsForBasDds(client, basDds),
  ]);
  return {
    records: [
      ...sources.map((row) => evidenceRecord("source_snapshot", String(row.id), row)),
      ...windows.map((row) => evidenceRecord("trading_calendar_kr", String(row.bas_dd), row)),
      ...dailyRows.map((row) =>
        evidenceRecord("etf_daily_kr", `${String(row.bas_dd)}:${String(row.isu_cd)}`, row),
      ),
    ].sort(compareEvidenceRecords),
  };
}

async function readEvidenceStateForExpectedRecords(
  client: SupabaseClient,
  expected: KrCorrectionEvidenceState,
): Promise<KrCorrectionEvidenceState> {
  const expectedByScope = groupEvidenceByScope(expected.records);
  const sourceIds = [...(expectedByScope.get("source_snapshot")?.keys() ?? [])].sort();
  const calendarKeys = [...(expectedByScope.get("trading_calendar_kr")?.keys() ?? [])].sort();
  const dailyKeys = [...(expectedByScope.get("etf_daily_kr")?.keys() ?? [])].sort();
  const dailyBasDds = [...new Set(dailyKeys.map((key) => splitDailyEvidenceKey(key)[0]))].sort();
  const [sources, calendars, dailyRows] = await Promise.all([
    readRowsByValues(client, "source_snapshot", "id", sourceIds, [{ column: "id", ascending: true }]),
    readCalendarEvidenceRows(client, calendarKeys),
    readDailyRowsForBasDds(client, dailyBasDds),
  ]);
  return {
    records: [
      ...sources.map((row) => evidenceRecord("source_snapshot", String(row.id), row)),
      ...calendars.map((row) => evidenceRecord("trading_calendar_kr", String(row.bas_dd), row)),
      ...dailyRows.map((row) =>
        evidenceRecord("etf_daily_kr", `${String(row.bas_dd)}:${String(row.isu_cd)}`, row),
      ),
    ].sort(compareEvidenceRecords),
  };
}

function groupEvidenceByScope(
  records: readonly KrCorrectionEvidenceRecord[],
): Map<KrCorrectionEvidenceRecord["scope"], Map<string, KrCorrectionEvidenceRecord>> {
  const grouped = new Map<KrCorrectionEvidenceRecord["scope"], Map<string, KrCorrectionEvidenceRecord>>();
  for (const record of records) {
    const scope = grouped.get(record.scope) ?? new Map<string, KrCorrectionEvidenceRecord>();
    scope.set(record.key, record);
    grouped.set(record.scope, scope);
  }
  return grouped;
}

async function readCalendarEvidenceRows(
  client: SupabaseClient,
  basDds: readonly string[],
): Promise<Record<string, unknown>[]> {
  if (basDds.length === 0) return [];
  const rows = await readAllRows<Record<string, unknown>>({
    operation: "read KR trading calendar evidence",
    createQuery: () =>
      client
        .from("trading_calendar_kr")
        .select("*", { count: "exact" })
        .eq("status", "TRADING_COMPLETE"),
    orderBy: [
      { column: "seq", ascending: true },
      { column: "bas_dd", ascending: true },
    ],
    getKey: (row) => String(row.bas_dd),
  });
  const expected = new Set(basDds);
  return rows.filter((row) => expected.has(String(row.bas_dd)));
}

async function readEligibleCalendarWindows(
  client: SupabaseClient,
  completedRuns: readonly Record<string, unknown>[],
  eligibleBasDd: readonly string[],
): Promise<Record<string, unknown>[]> {
  const calendars = await readAllRows<Record<string, unknown>>({
    operation: "read KR trading calendars for correction evidence",
    createQuery: () =>
      client
        .from("trading_calendar_kr")
        .select("*", { count: "exact" })
        .eq("status", "TRADING_COMPLETE"),
    orderBy: [
      { column: "seq", ascending: true },
      { column: "bas_dd", ascending: true },
    ],
    getKey: (row) => String(row.bas_dd),
  });
  const byBasDd = new Map(calendars.map((row) => [String(row.bas_dd), row]));
  const wantedSeqs = new Set<number>();
  for (const run of completedRuns) {
    if (!eligibleBasDd.includes(String(run.bas_dd))) continue;
    const current = byBasDd.get(String(run.bas_dd));
    const seq = Number(current?.seq);
    if (!Number.isFinite(seq)) throw new Error(`missing KR calendar seq for ${String(run.bas_dd)}`);
    for (let currentSeq = seq - 20; currentSeq <= seq; currentSeq += 1) wantedSeqs.add(currentSeq);
  }
  return calendars.filter((row) => wantedSeqs.has(Number(row.seq)));
}

async function readDailyRowsForBasDds(
  client: SupabaseClient,
  basDds: readonly string[],
): Promise<Record<string, unknown>[]> {
  if (basDds.length === 0) return [];
  return readAllRows({
    operation: "read KR daily rows for correction evidence",
    createQuery: () =>
      client.from("etf_daily_kr").select("*", { count: "exact" }).in("bas_dd", basDds),
    orderBy: [
      { column: "bas_dd", ascending: true },
      { column: "isu_cd", ascending: true },
    ],
    getKey: (row: Record<string, unknown>) => `${String(row.bas_dd)}:${String(row.isu_cd)}`,
  });
}

async function readKrSignalRows(client: SupabaseClient): Promise<Record<string, unknown>[]> {
  return readAllRows({
    operation: "read KR signal_daily rows for correction",
    createQuery: () =>
      client.from("signal_daily").select("*", { count: "exact" }).eq("market", "KR"),
    orderBy: [
      { column: "run_id", ascending: true },
      { column: "signal_type", ascending: true },
      { column: "screen", ascending: true },
      { column: "code", ascending: true },
    ],
    getKey: (row: Record<string, unknown>) =>
      `${String(row.run_id)}:${String(row.market)}:${String(row.signal_type)}:${String(row.screen)}:${String(row.code)}`,
  });
}

async function readListingEvents(client: SupabaseClient): Promise<Record<string, unknown>[]> {
  return readAllRows({
    operation: "read listing_event_kr rows for correction",
    createQuery: () => client.from("listing_event_kr").select("*", { count: "exact" }),
    orderBy: [{ column: "event_key", ascending: true }],
    getKey: (row: Record<string, unknown>) => String(row.event_key),
  });
}

async function readMasterRows(client: SupabaseClient): Promise<Record<string, unknown>[]> {
  return readAllRows({
    operation: "read etf_master_kr rows for correction",
    createQuery: () => client.from("etf_master_kr").select("*", { count: "exact" }),
    orderBy: [{ column: "code", ascending: true }],
    getKey: (row: Record<string, unknown>) => String(row.code),
  });
}

async function readRowsByValues(
  client: SupabaseClient,
  table: string,
  column: string,
  values: readonly string[],
  orderBy: readonly [{ column: string; ascending?: boolean }, ...{ column: string; ascending?: boolean }[]],
): Promise<Record<string, unknown>[]> {
  const unique = [...new Set(values)];
  if (unique.length === 0) return [];
  return readAllRows({
    operation: `read ${table} readback`,
    createQuery: () => client.from(table).select("*", { count: "exact" }).in(column, unique),
    orderBy,
    getKey: (row: Record<string, unknown>) => JSON.stringify(row),
  });
}

function evidenceRecord(
  scope: KrCorrectionEvidenceRecord["scope"],
  key: string,
  row: Record<string, unknown>,
): KrCorrectionEvidenceRecord {
  return { scope, key, sha256: sha256Json(row) };
}

function splitDailyEvidenceKey(key: string): [string, string] {
  const separator = key.indexOf(":");
  if (separator < 0) throw new Error(`invalid etf_daily_kr evidence key ${key}`);
  return [key.slice(0, separator), key.slice(separator + 1)];
}

function assertRecentRunAuditAllowed(audit: Record<string, unknown>): void {
  const proposal = audit.correctionProposal;
  const evidenceReasons =
    isRecord(proposal) && Array.isArray(proposal.evidenceReasons)
      ? proposal.evidenceReasons.map(String)
      : [];
  if (evidenceReasons.length > 0) {
    throw new Error(`recent KR run ${String(audit.runId)} has evidence failures: ${evidenceReasons.join(",")}`);
  }
  const caveats = Array.isArray(audit.provenanceCaveats)
    ? audit.provenanceCaveats.map(String)
    : [];
  const blocked = caveats.filter((caveat) => !ALLOWED_RECENT_CAVEATS.has(caveat));
  if (blocked.length > 0) {
    throw new Error(`recent KR run ${String(audit.runId)} has blocked caveats: ${blocked.join(",")}`);
  }
}

function assertFixedEligibleBasDd(values: readonly string[]): void {
  const actual = [...values].sort();
  const expected = [...DEFAULT_ELIGIBLE_BAS_DD].sort();
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error("--eligible-bas-dd is fixed to 2026-10-13,2026-10-14 for Q-27");
  }
}

function assertSameJson(left: unknown, right: unknown, message: string): void {
  if (sha256Json(left) !== sha256Json(right)) throw new Error(message);
}

function asCorrectionProposal(value: unknown) {
  if (!isRecord(value)) throw new Error("audit result missing correctionProposal");
  return {
    added: Array.isArray(value.added) ? value.added as never : [],
    removed: Array.isArray(value.removed) ? value.removed as never : [],
    changed: Array.isArray(value.changed) ? value.changed as never : [],
  };
}

function asListingProposal(value: unknown) {
  if (!isRecord(value)) throw new Error("audit output missing krListingCorrectionProposal");
  return {
    ok: value.ok === true,
    approvalReady: value.approvalReady === true,
    falseListingEvents: Array.isArray(value.falseListingEvents) ? value.falseListingEvents as never : [],
    masterFirstSeenCorrections: Array.isArray(value.masterFirstSeenCorrections)
      ? value.masterFirstSeenCorrections as never
      : [],
    caveats: Array.isArray(value.caveats) ? value.caveats.map(String) : [],
  };
}

async function writePrivateJson(path: string, value: unknown): Promise<void> {
  const output = resolve(path);
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  await writeFile(output, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(output, 0o600);
}

function required(values: ReadonlyMap<string, string>, flag: string): string {
  const value = values.get(flag)?.trim();
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

function awaitedHashNotAllowed(): never {
  throw new Error("--expected-audit-sha256 requires a value");
}

function throwIfError(error: { message: string } | null, operation: string): void {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function compareEvidenceRecords(
  left: KrCorrectionEvidenceRecord,
  right: KrCorrectionEvidenceRecord,
): number {
  return (
    left.scope.localeCompare(right.scope) ||
    left.key.localeCompare(right.key) ||
    left.sha256.localeCompare(right.sha256)
  );
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown KR data correction failure";
    console.error(`correct-kr-data failed: ${message}`);
    process.exitCode = 1;
  });
}
