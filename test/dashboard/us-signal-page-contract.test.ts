import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const page = readFileSync("app/signals/us/[obsDate]/page.tsx", "utf8");
const latest = readFileSync("app/signals/us/latest/page.tsx", "utf8");

describe("US 관측일 신호 라우트 계약", () => {
  it("US P1 전략의 COMPLETED 실행만 한국 관측일 구간으로 조회한다", () => {
    expect(page).toContain('.eq("market", "US")');
    expect(page).toContain('.eq("strategy_version", US_ETF_STRATEGY_VERSION)');
    expect(page).toContain('.eq("status", "COMPLETED")');
    expect(page).toContain('.gte("observed_at", bounds.from)');
    expect(page).toContain('.lt("observed_at", bounds.to)');
  });

  it("같은 관측일 재실행은 보고·latest와 같은 기준(observed_at, id 내림차순)으로 고른다", () => {
    expect(page).toContain('.order("observed_at", { ascending: false })');
    expect(page).toContain('.order("id", { ascending: false })');
    expect(page).not.toContain('"completed_at"');
  });

  it("고지 문구는 실행 유무와 상관없이 헤더에 항상 있다", () => {
    const headerStart = page.indexOf("<header");
    const headerEnd = page.indexOf("</header>");
    expect(page.slice(headerStart, headerEnd)).toContain("{US_ETF_P1_DISCLOSURE}");
  });

  it("한 유형의 조회 실패는 그 유형만 오류로 보이고 이동 조회 실패는 본문을 가리지 않는다", () => {
    expect(page).toContain("errors={errorTypes}");
    expect(page).toContain("{runResult.error ? (");
    expect(page).not.toContain("previousResult.error ||");
  });

  it("쓰기 경로 모듈이 아닌 순수 상수 모듈에서 식별 값을 가져온다", () => {
    expect(page).toContain("@/lib/signals/us-etf-constants");
    expect(page).not.toContain("us-etf-signal-repository");
    expect(latest).not.toContain("us-etf-signal-repository");
  });

  it("인증 확인이 첫 DB 조회보다 앞선다", () => {
    for (const source of [page, latest]) {
      const claimsAt = source.indexOf("getClaims");
      const queryAt = source.indexOf('.from("signal_run")');
      expect(claimsAt).not.toBe(-1);
      expect(queryAt).not.toBe(-1);
      expect(claimsAt).toBeLessThan(queryAt);
      expect(source).toContain('redirect("/auth/login")');
    }
  });

  it("잘못된 관측일은 404로 처리한다", () => {
    expect(page).toContain("normalizeObsDate");
    expect(page).toContain("notFound()");
  });

  it("유형별 상위 10건과 전체 건수만 조회하고 전체 행을 가져오지 않는다", () => {
    expect(page).toMatch(/count:\s*"exact"/);
    expect(page).toContain("const ROWS_PER_TYPE = 10;");
    expect(page).toContain(".limit(ROWS_PER_TYPE)");
    expect(page).toContain('.eq("signal_type", signalType)');
  });

  it("고지 문구와 P1 실험·한국 시간 관측일 표기를 유지한다", () => {
    expect(page).toContain("US_ETF_P1_DISCLOSURE");
    expect(page).toContain("미국 ETF 등락 · P1 실험");
    expect(page).toContain("formatObsDateLabel");
    expect(page).toContain("자동매매 또는 매수·매도 추천이 아닌 탐색 결과입니다.");
    expect(page).toContain("해당 관측일의 US 실행이 없습니다");
  });

  it("전·후 관측일 이동을 COMPLETED 실행이 있는 날로 제한한다", () => {
    expect(page).toContain('.lt("observed_at", bounds.from)');
    expect(page).toContain('.gte("observed_at", bounds.to)');
  });

  it("서비스 역할 클라이언트를 UI 경로에 만들지 않는다", () => {
    for (const source of [page, latest]) {
      expect(source).not.toContain("service-role");
      expect(source).not.toContain("SERVICE_ROLE");
      expect(source).not.toContain("createServiceRoleClient");
    }
  });
});

describe("US latest 리다이렉트 계약", () => {
  it("최신 COMPLETED 실행의 한국 관측일로 이동만 수행한다", () => {
    expect(latest).toContain('.eq("strategy_version", US_ETF_STRATEGY_VERSION)');
    expect(latest).toContain('.eq("status", "COMPLETED")');
    expect(latest).toContain("/signals/us/");
    expect(latest).toContain("redirect(");
    expect(latest).not.toContain("signal_daily");
  });
});
