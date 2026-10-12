import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { UsSignalBoard } from "@/components/us-signal-board";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type DashboardSignalRow } from "@/lib/dashboard/kr-signal-view";
import {
  formatKstTime,
  formatObsDateLabel,
  kstDayBoundsUtc,
  normalizeObsDate,
  toKstDate,
} from "@/lib/dashboard/us-signal-view";
import { US_ETF_P1_DISCLOSURE } from "@/lib/signals/us-etf-movers";
import {
  US_ETF_SIGNAL_TYPES,
  US_ETF_STRATEGY_VERSION,
} from "@/lib/signals/us-etf-constants";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const ROWS_PER_TYPE = 10;

interface UsRunRow {
  id: string;
  observed_at: string;
  completed_at: string | null;
  status: string;
}

interface UsSignalDailyRow {
  signal_type: string;
  name: string;
  value: number | string | null;
  value_unit: string | null;
  rank: number | null;
}

export default async function UsSignalDatePage({
  params,
}: {
  params: Promise<{ obsDate: string }>;
}) {
  await connection();
  const { obsDate: requestedObsDate } = await params;
  const obsDate = normalizeObsDate(requestedObsDate);
  if (!obsDate) notFound();

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) redirect("/auth/login");

  const bounds = kstDayBoundsUtc(obsDate);
  const runBase = () =>
    supabase
      .from("signal_run")
      .select("id,observed_at,completed_at,status")
      .eq("market", "US")
      .eq("strategy_version", US_ETF_STRATEGY_VERSION)
      .eq("status", "COMPLETED");

  const [runResult, previousResult, nextResult] = await Promise.all([
    runBase()
      .gte("observed_at", bounds.from)
      .lt("observed_at", bounds.to)
      // 보고(report-us-movers)와 latest가 쓰는 기준과 같아야 Telegram 본문과 같은 run을 보여준다.
      .order("observed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    runBase()
      .lt("observed_at", bounds.from)
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    runBase()
      .gte("observed_at", bounds.to)
      .order("observed_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const run = runResult.data as UsRunRow | null;
  const previousObsDate = previousResult.data
    ? toKstDate((previousResult.data as UsRunRow).observed_at)
    : null;
  const nextObsDate = nextResult.data
    ? toKstDate((nextResult.data as UsRunRow).observed_at)
    : null;

  // 유형별 전체 행은 수천 건이라 보고와 같은 상위 10건과 전체 건수만 읽는다.
  const typeResults = run
    ? await Promise.all(
        US_ETF_SIGNAL_TYPES.map(async (signalType) => {
          const { data, count, error } = await supabase
            .from("signal_daily")
            .select("signal_type,name,value,value_unit,rank", { count: "exact" })
            .eq("run_id", run.id)
            .eq("market", "US")
            .eq("signal_type", signalType)
            .order("rank")
            .order("code")
            .limit(ROWS_PER_TYPE);
          return { signalType, data: (data ?? []) as UsSignalDailyRow[], count: count ?? 0, error };
        }),
      )
    : [];
  const errorTypes = typeResults.filter((result) => result.error).map((result) => result.signalType);
  const rows: DashboardSignalRow[] = typeResults.flatMap((result) =>
    result.data.map(toDashboardSignalRow),
  );
  const totals = Object.fromEntries(
    typeResults.map((result) => [result.signalType, result.count]),
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          ETF 신호 MVP · 미국 ETF 등락 · P1 실험
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          {formatObsDateLabel(obsDate)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {run
            ? `관측 시각 ${formatKstTime(run.observed_at)} (한국 시간) · 상태 ${run.status}`
            : "상태 실행 없음"}
        </p>
        <p className="text-sm text-muted-foreground">{US_ETF_P1_DISCLOSURE}</p>
        <p className="text-sm text-muted-foreground">
          Kiwoom 순위 기준이며 미국 거래일이 아닌 한국 시간 관측일입니다. 관측
          시점(장중·장후)에 따라 값이 달라질 수 있습니다.
        </p>
        <nav aria-label="관측일 이동" className="flex items-center gap-4 text-sm">
          {previousObsDate ? (
            <Link className="underline" href={`/signals/us/${previousObsDate}`}>
              ‹ 이전 관측일
            </Link>
          ) : (
            <span aria-disabled="true" className="text-muted-foreground">‹ 이전 관측일</span>
          )}
          {nextObsDate ? (
            <Link className="underline" href={`/signals/us/${nextObsDate}`}>
              다음 관측일 ›
            </Link>
          ) : (
            <span aria-disabled="true" className="text-muted-foreground">다음 관측일 ›</span>
          )}
        </nav>
        <p className="text-sm text-muted-foreground">
          자동매매 또는 매수·매도 추천이 아닌 탐색 결과입니다.
        </p>
      </header>

      {runResult.error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            신호 결과를 불러오지 못했습니다. 잠시 후 다시 시도하세요.
          </CardContent>
        </Card>
      ) : !run ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            해당 관측일의 US 실행이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>미국 ETF 등락 · P1 실험</CardTitle>
          </CardHeader>
          <CardContent>
            <UsSignalBoard rows={rows} totals={totals} errors={errorTypes} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function toDashboardSignalRow(row: UsSignalDailyRow): DashboardSignalRow {
  return {
    signalType: row.signal_type,
    screen: "raw",
    name: row.name,
    value: row.value === null ? null : Number(row.value),
    valueUnit: row.value_unit,
    rank: row.rank,
  };
}
