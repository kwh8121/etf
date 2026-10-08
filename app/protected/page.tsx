import { redirect } from "next/navigation";
import { connection } from "next/server";

import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ProtectedPage() {
  await connection();
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims) redirect("/auth/login");

  const { data: run } = await supabase
    .from("signal_run")
    .select("bas_dd")
    .eq("market", "KR")
    .eq("strategy_version", "m3-price-movers-v1")
    .not("bas_dd", "is", null)
    .order("bas_dd", { ascending: false })
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestBasDd = (run as { bas_dd: string | null } | null)?.bas_dd;
  if (!latestBasDd) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          아직 생성된 국내 신호 실행이 없습니다.
        </CardContent>
      </Card>
    );
  }

  redirect(`/signals/kr/${latestBasDd}`);
}
