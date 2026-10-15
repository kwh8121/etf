"use client";

import { useState } from "react";
import { compareReportedRanks } from "@/lib/signals/report-rank-changes";

import {
  formatDashboardSignalValue,
  selectDirectionRows,
  type DashboardSignalRow,
  type SignalDirection,
  type SignalPeriod,
} from "@/lib/dashboard/kr-signal-view";

const PERIOD_OPTIONS = [
  { value: "daily", label: "일간" },
  { value: "five_day", label: "5거래일" },
] as const;

const SCREEN_OPTIONS = [
  { value: "raw", label: "전체" },
  { value: "liquid", label: "유동성" },
] as const;

export function KrSignalBoard({
  rows,
  previousRows = null,
}: {
  rows: readonly DashboardSignalRow[];
  previousRows?: readonly DashboardSignalRow[] | null;
}) {
  const [period, setPeriod] = useState<SignalPeriod>("daily");
  const [screen, setScreen] = useState<"raw" | "liquid">("raw");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <SegmentedGroup
          label="기간"
          options={PERIOD_OPTIONS}
          value={period}
          onChange={(next) => setPeriod(next as SignalPeriod)}
        />
        <SegmentedGroup
          label="스크린"
          options={SCREEN_OPTIONS}
          value={screen}
          onChange={(next) => setScreen(next as "raw" | "liquid")}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(["gain", "loss"] as const).map((direction) => (
          <DirectionList
            key={direction}
            direction={direction}
            rows={selectDirectionRows(rows, period, screen, direction)}
            previousRows={
              previousRows === null
                ? null
                : selectDirectionRows(previousRows, period, screen, direction)
            }
          />
        ))}
      </div>
    </div>
  );
}

export function SegmentedGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-md border border-border p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded px-3 py-1.5 text-sm transition-colors ${
            value === option.value
              ? "bg-secondary font-semibold text-secondary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function DirectionList({
  direction,
  rows,
  totalCount,
  previousRows = null,
}: {
  direction: SignalDirection;
  rows: readonly DashboardSignalRow[];
  previousRows?: readonly DashboardSignalRow[] | null;
  /** 있으면 제목 옆에 "상위 N건 / 전체 M건"을 표시한다(US처럼 일부만 보여줄 때). */
  totalCount?: number;
}) {
  const isGain = direction === "gain";
  const tone = isGain ? "text-signal-gain" : "text-signal-loss";

  return (
    <section className="rounded-lg border border-border p-3">
      <h3
        className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${tone}`}
      >
        <span aria-hidden="true">{isGain ? "▲" : "▼"}</span>
        {isGain ? "상승" : "하락"}
        {totalCount !== undefined && (
          <span className="text-xs font-normal text-muted-foreground">
            상위 {rows.length}건 / 전체 {totalCount}건
          </span>
        )}
      </h3>
      <SignalRankList rows={rows} previousRows={previousRows} tone={tone} />
    </section>
  );
}

export function SignalRankList({
  rows,
  previousRows = null,
  tone = "",
}: {
  rows: readonly DashboardSignalRow[];
  previousRows?: readonly DashboardSignalRow[] | null;
  tone?: string;
}) {
  const changes = compareReportedRanks(rows, previousRows);
  return (
    <>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          해당 조건의 신호가 없습니다.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li
              key={`${row.signalType}-${row.screen}-${row.code}`}
              className="flex items-start gap-2 text-sm"
            >
              <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">
                {row.rank ?? "-"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="break-words [overflow-wrap:anywhere] line-clamp-2">
                  {row.name}
                </span>
                {changes.rankInCodes.has(row.code) && (
                  <span className="text-xs font-medium text-muted-foreground">
                    랭크인
                  </span>
                )}
              </span>
              <span
                className={`w-20 shrink-0 text-right font-medium tabular-nums ${tone}`}
              >
                {formatDashboardSignalValue(row)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {changes.rankOut.length > 0 && (
        <div className="mt-3 border-t border-border pt-2 text-sm text-muted-foreground">
          <h4 className="mb-1 font-medium">랭크아웃</h4>
          <ol className="space-y-1">
            {changes.rankOut.map((row) => (
              <li key={row.code} className="flex items-start gap-2">
                <span className="w-5 shrink-0 text-right tabular-nums">
                  {row.rank ?? "-"}
                </span>
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                  {row.name}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
