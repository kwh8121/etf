import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getRequiredServerSecret } from "../lib/config/server-env.ts";
import {
  formatExperimentalTelegramReport,
  sendTelegramMessages,
  type TelegramReportSection,
} from "../lib/notifications/telegram.ts";
import {
  US_ETF_P1_DISCLOSURE,
  isUsEtfP1Enabled,
} from "../lib/signals/us-etf-movers.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";

const US_REPORT_LIMIT_PER_TYPE = 10;
const US_REPORT_SECTIONS = [
  ["daily_price_gain", "일간 상승"],
  ["daily_price_loss", "일간 하락"],
  ["five_day_price_gain", "5일 상승"],
  ["five_day_price_loss", "5일 하락"],
] as const;

export async function reportLatestUsEtfMovers(send = true, runId?: string) {
  const client = createServiceRoleClient();
  let query = client
    .from("signal_run")
    .select("id,observed_at,status")
    .eq("market", "US")
    .eq("strategy_version", "m5-us-etf-movers-p1-v1")
    .eq("status", "COMPLETED");
  query = runId
    ? query.eq("id", runId)
    : query
        .order("observed_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1);
  const { data: run, error: runError } = await query.maybeSingle();
  if (runError)
    throw new Error(
      `Supabase read latest US signal run failed: ${runError.message}`,
    );
  if (!run) return { runId: null, messageCount: 0 };

  const sections = await Promise.all(
    US_REPORT_SECTIONS.map(
      async ([signalType, title]): Promise<TelegramReportSection | null> => {
        const {
          data: rows,
          count,
          error,
        } = await client
          .from("signal_daily")
          .select("name,value,rank", { count: "exact" })
          .eq("run_id", run.id)
          .eq("market", "US")
          .eq("signal_type", signalType)
          .order("rank")
          .order("code")
          .limit(US_REPORT_LIMIT_PER_TYPE);
        if (error)
          throw new Error(
            `Supabase read US ${signalType} signals failed: ${error.message}`,
          );
        if (
          count === null ||
          !rows ||
          rows.length !== Math.min(count, US_REPORT_LIMIT_PER_TYPE)
        )
          throw new Error(
            `Supabase read US ${signalType} signals returned an incomplete count`,
          );
        if (count === 0) return null;
        return {
          title: `${title} (상위 ${rows.length}건 / 전체 ${count}건)`,
          lines: rows.map(
            (row) =>
              `${row.rank ?? "-"}. ${row.name} · ${Number(row.value).toFixed(2)}%`,
          ),
        };
      },
    ),
  );
  const messages = formatExperimentalTelegramReport({
    title: "미국 ETF 등락 (P1 실험)",
    observedAt: run.observed_at,
    runId: run.id,
    sections: sections.filter(
      (section): section is TelegramReportSection => section !== null,
    ),
    disclosure: US_ETF_P1_DISCLOSURE,
  });
  if (send)
    await sendTelegramMessages({
      token: getRequiredServerSecret("TELEGRAM_BOT_TOKEN"),
      chatId: getRequiredServerSecret("TELEGRAM_CHAT_ID"),
      messages,
    });
  return { runId: run.id, messageCount: messages.length };
}

async function main() {
  if (!isUsEtfP1Enabled()) {
    console.log(JSON.stringify({ status: "DISABLED" }));
    return;
  }
  const runId = process.argv
    .find((argument) => argument.startsWith("--run-id="))
    ?.slice("--run-id=".length);
  console.log(JSON.stringify(await reportLatestUsEtfMovers(true, runId)));
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error: unknown) => {
    console.error(
      `report-us-movers failed: ${error instanceof Error ? error.message : "Unknown failure"}`,
    );
    process.exitCode = 1;
  });
}
