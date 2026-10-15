import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { auditKrListingCorrectionProposals } from "../../lib/signals/data-accuracy.ts";
import {
  parseVerifyDataAccuracyArgs,
  runVerifyDataAccuracy,
  summarizeVerifyDataAccuracyResult,
} from "../../scripts/verify-data-accuracy.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("parseVerifyDataAccuracyArgs", () => {
  it("parses all mode with a local sanitized output path", () => {
    expect(
      parseVerifyDataAccuracyArgs(["all", "--output", "/tmp/data-accuracy.json"]),
    ).toEqual({
      mode: "all",
      runId: null,
      outputPath: "/tmp/data-accuracy.json",
    });
  });

  it("parses explicit run id without enabling writes", () => {
    expect(parseVerifyDataAccuracyArgs(["--run-id", "run-123"])).toEqual({
      mode: "run",
      runId: "run-123",
      outputPath: null,
    });
  });

  it("loads under Node strip-only runtime before rejecting unknown args", async () => {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "scripts/verify-data-accuracy.ts", "--unknown"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `/home/kwh8121/.nvm/versions/node/v22.23.2/bin:${process.env.PATH ?? ""}`,
        },
      },
    );
    if (result.error && String(result.error).includes("EPERM")) {
      expect(result.status).toBe(1);
      return;
    }
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("Unknown verify:data argument: --unknown");
    expect(combinedOutput).not.toContain("ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX");
  });

  it("fails closed when latest KR or US completed run selection is missing", async () => {
    const result = await runVerifyDataAccuracy(createSignalRunClient([]) as never, {
      mode: "latest",
      runId: null,
      outputPath: null,
    });

    expect(result.ok).toBe(false);
    expect(result.checkedRunCount).toBe(0);
    expect(result.selectionReasons).toEqual([
      "missing_latest_run:KR",
      "missing_latest_run:US",
    ]);
  });

  it("fails closed when all mode finds no completed runs", async () => {
    const result = await runVerifyDataAccuracy(createSignalRunClient([]) as never, {
      mode: "all",
      runId: null,
      outputPath: null,
    });

    expect(result.ok).toBe(false);
    expect(result.checkedRunCount).toBe(0);
    expect(result.selectionReasons).toEqual(["no_completed_runs"]);
  });

  it("fails all mode when the global KR listing proposal has evidence failures", async () => {
    const runClient = createSignalRunClient([
      { id: "run-kr", market: "KR", status: "COMPLETED", completed_at: "2026-10-14T00:00:00Z" },
    ]);
    const store = {
      async readSignalRun() { return null; },
      async readSignalRows() { return []; },
      async readSourceSnapshots() { return []; },
      async readKrTradingWindow() { return []; },
      async readKrDailyRows() { return []; },
      async readKrListingEvents() { return []; },
      async readKrMasters() { return []; },
      async readKrMasterSourceSnapshots() { return []; },
      async readKrListingHistory() {
        return [
          {
            event_key: "KR:new_listing:A001:20200101",
            code: "A001",
            reg_day: "2020-01-01",
            first_seen: "2026-10-15",
            new_in_snapshot: true,
            first_alerted_at: null,
            source_snapshot_id: "missing-source",
          },
        ];
      },
      async readKrMasterHistory() { return []; },
      async downloadSourceSnapshot() { throw new Error("unexpected download"); },
    };
    const krListingCorrectionProposal = await auditKrListingCorrectionProposals(
      runClient as never,
      { store },
    );
    const result = summarizeVerifyDataAccuracyResult({
      selectionReasons: [],
      results: [{ ok: true }],
      krListingCorrectionProposal,
    });

    expect(krListingCorrectionProposal).toMatchObject({
      ok: false,
      approvalReady: false,
    });
    expect(result.ok).toBe(false);
    expect(result.checkedRunCount).toBe(1);
    expect(result.inaccurateRunCount).toBe(0);
    expect(result.listingAccuracyOk).toBe(false);
    expect(result.failedCheckCount).toBe(1);
  });
});

function createSignalRunClient(rows: readonly Record<string, unknown>[]) {
  const tables: Record<string, readonly Record<string, unknown>[]> = {
    signal_run: rows,
    source_snapshot: [],
    listing_event_kr: [],
    etf_master_kr: [],
  };
  return {
    from(table: string) {
      return {
        select: () => new FakeQuery(tables[table] ?? [], table),
      };
    },
  };
}

class FakeQuery {
  private readonly filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private readonly orders: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private rangeStart = 0;
  private rangeEnd: number | null = null;

  constructor(
    private readonly rows: readonly Record<string, unknown>[],
    private readonly table: string,
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(start: number, end: number) {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }

  maybeSingle() {
    const result = this.result();
    const rows = result.data ?? [];
    return Promise.resolve({
      data: rows[0] ?? null,
      error: rows.length > 1 ? { message: `${this.table} returned multiple rows` } : null,
      count: result.count,
    });
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }

  private result() {
    let data = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    for (const order of [...this.orders].reverse()) {
      data = [...data].sort((left, right) => {
        const compared = String(left[order.column] ?? "").localeCompare(String(right[order.column] ?? ""));
        return order.ascending ? compared : -compared;
      });
    }
    const count = data.length;
    if (this.limitCount !== null) data = data.slice(0, this.limitCount);
    if (this.rangeEnd !== null) data = data.slice(this.rangeStart, this.rangeEnd + 1);
    return { data, error: null, count };
  }
}
