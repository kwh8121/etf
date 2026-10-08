import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const globalsCss = readFileSync("app/globals.css", "utf8");
const tailwindConfig = readFileSync("tailwind.config.ts", "utf8");

describe("방향 색 토큰", () => {
  it("라이트와 다크 양쪽에 상승·하락 변수를 정의한다", () => {
    const lightBlock = globalsCss.slice(globalsCss.indexOf(":root"), globalsCss.indexOf(".dark"));
    const darkBlock = globalsCss.slice(globalsCss.indexOf(".dark"));

    for (const token of ["--signal-gain", "--signal-loss"]) {
      expect(lightBlock).toContain(token);
      expect(darkBlock).toContain(token);
    }
  });

  it("Tailwind가 signal.gain과 signal.loss를 변수로 노출한다", () => {
    expect(tailwindConfig).toContain("hsl(var(--signal-gain))");
    expect(tailwindConfig).toContain("hsl(var(--signal-loss))");
  });
});
