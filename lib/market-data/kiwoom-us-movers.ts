import { KiwoomClientError } from "./kiwoom.ts";
import type {
  UsEtfMoverInput,
  UsEtfUniverseRecord,
} from "../signals/us-etf-movers.ts";

const KIWOOM_US_RANKING_ENDPOINT = "https://api.kiwoom.com/api/us/rkinfo";
const KIWOOM_US_STOCK_INFO_ENDPOINT = "https://api.kiwoom.com/api/us/stkinfo";
const DEFAULT_MIN_INTERVAL_MS = 1_250;
const DEFAULT_MAX_RETRIES = 3;

type Sleep = (milliseconds: number) => Promise<void>;
type RawRecord = Record<string, unknown>;
type MoverRow = {
  code: string;
  name: string;
  rank: number;
  returnPercent: number;
  endPrice: string;
};
type FiveDayRow = {
  code: string;
  name: string;
  rank: number;
  startPrice: string;
  endPrice: string;
};

interface Options {
  fetchFn?: typeof fetch;
  sleepFn?: Sleep;
  minIntervalMs?: number;
  maxRetries?: number;
}

export interface KiwoomUsEtfMoverResult extends UsEtfMoverInput {
  rawPayload: Record<string, unknown>;
  pageCount: number;
}

export class KiwoomUsEtfMoverClient {
  private readonly fetchFn: typeof fetch;
  private readonly sleepFn: Sleep;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;

  constructor({
    fetchFn = fetch,
    sleepFn = sleep,
    minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  }: Options = {}) {
    if (!Number.isInteger(minIntervalMs) || minIntervalMs < 0) {
      throw new KiwoomClientError(
        "Kiwoom minimum interval must be a non-negative integer",
      );
    }
    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new KiwoomClientError(
        "Kiwoom max retries must be a non-negative integer",
      );
    }
    this.fetchFn = fetchFn;
    this.sleepFn = sleepFn;
    this.minIntervalMs = minIntervalMs;
    this.maxRetries = maxRetries;
  }

  async fetchAll(accessToken: string): Promise<KiwoomUsEtfMoverResult> {
    const token = accessToken.trim();
    if (!token) throw new KiwoomClientError("Kiwoom access token is required");

    const universe = await this.fetchUniverse(token);
    const dailyGainers = await this.fetchMoverPages(
      token,
      "usa20911",
      KIWOOM_US_RANKING_ENDPOINT,
      dailyBody("1"),
      parseDailyRow,
    );
    const dailyLosers = await this.fetchMoverPages(
      token,
      "usa20911",
      KIWOOM_US_RANKING_ENDPOINT,
      dailyBody("4"),
      parseDailyRow,
    );
    const fiveDayGainers = await this.fetchMoverPages(
      token,
      "usa20511",
      KIWOOM_US_RANKING_ENDPOINT,
      fiveDayGainBody(),
      parseFiveDayGainRow,
    );
    const fiveDayLosers = await this.fetchMoverPages(
      token,
      "usa20931",
      KIWOOM_US_STOCK_INFO_ENDPOINT,
      fiveDayLossBody(),
      parseFiveDayLossRow,
    );

    return {
      universe: universe.records,
      dailyGainers: dailyGainers.records,
      dailyLosers: dailyLosers.records,
      fiveDayGainers: fiveDayGainers.records,
      fiveDayLosers: fiveDayLosers.records,
      rawPayload: {
        usa10104: { request: { stex_tp: "%" }, pages: universe.rawPages },
        usa20911_daily_gain: {
          request: dailyBody("1"),
          pages: dailyGainers.rawPages,
        },
        usa20911_daily_loss: {
          request: dailyBody("4"),
          pages: dailyLosers.rawPages,
        },
        usa20511_five_day_gain: {
          request: fiveDayGainBody(),
          pages: fiveDayGainers.rawPages,
        },
        usa20931_five_day_loss: {
          request: fiveDayLossBody(),
          pages: fiveDayLosers.rawPages,
        },
      },
      pageCount:
        universe.pageCount +
        dailyGainers.pageCount +
        dailyLosers.pageCount +
        fiveDayGainers.pageCount +
        fiveDayLosers.pageCount,
    };
  }

  private async fetchUniverse(accessToken: string): Promise<{
    records: UsEtfUniverseRecord[];
    rawPages: RawRecord[][];
    pageCount: number;
  }> {
    const result = await this.fetchPages(
      accessToken,
      "usa10104",
      KIWOOM_US_STOCK_INFO_ENDPOINT,
      { stex_tp: "%" },
      "list",
    );
    return {
      records: result.records.map(parseUniverseRow),
      rawPages: result.pages,
      pageCount: result.pages.length,
    };
  }

  private async fetchMoverPages<T>(
    accessToken: string,
    apiId: string,
    endpoint: string,
    body: Record<string, string>,
    parser: (value: RawRecord, apiId: string, position: number) => T,
  ): Promise<{ records: T[]; rawPages: RawRecord[][]; pageCount: number }> {
    const result = await this.fetchPages(
      accessToken,
      apiId,
      endpoint,
      body,
      "result_list",
    );
    return {
      records: result.records.map((record, index) =>
        parser(record, apiId, index + 1),
      ),
      rawPages: result.pages,
      pageCount: result.pages.length,
    };
  }

  private async fetchPages(
    accessToken: string,
    apiId: string,
    endpoint: string,
    body: Record<string, string>,
    listKey: "list" | "result_list",
  ): Promise<{ records: RawRecord[]; pages: RawRecord[][] }> {
    const records: RawRecord[] = [];
    const pages: RawRecord[][] = [];
    let contYn = "N";
    let nextKey = "";
    do {
      if (pages.length > 0) await this.sleepFn(this.minIntervalMs);
      const page = await this.fetchPageWithRetry(
        accessToken,
        apiId,
        endpoint,
        body,
        listKey,
        contYn,
        nextKey,
      );
      records.push(...page.records);
      pages.push(page.records);
      contYn = page.hasMore ? "Y" : "N";
      nextKey = page.nextKey ?? "";
    } while (contYn === "Y");
    return { records, pages };
  }

  private async fetchPageWithRetry(
    accessToken: string,
    apiId: string,
    endpoint: string,
    body: Record<string, string>,
    listKey: "list" | "result_list",
    contYn: string,
    nextKey: string,
  ): Promise<{
    records: RawRecord[];
    hasMore: boolean;
    nextKey: string | null;
  }> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await this.fetchFn(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "api-id": apiId,
          "cont-yn": contYn,
          "next-key": nextKey,
          "content-type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify(body),
        redirect: "error",
      });
      if (response.status === 429 && attempt < this.maxRetries) {
        await this.sleepFn(
          Math.max(this.minIntervalMs, retryAfterMs(response)),
        );
        continue;
      }
      return parsePage(response, apiId, listKey);
    }
    throw new KiwoomClientError(`Kiwoom ${apiId} request exhausted retries`);
  }
}

function dailyBody(sortTp: "1" | "4"): Record<string, string> {
  return {
    stex_tp: "0",
    etf_cat1: "",
    etf_cat2: "",
    sort_tp: sortTp,
    stk_cnd: "0",
    pric_cnd: "0",
    trde_prica_cnd: "0",
    trde_qty_tp: "",
  };
}
function fiveDayGainBody(): Record<string, string> {
  return {
    stex_tp: "0",
    etf_cat1: "",
    etf_cat2: "",
    stk_cnd: "0",
    tm: "5",
    trde_qty_tp: "0",
    pric_cnd: "0",
    trde_prica_cnd: "0",
  };
}
function fiveDayLossBody(): Record<string, string> {
  return {
    stex_tp: "0",
    etf_cat1: "",
    etf_cat2: "",
    stk_cnd: "1",
    flu_tp: "2",
    tm_tp: "3",
    tm: "2",
    pric_cnd: "0",
    trde_qty_tp: "0",
    trde_prica_cnd: "0",
  };
}

async function parsePage(
  response: Response,
  apiId: string,
  listKey: "list" | "result_list",
): Promise<{ records: RawRecord[]; hasMore: boolean; nextKey: string | null }> {
  if (!response.ok)
    throw new KiwoomClientError(
      `Kiwoom ${apiId} request failed with HTTP ${response.status}`,
    );
  if (
    !(response.headers.get("content-type") ?? "")
      .toLowerCase()
      .includes("application/json")
  )
    throw new KiwoomClientError(`Kiwoom ${apiId} response is not JSON`);
  const payload: unknown = await response.json();
  if (
    !isRecord(payload) ||
    (payload.return_code !== 0 && payload.return_code !== "0")
  )
    throw new KiwoomClientError(
      `Kiwoom ${apiId} returned an unsuccessful result`,
    );
  if (!Array.isArray(payload[listKey]) || !payload[listKey].every(isRecord))
    throw new KiwoomClientError(
      `Kiwoom ${apiId} response is missing ${listKey} array`,
    );
  const contYn = response.headers.get("cont-yn")?.trim().toUpperCase() ?? "N";
  if (contYn !== "Y" && contYn !== "N")
    throw new KiwoomClientError(
      `Kiwoom ${apiId} response has invalid cont-yn header`,
    );
  const nextKey = response.headers.get("next-key")?.trim() || null;
  if (contYn === "Y" && !nextKey)
    throw new KiwoomClientError(
      `Kiwoom ${apiId} continuation response is missing next-key`,
    );
  return { records: payload[listKey], hasMore: contYn === "Y", nextKey };
}

function parseUniverseRow(value: RawRecord): UsEtfUniverseRecord {
  const code = required(value.stk_cd, "usa10104", "stk_cd");
  const etn = required(value.etn, "usa10104", "etn").toUpperCase();
  if (etn !== "Y" && etn !== "N")
    throw new KiwoomClientError("Kiwoom usa10104 record has invalid etn");
  return { code, etn: etn === "Y" };
}
function parseDailyRow(value: RawRecord, apiId: string): MoverRow {
  return {
    ...parseCommonMover(value, apiId),
    returnPercent: numberField(value.flu_rt, apiId, "flu_rt"),
    endPrice: required(value.cur_prc, apiId, "cur_prc"),
  };
}
function parseFiveDayGainRow(value: RawRecord, apiId: string): FiveDayRow {
  return {
    ...parseCommonMover(value, apiId),
    startPrice: required(value.stdt_base_pric, apiId, "stdt_base_pric"),
    endPrice: required(value.endt_base_pric, apiId, "endt_base_pric"),
  };
}
function parseFiveDayLossRow(
  value: RawRecord,
  apiId: string,
  position: number,
): FiveDayRow {
  // usa20931 응답에는 rank가 없고 5일 하락률 순으로 정렬되어 오므로 응답 순서를 순위로 쓴다.
  return {
    ...parseCommonMover(value, apiId, String(position)),
    startPrice: required(value.base_pric, apiId, "base_pric"),
    endPrice: required(value.cur_prc, apiId, "cur_prc"),
  };
}
function parseCommonMover(
  value: RawRecord,
  apiId: string,
  rank: unknown = value.rank,
) {
  try {
    return {
      code: required(value.stk_cd, apiId, "stk_cd"),
      name: required(value.stk_nm, apiId, "stk_nm"),
      rank: integerField(rank, apiId, "rank"),
    };
  } catch {
    throw new KiwoomClientError(
      `Kiwoom ${apiId} result_list contains a malformed record`,
    );
  }
}
function required(value: unknown, apiId: string, field: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new KiwoomClientError(`Kiwoom ${apiId} record is missing ${field}`);
  return value.trim();
}
function integerField(value: unknown, apiId: string, field: string): number {
  const parsed = Number(required(value, apiId, field));
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new KiwoomClientError(`Kiwoom ${apiId} record has invalid ${field}`);
  return parsed;
}
function numberField(value: unknown, apiId: string, field: string): number {
  const parsed = Number(required(value, apiId, field));
  if (!Number.isFinite(parsed))
    throw new KiwoomClientError(`Kiwoom ${apiId} record has invalid ${field}`);
  return parsed;
}
function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get("retry-after")?.trim());
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.ceil(seconds * 1_000)
    : DEFAULT_MIN_INTERVAL_MS;
}
function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null;
}
function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
