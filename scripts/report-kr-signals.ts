import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getRequiredServerSecret } from "../lib/config/server-env.ts";
import { resolveKrSignalWebUrl } from "../lib/config/web-url.ts";
import { formatEtfDetailLink } from "../lib/notifications/etf-detail-link.ts";
import {
  formatTelegramReport,
  sendTelegramMessages,
  type TelegramReportSection,
} from "../lib/notifications/telegram.ts";
import { formatReportedRankChangeLines } from "../lib/signals/report-rank-changes.ts";
import {
  auditKrListingCorrectionProposals,
  auditRunAccuracy,
  type AuditRunAccuracyResult,
  type KrListingCorrectionProposal,
} from "../lib/signals/data-accuracy.ts";
import { SupabaseDataAccuracyStore } from "../lib/signals/data-accuracy-store.ts";
import { KR_PRICE_SIGNAL_STRATEGY_VERSION } from "../lib/signals/kr-signal-repository.ts";
import { readAllRows } from "../lib/supabase/read-all-rows.ts";
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
  const [dryRunRows, previousRun] = await Promise.all([
    send ? Promise.resolve(null) : readSignalRows(client, latest.id),
    readPreviousKrRun(client, latest),
  ]);
  if (send) await assertKrAccuracyForSend(client, latest, previousRun);
  const rows = send ? await readSignalRows(client, latest.id) : rowsOrNull(dryRunRows);
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
    html: true,
  });
  if (send) {
    await sendTelegramMessages({
      token: getRequiredServerSecret("TELEGRAM_BOT_TOKEN"),
      chatId: getRequiredServerSecret("TELEGRAM_CHAT_ID"),
      messages,
      parseMode: "HTML",
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
        (entry) =>
          `${entry.rank ?? "-"}. ${formatEtfDetailLink("KR", entry.code, entry.name)} ${formatValue(entry)}`,
        (entry) =>
          `${entry.rank ?? "-"}. ${formatEtfDetailLink("KR", entry.code, entry.name)}`,
      ),
    };
  });
}

async function readSignalRows(
  client: ReturnType<typeof createServiceRoleClient>,
  runId: string,
): Promise<SignalDailyRow[]> {
  return readAllRows<SignalDailyRow>({
    operation: "read KR signal results",
    createQuery: () =>
      client
        .from("signal_daily")
        .select("code,signal_type,name,value,value_unit,rank,screen", {
          count: "exact",
        })
        .eq("run_id", runId),
    orderBy: [
      { column: "signal_type" },
      { column: "screen" },
      { column: "rank" },
      { column: "code" },
    ],
    getKey: (row) =>
      `${row.signal_type}:${row.screen}:${row.rank ?? "none"}:${row.code}`,
  });
}

function rowsOrNull(rows: SignalDailyRow[] | null): SignalDailyRow[] {
  if (!rows) throw new Error("KR report rows were not loaded");
  return rows;
}

async function assertKrAccuracyForSend(
  client: ReturnType<typeof createServiceRoleClient>,
  latest: SignalRunRow,
  previousRun: SignalRunRow | null,
): Promise<void> {
  const store = new SupabaseDataAccuracyStore(client);
  const currentAccuracy = await auditRunAccuracy(client, latest.id, { store });
  throwIfRunAccuracyFailed("current", currentAccuracy);
  if (previousRun) {
    const previousAccuracy = await auditRunAccuracy(client, previousRun.id, {
      store,
    });
    throwIfRunAccuracyFailed("previous", previousAccuracy);
  }
  const listingAccuracy = await auditKrListingCorrectionProposals(client, {
    store,
  });
  throwIfListingAccuracyFailed(listingAccuracy);
}

function throwIfRunAccuracyFailed(
  label: "current" | "previous",
  result: AuditRunAccuracyResult,
): void {
  if (result.ok) return;
  throw new Error(
    `KR ${label} run accuracy audit failed: ${compactRunAccuracyReasons(result).join("; ")}`,
  );
}

function throwIfListingAccuracyFailed(
  result: KrListingCorrectionProposal,
): void {
  if (result.ok) return;
  throw new Error(
    `KR listing accuracy audit failed: ${compactListingAccuracyReasons(result).join("; ")}`,
  );
}

function compactRunAccuracyReasons(result: AuditRunAccuracyResult): string[] {
  return result.reasons.length > 0
    ? result.reasons
    : [
        `added=${result.diffs.added.length}`,
        `removed=${result.diffs.removed.length}`,
        `changed=${result.diffs.changed.length}`,
      ];
}

function compactListingAccuracyReasons(
  result: KrListingCorrectionProposal,
): string[] {
  return [
    ...(result.falseListingEvents.length > 0
      ? [`falseListingEvents=${result.falseListingEvents.length}`]
      : []),
    ...(result.masterFirstSeenCorrections.length > 0
      ? [`masterFirstSeenCorrections=${result.masterFirstSeenCorrections.length}`]
      : []),
    ...(result.sourceIntegrity.some((item) => !item.ok)
      ? ["sourceIntegrityFailed"]
      : []),
    ...(result.approvalReady ? [] : ["listingApprovalEvidenceNotReady"]),
  ];
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
