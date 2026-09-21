import { describe, expect, it } from "vitest";

import { createKrxNewListingSignals } from "../../lib/signals/kr-new-listings";

describe("KRX new listing signals", () => {
  it("emits only unalerted events that appeared after the initial master snapshot", () => {
    const result = createKrxNewListingSignals([
      { code: "INITIAL", name: "Initial", regDay: "2026-09-01", firstSeen: "2026-09-16", newInSnapshot: false, firstAlertedAt: null, sourceSnapshotId: "snapshot-initial" },
      { code: "ALERTED", name: "Alerted", regDay: "2026-09-17", firstSeen: "2026-09-17", newInSnapshot: true, firstAlertedAt: "2026-09-17T10:00:00Z", sourceSnapshotId: "snapshot-alerted" },
      { code: "NEW", name: "New", regDay: "2026-09-18", firstSeen: "2026-09-18", newInSnapshot: true, firstAlertedAt: null, sourceSnapshotId: "snapshot-new" },
    ]);

    expect(result.signals).toEqual([expect.objectContaining({ code: "NEW", value: 1, screen: "raw" })]);
    expect(result.sourceSnapshotIds).toEqual(["snapshot-new"]);
    expect(result.metaByCode.get("NEW")).toMatchObject({ reg_day: "2026-09-18", new_in_snapshot: true });
  });
});
