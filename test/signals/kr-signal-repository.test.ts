import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { KRX_FIVE_DAY_RETURN_DISCLOSURE } from "@/lib/signals/kr-price-movers";
import {
  createDeterministicSignalRunId,
  persistKrxPriceSignals,
  persistKrxSignalRows,
  type PersistKrxPriceSignalsInput,
} from "@/lib/signals/kr-signal-repository";

describe("KR signal persistence identity", () => {
  it("uses one stable UUID for the same input snapshot and transform", () => {
    const input = {
      basDd: "2026-09-18",
      sourceSnapshotId: "00000000-0000-4000-8000-000000000001",
      transformVersion: "m2-2026-09-21",
    };
    expect(createDeterministicSignalRunId(input)).toBe(
      createDeterministicSignalRunId(input),
    );
    expect(createDeterministicSignalRunId(input)).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      createDeterministicSignalRunId({
        ...input,
        sourceSnapshotId: "00000000-0000-4000-8000-000000000002",
      }),
    ).not.toBe(createDeterministicSignalRunId(input));
  });
});

describe("KR signal persistence recovery", () => {
  const input: PersistKrxPriceSignalsInput = {
    basDd: "2026-09-18",
    sourceSnapshotId: "00000000-0000-4000-8000-000000000001",
    transformVersion: "m2-2026-09-21",
    signals: {
      dailyGainers: [
        {
          code: "123456",
          name: "테스트 ETF",
          rank: 1,
          value: 1.5,
          screen: "raw" as const,
        },
      ],
      dailyLosers: [],
      fiveDayGainers: [],
      fiveDayLosers: [],
      disclosure: KRX_FIVE_DAY_RETURN_DISCLOSURE,
    },
  };

  it("keeps the run pending after a row failure and completes the same run on retry", async () => {
    const runWrites: Array<{
      id: string;
      status: string;
      completed_at: string | null;
    }> = [];
    let failRows = true;
    const client = {
      from(table: string) {
        return {
          select() {
            return { eq() { return this; }, async maybeSingle() { return { data: null, error: null }; } };
          },
          delete() {
            return {
              eq() { return this; },
              then(resolve: (value: { error: null }) => void) { resolve({ error: null }); },
            };
          },
          async upsert(value: unknown) {
            if (table === "signal_run") {
              runWrites.push(value as (typeof runWrites)[number]);
              return { error: null };
            }
            if (failRows) {
              failRows = false;
              return { error: { message: "injected row failure" } };
            }
            return { error: null };
          },
        };
      },
    } as unknown as SupabaseClient;

    await expect(persistKrxPriceSignals(client, input)).rejects.toThrow(
      "injected row failure",
    );
    expect(runWrites.map((write) => write.status)).toEqual(["PENDING"]);
    expect(runWrites[0].completed_at).toBeNull();

    const runId = await persistKrxPriceSignals(client, input);
    expect(runWrites.map((write) => write.status)).toEqual([
      "PENDING",
      "PENDING",
      "COMPLETED",
    ]);
    expect(runWrites.every((write) => write.id === runId)).toBe(true);
    expect(runWrites[2].completed_at).not.toBeNull();
  });

  it("only injects an operational failure after recording PENDING when explicitly enabled", async () => {
    const runWrites: Array<{ status: string; completed_at: string | null }> = [];
    const client = {
      from(table: string) {
        return {
          select() {
            return { eq() { return this; }, async maybeSingle() { return { data: null, error: null }; } };
          },
          async upsert(value: unknown) {
            if (table === "signal_run") runWrites.push(value as (typeof runWrites)[number]);
            return { error: null };
          },
          delete() {
            return { eq() { return this; }, then(resolve: (value: { error: null }) => void) { resolve({ error: null }); } };
          },
        };
      },
    } as unknown as SupabaseClient;
    const previous = process.env.ETF_SIGNAL_TEST_FAIL_AFTER_PENDING;
    process.env.ETF_SIGNAL_TEST_FAIL_AFTER_PENDING = "KR";
    try {
      await expect(persistKrxPriceSignals(client, input)).rejects.toThrow(
        "Injected KR signal persistence failure after PENDING",
      );
    } finally {
      if (previous === undefined) delete process.env.ETF_SIGNAL_TEST_FAIL_AFTER_PENDING;
      else process.env.ETF_SIGNAL_TEST_FAIL_AFTER_PENDING = previous;
    }
    expect(runWrites).toEqual([
      expect.objectContaining({ status: "PENDING", completed_at: null }),
    ]);
  });

  it("keeps an existing Telegram report marker when the same run is regenerated", async () => {
    const runWrites: Array<{ notes: Record<string, unknown> }> = [];
    const client = {
      from(table: string) {
        return {
          select() {
            return {
              eq() { return this; },
              async maybeSingle() {
                return { data: { notes: { telegram_reported_at: "2026-09-24T00:35:00.000Z" } }, error: null };
              },
            };
          },
          async upsert(value: unknown) {
            if (table === "signal_run") runWrites.push(value as (typeof runWrites)[number]);
            return { error: null };
          },
          delete() {
            return { eq() { return this; }, then(resolve: (value: { error: null }) => void) { resolve({ error: null }); } };
          },
        };
      },
    } as unknown as SupabaseClient;
    await persistKrxPriceSignals(client, input);
    expect(runWrites.length).toBeGreaterThan(0);
    expect(runWrites.every((write) => write.notes.telegram_reported_at === "2026-09-24T00:35:00.000Z")).toBe(true);
  });
});

describe("KR signal recalculation", () => {
  it("removes stale rows for the same run and signal type even when the new result is empty", async () => {
    const deleted: string[] = [];
    const client = {
      from(table: string) {
        expect(table).toBe("signal_daily");
        return {
          delete() {
            return {
              eq(key: string, value: string) {
                deleted.push(`${key}=${value}`);
                return this;
              },
              then(resolve: (value: { error: null }) => void) {
                resolve({ error: null });
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;
    await persistKrxSignalRows(client, {
      runId: "run-id", basDd: "2026-09-18", sourceSnapshotId: "snapshot-id",
      signalType: "turnover_surge", signals: [], valueUnit: "ratio",
    });
    expect(deleted).toEqual(["run_id=run-id", "signal_type=turnover_surge"]);
  });
});
