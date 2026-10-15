import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  auditKrListingCorrectionProposals,
  auditRunAccuracy,
} from "../lib/signals/data-accuracy.ts";
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

async function runVerifyDataAccuracy(
  client: SupabaseClient,
  args: VerifyDataAccuracyArgs,
) {
  const runIds =
    args.mode === "run" && args.runId
      ? [args.runId]
      : await readRunIds(client, args.mode === "all" ? "all" : "latest");
  const results = [];
  for (const runId of runIds) {
    results.push(await auditRunAccuracy(client, runId));
  }
  const krListingCorrectionProposal =
    args.mode === "all"
      ? await auditKrListingCorrectionProposals(client)
      : null;
  return {
    ok:
      results.every((result) => result.ok) &&
      (krListingCorrectionProposal?.ok ?? true),
    checkedRunCount: results.length,
    inaccurateRunCount:
      results.filter((result) => !result.ok).length +
      (krListingCorrectionProposal && !krListingCorrectionProposal.ok ? 1 : 0),
    results,
    krListingCorrectionProposal,
  };
}

async function readRunIds(
  client: SupabaseClient,
  mode: "latest" | "all",
): Promise<string[]> {
  if (mode === "latest") {
    const ids = await Promise.all([
      readLatestCompletedRunId(client, "KR"),
      readLatestCompletedRunId(client, "US"),
    ]);
    return ids.flatMap((id) => (id ? [id] : []));
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
  return rows.map((row) => row.id);
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
