import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getRequiredServerSecret } from "../lib/config/server-env.ts";
import { KrxClient } from "../lib/market-data/krx-client.ts";
import {
  buildHistoryRecord,
  weekdayRange,
  type KrxHistoryRecord,
} from "../lib/recommendations/krx-history.ts";

// 연구 전용 로컬 백필. 운영 DB에는 쓰지 않으며 출력은 gitignore된 research-data/에만 둔다.
const DEFAULT_OUT_DIR = "research-data/kr-etf-daily";
const DEFAULT_DELAY_MS = 300;
const MAX_ATTEMPTS = 4;

export interface BackfillArgs {
  from: string;
  to: string;
  outDir: string;
  delayMs: number;
}

export function parseArgs(argv: string[]): BackfillArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument near: ${key ?? "<end>"}`);
    }
    values.set(key.slice(2), value);
  }

  const from = values.get("from");
  const to = values.get("to");
  if (!from || !to) {
    throw new Error("Usage: --from YYYYMMDD --to YYYYMMDD [--out dir] [--delay-ms n]");
  }

  return {
    from,
    to,
    outDir: values.get("out") ?? DEFAULT_OUT_DIR,
    delayMs: Number(values.get("delay-ms") ?? DEFAULT_DELAY_MS),
  };
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function fetchWithRetry(client: KrxClient, date: string) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await client.fetchDailySnapshot(date);
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) {
        throw error;
      }
      await sleep(1000 * 2 ** attempt);
    }
  }
}

export async function runResearchBackfill(args: BackfillArgs, client: KrxClient) {
  await mkdir(args.outDir, { recursive: true });
  const counts: Record<string, number> = { skipped: 0 };
  const flagged: string[] = [];

  for (const date of weekdayRange(args.from, args.to)) {
    const file = join(args.outDir, `${date}.json`);
    if (existsSync(file)) {
      const saved = JSON.parse(await readFile(file, "utf8")) as KrxHistoryRecord;
      if (saved.status === "TRADING_COMPLETE" || saved.status === "NON_TRADING") {
        counts.skipped += 1;
        continue;
      }
    }

    const rawRows = await fetchWithRetry(client, date);
    const record = buildHistoryRecord(date, rawRows, new Date().toISOString());
    await writeFile(file, JSON.stringify(record));
    counts[record.status] = (counts[record.status] ?? 0) + 1;
    if (record.status !== "TRADING_COMPLETE" && record.status !== "NON_TRADING") {
      flagged.push(`${date}:${record.status}:${record.reasons[0] ?? ""}`);
    }
    await sleep(args.delayMs);
  }

  return { counts, flagged };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const client = new KrxClient({ authKey: getRequiredServerSecret("KRX_API_KEY") });
  const result = await runResearchBackfill(args, client);
  console.log(JSON.stringify(result, null, 2));
}
