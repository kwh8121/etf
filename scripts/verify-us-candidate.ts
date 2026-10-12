import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  US_ETF_SIGNAL_TYPES,
  US_ETF_STRATEGY_VERSION,
} from "../lib/signals/us-etf-constants.ts";
import { kstDayBoundsUtc, toKstDate } from "../lib/dashboard/us-signal-view.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";

const US_STRATEGY_VERSION = US_ETF_STRATEGY_VERSION;
const US_SIGNAL_TYPES = US_ETF_SIGNAL_TYPES;
const REPORT_LIMIT_PER_TYPE = 10;

interface SignalRunRow {
  id: string;
  status: string;
  observed_at: string;
  completed_at: string | null;
  notes: Record<string, unknown> | null;
}

export interface UsCandidateVerification {
  runId: string | null;
  found: boolean;
  status: string | null;
  observedAt: string | null;
  observedKstDate: string | null;
  completedAt: string | null;
  ageHours: number | null;
  telegramReportedAt: string | null;
  typeCounts: Record<string, number>;
  sameDayRunCount: number;
  sameDayReportedMarkerCount: number;
  ok: boolean;
  reasons: string[];
}

function throwIfError(error: unknown, context: string): void {
  if (error)
    throw new Error(
      `${context} failed: ${(error as { message?: string }).message ?? String(error)}`,
    );
}


function hasReportMarker(row: SignalRunRow): boolean {
  return typeof row.notes?.telegram_reported_at === "string";
}

/**
 * US P1 신호 실행 1건을 운영 Supabase에서 읽기 전용으로 대조한다. `latest`는 가장 최근 실행을
 * 상태와 관계없이 고르므로 직전 실행이 PENDING으로 남았다면 실패로 드러난다.
 * 어떤 경우에도 쓰기를 수행하지 않는다.
 */
export async function verifyUsCandidate(
  target: string,
): Promise<UsCandidateVerification> {
  const client = createServiceRoleClient();
  const base = () =>
    client
      .from("signal_run")
      .select("id,status,observed_at,completed_at,notes")
      .eq("market", "US")
      .eq("strategy_version", US_STRATEGY_VERSION);
  const lookup =
    target === "latest"
      ? base().order("observed_at", { ascending: false }).order("id", { ascending: false }).limit(1)
      : base().eq("id", target);
  const { data, error } = await lookup.maybeSingle();
  throwIfError(error, "read US signal run");
  const run = data as SignalRunRow | null;

  if (!run) {
    return {
      runId: target === "latest" ? null : target,
      found: false,
      status: null,
      observedAt: null,
      observedKstDate: null,
      completedAt: null,
      ageHours: null,
      telegramReportedAt: null,
      typeCounts: {},
      sameDayRunCount: 0,
      sameDayReportedMarkerCount: 0,
      ok: false,
      reasons: ["US signal_run을 찾을 수 없음 (market=US)"],
    };
  }

  const reasons: string[] = [];
  const observedKstDate = toKstDate(run.observed_at);
  const bounds = kstDayBoundsUtc(observedKstDate);

  const [sameDay, ...typeResults] = await Promise.all([
    client
      .from("signal_run")
      .select("id,status,observed_at,completed_at,notes")
      .eq("market", "US")
      .eq("strategy_version", US_STRATEGY_VERSION)
      .eq("status", "COMPLETED")
      .gte("observed_at", bounds.from)
      .lt("observed_at", bounds.to),
    ...US_SIGNAL_TYPES.map((signalType) =>
      client
        .from("signal_daily")
        .select("rank", { count: "exact" })
        .eq("run_id", run.id)
        .eq("market", "US")
        .eq("signal_type", signalType)
        .order("rank")
        .limit(REPORT_LIMIT_PER_TYPE),
    ),
  ]);
  throwIfError(sameDay.error, "read same-day US signal runs");

  const typeCounts: Record<string, number> = {};
  const shortTypes: string[] = [];
  const misrankedTypes: string[] = [];
  US_SIGNAL_TYPES.forEach((signalType, index) => {
    const result = typeResults[index];
    throwIfError(result.error, `read US ${signalType} signals`);
    const count = result.count ?? 0;
    typeCounts[signalType] = count;
    if (count < REPORT_LIMIT_PER_TYPE) shortTypes.push(`${signalType}=${count}(기대 ${REPORT_LIMIT_PER_TYPE} 이상)`);
    const ranks = ((result.data ?? []) as { rank: number | null }[]).map((row) => row.rank);
    // 같은 종목 반복·ETN 제외로 순위에 빈틈이 생기고 1위가 빠질 수 있다. 양수 오름차순 순위인지만 확인한다.
    const ordered = ranks.every(
      (rank, i) => typeof rank === "number" && rank > 0 && (i === 0 || rank > (ranks[i - 1] as number)),
    );
    if (count > 0 && !ordered) misrankedTypes.push(signalType);
  });

  const sameDayRuns = (sameDay.data ?? []) as SignalRunRow[];
  const sameDayRunCount = sameDayRuns.length;
  const sameDayReportedMarkerCount = sameDayRuns.filter(hasReportMarker).length;
  const telegramReportedAt =
    typeof run.notes?.telegram_reported_at === "string" ? run.notes.telegram_reported_at : null;

  if (run.status !== "COMPLETED") reasons.push(`signal_run 상태가 COMPLETED 아님: ${run.status}`);
  if (!run.completed_at) reasons.push("completed_at 없음");
  if (!telegramReportedAt) reasons.push("notes.telegram_reported_at 없음");
  if (shortTypes.length > 0) reasons.push(`유형별 상위 10건 미달: ${shortTypes.join(", ")}`);
  if (misrankedTypes.length > 0)
    reasons.push(`순위가 양수 오름차순이 아닌 유형: ${misrankedTypes.join(", ")}`);
  if (sameDayReportedMarkerCount > 1)
    reasons.push(`같은 한국 관측일에 telegram_reported_at 표식이 ${sameDayReportedMarkerCount}건 있음(중복 발송 의심)`);

  return {
    runId: run.id,
    found: true,
    status: run.status,
    observedAt: run.observed_at,
    observedKstDate,
    completedAt: run.completed_at,
    // 중복 관측일에는 latest가 며칠 전 run일 수 있다. 판정에는 쓰지 않고 해석용으로만 낸다.
    ageHours: Math.round(((Date.now() - new Date(run.observed_at).getTime()) / 3_600_000) * 10) / 10,
    telegramReportedAt,
    typeCounts,
    sameDayRunCount,
    sameDayReportedMarkerCount,
    ok: reasons.length === 0,
    reasons,
  };
}

async function main(): Promise<void> {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: verify-us-candidate <runId | latest>");
    process.exitCode = 1;
    return;
  }
  const result = await verifyUsCandidate(target);
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error: unknown) => {
    console.error(`US candidate verification failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  });
}
