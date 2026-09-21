const KIWOOM_API_ORIGIN = "https://api.kiwoom.com";
const KIWOOM_TOKEN_ENDPOINT = `${KIWOOM_API_ORIGIN}/oauth2/token`;
const KIWOOM_STOCK_INFO_ENDPOINT = `${KIWOOM_API_ORIGIN}/api/dostk/stkinfo`;

interface KiwoomClientOptions {
  appKey: string;
  secretKey: string;
  fetchFn?: typeof fetch;
}

interface KiwoomResponsePayload {
  return_code?: unknown;
  token?: unknown;
  token_type?: unknown;
  expires_dt?: unknown;
  list?: unknown;
}

export interface KiwoomAccessToken {
  token: string;
  tokenType: string;
  expiresAt: string;
}

export interface KiwoomEtfMasterRecord {
  code: string;
  name: string;
  regDay: string;
  marketCode: string;
  marketName: string;
  state: string;
}

export interface KiwoomEtfMasterPage {
  records: KiwoomEtfMasterRecord[];
  hasMore: boolean;
  nextKey: string | null;
}

export class KiwoomClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KiwoomClientError";
  }
}

export class KiwoomClient {
  private readonly appKey: string;
  private readonly secretKey: string;
  private readonly fetchFn: typeof fetch;

  constructor({ appKey, secretKey, fetchFn = fetch }: KiwoomClientOptions) {
    this.appKey = requireNonEmpty("Kiwoom app key", appKey);
    this.secretKey = requireNonEmpty("Kiwoom secret key", secretKey);
    this.fetchFn = fetchFn;
  }

  async issueAccessToken(): Promise<KiwoomAccessToken> {
    const response = await this.fetchFn(KIWOOM_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json;charset=UTF-8" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: this.appKey,
        secretkey: this.secretKey,
      }),
      redirect: "error",
    });
    const payload = await readSuccessPayload(response, "token");

    const token = getRequiredString(payload.token, "Kiwoom token response is missing token");
    const tokenType = getRequiredString(
      payload.token_type,
      "Kiwoom token response is missing token_type",
    );
    const expiresAt = getRequiredString(
      payload.expires_dt,
      "Kiwoom token response is missing expires_dt",
    );

    return { token, tokenType, expiresAt };
  }

  async fetchEtfMaster(accessToken: string): Promise<KiwoomEtfMasterPage> {
    const token = requireNonEmpty("Kiwoom access token", accessToken);
    const response = await this.fetchFn(KIWOOM_STOCK_INFO_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "api-id": "ka10099",
        "cont-yn": "N",
        "next-key": "",
        "content-type": "application/json;charset=UTF-8",
      },
      body: JSON.stringify({ mrkt_tp: "8" }),
      redirect: "error",
    });
    const payload = await readSuccessPayload(response, "ka10099");

    if (!Array.isArray(payload.list)) {
      throw new KiwoomClientError("Kiwoom ka10099 response is missing list array");
    }

    const records = payload.list.map(parseEtfMasterRecord);
    assertUniqueCodes(records);

    const continuation = response.headers.get("cont-yn")?.trim().toUpperCase() ?? "N";
    if (continuation !== "Y" && continuation !== "N") {
      throw new KiwoomClientError("Kiwoom response has invalid cont-yn header");
    }

    const nextKey = response.headers.get("next-key")?.trim() || null;
    if (continuation === "Y" && !nextKey) {
      throw new KiwoomClientError("Kiwoom continuation response is missing next-key");
    }

    return { records, hasMore: continuation === "Y", nextKey };
  }
}

export function getNewListingCandidates<T extends { code: string }>(
  previousCodes: ReadonlySet<string> | null,
  currentRecords: readonly T[],
): T[] {
  if (previousCodes === null) {
    return [];
  }

  return currentRecords.filter(({ code }) => !previousCodes.has(code));
}

async function readSuccessPayload(
  response: Response,
  operation: string,
): Promise<KiwoomResponsePayload> {
  if (!response.ok) {
    throw new KiwoomClientError(`Kiwoom ${operation} request failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new KiwoomClientError(`Kiwoom ${operation} response is not JSON`);
  }

  const payload: unknown = await response.json();
  if (!isResponsePayload(payload)) {
    throw new KiwoomClientError(`Kiwoom ${operation} response is malformed`);
  }

  if (payload.return_code !== 0 && payload.return_code !== "0") {
    throw new KiwoomClientError(`Kiwoom ${operation} returned an unsuccessful result`);
  }

  return payload;
}

function parseEtfMasterRecord(value: unknown): KiwoomEtfMasterRecord {
  if (!isRecord(value)) {
    throw new KiwoomClientError("Kiwoom ka10099 list contains a malformed record");
  }

  const code = getRequiredString(value.code, "Kiwoom ka10099 record is missing code");
  const name = getRequiredString(value.name, "Kiwoom ka10099 record is missing name");
  const regDay = getRequiredString(value.regDay, "Kiwoom ka10099 record is missing regDay");
  assertValidRegDay(regDay);

  return {
    code,
    name,
    regDay,
    marketCode: getOptionalString(value.marketCode),
    marketName: getOptionalString(value.marketName),
    state: getOptionalString(value.state),
  };
}

function assertValidRegDay(value: string): void {
  if (!/^\d{8}$/.test(value)) {
    throw new KiwoomClientError("Invalid Kiwoom regDay");
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new KiwoomClientError("Invalid Kiwoom regDay");
  }
}

function assertUniqueCodes(records: readonly KiwoomEtfMasterRecord[]): void {
  const codes = new Set<string>();
  for (const { code } of records) {
    if (codes.has(code)) {
      throw new KiwoomClientError("Kiwoom ka10099 response contains duplicate code");
    }
    codes.add(code);
  }
}

function requireNonEmpty(label: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new KiwoomClientError(`${label} is required`);
  }
  return trimmed;
}

function getRequiredString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new KiwoomClientError(message);
  }
  return value.trim();
}

function getOptionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isResponsePayload(value: unknown): value is KiwoomResponsePayload {
  return isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
