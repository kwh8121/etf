import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getRequiredServerSecret } from "../lib/config/server-env.ts";
import { KrxClient } from "../lib/market-data/krx-client.ts";
import { assertValidKrxRequestDate } from "../lib/market-data/krx-date.ts";
import { type MarketDataRepository, SupabaseMarketDataRepository } from "../lib/market-data/repository.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";
import { runKrxIngestion } from "./ingest-kr.ts";

const DEFAULT_TARGET_COMPLETE_DAYS = 25;
const DEFAULT_MAX_CALENDAR_DAYS = 90;

export interface BackfillDependencies {
  repository: Pick<MarketDataRepository, "getCompleteTradingDayCount">;
  ingestKrx: (requestedDate: string) => Promise<{ status: string }>;
}

export interface BackfillOptions {
  startDate: string;
  targetCompleteDays?: number;
  maxCalendarDays?: number;
}

export async function runKoreanMarketBackfill(
  dependencies: BackfillDependencies,
  options: BackfillOptions,
) {
  assertValidKrxRequestDate(options.startDate);
  const targetCompleteDays = options.targetCompleteDays ?? DEFAULT_TARGET_COMPLETE_DAYS;
  const maxCalendarDays = options.maxCalendarDays ?? DEFAULT_MAX_CALENDAR_DAYS;
  if (!Number.isInteger(targetCompleteDays) || targetCompleteDays < 1) {
    throw new Error("targetCompleteDays must be a positive integer");
  }
  if (!Number.isInteger(maxCalendarDays) || maxCalendarDays < 1) {
    throw new Error("maxCalendarDays must be a positive integer");
  }

  let completeDays = await dependencies.repository.getCompleteTradingDayCount();
  const initialCompleteDays = completeDays;
  const attemptedDates: string[] = [];
  const statusCounts: Record<string, number> = {};
  let requestedDate = options.startDate;

  for (let attempt = 0; attempt < maxCalendarDays && completeDays < targetCompleteDays; attempt += 1) {
    attemptedDates.push(requestedDate);
    const result = await dependencies.ingestKrx(requestedDate);
    statusCounts[result.status] = (statusCounts[result.status] ?? 0) + 1;
    if (result.status === "TRADING_COMPLETE") {
      completeDays = await dependencies.repository.getCompleteTradingDayCount();
    }
    requestedDate = previousCalendarDate(requestedDate);
  }

  return {
    initialCompleteDays,
    completeDays,
    reachedTarget: completeDays >= targetCompleteDays,
    attemptedDates,
    statusCounts,
  };
}

export function previousCalendarDate(value: string): string {
  assertValidKrxRequestDate(value);
  const date = new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8))));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function getKstDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}${value("month")}${value("day")}`;
}

async function main(): Promise<void> {
  const startDate = process.argv[2] ?? previousCalendarDate(getKstDate());
  const repository = new SupabaseMarketDataRepository(createServiceRoleClient());
  const observedDate = getKstDate();
  const krxClient = new KrxClient({ authKey: getRequiredServerSecret("KRX_API_KEY") });
  const result = await runKoreanMarketBackfill(
    {
      repository,
      ingestKrx: (requestedDate) =>
        runKrxIngestion({
          requestedDate,
          observedDate,
          observationKey: () => `kr-backfill-${randomUUID()}`,
          repository,
          krxClient,
        }),
    },
    { startDate },
  );

  console.log(JSON.stringify(result));
  if (!result.reachedTarget) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown backfill failure";
    console.error(`backfill failed: ${message}`);
    process.exitCode = 1;
  });
}
