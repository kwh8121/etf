import { assertValidKrxRequestDate } from "./krx-date.ts";
import {
  InvalidKrxFieldError,
  parseKrxEtfRow,
  type KrxEtfRow,
  type KrxRawEtfRow,
} from "./krx.ts";

export type KrxSnapshotStatus =
  | "TRADING_COMPLETE"
  | "NON_TRADING"
  | "PUBLISH_PENDING"
  | "PARTIAL";

export interface KrxSnapshotValidation {
  status: KrxSnapshotStatus;
  rows: KrxEtfRow[];
  reasons: string[];
}

interface ValidateKrxSnapshotOptions {
  previousCompleteRowCount?: number;
  isCurrentTarget?: boolean;
}

function coreFieldsAreBlank(row: KrxRawEtfRow): boolean {
  return ["TDD_CLSPRC", "NAV", "ACC_TRDVOL", "ACC_TRDVAL"].every(
    (field) => !row[field]?.trim(),
  );
}

export function validateKrxSnapshot(
  requestedDate: string,
  rawRows: KrxRawEtfRow[],
  options: ValidateKrxSnapshotOptions = {},
): KrxSnapshotValidation {
  assertValidKrxRequestDate(requestedDate);

  if (rawRows.length === 0) {
    return {
      status: options.isCurrentTarget ? "PUBLISH_PENDING" : "NON_TRADING",
      rows: [],
      reasons: ["KRX response has no rows"],
    };
  }

  if (rawRows.every(coreFieldsAreBlank)) {
    return {
      status: options.isCurrentTarget ? "PUBLISH_PENDING" : "NON_TRADING",
      rows: [],
      reasons: ["KRX response has blank core market fields"],
    };
  }

  const rows: KrxEtfRow[] = [];
  const reasons: string[] = [];
  const seen = new Set<string>();

  for (const raw of rawRows) {
    try {
      const row = parseKrxEtfRow(raw);
      if (row.basDd !== requestedDate) {
        reasons.push(`BAS_DD mismatch for ${row.isuCd}`);
        continue;
      }
      if (seen.has(row.isuCd)) {
        reasons.push(`Duplicate ISU_CD: ${row.isuCd}`);
        continue;
      }
      seen.add(row.isuCd);
      rows.push(row);
    } catch (error) {
      reasons.push(
        error instanceof InvalidKrxFieldError
          ? error.message
          : "Unknown KRX row validation error",
      );
    }
  }

  if (reasons.length > 0) {
    return { status: "PARTIAL", rows: [], reasons };
  }

  if (
    options.previousCompleteRowCount !== undefined &&
    rows.length < options.previousCompleteRowCount * 0.98
  ) {
    return {
      status: "PARTIAL",
      rows: [],
      reasons: ["Row count is below 98% of the previous complete snapshot"],
    };
  }

  return { status: "TRADING_COMPLETE", rows, reasons: [] };
}
