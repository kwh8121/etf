import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const protectedPage = readFileSync("app/protected/page.tsx", "utf8");

describe("protected signal dashboard contract", () => {
  it("limits the latest run to the current KR signal strategy", () => {
    expect(protectedPage).toContain(
      '.eq("strategy_version", "m3-price-movers-v1")',
    );
    expect(protectedPage).toContain(
      '.order("completed_at", { ascending: false })',
    );
  });

  it("shows a data-quality status alongside the latest run", () => {
    expect(protectedPage).toContain("데이터 품질");
    expect(protectedPage).toContain("신호 항목이 없습니다");
  });
});
