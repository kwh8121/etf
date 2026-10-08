const CANONICAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPACT_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function normalizeBasDd(input: string): string | null {
  const match = CANONICAL_PATTERN.exec(input) ?? COMPACT_PATTERN.exec(input);
  if (!match) return null;
  const canonical = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${canonical}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Date는 2026-02-30을 3월 2일로 넘긴다. 왕복 비교로 걸러낸다.
  return parsed.toISOString().slice(0, 10) === canonical ? canonical : null;
}

export function formatBasDdLabel(basDd: string): string {
  const parsed = new Date(`${basDd}T00:00:00.000Z`);
  return `${basDd} (${WEEKDAY_LABELS[parsed.getUTCDay()]})`;
}
