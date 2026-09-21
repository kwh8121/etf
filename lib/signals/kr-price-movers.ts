export const KRX_FIVE_DAY_RETURN_DISCLOSURE =
  "KRX가 제공한 종가 기준 가격수익률이며 분배금·기업행동 조정 총수익률이 아님.";

export interface KrxSignalInputRow {
  code: string;
  name: string;
  closePrc: number;
  flucRt: number | null;
  accTrdval: number;
  accTrdvol: number;
}

export interface RankedKrxSignal {
  code: string;
  name: string;
  rank: number;
  value: number;
  screen: "raw" | "liquid";
}

export interface KrxPriceMoverSignals {
  dailyGainers: RankedKrxSignal[];
  dailyLosers: RankedKrxSignal[];
  fiveDayGainers: RankedKrxSignal[];
  fiveDayLosers: RankedKrxSignal[];
  disclosure: typeof KRX_FIVE_DAY_RETURN_DISCLOSURE;
}

interface FiveDayInput {
  currentRows: readonly KrxSignalInputRow[];
  startRows: readonly KrxSignalInputRow[];
  currentSeq: number;
  startSeq: number;
  availableSeqs: readonly number[];
}

const TOP_LIMIT = 10;
const LIQUIDITY_MINIMUM_KRW = 1_000_000_000;

export function createKrxPriceMoverSignals(
  currentRows: readonly KrxSignalInputRow[],
  fiveDay: FiveDayInput | null,
): KrxPriceMoverSignals {
  const dailyGainers = rankByValue(currentRows, "raw", (row) => row.flucRt, "desc");
  const dailyLosers = rankByValue(currentRows, "raw", (row) => row.flucRt, "asc");
  const liquidRows = currentRows.filter(isLiquid);

  const fiveDayReturns = fiveDay && hasContinuousFiveDayWindow(fiveDay)
    ? calculateFiveDayReturns(fiveDay.currentRows, fiveDay.startRows)
    : [];
  const liquidCodes = new Set(liquidRows.map((row) => row.code));

  return {
    dailyGainers: [...dailyGainers, ...rankByValue(liquidRows, "liquid", (row) => row.flucRt, "desc")],
    dailyLosers: [...dailyLosers, ...rankByValue(liquidRows, "liquid", (row) => row.flucRt, "asc")],
    fiveDayGainers: [
      ...rankReturnRows(fiveDayReturns, "raw", "desc"),
      ...rankReturnRows(fiveDayReturns.filter((row) => liquidCodes.has(row.code)), "liquid", "desc"),
    ],
    fiveDayLosers: [
      ...rankReturnRows(fiveDayReturns, "raw", "asc"),
      ...rankReturnRows(fiveDayReturns.filter((row) => liquidCodes.has(row.code)), "liquid", "asc"),
    ],
    disclosure: KRX_FIVE_DAY_RETURN_DISCLOSURE,
  };
}

function hasContinuousFiveDayWindow(input: FiveDayInput): boolean {
  if (input.startSeq !== input.currentSeq - 5) return false;
  const sequences = new Set(input.availableSeqs);
  return Array.from({ length: 6 }, (_, offset) => input.startSeq + offset).every((seq) => sequences.has(seq));
}

function calculateFiveDayReturns(
  currentRows: readonly KrxSignalInputRow[],
  startRows: readonly KrxSignalInputRow[],
): Array<KrxSignalInputRow & { value: number }> {
  const startByCode = new Map(startRows.map((row) => [row.code, row]));
  return currentRows.flatMap((current) => {
    const start = startByCode.get(current.code);
    if (!start || start.closePrc <= 0 || current.closePrc < 0) return [];
    return [{ ...current, value: (current.closePrc / start.closePrc - 1) * 100 }];
  });
}

function rankByValue(
  rows: readonly KrxSignalInputRow[],
  screen: "raw" | "liquid",
  valueOf: (row: KrxSignalInputRow) => number | null,
  direction: "asc" | "desc",
): RankedKrxSignal[] {
  return rows
    .flatMap((row) => {
      const value = valueOf(row);
      return value === null || !Number.isFinite(value) ? [] : [{ ...row, value }];
    })
    .sort(compare(direction))
    .slice(0, TOP_LIMIT)
    .map((row, index) => ({ code: row.code, name: row.name, value: row.value, screen, rank: index + 1 }));
}

function rankReturnRows(
  rows: readonly (KrxSignalInputRow & { value: number })[],
  screen: "raw" | "liquid",
  direction: "asc" | "desc",
): RankedKrxSignal[] {
  return [...rows]
    .sort(compare(direction))
    .slice(0, TOP_LIMIT)
    .map((row, index) => ({ code: row.code, name: row.name, value: row.value, screen, rank: index + 1 }));
}

function compare(direction: "asc" | "desc") {
  const multiplier = direction === "asc" ? 1 : -1;
  return (left: { value: number; code: string }, right: { value: number; code: string }) =>
    multiplier * (left.value - right.value) || left.code.localeCompare(right.code);
}

function isLiquid(row: KrxSignalInputRow): boolean {
  return row.accTrdval >= LIQUIDITY_MINIMUM_KRW && row.accTrdvol > 0;
}
