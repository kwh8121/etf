export interface ReportedRankRow {
  code: string;
  name: string;
  rank: number | null;
}

export interface ReportedRankChanges {
  rankInCodes: ReadonlySet<string>;
  rankOut: ReportedRankRow[];
}

export function compareReportedRanks(
  current: readonly ReportedRankRow[],
  previous: readonly ReportedRankRow[] | null,
): ReportedRankChanges {
  if (!previous) return { rankInCodes: new Set(), rankOut: [] };
  const currentCodes = new Set(current.map((row) => row.code));
  const previousCodes = new Set(previous.map((row) => row.code));
  return {
    rankInCodes: new Set(
      current.filter((row) => !previousCodes.has(row.code)).map((row) => row.code),
    ),
    rankOut: previous.filter((row) => !currentCodes.has(row.code)),
  };
}

export function formatReportedRankChangeLines<T extends ReportedRankRow>(
  current: readonly T[],
  previous: readonly ReportedRankRow[] | null,
  formatCurrent: (row: T) => string,
): string[] {
  const changes = compareReportedRanks(current, previous);
  const currentLines = current.map((row) =>
    `${formatCurrent(row)}${changes.rankInCodes.has(row.code) ? " · 랭크인" : ""}`,
  );
  if (changes.rankOut.length === 0) return currentLines;
  return [
    ...currentLines,
    "랭크아웃",
    ...changes.rankOut.map((row) => `${row.rank ?? "-"}. ${row.name}`),
  ];
}
