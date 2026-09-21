import { redirect } from "next/navigation";
import { connection } from "next/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createDashboardSignalSections,
  formatDashboardSignalValue,
  type DashboardSignalRow,
} from "@/lib/dashboard/kr-signal-view";
import {
  isUsEtfP1Enabled,
  US_ETF_P1_DISCLOSURE,
} from "@/lib/signals/us-etf-movers";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

interface SignalRunDatabaseRow {
  id: string;
  bas_dd: string | null;
  completed_at: string | null;
  status: string;
}

interface SignalDailyDatabaseRow {
  signal_type: string;
  screen: "raw" | "liquid";
  name: string;
  value: number | string | null;
  value_unit: string | null;
  rank: number | null;
}

export default async function ProtectedPage() {
  await connection();
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) redirect("/auth/login");

  const { data: run, error: runError } = await supabase
    .from("signal_run")
    .select("id,bas_dd,completed_at,status")
    .eq("market", "KR")
    .eq("strategy_version", "m3-price-movers-v1")
    .order("bas_dd", { ascending: false })
    .order("completed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestRun = run as SignalRunDatabaseRow | null;
  const { data: signalRows, error: signalsError } = latestRun
    ? await supabase
        .from("signal_daily")
        .select("signal_type,screen,name,value,value_unit,rank")
        .eq("run_id", latestRun.id)
        .order("signal_type")
        .order("screen")
        .order("rank")
    : { data: [], error: null };
  const sections = createDashboardSignalSections(
    ((signalRows ?? []) as SignalDailyDatabaseRow[]).map(toDashboardSignalRow),
  );
  const qualityMessage =
    latestRun?.status === "COMPLETED" && sections.length > 0
      ? "완료된 신호 실행입니다."
      : sections.length === 0
        ? "검토 필요: 신호 항목이 없습니다."
        : "신호 실행 상태를 확인하세요.";
  const usEnabled = isUsEtfP1Enabled();
  const { data: usRun, error: usRunError } = usEnabled
    ? await supabase
        .from("signal_run")
        .select("id,bas_dd,completed_at,status")
        .eq("market", "US")
        .eq("strategy_version", "m5-us-etf-movers-p1-v1")
        .eq("status", "COMPLETED")
        .order("completed_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };
  const latestUsRun = usRun as SignalRunDatabaseRow | null;
  const { data: usRows, error: usRowsError } = latestUsRun
    ? await supabase
        .from("signal_daily")
        .select("signal_type,screen,name,value,value_unit,rank")
        .eq("run_id", latestUsRun.id)
        .eq("market", "US")
        .order("signal_type")
        .order("rank")
    : { data: [], error: null };
  const usSections = createDashboardSignalSections(
    ((usRows ?? []) as SignalDailyDatabaseRow[]).map(toDashboardSignalRow),
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          ETF 신호 MVP · 국내 시장
        </p>
        <h1 className="text-3xl font-bold tracking-tight">오늘의 탐색 신호</h1>
        <p className="text-sm text-muted-foreground">
          자동매매 또는 매수·매도 추천이 아닌 탐색 결과입니다.
        </p>
        <p className="text-sm text-muted-foreground">
          5거래일 값은 KRX 종가 기준 가격수익률이며 분배금·기업행동 조정
          총수익률이 아닙니다.
        </p>
      </header>

      {runError || signalsError ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            신호 결과를 불러오지 못했습니다. 잠시 후 다시 시도하세요.
          </CardContent>
        </Card>
      ) : !latestRun ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            아직 생성된 국내 신호 실행이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>최근 실행</CardTitle>
              <CardDescription>
                기준일 {latestRun.bas_dd ?? "미정"} · 상태 {latestRun.status}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              완료 시각 {latestRun.completed_at ?? "미정"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>데이터 품질</CardTitle>
              <CardDescription>{qualityMessage}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              현재 실행 상태: {latestRun.status}
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {sections.map((section) => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle>{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2 text-sm">
                    {section.rows.map((row) => (
                      <li
                        key={`${row.name}-${row.rank}`}
                        className="flex justify-between gap-3"
                      >
                        <span>
                          {row.rank ?? "-"}. {row.name}
                        </span>
                        <span className="font-medium">
                          {formatDashboardSignalValue(row)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
      {usEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>미국 ETF 등락 · P1 실험</CardTitle>
            <CardDescription>{US_ETF_P1_DISCLOSURE}</CardDescription>
          </CardHeader>
          <CardContent>
            {usRunError || usRowsError ? (
              <p className="text-sm text-muted-foreground">
                실험 신호를 불러오지 못했습니다. 국내 P0 신호에는 영향이
                없습니다.
              </p>
            ) : !latestUsRun ? (
              <p className="text-sm text-muted-foreground">
                아직 생성된 미국 ETF 실험 신호가 없습니다.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {usSections.map((section) => (
                  <div key={section.title} className="space-y-2 text-sm">
                    <p className="font-medium">{section.title}</p>
                    <ol className="space-y-1">
                      {section.rows.map((row) => (
                        <li key={`${row.name}-${row.rank}`}>
                          {row.rank ?? "-"}. {row.name} ·{" "}
                          {formatDashboardSignalValue(row)}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function toDashboardSignalRow(row: SignalDailyDatabaseRow): DashboardSignalRow {
  return {
    signalType: row.signal_type,
    screen: row.screen,
    name: row.name,
    value: row.value === null ? null : Number(row.value),
    valueUnit: row.value_unit,
    rank: row.rank,
  };
}
