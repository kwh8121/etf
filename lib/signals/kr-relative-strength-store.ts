import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  KrRelativeStrengthMarketRow,
  KrRelativeStrengthSignalRow,
} from "./kr-relative-strength";

interface TradingCalendarRow {
  bas_dd: string;
  seq: number | null;
  status: string;
}

interface KrDailyIndexRow {
  bas_dd: string;
  isu_cd: string;
  idx_nm: string | null;
  idx_close: number | string | null;
  idx_fluc_rt: number | string | null;
}

const DAILY_SIGNAL_TYPES = new Set(["daily_price_gain", "daily_price_loss"]);
const FIVE_DAY_SIGNAL_TYPES = new Set([
  "five_day_price_gain",
  "five_day_price_loss",
]);

export async function readKrRelativeStrengthMarketRows(
  client: SupabaseClient,
  basDd: string,
  signals: readonly KrRelativeStrengthSignalRow[],
): Promise<{
  currentRows: KrRelativeStrengthMarketRow[];
  startRows: KrRelativeStrengthMarketRow[];
}> {
  const priceSignals = signals.filter(
    (signal) =>
      DAILY_SIGNAL_TYPES.has(signal.signalType) ||
      FIVE_DAY_SIGNAL_TYPES.has(signal.signalType),
  );
  const codes = [...new Set(priceSignals.map((signal) => signal.code))];
  if (codes.length === 0) return { currentRows: [], startRows: [] };

  const needsFiveDayWindow = priceSignals.some((signal) =>
    FIVE_DAY_SIGNAL_TYPES.has(signal.signalType),
  );
  const startBasDd = needsFiveDayWindow
    ? await readFiveDayStartDate(client, basDd)
    : null;
  const dates = startBasDd ? [basDd, startBasDd] : [basDd];
  const { data, error } = await client
    .from("etf_daily_kr")
    .select("bas_dd,isu_cd,idx_nm,idx_close,idx_fluc_rt")
    .in("bas_dd", dates)
    .in("isu_cd", codes);
  if (error) {
    throw new Error(
      `Supabase read KR relative-strength rows failed: ${error.message}`,
    );
  }

  const rows = (data ?? []) as KrDailyIndexRow[];
  const toMarketRow = (row: KrDailyIndexRow): KrRelativeStrengthMarketRow => ({
    code: row.isu_cd,
    idxNm: row.idx_nm,
    idxClose: row.idx_close,
    idxFlucRt: row.idx_fluc_rt,
  });
  return {
    currentRows: rows.filter((row) => row.bas_dd === basDd).map(toMarketRow),
    startRows: startBasDd
      ? rows.filter((row) => row.bas_dd === startBasDd).map(toMarketRow)
      : [],
  };
}

async function readFiveDayStartDate(
  client: SupabaseClient,
  basDd: string,
): Promise<string | null> {
  const { data: current, error: currentError } = await client
    .from("trading_calendar_kr")
    .select("bas_dd,seq,status")
    .eq("bas_dd", basDd)
    .eq("status", "TRADING_COMPLETE")
    .maybeSingle();
  if (currentError || !current) return null;

  const currentRow = current as TradingCalendarRow;
  if (currentRow.seq === null || !Number.isInteger(currentRow.seq)) return null;
  const startSeq = currentRow.seq - 5;
  const { data, error } = await client
    .from("trading_calendar_kr")
    .select("bas_dd,seq,status")
    .eq("status", "TRADING_COMPLETE")
    .gte("seq", startSeq)
    .lte("seq", currentRow.seq)
    .order("seq", { ascending: true })
    .limit(6);
  if (error || !data || data.length !== 6) return null;

  const window = data as TradingCalendarRow[];
  const isContinuous = window.every(
    (row, index) => row.seq === startSeq + index,
  );
  return isContinuous ? window[0].bas_dd : null;
}
