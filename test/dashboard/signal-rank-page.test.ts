import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: navigation.redirect,
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client }));

import KrPage from "../../app/signals/kr/[basDd]/page";
import ProtectedPage from "../../app/protected/page";
import UsPage from "../../app/signals/us/[obsDate]/page";

type DbRow = Record<string, string | number | null>;
let runs: DbRow[];
let signals: DbRow[];
let failedRunId: string | null;

// 외부 DB 경계만 대체하고 실제 페이지·비교·React 렌더링을 검증한다.
function query(table: string) {
  const filters: Array<(row: DbRow) => boolean> = [];
  const orders: Array<{ field: string; ascending: boolean }> = [];
  let columns: string[] = [];
  let limit = Infinity;
  let runId: string | null = null;
  const result = () => {
    if (table === "signal_daily" && runId === failedRunId) {
      return { data: null, count: null, error: { message: "read failed" } };
    }
    let rows = (table === "signal_run" ? runs : signals).filter((row) =>
      filters.every((filter) => filter(row)),
    );
    const count = rows.length;
    rows = [...rows].sort((left, right) => {
      for (const { field, ascending } of orders) {
        const a = left[field] ?? "";
        const b = right[field] ?? "";
        if (a !== b) return (a < b ? -1 : 1) * (ascending ? 1 : -1);
      }
      return 0;
    });
    return {
      data: rows
        .slice(0, limit)
        .map((row) =>
          Object.fromEntries(columns.map((column) => [column, row[column]])),
        ),
      count,
      error: null,
    };
  };
  const builder = {
    select(fields: string) {
      columns = fields.split(",");
      return builder;
    },
    eq(field: string, value: string) {
      if (field === "run_id") runId = value;
      filters.push((row) => row[field] === value);
      return builder;
    },
    not(field: string, operator: string, value: string | null) {
      if (operator === "is" && value === null) {
        filters.push((row) => row[field] !== null);
      }
      return builder;
    },
    lt(field: string, value: string) {
      filters.push((row) => String(row[field]) < value);
      return builder;
    },
    gt(field: string, value: string) {
      filters.push((row) => String(row[field]) > value);
      return builder;
    },
    gte(field: string, value: string) {
      filters.push((row) => String(row[field]) >= value);
      return builder;
    },
    order(field: string, options?: { ascending?: boolean }) {
      orders.push({ field, ascending: options?.ascending ?? true });
      return builder;
    },
    limit(value: number) {
      limit = value;
      return builder;
    },
    async maybeSingle() {
      const response = result();
      return { ...response, data: response.data?.[0] ?? null };
    },
    then(resolve: (value: ReturnType<typeof result>) => unknown) {
      return Promise.resolve(result()).then(resolve);
    },
  };
  return builder;
}

const client = {
  auth: {
    getClaims: async () => ({
      data: { claims: { sub: "viewer" } },
      error: null,
    }),
  },
  from: query,
};

function run(
  id: string,
  market: string,
  date: string,
  status = "COMPLETED",
): DbRow {
  return {
    id,
    market,
    status,
    strategy_version:
      market === "KR" ? "m3-price-movers-v1" : "m5-us-etf-movers-p1-v1",
    bas_dd: date.slice(0, 10),
    observed_at: date,
    completed_at: date,
  };
}

function signal(
  runId: string,
  market: string,
  code: string,
  name: string,
  rank = 1,
): DbRow {
  return {
    run_id: runId,
    market,
    code,
    name,
    rank,
    signal_type: "daily_price_gain",
    screen: "raw",
    value: 1,
    value_unit: "percent",
  };
}

beforeEach(() => {
  runs = [];
  signals = [];
  failedRunId = null;
  vi.stubEnv("ENABLE_US_ETF_P1", "false");
  navigation.redirect.mockClear();
});

describe("신호 페이지의 이전 완료 run 비교", () => {
  it("KR 기준일 직접 조회는 같은 기준일의 정정 대기 실행을 건너뛰고 완료 실행만 보여준다", async () => {
    runs = [
      run("completed", "KR", "2026-10-15T01:00:00Z"),
      run("correction", "KR", "2026-10-15T02:00:00Z", "CORRECTION_PENDING"),
    ];
    signals = [
      signal("completed", "KR", "DONE", "완료 확정 종목"),
      signal("correction", "KR", "WAIT", "정정 대기 종목"),
    ];
    const html = renderToStaticMarkup(
      await KrPage({ params: Promise.resolve({ basDd: "2026-10-15" }) }),
    );
    expect(html).toContain("완료 확정 종목");
    expect(html).not.toContain("정정 대기 종목");
    expect(html).toContain("상태 COMPLETED");
  });

  it("KR은 직전 완료 거래일만 비교하고 그보다 최근의 PENDING 실행은 건너뛴다", async () => {
    runs = [
      run("current", "KR", "2026-10-15"),
      run("pending", "KR", "2026-10-14", "PENDING"),
      run("previous", "KR", "2026-10-13"),
    ];
    signals = [
      signal("current", "KR", "NEW", "신규 진입"),
      signal("previous", "KR", "OUT", "직전 이탈", 7),
      signal("pending", "KR", "NEW", "미완료 종목"),
    ];
    const html = renderToStaticMarkup(
      await KrPage({ params: Promise.resolve({ basDd: "2026-10-15" }) }),
    );
    expect(html).toContain("랭크인");
    expect(html).toMatch(/랭크아웃[\s\S]*7[\s\S]*직전 이탈/);
    expect(html).not.toContain("미완료 종목");
  });

  it("KR 다음 거래일 이동은 완료 실행이 있는 날로만 이어진다", async () => {
    runs = [
      run("current", "KR", "2026-10-15"),
      run("pending-next", "KR", "2026-10-16", "CORRECTION_PENDING"),
      run("completed-next", "KR", "2026-10-17"),
    ];
    signals = [signal("current", "KR", "NOW", "현재 신호")];
    const html = renderToStaticMarkup(
      await KrPage({ params: Promise.resolve({ basDd: "2026-10-15" }) }),
    );
    expect(html).toContain("/signals/kr/2026-10-17");
    expect(html).not.toContain("/signals/kr/2026-10-16");
  });

  it("US는 같은 한국 날짜의 직전 run을 비교하고 표시 상위 10건 밖의 행은 제외한다", async () => {
    runs = [
      run("current", "US", "2026-10-15T02:00:00Z"),
      run("previous", "US", "2026-10-15T01:00:00Z"),
      run("yesterday", "US", "2026-10-14T01:00:00Z"),
    ];
    signals = [
      signal("current", "US", "NEW", "신규 진입"),
      signal("yesterday", "US", "NEW", "전날 종목"),
      ...Array.from({ length: 11 }, (_, i) =>
        signal("previous", "US", `OUT${i}`, `직전 이탈 ${i + 1}`, i + 1),
      ),
    ];
    const html = renderToStaticMarkup(
      await UsPage({ params: Promise.resolve({ obsDate: "2026-10-15" }) }),
    );
    expect(html).toContain("랭크인");
    expect(html).toContain("직전 이탈 10");
    expect(html).not.toContain("직전 이탈 11");
    expect(html).not.toContain("전날 종목");
  });

  it.each(["KR", "US"])(
    "%s 이전 조회 실패는 현재 신호와 안내를 보이고 오정보를 표시하지 않는다",
    async (market) => {
      runs = [
        run("current", market, "2026-10-15T02:00:00Z"),
        run("previous", market, "2026-10-14T01:00:00Z"),
      ];
      signals = [signal("current", market, "NEW", "현재 신호")];
      failedRunId = "previous";
      const page =
        market === "KR"
          ? await KrPage({ params: Promise.resolve({ basDd: "2026-10-15" }) })
          : await UsPage({
              params: Promise.resolve({ obsDate: "2026-10-15" }),
            });
      const html = renderToStaticMarkup(page);
      expect(html).toContain("현재 신호");
      expect(html).toContain("이전 순위를 불러오지 못해");
      expect(html).not.toContain("랭크인");
      expect(html).not.toContain("랭크아웃");
    },
  );
});

describe("보호 경로의 최신 KR 실행 선택", () => {
  it("COMPLETED가 아닌 최신 기준일을 건너뛰고 최신 완료 기준일로 보낸다", async () => {
    runs = [
      run("completed", "KR", "2026-10-14"),
      run("correction", "KR", "2026-10-15", "CORRECTION_PENDING"),
    ];
    await expect(ProtectedPage()).rejects.toThrow(
      "NEXT_REDIRECT:/signals/kr/2026-10-14",
    );
    expect(navigation.redirect).toHaveBeenCalledWith("/signals/kr/2026-10-14");
  });
});
