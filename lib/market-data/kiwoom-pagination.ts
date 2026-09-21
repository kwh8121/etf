import { KiwoomClientError } from "@/lib/market-data/kiwoom";

const KIWOOM_ETF_QUOTES_ENDPOINT = "https://api.kiwoom.com/api/dostk/etf";
const DEFAULT_MIN_INTERVAL_MS = 1_250;
const DEFAULT_MAX_RETRIES = 3;

type Sleep = (milliseconds: number) => Promise<void>;

interface KiwoomPaginationClientOptions {
  fetchFn?: typeof fetch;
  sleepFn?: Sleep;
  minIntervalMs?: number;
  maxRetries?: number;
}

export interface KiwoomEtfQuotesResult {
  pages: Record<string, unknown>[][];
  pageCount: number;
}

export class KiwoomPaginationClient {
  private readonly fetchFn: typeof fetch;
  private readonly sleepFn: Sleep;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;

  constructor({
    fetchFn = fetch,
    sleepFn = sleep,
    minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  }: KiwoomPaginationClientOptions = {}) {
    if (!Number.isInteger(minIntervalMs) || minIntervalMs < 0) {
      throw new KiwoomClientError("Kiwoom minimum interval must be a non-negative integer");
    }
    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new KiwoomClientError("Kiwoom max retries must be a non-negative integer");
    }

    this.fetchFn = fetchFn;
    this.sleepFn = sleepFn;
    this.minIntervalMs = minIntervalMs;
    this.maxRetries = maxRetries;
  }

  async fetchAllEtfQuotes(accessToken: string): Promise<KiwoomEtfQuotesResult> {
    const token = accessToken.trim();
    if (!token) {
      throw new KiwoomClientError("Kiwoom access token is required");
    }

    const pages: Record<string, unknown>[][] = [];
    let continuation = "N";
    let nextKey = "";
    let shouldThrottle = false;

    do {
      if (shouldThrottle) {
        await this.sleepFn(this.minIntervalMs);
      }

      const page = await this.fetchPageWithRetry(token, continuation, nextKey);
      pages.push(page.records);
      continuation = page.hasMore ? "Y" : "N";
      nextKey = page.nextKey ?? "";
      shouldThrottle = continuation === "Y";
    } while (continuation === "Y");

    return { pages, pageCount: pages.length };
  }

  private async fetchPageWithRetry(
    accessToken: string,
    continuation: "N" | "Y" | string,
    nextKey: string,
  ): Promise<{ records: Record<string, unknown>[]; hasMore: boolean; nextKey: string | null }> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await this.fetchFn(KIWOOM_ETF_QUOTES_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "api-id": "ka40004",
          "cont-yn": continuation,
          "next-key": nextKey,
          "content-type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify({
          txon_type: "0",
          navpre: "0",
          mngmcomp: "0000",
          txon_yn: "0",
          trace_idex: "0",
          stex_tp: "1",
        }),
        redirect: "error",
      });

      if (response.status === 429 && attempt < this.maxRetries) {
        await this.sleepFn(Math.max(this.minIntervalMs, getRetryAfterMs(response)));
        continue;
      }

      if (!response.ok) {
        throw new KiwoomClientError(`Kiwoom ka40004 request failed with HTTP ${response.status}`);
      }

      return parseQuotesPage(response);
    }

    throw new KiwoomClientError("Kiwoom ka40004 request exhausted retries");
  }
}

async function parseQuotesPage(
  response: Response,
): Promise<{ records: Record<string, unknown>[]; hasMore: boolean; nextKey: string | null }> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new KiwoomClientError("Kiwoom ka40004 response is not JSON");
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || (payload.return_code !== 0 && payload.return_code !== "0")) {
    throw new KiwoomClientError("Kiwoom ka40004 returned an unsuccessful result");
  }
  if (!Array.isArray(payload.etfall_mrpr) || !payload.etfall_mrpr.every(isRecord)) {
    throw new KiwoomClientError("Kiwoom ka40004 response is missing etfall_mrpr array");
  }

  const continuation = response.headers.get("cont-yn")?.trim().toUpperCase() ?? "N";
  if (continuation !== "Y" && continuation !== "N") {
    throw new KiwoomClientError("Kiwoom ka40004 response has invalid cont-yn header");
  }
  const nextKey = response.headers.get("next-key")?.trim() || null;
  if (continuation === "Y" && !nextKey) {
    throw new KiwoomClientError("Kiwoom ka40004 continuation response is missing next-key");
  }

  return {
    records: payload.etfall_mrpr,
    hasMore: continuation === "Y",
    nextKey,
  };
}

function getRetryAfterMs(response: Response): number {
  const retryAfter = response.headers.get("retry-after")?.trim();
  if (!retryAfter) {
    return DEFAULT_MIN_INTERVAL_MS;
  }

  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.ceil(seconds * 1_000)
    : DEFAULT_MIN_INTERVAL_MS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
