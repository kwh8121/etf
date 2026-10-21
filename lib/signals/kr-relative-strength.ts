export const KR_RELATIVE_STRENGTH_DISCLOSURE =
  "지수 대비는 ETF 가격수익률에서 해당 ETF 추적지수의 가격수익률을 뺀 값이며, 분배금·기업행사 조정 총수익률은 아닙니다.";

export interface KrRelativeStrengthSignalRow {
  code: string;
  signalType: string;
  value: number | string | null;
  valueUnit: string | null;
}

export interface KrRelativeStrengthMarketRow {
  code: string;
  idxNm: string | null;
  idxClose: number | string | null;
  idxFlucRt: number | string | null;
}

export interface KrRelativeStrengthValue {
  benchmarkName: string;
  benchmarkReturn: number;
  excessReturn: number;
}

const DAILY_SIGNAL_TYPES = new Set(["daily_price_gain", "daily_price_loss"]);
const FIVE_DAY_SIGNAL_TYPES = new Set([
  "five_day_price_gain",
  "five_day_price_loss",
]);

export function krRelativeStrengthKey(
  signalType: string,
  code: string,
): string {
  return `${signalType}:${code}`;
}

export function createKrRelativeStrengthMap(
  signals: readonly KrRelativeStrengthSignalRow[],
  currentRows: readonly KrRelativeStrengthMarketRow[],
  startRows: readonly KrRelativeStrengthMarketRow[] = [],
): Map<string, KrRelativeStrengthValue | null> {
  const currentByCode = new Map(currentRows.map((row) => [row.code, row]));
  const startByCode = new Map(startRows.map((row) => [row.code, row]));
  const values = new Map<string, KrRelativeStrengthValue | null>();

  for (const signal of signals) {
    const isDaily = DAILY_SIGNAL_TYPES.has(signal.signalType);
    const isFiveDay = FIVE_DAY_SIGNAL_TYPES.has(signal.signalType);
    if (!isDaily && !isFiveDay) continue;

    const key = krRelativeStrengthKey(signal.signalType, signal.code);
    const etfReturn =
      signal.valueUnit === "percent" ? toFiniteNumber(signal.value) : null;
    const current = currentByCode.get(signal.code);
    const benchmarkName = current?.idxNm?.trim() ?? "";
    if (etfReturn === null || !benchmarkName || !current) {
      values.set(key, null);
      continue;
    }

    if (isDaily) {
      const benchmarkReturn = toFiniteNumber(current.idxFlucRt);
      values.set(
        key,
        benchmarkReturn === null
          ? null
          : {
              benchmarkName,
              benchmarkReturn,
              excessReturn: etfReturn - benchmarkReturn,
            },
      );
      continue;
    }

    const start = startByCode.get(signal.code);
    const startClose = toPositiveNumber(start?.idxClose);
    const currentClose = toPositiveNumber(current.idxClose);
    if (
      !start ||
      !startClose ||
      !currentClose ||
      start.idxNm?.trim() !== benchmarkName
    ) {
      values.set(key, null);
      continue;
    }

    const benchmarkReturn = (currentClose / startClose - 1) * 100;
    values.set(key, {
      benchmarkName,
      benchmarkReturn,
      excessReturn: etfReturn - benchmarkReturn,
    });
  }

  return values;
}

export function formatKrRelativeStrength(
  value: KrRelativeStrengthValue | null,
): string {
  if (!value) return "지수 비교 불가";
  const sign = value.excessReturn >= 0 ? "+" : "";
  return `${value.benchmarkName} 대비 ${sign}${value.excessReturn.toFixed(2)}%p`;
}

function toFiniteNumber(value: number | string | null): number | null {
  if (value === null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toPositiveNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
