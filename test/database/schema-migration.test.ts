import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260918080411_market_data_foundation.sql",
);
const migration = readFileSync(migrationPath, "utf8");

describe("market-data foundation migration", () => {
  it("creates all core market and signal tables", () => {
    for (const table of [
      "source_snapshot",
      "trading_calendar_kr",
      "etf_daily_kr",
      "etf_master_kr",
      "listing_event_kr",
      "signal_run",
      "signal_daily",
    ]) {
      expect(migration).toContain(`create table ${table}`);
    }
  });

  it("preserves reproducibility and raw/liquid signal identity", () => {
    expect(migration).toContain("observation_key text unique not null");
    expect(migration).toContain("sha256 text not null");
    expect(migration).toContain(
      "primary key (run_id, market, signal_type, screen, code)",
    );
    expect(migration).toContain("check (screen in ('raw', 'liquid'))");
  });

  it("enables RLS and keeps source object locations private", () => {
    expect(migration).toContain("alter table source_snapshot enable row level security");
    expect(migration).not.toContain(
      "create policy \"Authenticated users can read source snapshots\"",
    );
    expect(migration).toContain(
      "create policy \"Authenticated users can read signal results\"",
    );
  });
});
