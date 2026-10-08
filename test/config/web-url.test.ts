import { describe, expect, it } from "vitest";

import { buildKrSignalUrl, resolveKrSignalWebUrl, resolveWebBaseUrl } from "../../lib/config/web-url";

describe("웹 base URL 해석", () => {
  it("설정된 값을 그대로 돌려준다", () => {
    expect(resolveWebBaseUrl({ ETF_WEB_BASE_URL: "https://etf.example.app" })).toBe("https://etf.example.app");
  });

  it("후행 슬래시를 제거한다", () => {
    expect(resolveWebBaseUrl({ ETF_WEB_BASE_URL: "https://etf.example.app/" })).toBe("https://etf.example.app");
    expect(resolveWebBaseUrl({ ETF_WEB_BASE_URL: "https://etf.example.app///" })).toBe("https://etf.example.app");
  });

  it("앞뒤 공백을 제거한다", () => {
    expect(resolveWebBaseUrl({ ETF_WEB_BASE_URL: "  https://etf.example.app  " })).toBe("https://etf.example.app");
  });

  it("미설정·빈 문자열·공백만인 값은 null로 본다", () => {
    expect(resolveWebBaseUrl({})).toBeNull();
    expect(resolveWebBaseUrl({ ETF_WEB_BASE_URL: "" })).toBeNull();
    expect(resolveWebBaseUrl({ ETF_WEB_BASE_URL: "   " })).toBeNull();
  });

  it("기준일 링크를 조립한다", () => {
    expect(buildKrSignalUrl("https://etf.example.app", "2026-10-07")).toBe(
      "https://etf.example.app/signals/kr/2026-10-07",
    );
  });

  it("조립 단계에서도 후행 슬래시를 흘리지 않는다", () => {
    expect(buildKrSignalUrl("https://etf.example.app/", "2026-10-07")).toBe(
      "https://etf.example.app/signals/kr/2026-10-07",
    );
  });

  it("슬래시만 있는 값은 null로 본다", () => {
    expect(resolveWebBaseUrl({ ETF_WEB_BASE_URL: "///" })).toBeNull();
  });
});

describe("기준일 링크 해석", () => {
  it("미설정·빈 문자열·공백이면 undefined", () => {
    expect(resolveKrSignalWebUrl("2026-10-07", {})).toBeUndefined();
    expect(resolveKrSignalWebUrl("2026-10-07", { ETF_WEB_BASE_URL: "" })).toBeUndefined();
    expect(resolveKrSignalWebUrl("2026-10-07", { ETF_WEB_BASE_URL: "   " })).toBeUndefined();
  });

  it("설정되면 기준일 링크를 돌려준다", () => {
    expect(resolveKrSignalWebUrl("2026-10-07", { ETF_WEB_BASE_URL: "https://etf.example.app" })).toBe(
      "https://etf.example.app/signals/kr/2026-10-07",
    );
  });

  it("후행 슬래시를 정규화한다", () => {
    expect(resolveKrSignalWebUrl("2026-10-07", { ETF_WEB_BASE_URL: "https://etf.example.app//" })).toBe(
      "https://etf.example.app/signals/kr/2026-10-07",
    );
  });
});
