import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getRequiredServerSecret } from "../lib/config/server-env.ts";
import { KiwoomClient } from "../lib/market-data/kiwoom.ts";
import { KrxClient } from "../lib/market-data/krx-client.ts";
import { SupabaseMarketDataRepository } from "../lib/market-data/repository.ts";
import {
  createKoreanDailyStatusReport,
  shouldSendKoreanDailyStatus,
} from "../lib/notifications/kr-daily-status.ts";
import {
  formatTelegramReport,
  sendTelegramMessages,
} from "../lib/notifications/telegram.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";
import { generateKrxPriceSignals } from "./generate-kr-price-signals.ts";
import { runKoreanMarketIngestion } from "./ingest-kr.ts";
import { reportLatestKrxSignals } from "./report-kr-signals.ts";

export async function runKoreanDailyWorkflow(requestedDate = getKstDate()) {
  const repository = new SupabaseMarketDataRepository(
    createServiceRoleClient(),
  );
  const ingestion = await runKoreanMarketIngestion({
    requestedDate,
    observedDate: getKstDate(),
    observationKey: () => `kr-daily-${randomUUID()}`,
    repository,
    krxClient: new KrxClient({
      authKey: getRequiredServerSecret("KRX_API_KEY"),
    }),
    kiwoomClient: new KiwoomClient({
      appKey: getRequiredServerSecret("KIWOOM_APP_KEY"),
      secretKey: getRequiredServerSecret("KIWOOM_SECRET_KEY"),
    }),
  });
  const statusAlertRequired = shouldSendKoreanDailyStatus(ingestion);
  if (ingestion.krx.status !== "TRADING_COMPLETE" || ingestion.krx.duplicate) {
    await sendKoreanDailyStatus(requestedDate, ingestion);
    return { ingestion, signalRunId: null, telegramSent: true };
  }

  const signals = await generateKrxPriceSignals();
  await reportLatestKrxSignals(true);
  if (statusAlertRequired)
    await sendKoreanDailyStatus(requestedDate, ingestion);
  return { ingestion, signalRunId: signals.runId, telegramSent: true };
}

async function sendKoreanDailyStatus(
  requestedDate: string,
  ingestion: Awaited<ReturnType<typeof runKoreanMarketIngestion>>,
): Promise<void> {
  const statusReport = createKoreanDailyStatusReport({
    requestedDate,
    ...ingestion,
  });
  await sendTelegramMessages({
    token: getRequiredServerSecret("TELEGRAM_BOT_TOKEN"),
    chatId: getRequiredServerSecret("TELEGRAM_CHAT_ID"),
    messages: formatTelegramReport(statusReport),
  });
}

function getKstDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}${value("month")}${value("day")}`;
}

async function main(): Promise<void> {
  const result = await runKoreanDailyWorkflow(process.argv[2] || getKstDate());
  console.log(
    JSON.stringify({
      krxStatus: result.ingestion.krx.status,
      kiwoomStatus: result.ingestion.kiwoom.status,
      signalRunId: result.signalRunId,
      telegramSent: result.telegramSent,
    }),
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown KR daily workflow failure";
    console.error(`KR daily workflow failed: ${message}`);
    process.exitCode = 1;
  });
}
