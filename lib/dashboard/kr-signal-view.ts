export interface DashboardSignalRow {
  signalType: string;
  screen: "raw" | "liquid";
  name: string;
  value: number | null;
  valueUnit: string | null;
  rank: number | null;
}

export interface DashboardSignalSection {
  title: string;
  rows: DashboardSignalRow[];
}

const SECTION_TITLES: Record<string, string> = {
  "daily_price_gain:raw": "일간 상승 (전체)",
  "daily_price_gain:liquid": "일간 상승 (유동성)",
  "daily_price_loss:raw": "일간 하락 (전체)",
  "daily_price_loss:liquid": "일간 하락 (유동성)",
  "five_day_price_gain:raw": "5거래일 상승 (전체)",
  "five_day_price_gain:liquid": "5거래일 상승 (유동성)",
  "five_day_price_loss:raw": "5거래일 하락 (전체)",
  "five_day_price_loss:liquid": "5거래일 하락 (유동성)",
  "turnover_surge:raw": "거래대금 급증",
  "new_listing:raw": "신규 상장",
};

export function createDashboardSignalSections(rows: readonly DashboardSignalRow[]): DashboardSignalSection[] {
  const byKey = new Map<string, DashboardSignalRow[]>();
  for (const row of rows) {
    const key = `${row.signalType}:${row.screen}`;
    const group = byKey.get(key) ?? [];
    group.push(row);
    byKey.set(key, group);
  }
  return [...byKey.entries()].map(([key, sectionRows]) => ({
    title: SECTION_TITLES[key] ?? key,
    rows: sectionRows.sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER)),
  }));
}

export function formatDashboardSignalValue(row: DashboardSignalRow): string {
  if (row.value === null) return "-";
  if (row.valueUnit === "percent") return `${row.value >= 0 ? "+" : ""}${row.value.toFixed(2)}%`;
  if (row.valueUnit === "ratio") return `${row.value.toFixed(2)}배`;
  return row.valueUnit === "event" ? "신규" : String(row.value);
}
