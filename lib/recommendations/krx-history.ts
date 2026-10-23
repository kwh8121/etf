import { createHash } from "node:crypto";

import { assertValidKrxRequestDate } from "../market-data/krx-date.ts";
import type { KrxRawEtfRow } from "../market-data/krx.ts";
import {
  validateKrxSnapshot,
  type KrxSnapshotStatus,
} from "../market-data/krx-validation.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface KrxHistoryRecord {
  basDd: string;
  status: KrxSnapshotStatus;
  rowCount: number;
  rawSha256: string;
  fetchedAt: string;
  reasons: string[];
  rows: KrxRawEtfRow[];
}

function toUtcMs(value: string): number {
  assertValidKrxRequestDate(value);
  return Date.UTC(
    Number(value.slice(0, 4)),
    Number(value.slice(4, 6)) - 1,
    Number(value.slice(6, 8)),
  );
}

function toKrxDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10).replaceAll("-", "");
}

/** 양 끝을 포함한 평일 목록. 휴장일 판정은 API 응답으로 한다. */
export function weekdayRange(from: string, to: string): string[] {
  const start = toUtcMs(from);
  const end = toUtcMs(to);
  const dates: string[] = [];

  for (let ms = start; ms <= end; ms += DAY_MS) {
    const day = new Date(ms).getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(toKrxDate(ms));
    }
  }

  return dates;
}

export function buildHistoryRecord(
  requestedDate: string,
  rawRows: KrxRawEtfRow[],
  fetchedAt: string,
): KrxHistoryRecord {
  const validation = validateKrxSnapshot(requestedDate, rawRows);
  const rawSha256 = createHash("sha256")
    .update(JSON.stringify(rawRows))
    .digest("hex");

  return {
    basDd: requestedDate,
    status: validation.status,
    rowCount: rawRows.length,
    rawSha256,
    fetchedAt,
    reasons: validation.reasons,
    rows: validation.status === "TRADING_COMPLETE" ? rawRows : [],
  };
}
