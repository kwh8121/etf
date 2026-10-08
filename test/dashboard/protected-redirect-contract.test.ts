import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const protectedPage = readFileSync("app/protected/page.tsx", "utf8");

describe("보호 경로 리다이렉트 계약", () => {
  it("최신 KR 기준일을 조회해 신호 라우트로 보낸다", () => {
    expect(protectedPage).toContain('.eq("strategy_version", "m3-price-movers-v1")');
    expect(protectedPage).toContain('.order("bas_dd", { ascending: false })');
    expect(protectedPage).toContain("/signals/kr/");
    expect(protectedPage).toContain("redirect(");
  });

  it("미인증 접근을 로그인으로 보낸다", () => {
    expect(protectedPage).toContain('redirect("/auth/login")');
  });

  it("인증 확인이 첫 DB 조회보다 앞선다", () => {
    const claimsAt = protectedPage.indexOf("getClaims");
    const queryAt = protectedPage.indexOf('.from("signal_run")');
    expect(claimsAt).not.toBe(-1);
    expect(queryAt).not.toBe(-1);
    expect(claimsAt).toBeLessThan(queryAt);
  });

  it("조회 오류와 실행 없음을 구분해 안내한다", () => {
    expect(protectedPage).toContain("신호 결과를 불러오지 못했습니다. 잠시 후 다시 시도하세요.");
  });

  it("실행이 하나도 없을 때의 안내를 유지한다", () => {
    expect(protectedPage).toContain("아직 생성된 국내 신호 실행이 없습니다.");
  });

  it("신호 렌더링 코드를 더 들고 있지 않다", () => {
    expect(protectedPage).not.toContain("signal_daily");
    expect(protectedPage).not.toContain("isUsEtfP1Enabled");
  });
});
