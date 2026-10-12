import { formatBasDdLabel, normalizeBasDd } from "./bas-dd.ts";

// US 응답에는 공식 시장일이 없어 화면·링크·대조의 날짜 단위는 run의 관측 시각을 한국 시간으로 환산한 날짜다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 관측 시각(UTC ISO)을 한국 시간 날짜(YYYY-MM-DD)로 바꾼다. */
export function toKstDate(observedAt: string): string {
  return new Date(new Date(observedAt).getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** 한국 날짜 하루를 UTC 반열린 구간 [from, to)로 바꾼다. */
export function kstDayBoundsUtc(kstDate: string): { from: string; to: string } {
  const start = new Date(`${kstDate}T00:00:00.000Z`).getTime() - KST_OFFSET_MS;
  return {
    from: new Date(start).toISOString(),
    to: new Date(start + DAY_MS).toISOString(),
  };
}

export function normalizeObsDate(input: string): string | null {
  return normalizeBasDd(input);
}

/** 미국 거래일로 오인하지 않도록 한국 시간 관측일임을 라벨에 드러낸다. */
export function formatObsDateLabel(obsDate: string): string {
  return `한국 시간 ${formatBasDdLabel(obsDate)} 관측`;
}

/** 한국 시간 HH:mm. 같은 관측일의 어느 run인지 알아보게 하는 표시용이다. */
export function formatKstTime(observedAt: string): string {
  return new Date(new Date(observedAt).getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(11, 16);
}

export type UsSignalPeriod = "daily" | "five_day";
export type UsSignalDirection = "gain" | "loss";

/** 기간·방향에 대응하는 US `signal_type`. */
export function usSignalType(period: UsSignalPeriod, direction: UsSignalDirection): string {
  return `${period}_price_${direction}`;
}
