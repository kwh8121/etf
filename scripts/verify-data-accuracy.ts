import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  auditKrListingCorrectionProposals,
  auditRunAccuracy,
} from "../lib/signals/data-accuracy.ts";
import { SupabaseDataAccuracyStore } from "../lib/signals/data-accuracy-store.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";
import { readAllRows } from "../lib/supabase/read-all-rows.ts";

export interface VerifyDataAccuracyArgs {
  mode: "latest" | "all" | "run";
  runId: string | null;
  outputPath: string | null;
}

interface RunIdRow {
  id: string;
  market: "KR" | "US";
  completed_at: string | null;
}

export function parseVerifyDataAccuracyArgs(
  argv: readonly string[],
): VerifyDataAccuracyArgs {
  let mode: VerifyDataAccuracyArgs["mode"] = "latest";
  let runId: string | null = null;
  let outputPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "latest" || arg === "all") {
      mode = arg;
      continue;
    }
    if (arg === "--run-id") {
      runId = requireValue(argv, index, "--run-id");
      mode = "run";
      index += 1;
      continue;
    }
    if (arg === "--output") {
      outputPath = requireValue(argv, index, "--output");
      index += 1;
      continue;
    }
    throw new Error(`Unknown verify:data argument: ${arg}`);
  }

  if (mode === "run" && !runId) {
    throw new Error("--run-id requires a run id");
  }
  return { mode, runId, outputPath };
}

interface RunSelection {
  runIds: string[];
  reasons: string[];
}

export function summarizeVerifyDataAccuracyResult<
  Result extends { ok: boolean },
  Proposal extends { ok: boolean } | null,
>(input: {
  selectionReasons: readonly string[];
  results: readonly Result[];
  krListingCorrectionProposal: Proposal;
}) {
  const inaccurateRunCount = input.results.filter((result) => !result.ok).length;
  const listingAccuracyOk = input.krListingCorrectionProposal?.ok ?? true;
  const failedCheckCount =
    input.selectionReasons.length +
    inaccurateRunCount +
    (listingAccuracyOk ? 0 : 1);
  return {
    ok:
      input.selectionReasons.length === 0 &&
      inaccurateRunCount === 0 &&
      listingAccuracyOk,
    selectionReasons: input.selectionReasons,
    checkedRunCount: input.results.length,
    inaccurateRunCount,
    failedCheckCount,
    listingAccuracyOk,
    results: input.results,
    krListingCorrectionProposal: input.krListingCorrectionProposal,
  };
}

export async function runVerifyDataAccuracy(
  client: SupabaseClient,
  args: VerifyDataAccuracyArgs,
) {
  const selection =
    args.mode === "run" && args.runId
      ? { runIds: [args.runId], reasons: [] }
      : await readRunSelection(client, args.mode === "all" ? "all" : "latest");
  const store = new SupabaseDataAccuracyStore(client);
  const results = [];
  for (const runId of selection.runIds) {
    results.push(await auditRunAccuracy(client, runId, { store }));
  }
  const krListingCorrectionProposal =
    args.mode === "all"
      ? await auditKrListingCorrectionProposals(client, { store })
      : null;
  return summarizeVerifyDataAccuracyResult({
    selectionReasons: selection.reasons,
    results,
    krListingCorrectionProposal,
  });
}

async function readRunSelection(
  client: SupabaseClient,
  mode: "latest" | "all",
): Promise<RunSelection> {
  if (mode === "latest") {
    const markets = ["KR", "US"] as const;
    const ids = await Promise.all(markets.map((market) => readLatestCompletedRunId(client, market)));
    return {
      runIds: ids.flatMap((id) => (id ? [id] : [])),
      reasons: ids.flatMap((id, index) =>
        id ? [] : [`missing_latest_run:${markets[index]}`],
      ),
    };
  }
  const rows = await readAllRows<RunIdRow>({
    operation: "read completed signal runs for data accuracy",
    createQuery: () =>
      client
        .from("signal_run")
        .select("id,market,completed_at", { count: "exact" })
        .eq("status", "COMPLETED"),
    orderBy: [
      { column: "market", ascending: true },
      { column: "completed_at", ascending: true },
      { column: "id", ascending: true },
    ],
    getKey: (row) => row.id,
  });
  return {
    runIds: rows.map((row) => row.id),
    reasons: rows.length === 0 ? ["no_completed_runs"] : [],
  };
}

async function readLatestCompletedRunId(
  client: SupabaseClient,
  market: "KR" | "US",
): Promise<string | null> {
  const { data, error } = await client
    .from("signal_run")
    .select("id")
    .eq("market", market)
    .eq("status", "COMPLETED")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Supabase read latest ${market} signal run failed: ${error.message}`);
  }
  return data?.id ?? null;
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

async function main(): Promise<void> {
  const args = parseVerifyDataAccuracyArgs(process.argv.slice(2));
  const result = await runVerifyDataAccuracy(createServiceRoleClient(), args);
  if (args.outputPath) {
    const outputPath = resolve(args.outputPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(
      JSON.stringify({
        ok: result.ok,
        checkedRunCount: result.checkedRunCount,
        inaccurateRunCount: result.inaccurateRunCount,
        failedCheckCount: result.failedCheckCount,
        listingAccuracyOk: result.listingAccuracyOk,
        outputPath,
      }),
    );
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
  if (!result.ok) process.exitCode = 1;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown data accuracy failure";
    console.error(`verify-data-accuracy failed: ${message}`);
    process.exitCode = 1;
  });
}
