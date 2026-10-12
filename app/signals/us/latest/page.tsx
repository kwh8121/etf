import { redirect } from "next/navigation";
import { connection } from "next/server";

import { Card, CardContent } from "@/components/ui/card";
import { toKstDate } from "@/lib/dashboard/us-signal-view";
import { US_ETF_STRATEGY_VERSION } from "@/lib/signals/us-etf-constants";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function UsSignalLatestPage() {
  await connection();
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) redirect("/auth/login");

  const { data: run, error: runError } = await supabase
    .from("signal_run")
    .select("observed_at")
    .eq("market", "US")
    .eq("strategy_version", US_ETF_STRATEGY_VERSION)
    .eq("status", "COMPLETED")
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runError) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-destructive">
          신호 결과를 불러오지 못했습니다. 잠시 후 다시 시도하세요.
        </CardContent>
      </Card>
    );
  }
  const observedAt = (run as { observed_at: string } | null)?.observed_at;
  if (!observedAt) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          아직 생성된 미국 ETF 실험 신호 실행이 없습니다.
        </CardContent>
      </Card>
    );
  }
  redirect(`/signals/us/${toKstDate(observedAt)}`);
}
