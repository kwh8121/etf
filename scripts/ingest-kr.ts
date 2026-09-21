import { randomUUID } from "node:crypto";

import { getRequiredServerSecret } from "../lib/config/server-env.ts";
import { KiwoomClient } from "../lib/market-data/kiwoom.ts";
import { KrxClient } from "../lib/market-data/krx-client.ts";
import { assertValidKrxRequestDate } from "../lib/market-data/krx-date.ts";
import {
  persistKiwoomMasterSnapshot,
  persistKiwoomMasterFetchFailure,
  persistKrxFetchFailure,
  persistKrxSnapshot,
  SupabaseMarketDataRepository,
} from "../lib/market-data/repository.ts";
import { validateKrxSnapshot } from "../lib/market-data/krx-validation.ts";
import { createServiceRoleClient } from "../lib/supabase/service-role-core.ts";

interface IngestionDependencies {
  requestedDate: string;
  observedDate: string;
  observationKey: () => string;
  repository: SupabaseMarketDataRepository;
  krxClient: KrxClient;
  kiwoomClient: KiwoomClient;
}

export async function runKoreanMarketIngestion(dependencies: IngestionDependencies) {
  assertValidKrxRequestDate(dependencies.requestedDate);
  const previousCompleteRowCount = await dependencies.repository.getLatestCompleteRowCount();
  let krxResult: { status: string; snapshotId: string; duplicate: boolean } | undefined;
  let rawRows;
  let validation;

  try {
    rawRows = await dependencies.krxClient.fetchDailySnapshot(dependencies.requestedDate);
    validation = validateKrxSnapshot(dependencies.requestedDate, rawRows, {
      previousCompleteRowCount: previousCompleteRowCount ?? undefined,
      isCurrentTarget: dependencies.requestedDate === dependencies.observedDate,
    });
  } catch {
    const persisted = await persistKrxFetchFailure(dependencies.repository, {
      observationKey: dependencies.observationKey(),
      requestedDate: dependencies.requestedDate,
      errorCode: "KRX_FETCH_OR_CONTRACT_FAILURE",
    });
    krxResult = { status: "FETCH_FAIL", ...persisted };
  }

  if (rawRows && validation) {
    const persisted = await persistKrxSnapshot(dependencies.repository, {
      observationKey: dependencies.observationKey(),
      requestedDate: dependencies.requestedDate,
      status: validation.status,
      rawRows,
      rows: validation.rows,
    });
    krxResult = { status: validation.status, ...persisted };
  }

  let kiwoomResult:
    | { status: string; snapshotId: string; duplicate: boolean; newListingCount: number }
    | undefined;
  let master;
  try {
    const accessToken = await dependencies.kiwoomClient.issueAccessToken();
    master = await dependencies.kiwoomClient.fetchEtfMaster(accessToken.token);
    if (master.hasMore) {
      throw new Error("Kiwoom ka10099 pagination is not supported by the published contract");
    }
  } catch {
    const persisted = await persistKiwoomMasterFetchFailure(dependencies.repository, {
      observationKey: dependencies.observationKey(),
      errorCode: "KIWOOM_MASTER_FETCH_OR_CONTRACT_FAILURE",
    });
    kiwoomResult = { status: "FETCH_FAIL", ...persisted, newListingCount: 0 };
  }

  if (master) {
    const persisted = await persistKiwoomMasterSnapshot(dependencies.repository, {
      observationKey: dependencies.observationKey(),
      observedDate: dependencies.observedDate,
      records: master.records,
    });
    kiwoomResult = { status: "COMPLETE", ...persisted };
  }

  if (!krxResult || !kiwoomResult) {
    throw new Error("Korean market ingestion did not produce both source results");
  }

  return { krx: krxResult, kiwoom: kiwoomResult };
}

function getKstDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}${value("month")}${value("day")}`;
}

async function main(): Promise<void> {
  const requestedDate = process.argv[2] ?? getKstDate();
  assertValidKrxRequestDate(requestedDate);
  const repository = new SupabaseMarketDataRepository(createServiceRoleClient());
  const result = await runKoreanMarketIngestion({
    requestedDate,
    observedDate: getKstDate(),
    observationKey: () => `kr-ingest-${randomUUID()}`,
    repository,
    krxClient: new KrxClient({ authKey: getRequiredServerSecret("KRX_API_KEY") }),
    kiwoomClient: new KiwoomClient({
      appKey: getRequiredServerSecret("KIWOOM_APP_KEY"),
      secretKey: getRequiredServerSecret("KIWOOM_SECRET_KEY"),
    }),
  });

  console.log(JSON.stringify(result));
}

if (process.argv[1]?.endsWith("ingest-kr.ts")) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown ingestion failure";
    console.error(`ingest-kr failed: ${message}`);
    process.exitCode = 1;
  });
}
