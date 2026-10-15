"use client";

import { useState } from "react";

import { DirectionList, SegmentedGroup } from "@/components/kr-signal-board";
import { usSignalType } from "@/lib/dashboard/us-signal-view";
import {
  selectDirectionRows,
  type DashboardSignalRow,
  type SignalPeriod,
} from "@/lib/dashboard/kr-signal-view";

const PERIOD_OPTIONS = [
  { value: "daily", label: "일간" },
  { value: "five_day", label: "5일" },
] as const;

/** US는 스크린 구분이 없고(`raw`뿐) 유형별 상위 행만 받는다. totals는 유형별 전체 건수다. */
export function UsSignalBoard({
  rows,
  totals,
  errors,
  previousRows = null,
  rankChangeErrors = [],
}: {
  rows: readonly DashboardSignalRow[];
  totals: Readonly<Record<string, number>>;
  /** 조회에 실패한 신호 유형. 해당 방향 블록에만 오류 문구를 보인다. */
  errors: readonly string[];
  previousRows?: readonly DashboardSignalRow[] | null;
  rankChangeErrors?: readonly string[];
}) {
  const [period, setPeriod] = useState<SignalPeriod>("daily");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <SegmentedGroup
          label="기간"
          options={PERIOD_OPTIONS}
          value={period}
          onChange={(next) => setPeriod(next as SignalPeriod)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(["gain", "loss"] as const).map((direction) => {
          const signalType = usSignalType(period, direction);
          return errors.includes(signalType) ? (
            <section
              key={direction}
              className="rounded-lg border border-border p-3"
            >
              <p className="text-sm text-destructive">
                {direction === "gain" ? "상승" : "하락"} 신호를 불러오지
                못했습니다. 잠시 후 다시 시도하세요.
              </p>
            </section>
          ) : (
            <div key={direction} className="space-y-2">
              {rankChangeErrors.includes(signalType) && (
                <p className="text-sm text-muted-foreground">
                  이전 순위를 불러오지 못해 랭크 변동을 표시하지 않습니다.
                </p>
              )}
              <DirectionList
                direction={direction}
                rows={selectDirectionRows(rows, period, "raw", direction)}
                totalCount={totals[signalType] ?? 0}
                previousRows={
                  previousRows === null || rankChangeErrors.includes(signalType)
                    ? null
                    : selectDirectionRows(
                        previousRows,
                        period,
                        "raw",
                        direction,
                      )
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
