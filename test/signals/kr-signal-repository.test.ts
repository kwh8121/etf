import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { KRX_FIVE_DAY_RETURN_DISCLOSURE } from "@/lib/signals/kr-price-movers";
import {
  createDeterministicSignalRunId,
  persistKrxPriceSignals,
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
});
