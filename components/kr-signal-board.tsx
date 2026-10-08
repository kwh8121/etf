"use client";

import { useState } from "react";

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

export function KrSignalBoard({ rows }: { rows: readonly DashboardSignalRow[] }) {
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
        <DirectionList direction="gain" rows={selectDirectionRows(rows, period, screen, "gain")} />
        <DirectionList direction="loss" rows={selectDirectionRows(rows, period, screen, "loss")} />
      </div>
    </div>
  );
}

function SegmentedGroup({
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
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-border p-0.5">
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

function DirectionList({
  direction,
  rows,
}: {
  direction: SignalDirection;
  rows: readonly DashboardSignalRow[];
}) {
  const isGain = direction === "gain";
  const tone = isGain ? "text-signal-gain" : "text-signal-loss";

  return (
    <section className="rounded-lg border border-border p-3">
      <h3 className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${tone}`}>
        <span aria-hidden="true">{isGain ? "▲" : "▼"}</span>
        {isGain ? "상승" : "하락"}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">해당 조건의 신호가 없습니다.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li
              key={`${row.signalType}-${row.screen}-${row.name}-${row.rank}`}
              className="flex items-start gap-2 text-sm"
            >
              <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">
                {row.rank ?? "-"}
              </span>
              <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] line-clamp-2">
                {row.name}
              </span>
              <span className={`w-20 shrink-0 text-right font-medium tabular-nums ${tone}`}>
                {formatDashboardSignalValue(row)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
