import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getRequiredServerSecret } from "../lib/config/server-env.ts";
import { resolveWebBaseUrl, buildUsSignalUrl } from "../lib/config/web-url.ts";
import { toKstDate } from "../lib/dashboard/us-signal-view.ts";
import {
  formatExperimentalTelegramReport,
  sendTelegramMessages,
  type TelegramReportSection,
} from "../lib/notifications/telegram.ts";
import { formatReportedRankChangeLines } from "../lib/signals/report-rank-changes.ts";
import {
  US_ETF_P1_DISCLOSURE,
  isUsEtfP1Enabled,
} from "../lib/signals/us-etf-movers.ts";
import { US_ETF_STRATEGY_VERSION } from "../lib/signals/us-etf-constants.ts";
import { markUsTelegramReported } from "../lib/signals/us-etf-signal-repository.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";

const US_REPORT_LIMIT_PER_TYPE = 10;
const US_REPORT_SECTIONS = [
  ["daily_price_gain", "일간 상승"],
  ["daily_price_loss", "일간 하락"],
  ["five_day_price_gain", "5일 상승"],
  ["five_day_price_loss", "5일 하락"],
] as const;

interface UsSignalRow {
  code: string;
  name: string;
  value: number | string | null;
  rank: number | null;
}

export async function reportLatestUsEtfMovers(send = true, runId?: string) {
  const client = createServiceRoleClient();
  let query = client
    .from("signal_run")
    .select("id,observed_at,status,notes")
    .eq("market", "US")
    .eq("strategy_version", US_ETF_STRATEGY_VERSION)
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
  // 이미 발송한 run은 다시 보내지 않는다(수동 재실행·표식 복구 뒤 재호출 방지).
  if (send && typeof run.notes?.telegram_reported_at === "string")
    return { runId: run.id, messageCount: 0, alreadyReported: true };

  const previousRun = await readPreviousUsRun(client, run);

  const sections = await Promise.all(
    US_REPORT_SECTIONS.map(
      async ([signalType, title]): Promise<TelegramReportSection | null> => {
        const {
          data: rows,
          count,
          error,
        } = await client
          .from("signal_daily")
          .select("code,name,value,rank", { count: "exact" })
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
        const previousRows = previousRun
          ? await readUsSectionRows(client, previousRun.id, signalType)
          : null;
        if (count === 0 && (!previousRows || previousRows.length === 0))
          return null;
        return {
          title: `${title} (상위 ${rows.length}건 / 전체 ${count}건)`,
          lines: formatReportedRankChangeLines(
            rows as UsSignalRow[],
            previousRows,
            (row) =>
              `${row.rank ?? "-"}. ${row.name} · ${Number(row.value).toFixed(2)}%`,
          ),
        };
      },
    ),
  );
  // 링크를 쓰지 않을 때는 관측 시각 변환도 하지 않아 기존 보고 경로에 영향을 주지 않는다.
  const webBaseUrl = resolveWebBaseUrl();
  const webUrl = webBaseUrl
    ? buildUsSignalUrl(webBaseUrl, toKstDate(run.observed_at))
    : undefined;
  const messages = formatExperimentalTelegramReport({
    title: "미국 ETF 등락 (P1 실험)",
    observedAt: run.observed_at,
    runId: run.id,
    sections: sections.filter(
      (section): section is TelegramReportSection => section !== null,
    ),
    disclosure: US_ETF_P1_DISCLOSURE,
    ...(webUrl ? { webUrl } : {}),
  });
  if (send) {
    await sendTelegramMessages({
      token: getRequiredServerSecret("TELEGRAM_BOT_TOKEN"),
      chatId: getRequiredServerSecret("TELEGRAM_CHAT_ID"),
      messages,
    });
    try {
      await markUsTelegramReported(client, run.id);
    } catch (error) {
      // Telegram 발송은 이미 성공했다. 표식만 실패한 경우를 발송 실패와 구분한다.
      throw new Error(
        `US report sent but Telegram marker write failed for run ${run.id}: ${error instanceof Error ? error.message : "Unknown failure"}`,
      );
    }
  }
  return { runId: run.id, messageCount: messages.length };
}

async function readPreviousUsRun(
  client: ReturnType<typeof createServiceRoleClient>,
  latest: { id: string; observed_at: string },
): Promise<{ id: string } | null> {
  const { data, error } = await client
    .from("signal_run")
    .select("id")
    .eq("market", "US")
    .eq("strategy_version", US_ETF_STRATEGY_VERSION)
    .eq("status", "COMPLETED")
    .lt("observed_at", latest.observed_at)
    .order("observed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error)
    throw new Error(
      `Supabase read previous US signal run failed: ${error.message}`,
    );
  if (data?.id === latest.id) return null;
  return data as { id: string } | null;
}

async function readUsSectionRows(
  client: ReturnType<typeof createServiceRoleClient>,
  runId: string,
  signalType: string,
): Promise<UsSignalRow[]> {
  const { data, error } = await client
    .from("signal_daily")
    .select("code,name,value,rank")
    .eq("run_id", runId)
    .eq("market", "US")
    .eq("signal_type", signalType)
    .order("rank")
    .order("code")
    .limit(US_REPORT_LIMIT_PER_TYPE);
  if (error)
    throw new Error(
      `Supabase read previous US ${signalType} signals failed: ${error.message}`,
    );
  return (data ?? []) as UsSignalRow[];
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
