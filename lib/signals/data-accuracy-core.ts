import { createHash } from "node:crypto";

import type { AccuracySignalRow, SourceSnapshotAuditRow } from "./data-accuracy-store.ts";

const VALUE_TOLERANCE = 1e-8;

export interface SanitizedSignalRow {
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

export interface SignalDiffResult {
  ok: boolean;
  beforeCount: number;
  afterCount: number;
  added: SanitizedSignalRow[];
  removed: SanitizedSignalRow[];
  changed: Array<{
    key: string;
    before: SanitizedSignalRow;
    after: SanitizedSignalRow;
    fields: string[];
  }>;
}

export interface SourceIntegrityResult {
  id: string;
  apiId: string;
  ok: boolean;
  reason: string | null;
  rawRowCount: number | null;
  rawPageCount: number | null;
}

export function compareSignalRows(
  storedRows: readonly AccuracySignalRow[],
  expectedRows: readonly AccuracySignalRow[],
): SignalDiffResult {
  const stored = new Map(storedRows.map((row) => [signalKey(row), sanitize(row)]));
  const expected = new Map(expectedRows.map((row) => [signalKey(row), sanitize(row)]));
  const added: SanitizedSignalRow[] = [];
  const removed: SanitizedSignalRow[] = [];
  const changed: SignalDiffResult["changed"] = [];

  for (const [key, row] of expected) {
    const before = stored.get(key);
    if (!before) {
      added.push(row);
      continue;
    }
    const fields = changedFields(before, row);
    if (fields.length > 0) changed.push({ key, before, after: row, fields });
  }
  for (const [key, row] of stored) {
    if (!expected.has(key)) removed.push(row);
  }

  return {
    ok: added.length === 0 && removed.length === 0 && changed.length === 0,
    beforeCount: storedRows.length,
    afterCount: expectedRows.length,
    added,
    removed,
    changed,
  };
}

export function verifySourceSnapshotBytes(
  snapshot: SourceSnapshotAuditRow,
  bytes: Uint8Array,
): SourceIntegrityResult {
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (!snapshot.sha256 || actualHash !== snapshot.sha256) {
    return sourceIntegrity(snapshot, false, "sha256_mismatch", null, null);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return sourceIntegrity(snapshot, false, "json_parse_failed", null, null);
  }
  const { rowCount, pageCount } = countRawPayload(snapshot.api_id, parsed);
  if (snapshot.row_count !== null && rowCount !== snapshot.row_count) {
    return sourceIntegrity(snapshot, false, "row_count_mismatch", rowCount, pageCount);
  }
  if (snapshot.page_count !== null && pageCount !== snapshot.page_count) {
    return sourceIntegrity(snapshot, false, "page_count_mismatch", rowCount, pageCount);
  }
  return sourceIntegrity(snapshot, true, null, rowCount, pageCount);
}

export function sourceIntegrity(
  snapshot: SourceSnapshotAuditRow,
  ok: boolean,
  reason: string | null,
  rawRowCount: number | null,
  rawPageCount: number | null,
): SourceIntegrityResult {
  return {
    id: snapshot.id,
    apiId: snapshot.api_id,
    ok,
    reason,
    rawRowCount,
    rawPageCount,
  };
}

function changedFields(
  before: SanitizedSignalRow,
  after: SanitizedSignalRow,
): string[] {
  const fields: string[] = [];
  if (before.name !== after.name) fields.push("name");
  if (before.rank !== after.rank) fields.push("rank");
  if (!signalValuesEqual(before.value, after.value)) fields.push("value");
  if (before.value_unit !== after.value_unit) fields.push("value_unit");
  if (JSON.stringify(before.meta) !== JSON.stringify(after.meta)) fields.push("meta");
  if (before.source_snapshot_id !== after.source_snapshot_id) {
    fields.push("source_snapshot_id");
  }
  return fields;
}

function signalValuesEqual(
  left: number | string | null,
  right: number | string | null,
): boolean {
  const leftNumber = finiteSignalNumber(left);
  const rightNumber = finiteSignalNumber(right);
  if (leftNumber === null || rightNumber === null) return left === right;
  return numbersEqual(leftNumber, rightNumber);
}

function finiteSignalNumber(value: number | string | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function numbersEqual(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= VALUE_TOLERANCE * scale;
}

function signalKey(row: Pick<AccuracySignalRow, "signal_type" | "screen" | "code">): string {
  return `${row.signal_type}:${row.screen}:${row.code}`;
}

function sanitize(row: AccuracySignalRow): SanitizedSignalRow {
  return {
    signal_type: row.signal_type,
    screen: row.screen,
    code: row.code,
    name: row.name,
    rank: row.rank,
    value: row.value,
    value_unit: row.value_unit,
    meta: row.meta ?? {},
    source_snapshot_id: row.source_snapshot_id,
  };
}

function countRawPayload(apiId: string, payload: unknown): {
  rowCount: number;
  pageCount: number;
} {
  if (apiId === "us_etf_movers" && isRecord(payload)) {
    let rowCount = 0;
    let pageCount = 0;
    for (const value of Object.values(payload)) {
      if (!isRecord(value) || !Array.isArray(value.pages)) continue;
      pageCount += value.pages.length;
      rowCount += value.pages.reduce(
        (sum, page) => sum + (Array.isArray(page) ? page.length : 0),
        0,
      );
    }
    return { rowCount, pageCount };
  }
  return { rowCount: Array.isArray(payload) ? payload.length : 0, pageCount: 1 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
