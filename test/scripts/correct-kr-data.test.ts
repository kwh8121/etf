import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  parseCorrectKrDataArgs,
  SupabaseKrCorrectionStore,
} from "../../scripts/correct-kr-data.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("parseCorrectKrDataArgs", () => {
  it("requires a fixed audit hash when creating a plan", () => {
    expect(() =>
      parseCorrectKrDataArgs(["plan", "--audit-file", "/tmp/audit.json"]),
    ).toThrow("--expected-audit-sha256 requires a value");
  });

  it("keeps apply mode dry-run unless --apply and --plan-hash are both present", () => {
    expect(
      parseCorrectKrDataArgs([
        "apply",
        "--plan-file",
        "/tmp/plan.json",
        "--plan-hash",
        "abc123",
      ]),
    ).toEqual({
      command: "apply",
      planFile: "/tmp/plan.json",
      expectedPlanHash: "abc123",
      apply: false,
    });
    expect(
      parseCorrectKrDataArgs([
        "apply",
        "--plan-file",
        "/tmp/plan.json",
        "--plan-hash",
        "abc123",
        "--apply",
      ]),
    ).toMatchObject({ apply: true });
  });

  it("rejects eligible date overrides outside the approved Q-27 pair", () => {
    expect(() =>
      parseCorrectKrDataArgs([
        "plan",
        "--audit-file",
        "/tmp/audit.json",
        "--expected-audit-sha256",
        "abc123",
        "--eligible-bas-dd",
        "2026-10-14",
      ]),
    ).toThrow("--eligible-bas-dd is fixed to 2026-10-13,2026-10-14 for Q-27");
  });

  it("loads under Node strip-only runtime before rejecting unknown args", () => {
    const result = spawnSync(
      "/home/kwh8121/.nvm/versions/node/v22.23.2/bin/node",
      ["--experimental-strip-types", "scripts/correct-kr-data.ts", "plan", "--unknown"],
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
    expect(combinedOutput).toContain("--unknown requires a value");
    expect(combinedOutput).not.toContain("ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX");
  });
});

describe("SupabaseKrCorrectionStore evidence reads", () => {
  it("re-reads daily evidence as a bounded full bas_dd set and detects extra rows", async () => {
    const basDd = "2026-10-14";
    const plannedDailyRows = Array.from({ length: 1_205 }, (_, index) => ({
      bas_dd: basDd,
      isu_cd: `A${String(index).padStart(4, "0")}`,
      close_prc: index + 1,
    }));
    const extraDailyRow = {
      bas_dd: basDd,
      isu_cd: "AZZZZ",
      close_prc: 9_999,
    };
    const plannedRows = {
      source_snapshot: [{ id: "source-1", sha256: "raw-hash" }],
      trading_calendar_kr: [
        { bas_dd: basDd, seq: 100, status: "TRADING_COMPLETE", source_snapshot_id: "source-1" },
      ],
      etf_daily_kr: [...plannedDailyRows, extraDailyRow],
    };
    const expected = {
      records: [
        ...plannedRows.source_snapshot.map((row) => evidenceRecord("source_snapshot", String(row.id), row)),
        ...plannedRows.trading_calendar_kr.map((row) =>
          evidenceRecord("trading_calendar_kr", String(row.bas_dd), row),
        ),
        ...plannedRows.etf_daily_kr.map((row) =>
          evidenceRecord("etf_daily_kr", `${String(row.bas_dd)}:${String(row.isu_cd)}`, row),
        ),
      ],
    };
    const actualRows = {
      ...plannedRows,
      etf_daily_kr: plannedDailyRows,
    };
    const calls: string[] = [];
    const actualStore = new SupabaseKrCorrectionStore(
      createEvidenceClient(actualRows, calls) as unknown as SupabaseClient,
      "/tmp",
    );

    const actual = await actualStore.readPreflightEvidence(expected);

    expect(actual.records).toHaveLength(expected.records.length - 1);
    expect(calls.filter((call) => call === "etf_daily_kr")).toHaveLength(2);
    expect(calls.filter((call) => call === "source_snapshot")).toHaveLength(1);
    expect(calls.filter((call) => call === "trading_calendar_kr")).toHaveLength(1);
  });
});

function createEvidenceClient(
  rows: Record<string, readonly Record<string, unknown>[]>,
  calls: string[] = [],
) {
  return {
    from(table: string) {
      calls.push(table);
      return {
        select: () => new FakeQuery(rows[table] ?? [], table),
      };
    },
  };
}

function evidenceRecord(
  scope: "source_snapshot" | "trading_calendar_kr" | "etf_daily_kr",
  key: string,
  row: Record<string, unknown>,
) {
  return { scope, key, sha256: JSON.stringify(row) };
}

class FakeQuery {
  private readonly filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private readonly inFilters: Array<(row: Record<string, unknown>) => boolean> = [];
  private readonly orders: Array<{ column: string; ascending: boolean }> = [];
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

  in(column: string, values: readonly unknown[]) {
    const set = new Set(values.map(String));
    this.inFilters.push((row) => set.has(String(row[column])));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
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
    let data = this.rows.filter(
      (row) =>
        this.filters.every((filter) => filter(row)) &&
        this.inFilters.every((filter) => filter(row)),
    );
    for (const order of [...this.orders].reverse()) {
      data = [...data].sort((left, right) => {
        const compared = String(left[order.column] ?? "").localeCompare(String(right[order.column] ?? ""));
        return order.ascending ? compared : -compared;
      });
    }
    const count = data.length;
    if (this.rangeEnd !== null) data = data.slice(this.rangeStart, this.rangeEnd + 1);
    return { data, error: null, count };
  }
}
