import { assertValidKrxRequestDate } from "./krx-date.ts";
import type { KrxRawEtfRow } from "./krx.ts";

const KRX_ETF_DAILY_ENDPOINT =
  "https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd";

interface KrxResponsePayload {
  OutBlock_1?: unknown;
}

interface KrxClientOptions {
  authKey: string;
  fetchFn?: typeof fetch;
}

export class KrxClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KrxClientError";
  }
}

export class KrxClient {
  private readonly authKey: string;
  private readonly fetchFn: typeof fetch;

  constructor({ authKey, fetchFn = fetch }: KrxClientOptions) {
    if (!authKey.trim()) {
      throw new KrxClientError("KRX AUTH_KEY is required");
    }

    this.authKey = authKey.trim();
    this.fetchFn = fetchFn;
  }

  async fetchDailySnapshot(requestedDate: string): Promise<KrxRawEtfRow[]> {
    assertValidKrxRequestDate(requestedDate);

    const url = new URL(KRX_ETF_DAILY_ENDPOINT);
    url.searchParams.set("basDd", requestedDate);

    const response = await this.fetchFn(url, {
      headers: { AUTH_KEY: this.authKey },
      redirect: "error",
    });

    if (!response.ok) {
      throw new KrxClientError(`KRX request failed with HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new KrxClientError("KRX response is not JSON");
    }

    const payload: unknown = await response.json();
    if (!isKrxResponsePayload(payload) || !Array.isArray(payload.OutBlock_1)) {
      throw new KrxClientError("KRX response does not contain OutBlock_1 array");
    }

    return payload.OutBlock_1.map((row) => {
      if (!isRecordOfStrings(row)) {
        throw new KrxClientError("KRX OutBlock_1 contains a non-string row");
      }

      return row;
    });
  }
}

function isKrxResponsePayload(value: unknown): value is KrxResponsePayload {
  return typeof value === "object" && value !== null;
}

function isRecordOfStrings(value: unknown): value is KrxRawEtfRow {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((field) => typeof field === "string")
  );
}
