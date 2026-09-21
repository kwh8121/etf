import { describe, expect, it, vi } from "vitest";

import {
  runUsEtfMoverIngestion,
  toGitHubOutput,
} from "../../scripts/ingest-us-movers";

describe("US ETF ingestion workflow", () => {
  it("does nothing while the P1 feature flag is off", async () => {
    const issueAccessToken = vi.fn();
    const fetchAll = vi.fn();
    const persist = vi.fn();

    await expect(
      runUsEtfMoverIngestion({
        enabled: false,
        issueAccessToken,
        fetchAll,
        persist,
        observationKey: () => "us-1",
        now: () => new Date("2026-09-21T14:00:00.000Z"),
      }),
    ).resolves.toEqual({ status: "DISABLED" });
    expect(issueAccessToken).not.toHaveBeenCalled();
    expect(fetchAll).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("persists a complete US-only observation when enabled", async () => {
    const persist = vi.fn().mockResolvedValue({
      snapshotId: "snapshot-1",
      runId: "run-1",
      duplicate: false,
    });
    const result = await runUsEtfMoverIngestion({
      enabled: true,
      issueAccessToken: vi.fn().mockResolvedValue({ token: "token" }),
      fetchAll: vi.fn().mockResolvedValue({
        universe: [],
        dailyGainers: [],
        dailyLosers: [],
        fiveDayGainers: [],
        fiveDayLosers: [],
        rawPayload: {},
        pageCount: 5,
      }),
      persist,
      observationKey: () => "us-1",
      now: () => new Date("2026-09-21T14:00:00.000Z"),
    });

    expect(result).toEqual({
      status: "COMPLETE",
      snapshotId: "snapshot-1",
      runId: "run-1",
      duplicate: false,
    });
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        observationKey: "us-1",
        observedAt: "2026-09-21T14:00:00.000Z",
      }),
    );
  });

  it("exposes no report run for disabled or duplicate observations", () => {
    expect(toGitHubOutput({ status: "DISABLED" })).toContain("run_id=\n");
    expect(
      toGitHubOutput({ status: "COMPLETE", runId: null, duplicate: true }),
    ).toContain("duplicate=true");
    expect(
      toGitHubOutput({
        status: "COMPLETE",
        runId: "new-run",
        duplicate: false,
      }),
    ).toContain("run_id=new-run");
  });
});
