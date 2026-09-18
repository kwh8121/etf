export const KRX_REQUIRED_FIELDS = [
  "BAS_DD",
  "ISU_CD",
  "ISU_NM",
  "TDD_CLSPRC",
  "NAV",
  "ACC_TRDVOL",
  "ACC_TRDVAL",
] as const;

const KRX_CODE_PATTERN = /^[0-9A-Z]{6}$/;
const KRX_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;

export type KrxRawEtfRow = Record<string, string | undefined>;

export interface KrxEtfRow {
  basDd: string;
  isuCd: string;
  isuNm: string;
  closePrc: number;
  nav: number;
  accTrdvol: number;
  accTrdval: number;
  raw: KrxRawEtfRow;
}

export class InvalidKrxFieldError extends Error {
  constructor(field: string, value: string | undefined) {
    super(`Invalid KRX ${field}: ${value ?? "<missing>"}`);
    this.name = "InvalidKrxFieldError";
  }
}

export function parseKrxNumber(field: string, value: string | undefined): number {
  const normalized = value?.replaceAll(",", "").trim();

  if (!normalized || !KRX_NUMBER_PATTERN.test(normalized)) {
    throw new InvalidKrxFieldError(field, value);
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new InvalidKrxFieldError(field, value);
  }

  return parsed;
}

function requireKrxString(field: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new InvalidKrxFieldError(field, value);
  }

  return normalized;
}

export function parseKrxEtfRow(raw: KrxRawEtfRow): KrxEtfRow {
  const isuCd = requireKrxString("ISU_CD", raw.ISU_CD);
  if (!KRX_CODE_PATTERN.test(isuCd)) {
    throw new InvalidKrxFieldError("ISU_CD", raw.ISU_CD);
  }

  const row = {
    basDd: requireKrxString("BAS_DD", raw.BAS_DD),
    isuCd,
    isuNm: requireKrxString("ISU_NM", raw.ISU_NM),
    closePrc: parseKrxNumber("TDD_CLSPRC", raw.TDD_CLSPRC),
    nav: parseKrxNumber("NAV", raw.NAV),
    accTrdvol: parseKrxNumber("ACC_TRDVOL", raw.ACC_TRDVOL),
    accTrdval: parseKrxNumber("ACC_TRDVAL", raw.ACC_TRDVAL),
    raw,
  };

  if (
    row.closePrc < 0 ||
    row.nav < 0 ||
    row.accTrdvol < 0 ||
    row.accTrdval < 0
  ) {
    throw new InvalidKrxFieldError("numeric field", "negative value");
  }

  return row;
}
