import type { RankedKrxSignal } from "./kr-price-movers";

const PRIOR_TRADING_DAY_COUNT = 20;
const MINIMUM_AVERAGE_KRW = 1_000_000_000;
const MINIMUM_SURGE_RATIO = 3;
const TOP_LIMIT = 15;

export interface KrxTurnoverRow {
  code: string;
  name: string;
  accTrdval: number;
}

export interface KrxTurnoverSurge {
  signals: RankedKrxSignal[];
  averageByCode: Map<string, number>;
}

export function createKrxTurnoverSurges(
  currentRows: readonly KrxTurnoverRow[],
  priorRowsByCode: ReadonlyMap<string, readonly number[]>,
): KrxTurnoverSurge {
  const averageByCode = new Map<string, number>();
  const signals = currentRows
    .flatMap((current) => {
      const priorValues = priorRowsByCode.get(current.code) ?? [];
      if (priorValues.length !== PRIOR_TRADING_DAY_COUNT || priorValues.some((value) => value < 0)) return [];
      const average = priorValues.reduce((sum, value) => sum + value, 0) / PRIOR_TRADING_DAY_COUNT;
      if (average < MINIMUM_AVERAGE_KRW || current.accTrdval / average < MINIMUM_SURGE_RATIO) return [];
      averageByCode.set(current.code, average);
      return [{ ...current, value: current.accTrdval / average }];
    })
    .sort((left, right) => right.value - left.value || left.code.localeCompare(right.code))
    .slice(0, TOP_LIMIT)
    .map((row, index) => ({
      code: row.code,
      name: row.name,
      value: row.value,
      screen: "raw" as const,
      rank: index + 1,
    }));

  return { signals, averageByCode };
}
