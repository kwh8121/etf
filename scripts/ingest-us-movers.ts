import { randomUUID } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getRequiredServerSecret } from "../lib/config/server-env.ts";
import {
  KiwoomUsEtfMoverClient,
  type KiwoomUsEtfMoverResult,
} from "../lib/market-data/kiwoom-us-movers.ts";
import { KiwoomClient } from "../lib/market-data/kiwoom.ts";
import {
  SupabaseUsEtfMoverRepository,
  persistUsEtfMoverSnapshot,
} from "../lib/signals/us-etf-signal-repository.ts";
import {
  buildUsEtfMoverSignals,
  isUsEtfP1Enabled,
  type UsEtfMoverSignals,
} from "../lib/signals/us-etf-movers.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";

export async function runUsEtfMoverIngestion(input: {
  enabled: boolean;
  issueAccessToken: () => Promise<{ token: string }>;
  fetchAll: (token: string) => Promise<KiwoomUsEtfMoverResult>;
  persist: (input: {
    observationKey: string;
    observedAt: string;
    rawPayload: Record<string, unknown>;
    pageCount: number;
    signals: UsEtfMoverSignals;
  }) => ReturnType<typeof persistUsEtfMoverSnapshot>;
  observationKey: () => string;
  now: () => Date;
}) {
  if (!input.enabled) return { status: "DISABLED" as const };
  const accessToken = await input.issueAccessToken();
  const source = await input.fetchAll(accessToken.token);
  const persisted = await input.persist({
    observationKey: input.observationKey(),
    observedAt: input.now().toISOString(),
    rawPayload: source.rawPayload,
    pageCount: source.pageCount,
    signals: buildUsEtfMoverSignals(source),
  });
  return { status: "COMPLETE" as const, ...persisted };
}

export function toGitHubOutput(result: {
  status: "DISABLED" | "COMPLETE";
  runId?: string | null;
  duplicate?: boolean;
}): string {
  return [
    `status=${result.status}`,
    `run_id=${result.runId ?? ""}`,
    `duplicate=${result.duplicate === true}`,
  ].join("\n");
}

async function main(): Promise<void> {
  if (!isUsEtfP1Enabled()) {
    const result = { status: "DISABLED" as const };
    if (process.env.GITHUB_OUTPUT) {
      await appendFile(
        process.env.GITHUB_OUTPUT,
        `${toGitHubOutput(result)}\n`,
        "utf8",
      );
    }
    console.log(
      JSON.stringify({ ...result, reason: "ENABLE_US_ETF_P1 is not true" }),
    );
    return;
  }
  const tokenClient = new KiwoomClient({
    appKey: getRequiredServerSecret("KIWOOM_APP_KEY"),
    secretKey: getRequiredServerSecret("KIWOOM_SECRET_KEY"),
  });
  const moverClient = new KiwoomUsEtfMoverClient();
  const repository = new SupabaseUsEtfMoverRepository(
    createServiceRoleClient(),
  );
  const result = await runUsEtfMoverIngestion({
    enabled: true,
    issueAccessToken: () => tokenClient.issueAccessToken(),
    fetchAll: (token) => moverClient.fetchAll(token),
    persist: (input) => persistUsEtfMoverSnapshot(repository, input),
    observationKey: () => `us-etf-movers-${randomUUID()}`,
    now: () => new Date(),
  });
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `${toGitHubOutput(result)}\n`,
      "utf8",
    );
  }
  console.log(JSON.stringify(result));
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error: unknown) => {
    console.error(
      `ingest-us-movers failed: ${error instanceof Error ? error.message : "Unknown failure"}`,
    );
    process.exitCode = 1;
  });
}
