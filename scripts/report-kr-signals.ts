import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getRequiredServerSecret } from "../lib/config/server-env.ts";
import { resolveKrSignalWebUrl } from "../lib/config/web-url.ts";
import {
  formatTelegramReport,
  sendTelegramMessages,
  type TelegramReportSection,
} from "../lib/notifications/telegram.ts";
import {
  formatReportedRankChangeLines,
} from "../lib/signals/report-rank-changes.ts";
import { KR_PRICE_SIGNAL_STRATEGY_VERSION } from "../lib/signals/kr-signal-repository.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";

interface SignalRunRow {
  id: string;
  bas_dd: string;
  status: "COMPLETED" | "PENDING" | "PARTIAL" | "FAILED";
}

interface SignalDailyRow {
  code: string;
  signal_type: string;
  name: string;
  value: number | string | null;
  value_unit: string | null;
  rank: number | null;
  screen: "raw" | "liquid";
}

export async function reportLatestKrxSignals(
  send = false,
  runId?: string,
): Promise<{ runId: string; messageCount: number; sent: boolean }> {
  const client = createServiceRoleClient();
  let runQuery = client
    .from("signal_run")
    .select("id,bas_dd,status")
    .eq("market", "KR")
    .eq("strategy_version", KR_PRICE_SIGNAL_STRATEGY_VERSION);
  if (runId) runQuery = runQuery.eq("id", runId);
  const { data: run, error: runError } = await (runId
    ? runQuery.single()
    : runQuery
        .order("bas_dd", { ascending: false })
        .order("completed_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .single());
  throwIfError(runError, "read latest KR signal run");
  const latest = run as SignalRunRow;
  const [rows, previousRun] = await Promise.all([
    readSignalRows(client, latest.id),
    readPreviousKrRun(client, latest),
  ]);
  const previousRows = previousRun
    ? await readSignalRows(client, previousRun.id)
    : null;

  const messages = formatTelegramReport({
    market: "KR",
    basDd: latest.bas_dd,
    status: latest.status,
    runId: latest.id,
    source: "KRX etf_bydd_trd, Kiwoom ka10099",
    sections: createSections(rows, previousRows),
    webUrl: resolveKrSignalWebUrl(latest.bas_dd),
  });
  if (send) {
    await sendTelegramMessages({
      token: getRequiredServerSecret("TELEGRAM_BOT_TOKEN"),
      chatId: getRequiredServerSecret("TELEGRAM_CHAT_ID"),
      messages,
    });
  }
  return { runId: latest.id, messageCount: messages.length, sent: send };
}

function createSections(
  rows: readonly SignalDailyRow[],
  previousRows: readonly SignalDailyRow[] | null,
): TelegramReportSection[] {
  const groups = new Map<string, SignalDailyRow[]>();
  const previousGroups = new Map<string, SignalDailyRow[]>();
  for (const row of rows) {
    const key = `${row.signal_type}:${row.screen}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const row of previousRows ?? []) {
    const key = `${row.signal_type}:${row.screen}`;
    const group = previousGroups.get(key) ?? [];
    group.push(row);
    previousGroups.set(key, group);
  }
  const keys = new Set([...groups.keys(), ...previousGroups.keys()]);
  return [...keys].map((key) => {
    const entries = groups.get(key) ?? [];
    return {
      title: sectionTitle(key),
      lines: formatReportedRankChangeLines(
        entries,
        previousRows ? (previousGroups.get(key) ?? []) : null,
        (entry) => `${entry.rank ?? "-"}. ${entry.name} ${formatValue(entry)}`,
      ),
    };
  });
}

async function readSignalRows(
  client: ReturnType<typeof createServiceRoleClient>,
  runId: string,
): Promise<SignalDailyRow[]> {
  const { data, error } = await client
    .from("signal_daily")
    .select("code,signal_type,name,value,value_unit,rank,screen")
    .eq("run_id", runId)
    .order("signal_type")
    .order("screen")
    .order("rank");
  throwIfError(error, "read KR signal results");
  return (data ?? []) as SignalDailyRow[];
}

async function readPreviousKrRun(
  client: ReturnType<typeof createServiceRoleClient>,
  latest: SignalRunRow,
): Promise<SignalRunRow | null> {
  const { data, error } = await client
    .from("signal_run")
    .select("id,bas_dd,status")
    .eq("market", "KR")
    .eq("strategy_version", KR_PRICE_SIGNAL_STRATEGY_VERSION)
    .eq("status", "COMPLETED")
    .lt("bas_dd", latest.bas_dd)
    .order("bas_dd", { ascending: false })
    .order("completed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error, "read previous KR signal run");
  return data as SignalRunRow | null;
}

function sectionTitle(key: string): string {
  const titles: Record<string, string> = {
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
  return titles[key] ?? key;
}

function formatValue(row: SignalDailyRow): string {
  if (row.value === null) return "";
  const value = Number(row.value);
  if (row.value_unit === "percent")
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  if (row.value_unit === "ratio") return `${value.toFixed(2)}배`;
  return row.value_unit === "event" ? "신규" : String(value);
}

function throwIfError(
  error: { message: string } | null,
  operation: string,
): void {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message}`);
}

async function main(): Promise<void> {
  const result = await reportLatestKrxSignals(process.argv.includes("--send"));
  console.log(JSON.stringify(result));
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Telegram report failure";
    console.error(`KR signal report failed: ${message}`);
    process.exitCode = 1;
  });
}
