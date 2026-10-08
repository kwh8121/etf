import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const script = readFileSync("scripts/report-kr-signals.ts", "utf8");

describe("KR 보고 스크립트 웹 링크 배선", () => {
  it("헬퍼를 .ts 확장자로 import한다", () => {
    expect(script).toContain("resolveKrSignalWebUrl");
    expect(script).toContain('from "../lib/config/web-url.ts"');
  });

  it("기준일로 해석한 링크를 webUrl로 넘긴다", () => {
    expect(script).toContain("webUrl: resolveKrSignalWebUrl(latest.bas_dd)");
  });
});
