import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const signalPage = readFileSync("app/signals/kr/[basDd]/page.tsx", "utf8");

describe("기준일 신호 라우트 계약", () => {
  it("현재 KR 신호 전략으로 실행을 한정하고 재실행 시 최신 건을 고른다", () => {
    expect(signalPage).toContain('.eq("strategy_version", "m3-price-movers-v1")');
    expect(signalPage).toContain('.order("completed_at", { ascending: false, nullsFirst: false })');
    expect(signalPage).toContain('.order("id", { ascending: false })');
  });

  it("인증 확인이 첫 DB 조회보다 앞선다", () => {
    const claimsAt = signalPage.indexOf("getClaims");
    const queryAt = signalPage.indexOf('.from("signal_run")');
    expect(claimsAt).not.toBe(-1);
    expect(queryAt).not.toBe(-1);
    expect(claimsAt).toBeLessThan(queryAt);
  });

  it("경로의 기준일로 실행을 조회한다", () => {
    expect(signalPage).toContain('.eq("bas_dd", basDd)');
  });

  it("잘못된 기준일은 404로 처리하고 미인증은 로그인으로 보낸다", () => {
    expect(signalPage).toContain("normalizeBasDd");
    expect(signalPage).toContain("notFound()");
    expect(signalPage).toContain('redirect("/auth/login")');
  });

  it("데이터 품질 판정 문구를 유지한다", () => {
    expect(signalPage).toContain("데이터 품질");
    expect(signalPage).toContain("신호 항목이 없습니다");
  });

  it("고지 문구 두 개를 유지한다", () => {
    expect(signalPage).toContain("자동매매 또는 매수·매도 추천이 아닌 탐색 결과입니다.");
    expect(signalPage).toContain("분배금·기업행동 조정");
  });

  it("US P1 섹션을 기능 플래그와 독립 쿼리 뒤에 둔다", () => {
    expect(signalPage).toContain("isUsEtfP1Enabled()");
    expect(signalPage).toContain('.eq("market", "US")');
    expect(signalPage).toContain("미국 ETF 등락 · P1 실험");
    expect(signalPage).toContain("국내 P0 신호에는 영향이");
    expect(signalPage).toContain("없습니다.");
  });

  it("전·후 거래일 이동을 신호 실행이 있는 날로 제한한다", () => {
    expect(signalPage).toContain('.lt("bas_dd", basDd)');
    expect(signalPage).toContain('.gt("bas_dd", basDd)');
  });

  it("서비스 역할 클라이언트를 UI 경로에 만들지 않는다", () => {
    expect(signalPage).not.toContain("service-role");
    expect(signalPage).not.toContain("SERVICE_ROLE");
    expect(signalPage).not.toContain("createServiceRoleClient");
  });
});
