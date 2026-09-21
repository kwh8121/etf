import type { RankedKrxSignal } from "./kr-price-movers";

export interface KrxListingEventInput {
  code: string;
  name: string;
  regDay: string | null;
  firstSeen: string;
  newInSnapshot: boolean;
  firstAlertedAt: string | null;
  sourceSnapshotId: string | null;
}

export interface KrxNewListingSignals {
  signals: RankedKrxSignal[];
  metaByCode: Map<string, Record<string, string | boolean | null>>;
  sourceSnapshotIds: string[];
}

export function createKrxNewListingSignals(events: readonly KrxListingEventInput[]): KrxNewListingSignals {
  const candidates = events
    .filter((event) => event.newInSnapshot && event.firstAlertedAt === null)
    .sort((left, right) => left.firstSeen.localeCompare(right.firstSeen) || left.code.localeCompare(right.code));

  return {
    signals: candidates.map((event, index) => ({
      code: event.code,
      name: event.name,
      rank: index + 1,
      value: 1,
      screen: "raw",
    })),
    metaByCode: new Map(
      candidates.map((event) => [
        event.code,
        {
          reg_day: event.regDay,
          first_seen: event.firstSeen,
          new_in_snapshot: event.newInSnapshot,
          first_alerted_at: event.firstAlertedAt,
        },
      ]),
    ),
    sourceSnapshotIds: candidates.flatMap((event) => event.sourceSnapshotId ? [event.sourceSnapshotId] : []),
  };
}
