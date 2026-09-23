import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getRequiredServerSecret } from "../lib/config/server-env.ts";
import { KiwoomClient } from "../lib/market-data/kiwoom.ts";
import { KrxClient } from "../lib/market-data/krx-client.ts";
import { assertValidKrxRequestDate } from "../lib/market-data/krx-date.ts";
import { SupabaseMarketDataRepository } from "../lib/market-data/repository.ts";
import { shouldSendKoreanDailyStatus } from "../lib/notifications/kr-daily-status.ts";
import {
  KR_PRICE_SIGNAL_STRATEGY_VERSION,
  markTelegramReported,
} from "../lib/signals/kr-signal-repository.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";
import { generateKrxPriceSignals } from "./generate-kr-price-signals.ts";
import { runKiwoomMasterSync, runKrxIngestion } from "./ingest-kr.ts";
import { reportLatestKrxSignals } from "./report-kr-signals.ts";
import { markNewListingAlerts, sendKoreanDailyStatus } from "./run-kr-daily.ts";

type CalendarStatus = "TRADING_COMPLETE" | "NON_TRADING" | "PUBLISH_PENDING" | "PARTIAL" | "FETCH_FAIL";

interface CatchupDependencies {
  status(date: string): Promise<CalendarStatus | null>;
  ingest(date: string): Promise<CalendarStatus>;
  signalComplete(date: string): Promise<boolean>;
  generate(date: string): Promise<unknown>;
}

export function missingWeekdays(from: string, today: string): string[] {
  assertValidKrxRequestDate(from);
  assertValidKrxRequestDate(today);
  const start = new Date(`${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6)}T00:00:00Z`);
  const end = new Date(`${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6)}T00:00:00Z`);
  const days: string[] = [];
  for (let day = start; day < end; day = new Date(day.getTime() + 86_400_000)) {
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6)
      days.push(day.toISOString().slice(0, 10).replaceAll("-", ""));
  }
  return days;
}

export async function catchUpKoreanTradingDays(
  days: readonly string[],
  dependencies: CatchupDependencies,
): Promise<{ completed: string[]; nonTrading: string[]; blocked: string | null }> {
  const completed: string[] = [];
  const nonTrading: string[] = [];
  let recalculateFollowing = false;
  for (const date of days) {
    const existing = await dependencies.status(date);
    const status = existing === "TRADING_COMPLETE"
      ? existing
      : await dependencies.ingest(date);
    if (status === "NON_TRADING") {
      nonTrading.push(date);
      continue;
    }
    if (status !== "TRADING_COMPLETE")
      return { completed, nonTrading, blocked: date };
    if (existing !== "TRADING_COMPLETE") recalculateFollowing = true;
    if (recalculateFollowing || !(await dependencies.signalComplete(date)))
      await dependencies.generate(date);
    completed.push(date);
  }
  return { completed, nonTrading, blocked: null };
}

interface KiwoomSyncResult {
  status: string;
  snapshotId: string;
  duplicate: boolean;
  newListingCount: number;
}

export interface LatestReportDependencies {
  alreadyReported(date: string): Promise<boolean>;
  syncKiwoom(): Promise<KiwoomSyncResult>;
  generate(date: string): Promise<{ runId: string }>;
  report(runId: string): Promise<void>;
  markListingAlerts(runId: string): Promise<void>;
  sendStatusIfNeeded(date: string, runId: string, kiwoom: KiwoomSyncResult): Promise<void>;
  markReported(runId: string): Promise<void>;
}

export type LatestReportResult =
  | { reported: true; date: string; runId: string; kiwoomStatus: string }
  | { reported: false; date: string | null; reason: "no_trading_day" | "already_reported" };

// timer 경로에서 M6 완전 거래일 증거를 남기도록 보충의 마지막 거래일 1건만
// Kiwoom 동기화·신호 재생성·Telegram 보고까지 수행한다. 표식은 발송 성공 직후, 후속 단계보다 먼저 남긴다.
export async function reportLatestCatchupDay(
  completed: readonly string[],
  dependencies: LatestReportDependencies,
): Promise<LatestReportResult> {
  const date = completed.at(-1);
  if (!date) return { reported: false, date: null, reason: "no_trading_day" };
  if (await dependencies.alreadyReported(date))
    return { reported: false, date, reason: "already_reported" };
  const kiwoom = await dependencies.syncKiwoom();
  const { runId } = await dependencies.generate(date);
  await dependencies.report(runId);
  await dependencies.markReported(runId);
  await dependencies.markListingAlerts(runId);
  await dependencies.sendStatusIfNeeded(date, runId, kiwoom);
  return { reported: true, date, runId, kiwoomStatus: kiwoom.status };
}

function toIsoDate(date: string): string {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function kstToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}${value("month")}${value("day")}`;
}

async function main(): Promise<void> {
  const from = process.argv[2] ?? "20260922";
  const today = kstToday();
  const days = missingWeekdays(from, today);
  const client = createServiceRoleClient();
  const repository = new SupabaseMarketDataRepository(client);
  const krxClient = new KrxClient({ authKey: getRequiredServerSecret("KRX_API_KEY") });
  const result = await catchUpKoreanTradingDays(days, {
    async status(date) {
      const { data, error } = await client.from("trading_calendar_kr")
        .select("status").eq("bas_dd", toIsoDate(date)).maybeSingle();
      if (error) throw new Error(`KR calendar read failed: ${error.message}`);
      return (data?.status as CalendarStatus | undefined) ?? null;
    },
    async ingest(date) {
      const result = await runKrxIngestion({
        requestedDate: date,
        observedDate: today,
        observationKey: () => `kr-catchup-${randomUUID()}`,
        repository,
        krxClient,
      });
      return result.status as CalendarStatus;
    },
    async signalComplete(date) {
      const { data, error } = await client.from("signal_run").select("notes")
        .eq("market", "KR").eq("bas_dd", toIsoDate(date))
        .eq("strategy_version", KR_PRICE_SIGNAL_STRATEGY_VERSION)
        .eq("status", "COMPLETED")
        .order("completed_at", { ascending: false }).limit(1);
      if (error) throw new Error(`KR signal run read failed: ${error.message}`);
      return (data ?? []).some((row) =>
        typeof row.notes === "object" && row.notes !== null &&
        "kr_full_signal_complete" in row.notes && row.notes.kr_full_signal_complete === true,
      );
    },
    generate: generateKrxPriceSignals,
  });
  if (result.blocked) {
    console.log(JSON.stringify({ ...result, report: null }));
    process.exitCode = 1;
    return;
  }
  const kiwoomClient = new KiwoomClient({
    appKey: getRequiredServerSecret("KIWOOM_APP_KEY"),
    secretKey: getRequiredServerSecret("KIWOOM_SECRET_KEY"),
  });
  const report = await reportLatestCatchupDay(result.completed, {
    async alreadyReported(date) {
      const { data, error } = await client.from("signal_run").select("id")
        .eq("market", "KR").eq("bas_dd", toIsoDate(date))
        .eq("strategy_version", KR_PRICE_SIGNAL_STRATEGY_VERSION)
        .not("notes->>telegram_reported_at", "is", null).limit(1);
      if (error) throw new Error(`KR report marker read failed: ${error.message}`);
      return (data ?? []).length > 0;
    },
    syncKiwoom: () => runKiwoomMasterSync({
      requestedDate: result.completed.at(-1) ?? today,
      observedDate: today,
      observationKey: () => `kr-timer-${randomUUID()}`,
      repository,
      krxClient,
      kiwoomClient,
    }),
    generate: generateKrxPriceSignals,
    async report(runId) {
      await reportLatestKrxSignals(true, runId);
    },
    markListingAlerts: markNewListingAlerts,
    async sendStatusIfNeeded(date, runId, kiwoom) {
      // 보고 대상일은 보충에서 이미 TRADING_COMPLETE로 확인됐다.
      const ingestion = {
        krx: { status: "TRADING_COMPLETE", snapshotId: runId, duplicate: false },
        kiwoom,
      };
      if (shouldSendKoreanDailyStatus(ingestion))
        await sendKoreanDailyStatus(date, ingestion);
    },
    markReported: (runId) => markTelegramReported(client, runId),
  });
  console.log(JSON.stringify({ ...result, report }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error: unknown) => {
    console.error(`KR catchup failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  });
}
