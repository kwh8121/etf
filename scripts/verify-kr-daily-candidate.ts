import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { KR_PRICE_SIGNAL_STRATEGY_VERSION } from "../lib/signals/kr-signal-repository.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";

/**
 * KR P0 신호의 고정 상위 10건 구간. `new_listing`·`turnover_surge`는 그날 실제
 * 이벤트 수에 따라 0건 이상으로 달라지는 가변 신호라 여기 포함하지 않는다
 * (2026-09-30 방법론 정정: 총 행 수를 "정확히 80"으로 판정하지 않는다).
 */
export const FIXED_KR_P0_SECTIONS = [
  "daily_price_gain:raw",
  "daily_price_gain:liquid",
  "daily_price_loss:raw",
  "daily_price_loss:liquid",
  "five_day_price_gain:raw",
  "five_day_price_gain:liquid",
  "five_day_price_loss:raw",
  "five_day_price_loss:liquid",
] as const;
const FIXED_ROWS_PER_SECTION = 10;

interface SignalRunRow {
  id: string;
  status: string;
  notes: Record<string, unknown> | null;
}

interface SignalDailyRow {
  signal_type: string;
  screen: "raw" | "liquid";
}

export interface KrDailyVerification {
  basDd: string;
  runId: string | null;
  found: boolean;
  status: string | null;
  krFullSignalComplete: boolean;
  telegramReportedAt: string | null;
  fixedTypeCounts: Record<string, number>;
  fixedTypesOk: boolean;
  variableTypeCounts: Record<string, number>;
  totalRows: number;
  duplicateRunCount: number;
  reportedMarkerCount: number;
  tradingCalendarStatus: string | null;
  ok: boolean;
  reasons: string[];
}

function throwIfError(error: unknown, context: string): void {
  if (error) throw new Error(`${context} failed: ${(error as { message?: string }).message ?? String(error)}`);
}

function isFixedSection(key: string): key is (typeof FIXED_KR_P0_SECTIONS)[number] {
  return (FIXED_KR_P0_SECTIONS as readonly string[]).includes(key);
}

/**
 * KR 신호 실행이 있는 가장 최근 기준일을 읽기 전용으로 찾는다. KR timer 보충은 마지막
 * 거래일 1건을 보고하므로, 실행 직후의 가장 최근 기준일이 방금 보고된 날짜다.
 */
export async function resolveLatestKrBasDd(): Promise<string | null> {
  const { data, error } = await createServiceRoleClient()
    .from("signal_run")
    .select("bas_dd")
    .eq("market", "KR")
    .eq("strategy_version", KR_PRICE_SIGNAL_STRATEGY_VERSION)
    .order("bas_dd", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error, "read latest KR signal run date");
  return (data as { bas_dd: string } | null)?.bas_dd ?? null;
}

/**
 * KR 완전 거래일 완전성 후보를 운영 Supabase에서 읽기 전용으로 대조한다.
 * 어떤 경우에도 쓰기를 수행하지 않는다.
 */
export async function verifyKrDailyCandidate(
  basDd: string,
  runId?: string,
): Promise<KrDailyVerification> {
  const client = createServiceRoleClient();
  const reasons: string[] = [];

  const { data: runs, error: runsError } = await client
    .from("signal_run")
    .select("id,status,notes")
    .eq("market", "KR")
    .eq("bas_dd", basDd)
    .eq("strategy_version", KR_PRICE_SIGNAL_STRATEGY_VERSION);
  throwIfError(runsError, "read KR signal runs for date");

  const rows = (runs ?? []) as SignalRunRow[];
  const duplicateRunCount = rows.length;
  const reportedMarkerCount = rows.filter(
    (row) => typeof row.notes?.telegram_reported_at === "string",
  ).length;
  const target = runId ? rows.find((row) => row.id === runId) : rows[0];

  if (duplicateRunCount === 0) reasons.push(`signal_run을 찾을 수 없음 (market=KR, bas_dd=${basDd})`);
  if (duplicateRunCount > 1) reasons.push(`같은 기준일에 signal_run이 ${duplicateRunCount}건 있음(중복)`);
  if (reportedMarkerCount > 1) reasons.push(`telegram_reported_at 표식이 ${reportedMarkerCount}건 있음(중복 발송 의심)`);

  if (!target) {
    return {
      basDd,
      runId: runId ?? null,
      found: false,
      status: null,
      krFullSignalComplete: false,
      telegramReportedAt: null,
      fixedTypeCounts: {},
      fixedTypesOk: false,
      variableTypeCounts: {},
      totalRows: 0,
      duplicateRunCount,
      reportedMarkerCount,
      tradingCalendarStatus: null,
      ok: false,
      reasons: [...reasons, "대상 run을 찾을 수 없음"],
    };
  }

  const notes = target.notes ?? {};
  const krFullSignalComplete = notes.kr_full_signal_complete === true;
  const telegramReportedAt = typeof notes.telegram_reported_at === "string" ? notes.telegram_reported_at : null;

  const [dailyResult, calendarResult] = await Promise.all([
    client.from("signal_daily").select("signal_type,screen").eq("run_id", target.id),
    client.from("trading_calendar_kr").select("status").eq("bas_dd", basDd).maybeSingle(),
  ]);
  throwIfError(dailyResult.error, "read signal_daily rows");
  throwIfError(calendarResult.error, "read trading_calendar_kr status");

  const counts = new Map<string, number>();
  for (const row of (dailyResult.data ?? []) as SignalDailyRow[]) {
    const key = `${row.signal_type}:${row.screen}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const fixedTypeCounts: Record<string, number> = {};
  const mismatches: string[] = [];
  for (const key of FIXED_KR_P0_SECTIONS) {
    const count = counts.get(key) ?? 0;
    fixedTypeCounts[key] = count;
    if (count !== FIXED_ROWS_PER_SECTION) mismatches.push(`${key}=${count}(기대 ${FIXED_ROWS_PER_SECTION})`);
  }
  if (mismatches.length > 0) reasons.push(`고정 P0 유형 행 수 불일치: ${mismatches.join(", ")}`);

  const variableTypeCounts: Record<string, number> = {};
  for (const [key, count] of counts) if (!isFixedSection(key)) variableTypeCounts[key] = count;

  const totalRows = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const tradingCalendarStatus =
    ((calendarResult.data as { status?: string } | null)?.status as string | undefined) ?? null;

  if (target.status !== "COMPLETED") reasons.push(`signal_run 상태가 COMPLETED 아님: ${target.status}`);
  if (!krFullSignalComplete) reasons.push("notes.kr_full_signal_complete가 true 아님");
  if (!telegramReportedAt) reasons.push("notes.telegram_reported_at 없음");
  if (tradingCalendarStatus !== "TRADING_COMPLETE")
    reasons.push(`trading_calendar_kr 상태가 TRADING_COMPLETE 아님: ${tradingCalendarStatus ?? "없음"}`);

  return {
    basDd,
    runId: target.id,
    found: true,
    status: target.status,
    krFullSignalComplete,
    telegramReportedAt,
    fixedTypeCounts,
    fixedTypesOk: mismatches.length === 0,
    variableTypeCounts,
    totalRows,
    duplicateRunCount,
    reportedMarkerCount,
    tradingCalendarStatus,
    ok: reasons.length === 0,
    reasons,
  };
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  const runId = process.argv[3];
  if (!arg) {
    console.error("usage: verify-kr-daily-candidate <bas_dd YYYY-MM-DD | latest> [runId]");
    process.exitCode = 1;
    return;
  }
  const basDd = arg === "latest" ? await resolveLatestKrBasDd() : arg;
  if (!basDd) {
    console.error("KR signal run이 하나도 없어 최근 기준일을 찾을 수 없습니다.");
    process.exitCode = 1;
    return;
  }
  const result = await verifyKrDailyCandidate(basDd, runId);
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error: unknown) => {
    console.error(`KR daily candidate verification failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  });
}
