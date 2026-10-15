import { describe, expect, it } from "vitest";

import {
  applyKrDataCorrectionPlan,
  buildKrDataCorrectionPlan,
  restoreKrDataCorrectionBackup,
  type KrCorrectionBackup,
  type KrCorrectionInput,
  type KrCorrectionListingEventRow,
  type KrCorrectionMasterRow,
  type KrCorrectionRunRow,
  type KrCorrectionSignalRow,
  type KrCorrectionStore,
} from "../../lib/signals/kr-data-correction.ts";

describe("buildKrDataCorrectionPlan", () => {
  it("rejects stale proposal evidence by fixed audit hash before writes can be planned", () => {
    const input = correctionInput({
      auditSha256: "new-hash",
      expectedAuditSha256: "old-hash",
    });

    expect(() => buildKrDataCorrectionPlan(input)).toThrow(
      "audit hash mismatch: expected old-hash but received new-hash",
    );
  });

  it("rejects eligible date overrides outside the approved Q-27 pair", () => {
    expect(() =>
      buildKrDataCorrectionPlan(correctionInput({ eligibleBasDd: ["2026-10-14"] })),
    ).toThrow("eligibleBasDd is fixed to 2026-10-13,2026-10-14 for Q-27");
  });

  it("rejects drifted listing proposal rows before writes can be planned", () => {
    expect(() =>
      buildKrDataCorrectionPlan(
        correctionInput({
          listingEvents: [
            listingEvent({ event_key: "event:false", code: "OTHER", first_seen: "2026-10-15" }),
          ],
        }),
      ),
    ).toThrow("listing proposal event drift: event:false");
  });

  it("keeps uncertain historical price runs out while deleting false listing references", () => {
    const input = correctionInput({
      completedRuns: [
        run({ id: "recent", bas_dd: "2026-10-14" }),
        run({ id: "uncertain", bas_dd: "2026-09-21" }),
      ],
      signalRows: [
        signalRow({ run_id: "recent", signal_type: "daily_price_gain", code: "KEEP" }),
        signalRow({
          run_id: "uncertain",
          signal_type: "new_listing",
          code: "FALSE",
          meta: { event_key: "event:false", first_seen: "2026-10-10" },
        }),
      ],
      runAudits: [
        {
          runId: "recent",
          ok: false,
          correctionProposal: {
            added: [sanitized({ code: "ADD", rank: 1 })],
            removed: [sanitized({ code: "KEEP", rank: 1 })],
            changed: [],
          },
        },
        {
          runId: "uncertain",
          ok: false,
          correctionProposal: {
            added: [sanitized({ code: "BAD", signal_type: "daily_price_gain" })],
            removed: [],
            changed: [],
          },
        },
      ],
    });

    const plan = buildKrDataCorrectionPlan(input);

    expect(plan.runReplacements.map((replacement) => replacement.runId)).toEqual(["recent", "uncertain"]);
    expect(
      plan.runReplacements
        .find((replacement) => replacement.runId === "uncertain")
        ?.replacementRows.some((row) => row.code === "BAD"),
    ).toBe(false);
    expect(plan.signalRowsToDelete).toEqual([
      {
        run_id: "uncertain",
        market: "KR",
        signal_type: "new_listing",
        screen: "raw",
        code: "FALSE",
      },
    ]);
    expect(plan.deferredRunIds).toEqual(["uncertain"]);
  });

  it("preserves existing observed_at and report metadata, while added rows use the run observed_at", () => {
    const input = correctionInput({
      completedRuns: [
        run({
          id: "recent",
          observed_at: "2026-10-14T08:00:00.000Z",
          notes: { telegram_reported_at: "2026-10-14T08:10:00.000Z" },
        }),
      ],
      signalRows: [
        signalRow({
          run_id: "recent",
          code: "CHANGED",
          observed_at: "2026-10-14T08:01:00.000Z",
          rank: 2,
          meta: { keep: true },
        }),
      ],
      runAudits: [
        {
          runId: "recent",
          ok: false,
          correctionProposal: {
            added: [sanitized({ code: "ADDED", rank: 1 })],
            removed: [],
            changed: [
              {
                key: "daily_price_gain:raw:CHANGED",
                before: sanitized({ code: "CHANGED", rank: 2 }),
                after: sanitized({ code: "CHANGED", rank: 1, meta: { corrected: true } }),
                fields: ["rank", "meta"],
              },
            ],
          },
        },
      ],
    });

    const plan = buildKrDataCorrectionPlan(input);
    const rows = plan.runReplacements[0]?.replacementRows ?? [];

    expect(plan.runQuarantines).toEqual([
      {
        runId: "recent",
        originalStatus: "COMPLETED",
        originalCompletedAt: "2026-10-14T08:05:00.000Z",
      },
    ]);
    expect(plan.preservedRunNotesById.recent).toEqual({
      telegram_reported_at: "2026-10-14T08:10:00.000Z",
    });
    expect(rows.find((row) => row.code === "CHANGED")).toMatchObject({
      rank: 1,
      observed_at: "2026-10-14T08:01:00.000Z",
      meta: { corrected: true },
    });
    expect(rows.find((row) => row.code === "ADDED")).toMatchObject({
      observed_at: "2026-10-14T08:00:00.000Z",
      bas_dd: "2026-10-14",
      market_date: "2026-10-14",
    });
  });

  it("rejects changed rows that mutate the signal identity", () => {
    expect(() =>
      buildKrDataCorrectionPlan(
        correctionInput({
          completedRuns: [run({ id: "recent" })],
          signalRows: [signalRow({ run_id: "recent", code: "OLD" })],
          runAudits: [
            {
              runId: "recent",
              ok: false,
              correctionProposal: {
                added: [],
                removed: [],
                changed: [
                  {
                    key: "daily_price_gain:raw:OLD",
                    before: sanitized({ code: "OLD" }),
                    after: sanitized({ code: "NEW" }),
                    fields: ["code"],
                  },
                ],
              },
            },
          ],
        }),
      ),
    ).toThrow("changed signal identity mutation is not supported");
  });

  it("deletes confirmed false listing events, updates master first_seen, and reranks remaining listing rows", () => {
    const input = correctionInput({
      signalRows: [
        signalRow({
          signal_type: "new_listing",
          code: "FALSE",
          rank: 1,
          meta: { event_key: "event:false", first_seen: "2026-10-10" },
        }),
        signalRow({
          signal_type: "new_listing",
          code: "TRUE",
          rank: 2,
          meta: { event_key: "event:true", first_seen: "2026-10-11" },
        }),
      ],
    });

    const plan = buildKrDataCorrectionPlan(input);

    expect(plan.listingEventKeysToDelete).toEqual(["event:false"]);
    expect(plan.masterFirstSeenUpdates).toEqual([
      {
        code: "FALSE",
        from: "2026-10-15",
        to: "2026-10-10",
        sourceSnapshotId: "master-early",
      },
    ]);
    expect(plan.runReplacements[0]?.replacementRows).toEqual([
      expect.objectContaining({
        signal_type: "new_listing",
        code: "TRUE",
        rank: 1,
      }),
    ]);
  });
});

describe("applyKrDataCorrectionPlan", () => {
  it("quarantines before global writes, restores exact backup after failure, and never leaves a completed partial run", async () => {
    const input = correctionInput({
      completedRuns: [run({ id: "recent" })],
      signalRows: [
        signalRow({ run_id: "recent", signal_type: "new_listing", code: "FALSE", meta: { event_key: "event:false" } }),
      ],
    });
    const plan = buildKrDataCorrectionPlan(input);
    const store = new FakeCorrectionStore(input, {
      failOn: "deleteListingEvents",
    });

    await expect(applyKrDataCorrectionPlan(store, plan, { apply: true })).rejects.toThrow(
      "injected deleteListingEvents failure",
    );

    expect(store.runStatus("recent")).toBe("COMPLETED");
    expect(store.signalRows()).toEqual(input.signalRows);
    expect(store.listingEventKeys()).toEqual(["event:false", "event:true"]);
    expect(store.log.slice(0, 2)).toEqual([
      "writeBackup",
      "updateRunStatus:recent:CORRECTION_PENDING",
    ]);
  });

  it("refuses to mutate when preflight evidence changed after planning", async () => {
    const input = correctionInput();
    const plan = buildKrDataCorrectionPlan(input);
    const store = new FakeCorrectionStore(input, {
      evidenceSha256: "changed",
    });

    await expect(applyKrDataCorrectionPlan(store, plan, { apply: true })).rejects.toThrow(
      "pre-apply evidence freshness check mismatch",
    );

    expect(store.log).toEqual(["writeBackup"]);
  });

  it("removes inserted rows during rollback when the original run had no signal rows", async () => {
    const input = correctionInput({
      completedRuns: [run({ id: "empty-run", bas_dd: "2026-10-14" })],
      signalRows: [],
      listingProposal: {
        ok: true,
        approvalReady: true,
        falseListingEvents: [],
        masterFirstSeenCorrections: [],
        caveats: [],
      },
      listingEvents: [],
      masterRows: [],
      runAudits: [
        {
          runId: "empty-run",
          ok: false,
          correctionProposal: {
            added: [sanitized({ code: "INSERTED", rank: 1 })],
            removed: [],
            changed: [],
          },
        },
      ],
    });
    const plan = buildKrDataCorrectionPlan(input);
    const store = new FakeCorrectionStore(input, {
      failOn: "updateMasterFirstSeen",
    });

    await expect(applyKrDataCorrectionPlan(store, plan, { apply: true })).rejects.toThrow(
      "injected updateMasterFirstSeen failure",
    );

    expect(store.runStatus("empty-run")).toBe("COMPLETED");
    expect(store.signalRows()).toEqual([]);
  });

  it("applies, verifies readback, and can restore the immutable backup", async () => {
    const input = correctionInput({
      completedRuns: [run({ id: "recent" })],
      signalRows: [
        signalRow({ run_id: "recent", signal_type: "new_listing", code: "FALSE", meta: { event_key: "event:false" } }),
        signalRow({ run_id: "recent", signal_type: "new_listing", code: "TRUE", rank: 2, meta: { event_key: "event:true", first_seen: "2026-10-11" } }),
      ],
    });
    const plan = buildKrDataCorrectionPlan(input);
    const store = new FakeCorrectionStore(input);

    const result = await applyKrDataCorrectionPlan(store, plan, { apply: true });

    expect(result.status).toBe("COMPLETED");
    expect(store.runStatus("recent")).toBe("COMPLETED");
    expect(store.listingEventKeys()).toEqual(["event:true"]);
    expect(store.signalRows()).toEqual([
      expect.objectContaining({ code: "TRUE", rank: 1 }),
    ]);

    await restoreKrDataCorrectionBackup(store, result.backup);

    expect(store.signalRows()).toEqual(input.signalRows);
    expect(store.listingEventKeys()).toEqual(["event:false", "event:true"]);
  });

  it("is dry-run by default and refuses hash-mismatched plans", async () => {
    const input = correctionInput();
    const plan = buildKrDataCorrectionPlan(input);
    const store = new FakeCorrectionStore(input);

    await expect(applyKrDataCorrectionPlan(store, plan)).resolves.toMatchObject({
      status: "DRY_RUN",
    });
    expect(store.log).toEqual([]);
    await expect(
      applyKrDataCorrectionPlan(store, { ...plan, planHash: "tampered" }, {
        apply: true,
        expectedPlanHash: plan.planHash,
      }),
    ).rejects.toThrow("plan hash mismatch");
  });
});

function correctionInput(overrides: Partial<KrCorrectionInput> = {}): KrCorrectionInput {
  const completedRuns = overrides.completedRuns ?? [run({ id: "recent" })];
  const signalRows = overrides.signalRows ?? [
    signalRow({
      run_id: "recent",
      signal_type: "new_listing",
      code: "FALSE",
      meta: { event_key: "event:false", first_seen: "2026-10-15" },
    }),
    signalRow({
      run_id: "recent",
      signal_type: "new_listing",
      code: "TRUE",
      rank: 2,
      meta: { event_key: "event:true", first_seen: "2026-10-11" },
    }),
  ];
  return {
    auditSha256: "audit-hash",
    expectedAuditSha256: "audit-hash",
    eligibleBasDd: ["2026-10-13", "2026-10-14"],
    preflightEvidence: {
      records: [
        { scope: "source_snapshot", key: "source-current", sha256: "source-hash" },
        { scope: "trading_calendar_kr", key: "2026-10-14", sha256: "calendar-hash" },
        { scope: "etf_daily_kr", key: "2026-10-14:KEEP", sha256: "daily-hash" },
      ],
    },
    completedRuns,
    signalRows,
    listingEvents: [
      listingEvent({
        event_key: "event:false",
        code: "FALSE",
        first_seen: "2026-10-15",
        source_snapshot_id: "master-late",
      }),
      listingEvent({ event_key: "event:true", code: "TRUE", first_seen: "2026-10-11" }),
    ],
    masterRows: [
      masterRow({ code: "FALSE", first_seen: "2026-10-15" }),
      masterRow({ code: "TRUE", first_seen: "2026-10-11" }),
    ],
    listingProposal: {
      ok: false,
      approvalReady: true,
      falseListingEvents: [
        {
          eventKey: "event:false",
          code: "FALSE",
          storedFirstSeen: "2026-10-15",
          earliestObservedDate: "2026-10-10",
          eventSourceSnapshotId: "master-late",
          earliestSourceSnapshotId: "master-early",
        },
      ],
      masterFirstSeenCorrections: [
        {
          code: "FALSE",
          storedFirstSeen: "2026-10-15",
          proposedFirstSeen: "2026-10-10",
          sourceSnapshotId: "master-early",
        },
      ],
      caveats: [],
    },
    runAudits: [],
    ...overrides,
  };
}

function run(overrides: Partial<KrCorrectionRunRow> = {}): KrCorrectionRunRow {
  return {
    id: "recent",
    market: "KR",
    bas_dd: "2026-10-14",
    market_date: "2026-10-14",
    observed_at: "2026-10-14T08:00:00.000Z",
    asof_at: null,
    status: "COMPLETED",
    started_at: "2026-10-14T08:00:00.000Z",
    completed_at: "2026-10-14T08:05:00.000Z",
    strategy_version: "kr-price-v1",
    transform_version: "v1",
    input_snapshot_ids: ["source-current"],
    notes: {},
    ...overrides,
  };
}

function signalRow(overrides: Partial<KrCorrectionSignalRow> = {}): KrCorrectionSignalRow {
  return {
    run_id: "recent",
    market: "KR",
    bas_dd: "2026-10-14",
    market_date: "2026-10-14",
    observed_at: "2026-10-14T08:00:00.000Z",
    asof_at: null,
    signal_type: "daily_price_gain",
    code: "KEEP",
    name: "Keep",
    screen: "raw",
    rank: 1,
    value: 1,
    value_unit: "percent",
    liquidity_value: null,
    is_experimental: false,
    source_snapshot_id: "source-current",
    meta: {},
    ...overrides,
  };
}

function sanitized(overrides: Record<string, unknown> = {}) {
  return {
    signal_type: "daily_price_gain",
    screen: "raw",
    code: "KEEP",
    name: "Keep",
    rank: 1,
    value: 1,
    value_unit: "percent",
    meta: {},
    source_snapshot_id: "source-current",
    ...overrides,
  };
}

function listingEvent(overrides: Partial<KrCorrectionListingEventRow> = {}): KrCorrectionListingEventRow {
  return {
    event_key: "event:true",
    code: "TRUE",
    reg_day: "2020-01-01",
    first_seen: "2026-10-11",
    new_in_snapshot: true,
    first_alerted_at: null,
    source_snapshot_id: "master-source",
    ...overrides,
  };
}

function masterRow(overrides: Partial<KrCorrectionMasterRow> = {}): KrCorrectionMasterRow {
  return {
    code: "TRUE",
    name: "True ETF",
    reg_day: "2020-01-01",
    market_code: "",
    market_name: "",
    state: "",
    first_seen: "2026-10-11",
    last_seen: "2026-10-15",
    first_alerted_at: null,
    source_snapshot_id: "master-source",
    ...overrides,
  };
}

class FakeCorrectionStore implements KrCorrectionStore {
  readonly log: string[] = [];
  private runs: Record<string, Record<string, unknown>>;
  private rows: Record<string, unknown>[];
  private events: Record<string, Record<string, unknown>>;
  private masters: Record<string, Record<string, unknown>>;
  private backup: KrCorrectionBackup | null = null;

  constructor(
    input: KrCorrectionInput,
    private readonly options: { failOn?: string; evidenceSha256?: string } = {},
  ) {
    this.runs = Object.fromEntries(input.completedRuns.map((item) => [String(item.id), { ...item }]));
    this.rows = input.signalRows.map((row) => ({ ...row }));
    this.events = Object.fromEntries(input.listingEvents.map((item) => [String(item.event_key), { ...item }]));
    this.masters = Object.fromEntries(input.masterRows.map((item) => [String(item.code), { ...item }]));
  }

  async writeBackup(backup: KrCorrectionBackup): Promise<void> {
    this.log.push("writeBackup");
    this.backup = backup;
  }

  async readPreflightEvidence(expected: KrCorrectionInput["preflightEvidence"]): Promise<KrCorrectionInput["preflightEvidence"]> {
    return {
      records: expected.records.map((record) => ({
        ...record,
        sha256: this.options.evidenceSha256 ?? record.sha256,
      })),
    };
  }

  async updateRunStatus(runId: string, status: string, completedAt: string | null): Promise<void> {
    this.log.push(`updateRunStatus:${runId}:${status}`);
    this.runs[runId] = { ...this.runs[runId], status, completed_at: completedAt };
  }

  async replaceSignalRows(runId: string, rows: readonly Record<string, unknown>[]): Promise<void> {
    this.failIf("replaceSignalRows");
    this.log.push(`replaceSignalRows:${runId}`);
    this.rows = [...this.rows.filter((row) => row.run_id !== runId), ...rows.map((row) => ({ ...row }))];
  }

  async deleteSignalRows(keys: readonly { run_id: string; market: string; signal_type: string; screen: string; code: string }[]): Promise<void> {
    this.log.push(`deleteSignalRows:${keys.length}`);
    const keySet = new Set(keys.map(signalKey));
    this.rows = this.rows.filter((row) => !keySet.has(signalKey(row as never)));
  }

  async deleteListingEvents(eventKeys: readonly string[]): Promise<void> {
    this.failIf("deleteListingEvents");
    this.log.push(`deleteListingEvents:${eventKeys.length}`);
    for (const key of eventKeys) delete this.events[key];
  }

  async updateMasterFirstSeen(updates: readonly { code: string; to: string; sourceSnapshotId: string }[]): Promise<void> {
    this.failIf("updateMasterFirstSeen");
    this.log.push(`updateMasterFirstSeen:${updates.length}`);
    for (const update of updates) {
      this.masters[update.code] = {
        ...this.masters[update.code],
        first_seen: update.to,
      };
    }
  }

  async completeRuns(quarantines: readonly { runId: string; originalStatus: string; originalCompletedAt: string | null }[]): Promise<void> {
    for (const quarantine of quarantines) {
      this.log.push(`completeRun:${quarantine.runId}`);
      this.runs[quarantine.runId] = {
        ...this.runs[quarantine.runId],
        status: quarantine.originalStatus,
        completed_at: quarantine.originalCompletedAt,
      };
    }
  }

  async restoreBackup(backup: KrCorrectionBackup): Promise<void> {
    this.log.push("restoreBackup");
    const runIds = new Set([
      ...backup.signalRuns.map((row) => String(row.id)),
      ...backup.signalRows.map((row) => String(row.run_id)),
    ]);
    this.rows = [
      ...this.rows.filter((row) => !runIds.has(String(row.run_id))),
      ...backup.signalRows.map((row) => ({ ...row })),
    ];
    for (const item of backup.signalRuns) this.runs[String(item.id)] = { ...item };
    for (const item of backup.listingEvents) this.events[String(item.event_key)] = { ...item };
    for (const item of backup.masterRows) this.masters[String(item.code)] = { ...item };
  }

  async readBack(): Promise<KrCorrectionBackup> {
    if (this.backup) return this.scopedReadBack(this.backup);
    return {
      signalRuns: Object.values(this.runs),
      signalRows: this.rows.map((row) => ({ ...row })),
      listingEvents: Object.values(this.events),
      masterRows: Object.values(this.masters),
    };
  }

  runStatus(id: string): unknown {
    return this.runs[id]?.status;
  }

  signalRows(): Record<string, unknown>[] {
    return this.rows;
  }

  listingEventKeys(): string[] {
    return Object.keys(this.events).sort();
  }

  private failIf(operation: string): void {
    if (this.options.failOn === operation) {
      throw new Error(`injected ${operation} failure`);
    }
  }

  private scopedReadBack(scope: KrCorrectionBackup): KrCorrectionBackup {
    const runIds = new Set(scope.signalRuns.map((row) => String(row.id)));
    const signalRunIds = new Set([
      ...scope.signalRuns.map((row) => String(row.id)),
      ...scope.signalRows.map((row) => String(row.run_id)),
    ]);
    const eventKeys = new Set(scope.listingEvents.map((row) => String(row.event_key)));
    const masterCodes = new Set(scope.masterRows.map((row) => String(row.code)));
    return {
      signalRuns: Object.values(this.runs).filter((row) => runIds.has(String(row.id))),
      signalRows: this.rows.filter((row) => signalRunIds.has(String(row.run_id))).map((row) => ({ ...row })),
      listingEvents: Object.values(this.events).filter((row) => eventKeys.has(String(row.event_key))),
      masterRows: Object.values(this.masters).filter((row) => masterCodes.has(String(row.code))),
    };
  }
}

function signalKey(row: { run_id: string; market: string; signal_type: string; screen: string; code: string }): string {
  return `${row.run_id}:${row.market}:${row.signal_type}:${row.screen}:${row.code}`;
}
