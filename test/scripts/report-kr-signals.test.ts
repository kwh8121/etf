import { beforeEach, describe, expect, it, vi } from "vitest";

interface RunRow {
  id: string;
  bas_dd: string;
  status: "COMPLETED" | "PENDING" | "PARTIAL" | "FAILED";
  completed_at?: string;
}

interface SignalRow {
  code: string;
  signal_type: string;
  name: string;
  value: number | string | null;
  value_unit: string | null;
  rank: number | null;
  screen: "raw" | "liquid";
}

const accuracyMocks = vi.hoisted(() => ({
  auditRunAccuracy: vi.fn(),
  auditKrListingCorrectionProposals: vi.fn(),
}));
const telegramMocks = vi.hoisted(() => ({
  formatTelegramReport: vi.fn((input: { sections: Array<{ lines: string[] }> }) =>
    input.sections.flatMap((section) => section.lines),
  ),
  sendTelegramMessages: vi.fn(),
}));

let signalRuns: RunRow[] = [];
let signalRowsByRunId = new Map<string, SignalRow[]>();

class RunQuery {
  private filters: Array<(row: RunRow) => boolean> = [];
  private orders: Array<{ column: keyof RunRow; ascending: boolean }> = [];
  private limitCount: number | null = null;

  select() {
    return this;
  }
  eq(column: keyof RunRow | string, value: unknown) {
    if (!(column in (signalRuns[0] ?? {}))) return this;
    this.filters.push((row) => row[column as keyof RunRow] === value);
    return this;
  }
  lt(column: keyof RunRow | string, value: unknown) {
    this.filters.push((row) => String(row[column as keyof RunRow] ?? "") < String(value));
    return this;
  }
  order(column: keyof RunRow, options: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: options.ascending ?? true });
    return this;
  }
  limit(count: number) {
    this.limitCount = count;
    return this;
  }
  single() {
    const rows = this.result();
    return Promise.resolve({
      data: rows.length === 1 ? rows[0] : null,
      error: rows.length === 1 ? null : { message: "expected one run" },
    });
  }
  maybeSingle() {
    const rows = this.result();
    return Promise.resolve({
      data: rows[0] ?? null,
      error: rows.length > 1 ? { message: "expected at most one run" } : null,
    });
  }
  private result() {
    let rows = signalRuns.filter((row) => this.filters.every((filter) => filter(row)));
    for (const order of [...this.orders].reverse()) {
      rows = [...rows].sort((left, right) => {
        const leftValue = left[order.column];
        const rightValue = right[order.column];
        const compared =
          typeof leftValue === "number" && typeof rightValue === "number"
            ? leftValue - rightValue
            : String(leftValue ?? "").localeCompare(String(rightValue ?? ""));
        return order.ascending ? compared : -compared;
      });
    }
    return this.limitCount === null ? rows : rows.slice(0, this.limitCount);
  }
}

class SignalRowsQuery {
  private runId: string | null = null;
  private orders: Array<{ column: keyof SignalRow; ascending: boolean }> = [];
  private rangeStart = 0;
  private rangeEnd: number | null = 999;

  select() {
    return this;
  }
  eq(column: keyof SignalRow | "run_id", value: unknown) {
    if (column === "run_id") this.runId = String(value);
    return this;
  }
  order(column: keyof SignalRow, options: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: options.ascending ?? true });
    return this;
  }
  range(start: number, end: number) {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }
  private result() {
    let rows = [...(this.runId ? (signalRowsByRunId.get(this.runId) ?? []) : [])];
    for (const order of [...this.orders].reverse()) {
      rows = [...rows].sort((left, right) => {
        const compared = String(left[order.column] ?? "").localeCompare(
          String(right[order.column] ?? ""),
        );
        return order.ascending ? compared : -compared;
      });
    }
    const count = rows.length;
    if (this.rangeEnd !== null) rows = rows.slice(this.rangeStart, this.rangeEnd + 1);
    return { data: rows, error: null, count };
  }
}

const from = vi.fn((table: string) =>
  table === "signal_run" ? new RunQuery() : new SignalRowsQuery(),
);

vi.mock("../../lib/supabase/service-role-core.ts", () => ({
  createServiceRoleClient: () => ({ from }),
}));
vi.mock("../../lib/notifications/telegram.ts", () => ({
  formatTelegramReport: telegramMocks.formatTelegramReport,
  sendTelegramMessages: telegramMocks.sendTelegramMessages,
}));
vi.mock("../../lib/config/server-env.ts", () => ({
  getRequiredServerSecret: vi.fn(() => "secret"),
}));
vi.mock("../../lib/signals/data-accuracy.ts", () => ({
  SupabaseDataAccuracyStore: class SupabaseDataAccuracyStore {},
  auditRunAccuracy: accuracyMocks.auditRunAccuracy,
  auditKrListingCorrectionProposals:
    accuracyMocks.auditKrListingCorrectionProposals,
}));

import { sendTelegramMessages } from "../../lib/notifications/telegram";
import { reportLatestKrxSignals } from "../../scripts/report-kr-signals";

function okRunAccuracy() {
  return {
    ok: true,
    reasons: [],
    sourceIntegrity: [{ ok: true }],
    diffs: { beforeCount: 1, afterCount: 1, added: [], removed: [], changed: [] },
    provenanceCaveats: [],
    sourceIds: ["source-1"],
  };
}

function okListingAccuracy() {
  return {
    ok: true,
    approvalReady: true,
    sourceIntegrity: [{ ok: true }],
    falseListingEvents: [],
    masterFirstSeenCorrections: [],
    caveats: [],
  };
}

function row(index: number, overrides: Partial<SignalRow> = {}): SignalRow {
  return {
    code: `ETF${String(index).padStart(4, "0")}`,
    signal_type: "turnover_surge",
    name: `ETF ${index}`,
    value: index,
    value_unit: "ratio",
    rank: index,
    screen: "raw",
    ...overrides,
  };
}

describe("KR signal reporting", () => {
  it("links both current and ranked-out ETF names and sends HTML", async () => {
    signalRowsByRunId.set("generated-run", [row(1, { code: "069500", name: "KODEX S&P" })]);
    signalRowsByRunId.set("previous-run", [row(2, { code: "360750", name: "TIGER <ETF>" })]);
    await reportLatestKrxSignals(true, "generated-run");
    expect(telegramMocks.formatTelegramReport).toHaveBeenCalledWith(expect.objectContaining({ html: true }));
    const lines = telegramMocks.formatTelegramReport.mock.results[0].value.join("\n");
    expect(lines).toContain('<a href="https://m.stock.naver.com/domestic/stock/069500/total">KODEX S&amp;P</a>');
    expect(lines).toContain('<a href="https://m.stock.naver.com/domestic/stock/360750/total">TIGER &lt;ETF&gt;</a>');
    expect(sendTelegramMessages).toHaveBeenCalledWith(expect.objectContaining({ parseMode: "HTML" }));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    signalRuns = [
      { id: "generated-run", bas_dd: "2026-09-18", status: "COMPLETED", completed_at: "2026-09-18T01:00:00Z" },
      { id: "previous-run", bas_dd: "2026-09-17", status: "COMPLETED", completed_at: "2026-09-17T01:00:00Z" },
    ];
    signalRowsByRunId = new Map([
      ["generated-run", [row(1)]],
      ["previous-run", [row(2)]],
    ]);
    accuracyMocks.auditRunAccuracy.mockResolvedValue(okRunAccuracy());
    accuracyMocks.auditKrListingCorrectionProposals.mockResolvedValue(okListingAccuracy());
  });

  it("reports the requested generated signal run instead of a newer run", async () => {
    signalRuns.push({
      id: "newer-run",
      bas_dd: "2026-09-19",
      status: "COMPLETED",
      completed_at: "2026-09-19T01:00:00Z",
    });

    const result = await reportLatestKrxSignals(false, "generated-run");

    expect(result.runId).toBe("generated-run");
  });

  it("breaks same-date latest-run ties by completion time and id", async () => {
    signalRuns.push({
      id: "latest-run",
      bas_dd: "2026-09-18",
      status: "COMPLETED",
      completed_at: "2026-09-18T02:00:00Z",
    });

    const result = await reportLatestKrxSignals();

    expect(result.runId).toBe("latest-run");
  });

  it("does not run heavy accuracy audits for dry-run rendering", async () => {
    const result = await reportLatestKrxSignals(false, "generated-run");

    expect(result.sent).toBe(false);
    expect(accuracyMocks.auditRunAccuracy).not.toHaveBeenCalled();
    expect(accuracyMocks.auditKrListingCorrectionProposals).not.toHaveBeenCalled();
  });

  it("blocks send=true before Telegram when the current run accuracy mismatches", async () => {
    accuracyMocks.auditRunAccuracy.mockResolvedValueOnce({
      ...okRunAccuracy(),
      ok: false,
      reasons: ["signal_diff"],
      diffs: { beforeCount: 80, afterCount: 80, added: [], removed: [], changed: [{ key: "x" }] },
    });

    await expect(reportLatestKrxSignals(true, "generated-run")).rejects.toThrow(
      "current run accuracy audit failed",
    );

    expect(sendTelegramMessages).not.toHaveBeenCalled();
  });

  it("blocks send=true before Telegram when the previous comparison run is inaccurate", async () => {
    accuracyMocks.auditRunAccuracy
      .mockResolvedValueOnce(okRunAccuracy())
      .mockResolvedValueOnce({
        ...okRunAccuracy(),
        ok: false,
        reasons: ["source_sha256_mismatch:source-previous"],
      });

    await expect(reportLatestKrxSignals(true, "generated-run")).rejects.toThrow(
      "previous run accuracy audit failed",
    );

    expect(sendTelegramMessages).not.toHaveBeenCalled();
  });

  it("blocks send=true before Telegram when global KR listing evidence is known incorrect", async () => {
    accuracyMocks.auditKrListingCorrectionProposals.mockResolvedValueOnce({
      ...okListingAccuracy(),
      ok: false,
      approvalReady: true,
      falseListingEvents: Array.from({ length: 214 }, (_, index) => ({ eventKey: `event-${index}` })),
      masterFirstSeenCorrections: Array.from({ length: 214 }, (_, index) => ({ code: `A${index}` })),
      caveats: [],
    });

    await expect(reportLatestKrxSignals(true, "generated-run")).rejects.toThrow(
      "KR listing accuracy audit failed",
    );

    expect(sendTelegramMessages).not.toHaveBeenCalled();
  });

  it("reads current and previous signal rows beyond Supabase's default 1000-row cap", async () => {
    signalRowsByRunId.set(
      "generated-run",
      Array.from({ length: 1_001 }, (_, index) => row(index + 1)),
    );
    signalRowsByRunId.set("previous-run", []);

    const result = await reportLatestKrxSignals(false, "generated-run");

    expect(result.messageCount).toBe(1_001);
    expect(telegramMocks.formatTelegramReport.mock.results[0].value).toContainEqual(
      expect.stringContaining("ETF 1001"),
    );
  });
});
