import { createHash } from "node:crypto";

type JsonRecord = Record<string, unknown>;

export interface KrCorrectionRunRow extends JsonRecord {
  id: string;
  market: "KR";
  bas_dd: string | null;
  market_date: string | null;
  observed_at: string;
  asof_at: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  strategy_version: string;
  transform_version: string;
  input_snapshot_ids: unknown;
  notes: JsonRecord;
}

export interface KrCorrectionSignalRow extends JsonRecord {
  run_id: string;
  market: "KR";
  bas_dd: string | null;
  market_date: string | null;
  observed_at: string;
  asof_at: string | null;
  signal_type: string;
  code: string;
  name: string;
  screen: string;
  rank: number;
  value: number | string | null;
  value_unit: string | null;
  liquidity_value: number | string | null;
  is_experimental: boolean;
  source_snapshot_id: string | null;
  meta: JsonRecord;
}

export interface KrCorrectionListingEventRow extends JsonRecord {
  event_key: string;
  code: string;
  first_seen: string;
}

export interface KrCorrectionMasterRow extends JsonRecord {
  code: string;
  first_seen: string;
}

export interface SanitizedCorrectionSignalRow {
  signal_type: string;
  screen: string;
  code: string;
  name: string;
  rank: number;
  value: number | string | null;
  value_unit: string | null;
  meta: JsonRecord;
  source_snapshot_id: string | null;
}

interface ListingCorrectionProposal {
  ok: boolean;
  approvalReady: boolean;
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

interface RunAccuracyInput {
  runId: string;
  ok: boolean;
  correctionProposal: {
    added: SanitizedCorrectionSignalRow[];
    removed: SanitizedCorrectionSignalRow[];
    changed: Array<{
      key: string;
      before: SanitizedCorrectionSignalRow;
      after: SanitizedCorrectionSignalRow;
      fields: string[];
    }>;
  };
}

export interface KrCorrectionInput {
  auditSha256: string;
  expectedAuditSha256: string;
  eligibleBasDd: readonly string[];
  preflightEvidence: KrCorrectionEvidenceState;
  completedRuns: readonly KrCorrectionRunRow[];
  signalRows: readonly KrCorrectionSignalRow[];
  listingEvents: readonly KrCorrectionListingEventRow[];
  masterRows: readonly KrCorrectionMasterRow[];
  listingProposal: ListingCorrectionProposal;
  runAudits: readonly RunAccuracyInput[];
}

export interface KrCorrectionBackup {
  signalRuns: JsonRecord[];
  signalRows: JsonRecord[];
  listingEvents: JsonRecord[];
  masterRows: JsonRecord[];
}

export interface KrCorrectionEvidenceRecord {
  scope: "source_snapshot" | "trading_calendar_kr" | "etf_daily_kr";
  key: string;
  sha256: string;
}

export interface KrCorrectionEvidenceState {
  records: KrCorrectionEvidenceRecord[];
}

export interface KrCorrectionStore {
  writeBackup(backup: KrCorrectionBackup): Promise<void>;
  readPreflightEvidence(expected: KrCorrectionEvidenceState): Promise<KrCorrectionEvidenceState>;
  updateRunStatus(runId: string, status: string, completedAt: string | null): Promise<void>;
  replaceSignalRows(runId: string, rows: readonly JsonRecord[]): Promise<void>;
  deleteSignalRows(keys: readonly SignalRowKey[]): Promise<void>;
  deleteListingEvents(eventKeys: readonly string[]): Promise<void>;
  updateMasterFirstSeen(updates: readonly MasterFirstSeenUpdate[]): Promise<void>;
  completeRuns(quarantines: readonly RunQuarantine[]): Promise<void>;
  restoreBackup(backup: KrCorrectionBackup): Promise<void>;
  readBack(): Promise<KrCorrectionBackup>;
}

export interface SignalRowKey {
  run_id: string;
  market: "KR";
  signal_type: string;
  screen: string;
  code: string;
}

export interface MasterFirstSeenUpdate {
  code: string;
  from: string;
  to: string;
  sourceSnapshotId: string;
}

export interface RunQuarantine {
  runId: string;
  originalStatus: string;
  originalCompletedAt: string | null;
}

interface RunReplacement {
  runId: string;
  replacementRows: KrCorrectionSignalRow[];
}

export interface KrCorrectionPlan {
  auditSha256: string;
  eligibleBasDd: readonly string[];
  planHash: string;
  backupHash: string;
  preflightEvidence: KrCorrectionEvidenceState;
  backup: KrCorrectionBackup;
  runQuarantines: RunQuarantine[];
  runReplacements: RunReplacement[];
  signalRowsToDelete: SignalRowKey[];
  listingEventKeysToDelete: string[];
  masterFirstSeenUpdates: MasterFirstSeenUpdate[];
  preservedRunNotesById: Record<string, JsonRecord>;
  deferredRunIds: string[];
}

export interface ApplyKrDataCorrectionOptions {
  apply?: boolean;
  expectedPlanHash?: string;
}

export interface ApplyKrDataCorrectionResult {
  status: "DRY_RUN" | "COMPLETED";
  planHash: string;
  backup: KrCorrectionBackup;
}

export function buildKrDataCorrectionPlan(input: KrCorrectionInput): KrCorrectionPlan {
  if (input.auditSha256 !== input.expectedAuditSha256) {
    throw new Error(
      `audit hash mismatch: expected ${input.expectedAuditSha256} but received ${input.auditSha256}`,
    );
  }
  if (!input.listingProposal.approvalReady) {
    throw new Error("listing correction proposal is not approval-ready");
  }
  assertFixedEligibleBasDd(input.eligibleBasDd);
  assertListingProposalMatchesRows(input);

  const eligibleBasDd = new Set(input.eligibleBasDd);
  const runsById = new Map(input.completedRuns.map((run) => [run.id, cloneRecord(run)]));
  const rowsByRun = groupRowsByRun(input.signalRows);
  const falseEventKeys = new Set(
    input.listingProposal.falseListingEvents.map((event) => event.eventKey),
  );
  const falseListingRows = input.signalRows.filter((row) =>
    row.signal_type === "new_listing" && falseEventKeys.has(metaEventKey(row.meta)),
  );
  const affectedRunIds = new Set(falseListingRows.map((row) => row.run_id));
  const deferredRunIds = input.runAudits.flatMap((audit) => {
    const run = runsById.get(audit.runId);
    return run && run.bas_dd && eligibleBasDd.has(run.bas_dd) ? [] : [audit.runId];
  });

  const replacementByRun = new Map<string, KrCorrectionSignalRow[]>();
  for (const audit of input.runAudits) {
    const run = runsById.get(audit.runId);
    if (!run?.bas_dd || !eligibleBasDd.has(run.bas_dd)) continue;
    replacementByRun.set(
      audit.runId,
      applyRunAuditProjection(run, rowsByRun.get(audit.runId) ?? [], audit),
    );
  }

  for (const runId of affectedRunIds) {
    const rows = replacementByRun.get(runId) ?? rowsByRun.get(runId) ?? [];
    replacementByRun.set(runId, removeFalseListingRowsAndRerank(rows, falseEventKeys));
  }

  const runReplacements = [...replacementByRun]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([runId, replacementRows]) => ({ runId, replacementRows }));
  const runQuarantines = runReplacements.map((replacement) => {
    const run = runsById.get(replacement.runId);
    if (!run) throw new Error(`run ${replacement.runId} missing from correction input`);
    return {
      runId: replacement.runId,
      originalStatus: run.status,
      originalCompletedAt: run.completed_at,
    };
  });
  const backup = buildBackup(input, runQuarantines.map((item) => item.runId), falseEventKeys);
  const planWithoutHashes = {
    auditSha256: input.auditSha256,
    eligibleBasDd: input.eligibleBasDd,
    preflightEvidence: canonicalEvidence(input.preflightEvidence),
    backup,
    runQuarantines,
    runReplacements,
    signalRowsToDelete: falseListingRows.map(signalRowKey).sort(compareSignalKeys),
    listingEventKeysToDelete: [...falseEventKeys].sort(),
    masterFirstSeenUpdates: input.listingProposal.masterFirstSeenCorrections
      .map((item) => ({
        code: item.code,
        from: item.storedFirstSeen,
        to: item.proposedFirstSeen,
        sourceSnapshotId: item.sourceSnapshotId,
      }))
      .sort((left, right) => left.code.localeCompare(right.code)),
    preservedRunNotesById: Object.fromEntries(
      runQuarantines.map((item) => [item.runId, runsById.get(item.runId)?.notes ?? {}]),
    ),
    deferredRunIds: [...new Set(deferredRunIds)].sort(),
  };
  const backupHash = sha256Json(backup);
  const planHash = sha256Json({ ...planWithoutHashes, backupHash });
  return { ...planWithoutHashes, planHash, backupHash };
}

export async function applyKrDataCorrectionPlan(
  store: KrCorrectionStore,
  plan: KrCorrectionPlan,
  options: ApplyKrDataCorrectionOptions = {},
): Promise<ApplyKrDataCorrectionResult> {
  if (!options.apply) {
    return { status: "DRY_RUN", planHash: plan.planHash, backup: plan.backup };
  }
  if (options.expectedPlanHash && options.expectedPlanHash !== plan.planHash) {
    throw new Error(
      `plan hash mismatch: expected ${options.expectedPlanHash} but received ${plan.planHash}`,
    );
  }
  if (plan.planHash !== sha256Json({ ...plan, planHash: undefined })) {
    throw new Error("plan content hash mismatch");
  }

  await store.writeBackup(plan.backup);
  assertEvidenceEqual(
    await store.readPreflightEvidence(plan.preflightEvidence),
    plan.preflightEvidence,
    "pre-apply evidence freshness check",
  );
  assertBackupEqual(await store.readBack(), plan.backup, "pre-apply stale check");
  try {
    for (const quarantine of plan.runQuarantines) {
      await store.updateRunStatus(quarantine.runId, "CORRECTION_PENDING", null);
    }
    for (const replacement of plan.runReplacements) {
      await store.replaceSignalRows(replacement.runId, replacement.replacementRows);
    }
    await store.deleteSignalRows(plan.signalRowsToDelete);
    await store.deleteListingEvents(plan.listingEventKeysToDelete);
    await store.updateMasterFirstSeen(plan.masterFirstSeenUpdates);
    assertAppliedState(await store.readBack(), plan);
    await store.completeRuns(plan.runQuarantines);
    assertCompletedState(await store.readBack(), plan);
    return { status: "COMPLETED", planHash: plan.planHash, backup: plan.backup };
  } catch (error) {
    await restoreKrDataCorrectionBackup(store, plan.backup);
    throw error;
  }
}

export async function restoreKrDataCorrectionBackup(
  store: KrCorrectionStore,
  backup: KrCorrectionBackup,
): Promise<void> {
  await store.restoreBackup(backup);
  const readBack = await store.readBack();
  assertBackupEqual(readBack, backup, "backup restore readback");
}

function applyRunAuditProjection(
  run: KrCorrectionRunRow,
  rows: readonly KrCorrectionSignalRow[],
  audit: RunAccuracyInput,
): KrCorrectionSignalRow[] {
  const projected = new Map(rows.map((row) => [perRunSignalKey(row), cloneSignalRow(row)]));
  for (const removed of audit.correctionProposal.removed) {
    projected.delete(sanitizedKey(removed));
  }
  for (const changed of audit.correctionProposal.changed) {
    if (sanitizedKey(changed.before) !== sanitizedKey(changed.after)) {
      throw new Error(`changed signal identity mutation is not supported: ${changed.key}`);
    }
    const key = sanitizedKey(changed.after);
    const existing = projected.get(key);
    projected.set(
      key,
      existing
        ? mergeSanitizedIntoExisting(existing, changed.after)
        : newSignalRowFromSanitized(run, changed.after),
    );
  }
  for (const added of audit.correctionProposal.added) {
    projected.set(sanitizedKey(added), newSignalRowFromSanitized(run, added));
  }
  return sortSignalRows([...projected.values()]);
}

function assertFixedEligibleBasDd(values: readonly string[]): void {
  const actual = [...values].sort();
  const expected = ["2026-10-13", "2026-10-14"];
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error("eligibleBasDd is fixed to 2026-10-13,2026-10-14 for Q-27");
  }
}

function assertListingProposalMatchesRows(input: KrCorrectionInput): void {
  const eventsByKey = new Map(input.listingEvents.map((event) => [event.event_key, event]));
  for (const proposal of input.listingProposal.falseListingEvents) {
    const event = eventsByKey.get(proposal.eventKey);
    if (!event) throw new Error(`listing proposal event missing from fresh rows: ${proposal.eventKey}`);
    if (
      event.code !== proposal.code ||
      event.first_seen !== proposal.storedFirstSeen ||
      event.source_snapshot_id !== proposal.eventSourceSnapshotId
    ) {
      throw new Error(`listing proposal event drift: ${proposal.eventKey}`);
    }
  }
  const mastersByCode = new Map(input.masterRows.map((master) => [master.code, master]));
  for (const proposal of input.listingProposal.masterFirstSeenCorrections) {
    const master = mastersByCode.get(proposal.code);
    if (!master) throw new Error(`master proposal row missing from fresh rows: ${proposal.code}`);
    if (master.first_seen !== proposal.storedFirstSeen) {
      throw new Error(`master proposal drift: ${proposal.code}`);
    }
  }
}

function mergeSanitizedIntoExisting(
  existing: KrCorrectionSignalRow,
  after: SanitizedCorrectionSignalRow,
): KrCorrectionSignalRow {
  return {
    ...cloneSignalRow(existing),
    signal_type: after.signal_type,
    screen: after.screen,
    code: after.code,
    name: after.name,
    rank: after.rank,
    value: after.value,
    value_unit: after.value_unit,
    meta: cloneRecord(after.meta),
    source_snapshot_id: after.source_snapshot_id,
  };
}

function newSignalRowFromSanitized(
  run: KrCorrectionRunRow,
  row: SanitizedCorrectionSignalRow,
): KrCorrectionSignalRow {
  return {
    run_id: run.id,
    market: "KR",
    bas_dd: run.bas_dd,
    market_date: run.market_date ?? run.bas_dd,
    observed_at: run.observed_at,
    asof_at: run.asof_at,
    signal_type: row.signal_type,
    code: row.code,
    name: row.name,
    screen: row.screen,
    rank: row.rank,
    value: row.value,
    value_unit: row.value_unit,
    liquidity_value: null,
    is_experimental: false,
    source_snapshot_id: row.source_snapshot_id,
    meta: cloneRecord(row.meta),
  };
}

function removeFalseListingRowsAndRerank(
  rows: readonly KrCorrectionSignalRow[],
  falseEventKeys: ReadonlySet<string>,
): KrCorrectionSignalRow[] {
  const kept = rows.filter(
    (row) => row.signal_type !== "new_listing" || !falseEventKeys.has(metaEventKey(row.meta)),
  );
  const listingRows = kept
    .filter((row) => row.signal_type === "new_listing")
    .sort((left, right) =>
      String(left.meta.first_seen ?? "").localeCompare(String(right.meta.first_seen ?? "")) ||
      left.code.localeCompare(right.code),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const listingByKey = new Map(listingRows.map((row) => [signalKey(row), row]));
  return sortSignalRows(kept.map((row) => listingByKey.get(signalKey(row)) ?? row));
}

function buildBackup(
  input: KrCorrectionInput,
  affectedRunIds: readonly string[],
  falseEventKeys: ReadonlySet<string>,
): KrCorrectionBackup {
  const affected = new Set(affectedRunIds);
  const masterCodes = new Set(
    input.listingProposal.masterFirstSeenCorrections.map((item) => item.code),
  );
  return {
    signalRuns: input.completedRuns
      .filter((run) => affected.has(run.id))
      .map((run) => cloneRecord(run)),
    signalRows: input.signalRows
      .filter((row) => affected.has(row.run_id) || falseEventKeys.has(metaEventKey(row.meta)))
      .map((row) => cloneRecord(row)),
    listingEvents: input.listingEvents
      .filter((event) => falseEventKeys.has(event.event_key))
      .map((event) => cloneRecord(event)),
    masterRows: input.masterRows
      .filter((master) => masterCodes.has(master.code))
      .map((master) => cloneRecord(master)),
  };
}

function assertAppliedState(readBack: KrCorrectionBackup, plan: KrCorrectionPlan): void {
  assertBackupShape(readBack, "post-apply readback");
  const runsById = new Map(readBack.signalRuns.map((run) => [String(run.id), run]));
  for (const quarantine of plan.runQuarantines) {
    const run = runsById.get(quarantine.runId);
    if (!run) throw new Error(`post-apply readback missing run ${quarantine.runId}`);
    if (run.status !== "CORRECTION_PENDING" || run.completed_at !== null) {
      throw new Error(`post-apply quarantine mismatch for ${quarantine.runId}`);
    }
  }
  for (const replacement of plan.runReplacements) {
    const actualRows = readBack.signalRows.filter((row) => row.run_id === replacement.runId);
    if (sha256Json(sortPlainRows(actualRows)) !== sha256Json(sortPlainRows(replacement.replacementRows))) {
      throw new Error(`post-apply signal row mismatch for ${replacement.runId}`);
    }
  }
  const deletedSignalKeys = new Set(plan.signalRowsToDelete.map(signalKey));
  for (const row of readBack.signalRows) {
    const key = signalKeyFromRecord(row);
    if (deletedSignalKeys.has(key)) {
      throw new Error(`post-apply deleted signal row still exists: ${key}`);
    }
  }
  const deletedEventKeys = new Set(plan.listingEventKeysToDelete);
  for (const event of readBack.listingEvents) {
    if (deletedEventKeys.has(String(event.event_key))) {
      throw new Error(`post-apply deleted listing event still exists: ${String(event.event_key)}`);
    }
  }
  const mastersByCode = new Map(readBack.masterRows.map((row) => [String(row.code), row]));
  for (const update of plan.masterFirstSeenUpdates) {
    const master = mastersByCode.get(update.code);
    if (!master || master.first_seen !== update.to) {
      throw new Error(`post-apply master first_seen mismatch for ${update.code}`);
    }
  }
}

function assertCompletedState(readBack: KrCorrectionBackup, plan: KrCorrectionPlan): void {
  const runsById = new Map(readBack.signalRuns.map((run) => [String(run.id), run]));
  for (const quarantine of plan.runQuarantines) {
    const run = runsById.get(quarantine.runId);
    if (!run) throw new Error(`post-complete readback missing run ${quarantine.runId}`);
    if (
      run.status !== quarantine.originalStatus ||
      run.completed_at !== quarantine.originalCompletedAt
    ) {
      throw new Error(`post-complete run metadata mismatch for ${quarantine.runId}`);
    }
  }
}

function assertBackupEqual(
  actual: KrCorrectionBackup,
  expected: KrCorrectionBackup,
  operation: string,
): void {
  if (sha256Json(canonicalBackup(actual)) !== sha256Json(canonicalBackup(expected))) {
    throw new Error(`${operation} mismatch`);
  }
}

function assertEvidenceEqual(
  actual: KrCorrectionEvidenceState,
  expected: KrCorrectionEvidenceState,
  operation: string,
): void {
  if (sha256Json(canonicalEvidence(actual)) !== sha256Json(canonicalEvidence(expected))) {
    throw new Error(`${operation} mismatch`);
  }
}

function assertBackupShape(backup: KrCorrectionBackup, operation: string): void {
  for (const run of backup.signalRuns) {
    if (typeof run.id !== "string") throw new Error(`${operation} returned signal_run without id`);
  }
}

function groupRowsByRun(
  rows: readonly KrCorrectionSignalRow[],
): Map<string, KrCorrectionSignalRow[]> {
  const grouped = new Map<string, KrCorrectionSignalRow[]>();
  for (const row of rows) {
    grouped.set(row.run_id, [...(grouped.get(row.run_id) ?? []), cloneSignalRow(row)]);
  }
  return grouped;
}

function signalRowKey(row: KrCorrectionSignalRow): SignalRowKey {
  return {
    run_id: row.run_id,
    market: row.market,
    signal_type: row.signal_type,
    screen: row.screen,
    code: row.code,
  };
}

function compareSignalKeys(left: SignalRowKey, right: SignalRowKey): number {
  return signalKey(left).localeCompare(signalKey(right));
}

function signalKey(row: Pick<KrCorrectionSignalRow, "run_id" | "market" | "signal_type" | "screen" | "code">): string {
  return `${row.run_id}:${row.market}:${row.signal_type}:${row.screen}:${row.code}`;
}

function signalKeyFromRecord(row: JsonRecord): string {
  return `${String(row.run_id)}:${String(row.market)}:${String(row.signal_type)}:${String(row.screen)}:${String(row.code)}`;
}

function perRunSignalKey(row: Pick<KrCorrectionSignalRow, "market" | "signal_type" | "screen" | "code">): string {
  return `${row.market}:${row.signal_type}:${row.screen}:${row.code}`;
}

function sanitizedKey(row: Pick<SanitizedCorrectionSignalRow, "signal_type" | "screen" | "code">): string {
  return `KR:${row.signal_type}:${row.screen}:${row.code}`;
}

function metaEventKey(meta: JsonRecord | null | undefined): string {
  return typeof meta?.event_key === "string" ? meta.event_key : "";
}

function sortSignalRows(rows: KrCorrectionSignalRow[]): KrCorrectionSignalRow[] {
  return [...rows].sort(
    (left, right) =>
      left.signal_type.localeCompare(right.signal_type) ||
      left.screen.localeCompare(right.screen) ||
      left.rank - right.rank ||
      left.code.localeCompare(right.code),
  );
}

function sortPlainRows(rows: readonly JsonRecord[]): JsonRecord[] {
  return [...rows].sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

function canonicalBackup(backup: KrCorrectionBackup): KrCorrectionBackup {
  return {
    signalRuns: sortPlainRows(backup.signalRuns),
    signalRows: sortPlainRows(backup.signalRows),
    listingEvents: sortPlainRows(backup.listingEvents),
    masterRows: sortPlainRows(backup.masterRows),
  };
}

function canonicalEvidence(evidence: KrCorrectionEvidenceState): KrCorrectionEvidenceState {
  return {
    records: [...evidence.records].sort(
      (left, right) =>
        left.scope.localeCompare(right.scope) ||
        left.key.localeCompare(right.key) ||
        left.sha256.localeCompare(right.sha256),
    ),
  };
}

function cloneSignalRow(row: KrCorrectionSignalRow): KrCorrectionSignalRow {
  return cloneRecord(row) as KrCorrectionSignalRow;
}

function cloneRecord<T extends JsonRecord>(row: T): T {
  return JSON.parse(JSON.stringify(row)) as T;
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
