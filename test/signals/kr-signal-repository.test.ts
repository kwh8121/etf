import { describe, expect, it } from "vitest";

import { createDeterministicSignalRunId } from "@/lib/signals/kr-signal-repository";

describe("KR signal persistence identity", () => {
  it("uses one stable UUID for the same input snapshot and transform", () => {
    const input = { basDd: "2026-09-18", sourceSnapshotId: "00000000-0000-4000-8000-000000000001", transformVersion: "m2-2026-09-21" };
    expect(createDeterministicSignalRunId(input)).toBe(createDeterministicSignalRunId(input));
    expect(createDeterministicSignalRunId(input)).toMatch(/^[0-9a-f-]{36}$/);
    expect(createDeterministicSignalRunId({ ...input, sourceSnapshotId: "00000000-0000-4000-8000-000000000002" })).not.toBe(createDeterministicSignalRunId(input));
  });
});
