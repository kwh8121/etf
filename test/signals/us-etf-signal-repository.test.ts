import { describe, expect, it } from "vitest";

import {
  persistUsEtfMoverSnapshot,
  type UsEtfMoverRepository,
} from "@/lib/signals/us-etf-signal-repository";

class FakeRepository implements UsEtfMoverRepository {
  existing: { id: string; objectPath: string | null; asofAt: string } | null =
    null;
  snapshots: Record<string, unknown>[] = [];
  uploads: string[] = [];
  runs: Record<string, unknown>[] = [];
  rows: Record<string, unknown>[] = [];
  existingRun: { id: string; status: string } | null = null;
  failRows = false;
  async findSnapshotByContent() {
    return this.existing;
  }
  async findSignalRunBySnapshot() {
    return this.existingRun;
  }
  async uploadRawSnapshot(path: string) {
    this.uploads.push(path);
  }
  async insertSnapshot(input: Record<string, unknown>) {
    this.snapshots.push(input);
    return {
      id: `snapshot-${this.snapshots.length}`,
      objectPath: input.objectPath as string | null,
    };
  }
  async upsertSignalRun(input: Record<string, unknown>) {
    this.runs.push(input);
  }
  async upsertSignalRows(rows: readonly Record<string, unknown>[]) {
    if (this.failRows) throw new Error("signal rows unavailable");
    this.rows.push(...rows);
  }
}

const input = {
  observationKey: "us-1",
  observedAt: "2026-09-21T14:00:00.000Z",
  rawPayload: { usa10104: [[]], usa20911_daily_gain: [[]] },
  pageCount: 5,
  signals: {
    dailyGainers: [
      {
        code: "ETF1",
        name: "ETF one",
        rank: 1,
        value: 2.5,
        meta: { end_price: 10 },
      },
    ],
    dailyLosers: [],
    fiveDayGainers: [],
    fiveDayLosers: [],
  },
};

describe("US ETF P1 persistence", () => {
  it("keeps market_date null and saves one composite source snapshot plus US experimental signals", async () => {
    const repository = new FakeRepository();
    const result = await persistUsEtfMoverSnapshot(repository, input);

    expect(result).toEqual({
      snapshotId: "snapshot-1",
      runId: expect.any(String),
      duplicate: false,
    });
    expect(repository.uploads).toEqual(["kiwoom/us_etf_movers/us-1.json"]);
    expect(repository.snapshots[0]).toMatchObject({
      market: "US",
      apiId: "us_etf_movers",
      marketDate: null,
      status: "COMPLETE",
      pageCount: 5,
    });
    expect(repository.runs[0]).toMatchObject({
      market: "US",
      marketDate: null,
      asofAt: "2026-09-21T14:00:00.000Z",
      status: "PENDING",
      completedAt: null,
    });
    expect(repository.runs[1]).toMatchObject({
      status: "COMPLETED",
    });
    expect(repository.rows).toEqual([
      expect.objectContaining({
        market: "US",
        marketDate: null,
        isExperimental: true,
        signalType: "daily_price_gain",
      }),
    ]);
  });

  it("records a duplicate observation but creates no duplicate run or signals", async () => {
    const repository = new FakeRepository();
    repository.existing = {
      id: "original",
      objectPath: "kiwoom/us_etf_movers/original.json",
      asofAt: input.observedAt,
    };
    repository.existingRun = { id: "completed-run", status: "COMPLETED" };

    const result = await persistUsEtfMoverSnapshot(repository, {
      ...input,
      observationKey: "us-2",
    });

    expect(result).toEqual({
      snapshotId: "snapshot-1",
      runId: null,
      duplicate: true,
    });
    expect(repository.snapshots[0]).toMatchObject({
      status: "duplicate_observation",
      duplicateOfSnapshotId: "original",
    });
    expect(repository.runs).toEqual([]);
    expect(repository.rows).toEqual([]);
  });

  it("leaves a failed run pending and resumes it from the same source content", async () => {
    const repository = new FakeRepository();
    repository.failRows = true;
    await expect(persistUsEtfMoverSnapshot(repository, input)).rejects.toThrow(
      "signal rows unavailable",
    );
    expect(repository.runs.map((run) => run.status)).toEqual(["PENDING"]);

    repository.existing = {
      id: "snapshot-1",
      objectPath: repository.uploads[0],
      asofAt: "2026-09-21T14:00:00+00:00",
    };
    repository.existingRun = {
      id: repository.runs[0].id as string,
      status: "PENDING",
    };
    repository.failRows = false;
    const resumed = await persistUsEtfMoverSnapshot(repository, {
      ...input,
      observationKey: "us-retry",
      observedAt: "2026-09-21T14:05:00.000Z",
    });

    expect(resumed).toMatchObject({
      snapshotId: "snapshot-1",
      duplicate: false,
    });
    expect(resumed.runId).toBe(repository.runs[0].id);
    expect(repository.uploads).toHaveLength(1);
    expect(repository.snapshots).toHaveLength(1);
    expect(repository.runs.map((run) => run.status)).toEqual([
      "PENDING",
      "PENDING",
      "COMPLETED",
    ]);
    expect(repository.rows).toHaveLength(1);
  });
});
