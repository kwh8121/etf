import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getRequiredServerSecret } from "../lib/config/server-env.ts";
import { KiwoomClient, KiwoomClientError } from "../lib/market-data/kiwoom.ts";

const ENDPOINT = "https://api.kiwoom.com/api/us/stkinfo";
const API_ID = "usa20931";
const DEFAULT_PAGES_PER_CONDITION = 20;
const MIN_INTERVAL_MS = 1_250;

type StockCondition = "0" | "1";
type RawRecord = Record<string, unknown>;

export interface CompareUsLossScopeArgs {
  outputPath: string;
  pagesPerCondition: number;
}

interface ParsedRow {
  code: string;
  name: string;
  rank: number;
  startPrice: string;
  endPrice: string;
}

interface ConditionResult {
  stkCnd: StockCondition;
  requestCount: number;
  rowCount: number;
  uniqueCodeCount: number;
  duplicateCodes: string[];
  observedCodes: string[];
  complete: boolean;
  stoppedByPageCap: boolean;
  durationMs: number;
  firstRequestedAt: string | null;
  lastReceivedAt: string | null;
  topRanks: ParsedRow[];
}

interface PageState {
  stkCnd: StockCondition;
  contYn: "N" | "Y";
  nextKey: string;
  complete: boolean;
  pageCount: number;
  rows: ParsedRow[];
  seenCodes: Set<string>;
  seenNextKeys: Set<string>;
  requestedAt: string | null;
  receivedAt: string | null;
}

export function parseCompareUsLossScopeArgs(
  argv: readonly string[],
): CompareUsLossScopeArgs {
  let outputPath: string | null = null;
  let pagesPerCondition = DEFAULT_PAGES_PER_CONDITION;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") {
      outputPath = requireValue(argv, index, "--output");
      index += 1;
      continue;
    }
    if (arg === "--pages-per-condition") {
      const raw = requireValue(argv, index, "--pages-per-condition");
      pagesPerCondition = Number(raw);
      index += 1;
      continue;
    }
    throw new Error(`Unknown compare:us-loss-scope argument: ${arg}`);
  }
  if (!outputPath) throw new Error("--output is required");
  if (
    !Number.isInteger(pagesPerCondition) ||
    pagesPerCondition < 1 ||
    pagesPerCondition > 20
  ) {
    throw new Error("--pages-per-condition must be an integer from 1 to 20");
  }
  return { outputPath, pagesPerCondition };
}

export function fiveDayLossBody(
  stkCnd: StockCondition,
): Record<string, string> {
  return {
    stex_tp: "0",
    etf_cat1: "",
    etf_cat2: "",
    stk_cnd: stkCnd,
    flu_tp: "2",
    tm_tp: "3",
    tm: "2",
    pric_cnd: "0",
    trde_qty_tp: "0",
    trde_prica_cnd: "0",
  };
}

export async function compareUsLossScope(input: {
  accessToken: string;
  fetchFn?: typeof fetch;
  sleepFn?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
  pagesPerCondition: number;
}) {
  const fetchFn = input.fetchFn ?? fetch;
  const sleepFn = input.sleepFn ?? sleep;
  const now = input.now ?? (() => new Date());
  const states: PageState[] = [emptyState("0"), emptyState("1")];
  const startedAt = now();
  let requestCount = 0;
  let lastRequestAt: number | null = null;

  while (
    states.some(
      (state) => !state.complete && state.pageCount < input.pagesPerCondition,
    )
  ) {
    for (const state of states) {
      if (state.complete || state.pageCount >= input.pagesPerCondition)
        continue;
      const currentTime = Date.now();
      const elapsed =
        lastRequestAt === null ? MIN_INTERVAL_MS : currentTime - lastRequestAt;
      if (elapsed < MIN_INTERVAL_MS) {
        await sleepFn(MIN_INTERVAL_MS - elapsed);
      }
      state.requestedAt ??= now().toISOString();
      const response = await fetchFn(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          "api-id": API_ID,
          "cont-yn": state.contYn,
          "next-key": state.nextKey,
          "content-type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify(fiveDayLossBody(state.stkCnd)),
        redirect: "error",
      });
      lastRequestAt = Date.now();
      requestCount += 1;
      const page = await parseUsLossPage(
        response,
        state.stkCnd,
        state.rows.length,
      );
      appendRowsOrThrow(state, page.rows);
      recordContinuationOrThrow(state, page);
      state.pageCount += 1;
      state.receivedAt = now().toISOString();
      state.contYn = page.hasMore ? "Y" : "N";
      state.nextKey = page.nextKey ?? "";
      state.complete = !page.hasMore;
      if (requestCount >= 40) break;
    }
    if (requestCount >= 40) break;
  }

  const conditionResults = states.map((state) =>
    summarizeCondition(state, startedAt, now(), input.pagesPerCondition),
  );
  return {
    ok: conditionResults.every((result) => result.duplicateCodes.length === 0),
    apiId: API_ID,
    endpoint: "us/stkinfo",
    requestBodyComparedFields: {
      stk_cnd: ["0", "1"],
      tm: "2",
      tm_tp: "3",
      flu_tp: "2",
    },
    requestCount,
    requestCap: 40,
    pagesPerConditionCap: input.pagesPerCondition,
    conditions: conditionResults,
    comparison: compareConditions(conditionResults),
    caveats: [
      "This compares the usa20931 ranking endpoint only.",
      "Endpoint codes alone do not prove full ETF universe coverage.",
      "No operational DB writes or Telegram sends were performed.",
    ],
  };
}

export async function runCompareUsLossScope(args: CompareUsLossScopeArgs) {
  const tokenClient = new KiwoomClient({
    appKey: getRequiredServerSecret("KIWOOM_APP_KEY"),
    secretKey: getRequiredServerSecret("KIWOOM_SECRET_KEY"),
  });
  const accessToken = await tokenClient.issueAccessToken();
  const result = await compareUsLossScope({
    accessToken: accessToken.token,
    pagesPerCondition: args.pagesPerCondition,
  });
  await writePrivateJson(args.outputPath, result);
  return {
    ok: result.ok,
    outputPath: resolve(args.outputPath),
    requestCount: result.requestCount,
    complete: result.conditions.every((condition) => condition.complete),
    stoppedByPageCap: result.conditions.some(
      (condition) => condition.stoppedByPageCap,
    ),
    topRankDifferenceCount: result.comparison.topRankDifferenceCount,
    observedCodeDifferenceCount: result.comparison.observedCodeDifferenceCount,
  };
}

async function parseUsLossPage(
  response: Response,
  stkCnd: StockCondition,
  rowOffset: number,
): Promise<{ rows: ParsedRow[]; hasMore: boolean; nextKey: string | null }> {
  if (!response.ok) {
    throw new KiwoomClientError(
      `${API_ID} stk_cnd=${stkCnd} failed with HTTP ${response.status}`,
    );
  }
  if (
    !(response.headers.get("content-type") ?? "")
      .toLowerCase()
      .includes("application/json")
  ) {
    throw new KiwoomClientError(
      `${API_ID} stk_cnd=${stkCnd} response is not JSON`,
    );
  }
  const payload: unknown = await response.json();
  if (
    !isRecord(payload) ||
    (payload.return_code !== 0 && payload.return_code !== "0") ||
    !Array.isArray(payload.result_list) ||
    !payload.result_list.every(isRecord)
  ) {
    throw new KiwoomClientError(
      `${API_ID} stk_cnd=${stkCnd} response is malformed`,
    );
  }
  const contYn = response.headers.get("cont-yn")?.trim().toUpperCase() ?? "N";
  if (contYn !== "Y" && contYn !== "N") {
    throw new KiwoomClientError(
      `${API_ID} stk_cnd=${stkCnd} response has invalid cont-yn`,
    );
  }
  const nextKey = response.headers.get("next-key")?.trim() || null;
  if (contYn === "Y" && !nextKey) {
    throw new KiwoomClientError(
      `${API_ID} stk_cnd=${stkCnd} continuation is missing next-key`,
    );
  }
  return {
    rows: payload.result_list.map((record, index) =>
      parseRow(record, rowOffset + index + 1),
    ),
    hasMore: contYn === "Y",
    nextKey,
  };
}

function parseRow(record: RawRecord, rank: number): ParsedRow {
  return {
    code: required(record.stk_cd, "stk_cd"),
    name: required(record.stk_nm, "stk_nm"),
    rank,
    startPrice: requiredNumberString(record.base_pric, "base_pric"),
    endPrice: requiredNumberString(record.cur_prc, "cur_prc"),
  };
}

function appendRowsOrThrow(state: PageState, rows: readonly ParsedRow[]): void {
  for (const row of rows) {
    if (state.seenCodes.has(row.code)) {
      throw new KiwoomClientError(
        `${API_ID} stk_cnd=${state.stkCnd} duplicate code ${row.code}`,
      );
    }
    state.seenCodes.add(row.code);
    state.rows.push(row);
  }
}

function recordContinuationOrThrow(
  state: PageState,
  page: { hasMore: boolean; nextKey: string | null },
): void {
  if (!page.hasMore) return;
  const nextKey = page.nextKey;
  if (!nextKey) {
    throw new KiwoomClientError(
      `${API_ID} stk_cnd=${state.stkCnd} continuation is missing next-key`,
    );
  }
  if (state.seenNextKeys.has(nextKey)) {
    throw new KiwoomClientError(
      `${API_ID} stk_cnd=${state.stkCnd} reused continuation next-key`,
    );
  }
  state.seenNextKeys.add(nextKey);
}

function summarizeCondition(
  state: PageState,
  startedAt: Date,
  finishedAt: Date,
  pagesPerCondition: number,
): ConditionResult {
  const counts = new Map<string, number>();
  for (const row of state.rows) {
    counts.set(row.code, (counts.get(row.code) ?? 0) + 1);
  }
  const duplicateCodes = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([code]) => code)
    .sort();
  return {
    stkCnd: state.stkCnd,
    requestCount: state.pageCount,
    rowCount: state.rows.length,
    uniqueCodeCount: state.seenCodes.size,
    duplicateCodes,
    observedCodes: [...state.seenCodes].sort(),
    complete: state.complete,
    stoppedByPageCap: !state.complete && state.pageCount >= pagesPerCondition,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    firstRequestedAt: state.requestedAt,
    lastReceivedAt: state.receivedAt,
    topRanks: state.rows.slice(0, 20),
  };
}

function compareConditions(results: readonly ConditionResult[]) {
  const all = results.find((result) => result.stkCnd === "0");
  const current = results.find((result) => result.stkCnd === "1");
  if (!all || !current) throw new Error("Both stk_cnd conditions are required");
  const allCodes = new Set(all.topRanks.map((row) => row.code));
  const currentCodes = new Set(current.topRanks.map((row) => row.code));
  const allObservedCodes = new Set(all.observedCodes);
  const currentObservedCodes = new Set(current.observedCodes);
  return {
    topRankDifferenceCount: symmetricDifferenceCount(allCodes, currentCodes),
    onlyInStkCnd0TopRanks: [...allCodes]
      .filter((code) => !currentCodes.has(code))
      .sort(),
    onlyInStkCnd1TopRanks: [...currentCodes]
      .filter((code) => !allCodes.has(code))
      .sort(),
    observedCodeDifferenceCount: symmetricDifferenceCount(
      allObservedCodes,
      currentObservedCodes,
    ),
    onlyInStkCnd0ObservedCodes: [...allObservedCodes]
      .filter((code) => !currentObservedCodes.has(code))
      .sort(),
    onlyInStkCnd1ObservedCodes: [...currentObservedCodes]
      .filter((code) => !allObservedCodes.has(code))
      .sort(),
    rowCountDifference: all.rowCount - current.rowCount,
    uniqueCodeCountDifference: all.uniqueCodeCount - current.uniqueCodeCount,
  };
}

function symmetricDifferenceCount(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): number {
  return (
    [...left].filter((value) => !right.has(value)).length +
    [...right].filter((value) => !left.has(value)).length
  );
}

function emptyState(stkCnd: StockCondition): PageState {
  return {
    stkCnd,
    contYn: "N",
    nextKey: "",
    complete: false,
    pageCount: 0,
    rows: [],
    seenCodes: new Set<string>(),
    seenNextKeys: new Set<string>(),
    requestedAt: null,
    receivedAt: null,
  };
}

export async function writePrivateJson(
  path: string,
  value: unknown,
): Promise<void> {
  const outputPath = resolve(path);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(outputPath, 0o600);
}

function requireValue(
  argv: readonly string[],
  index: number,
  flag: string,
): string {
  const value = argv[index + 1]?.trim();
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

function required(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new KiwoomClientError(`${API_ID} record is missing ${field}`);
  }
  return value.trim();
}

function requiredNumberString(value: unknown, field: string): string {
  const raw = required(value, field);
  if (!Number.isFinite(Number(raw))) {
    throw new KiwoomClientError(`${API_ID} record has invalid ${field}`);
  }
  return raw;
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main(): Promise<void> {
  const args = parseCompareUsLossScopeArgs(process.argv.slice(2));
  const result = await runCompareUsLossScope(args);
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown US loss scope comparison failure";
    console.error(`compare-us-loss-scope failed: ${message}`);
    process.exitCode = 1;
  });
}
