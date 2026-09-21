export const US_ETF_P1_DISCLOSURE =
  "미국 ETF 등락은 Kiwoom 순위 기반의 실험 항목이며 국내 P0 신호와 독립적으로 제공됩니다.";

type Environment = Readonly<Record<string, string | undefined>>;

export interface UsEtfUniverseRecord {
  code: string;
  etn: boolean;
}

interface UsDailyMoverInput {
  code: string;
  name: string;
  rank: number;
  returnPercent: number;
  endPrice: string;
}

interface UsFiveDayMoverInput {
  code: string;
  name: string;
  rank: number;
  startPrice: string;
  endPrice: string;
}

export interface UsEtfMoverInput {
  universe: readonly UsEtfUniverseRecord[];
  dailyGainers: readonly UsDailyMoverInput[];
  dailyLosers: readonly UsDailyMoverInput[];
  fiveDayGainers: readonly UsFiveDayMoverInput[];
  fiveDayLosers: readonly UsFiveDayMoverInput[];
}

export interface UsEtfSignal {
  code: string;
  name: string;
  rank: number;
  value: number;
  meta: Record<string, number>;
}

export interface UsEtfMoverSignals {
  dailyGainers: UsEtfSignal[];
  dailyLosers: UsEtfSignal[];
  fiveDayGainers: UsEtfSignal[];
  fiveDayLosers: UsEtfSignal[];
}

export function isUsEtfP1Enabled(env: Environment = process.env): boolean {
  return env.ENABLE_US_ETF_P1?.trim().toLowerCase() === "true";
}

export function buildUsEtfMoverSignals(
  input: UsEtfMoverInput,
): UsEtfMoverSignals {
  const eligibleCodes = new Set(
    input.universe.filter((record) => !record.etn).map((record) => record.code),
  );

  return {
    dailyGainers: keepBestRankPerCode(
      buildDailySignals(input.dailyGainers, eligibleCodes),
    ),
    dailyLosers: keepBestRankPerCode(
      buildDailySignals(input.dailyLosers, eligibleCodes),
    ),
    fiveDayGainers: keepBestRankPerCode(
      buildFiveDaySignals(input.fiveDayGainers, eligibleCodes),
    ),
    fiveDayLosers: keepBestRankPerCode(
      buildFiveDaySignals(input.fiveDayLosers, eligibleCodes),
    ),
  };
}

// Kiwoom 순위 목록은 같은 종목을 반복할 수 있다(페이지 경계 등). 신호 유형마다 종목당 최고 순위 하나만 남긴다.
function keepBestRankPerCode(signals: UsEtfSignal[]): UsEtfSignal[] {
  const seen = new Set<string>();
  return [...signals]
    .sort((a, b) => a.rank - b.rank)
    .filter((signal) => {
      if (seen.has(signal.code)) return false;
      seen.add(signal.code);
      return true;
    });
}

function buildDailySignals(
  rows: readonly UsDailyMoverInput[],
  eligibleCodes: ReadonlySet<string>,
): UsEtfSignal[] {
  return rows.flatMap((row) => {
    const endPrice = parseDirectionalPrice(row.endPrice);
    if (
      !eligibleCodes.has(row.code) ||
      !isValidSignal(row, row.returnPercent) ||
      endPrice === null
    )
      return [];
    return [
      {
        code: row.code,
        name: row.name,
        rank: row.rank,
        value: row.returnPercent,
        meta: { end_price: endPrice },
      },
    ];
  });
}

function buildFiveDaySignals(
  rows: readonly UsFiveDayMoverInput[],
  eligibleCodes: ReadonlySet<string>,
): UsEtfSignal[] {
  return rows.flatMap((row) => {
    const startPrice = parseDirectionalPrice(row.startPrice);
    const endPrice = parseDirectionalPrice(row.endPrice);
    if (
      !eligibleCodes.has(row.code) ||
      !isValidSignal(row, 0) ||
      startPrice === null ||
      endPrice === null ||
      startPrice === 0
    )
      return [];
    return [
      {
        code: row.code,
        name: row.name,
        rank: row.rank,
        value: roundPercent((endPrice / startPrice - 1) * 100),
        meta: { start_price: startPrice, end_price: endPrice },
      },
    ];
  });
}

function parseDirectionalPrice(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? Math.abs(parsed) : null;
}

function isValidSignal(
  row: { code: string; name: string; rank: number },
  value: number,
): boolean {
  return (
    Boolean(row.code.trim() && row.name.trim()) &&
    Number.isInteger(row.rank) &&
    row.rank > 0 &&
    Number.isFinite(value)
  );
}

function roundPercent(value: number): number {
  return Number(value.toFixed(6));
}
