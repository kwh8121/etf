import type { TelegramReportInput } from "./telegram";

interface SourceStatus {
  status: string;
  duplicate: boolean;
  snapshotId: string;
}

interface KoreanDailyStatusInput {
  requestedDate: string;
  krx: SourceStatus;
  kiwoom: SourceStatus;
}

export function createKoreanDailyStatusReport(
  input: KoreanDailyStatusInput,
): TelegramReportInput {
  return {
    market: "KR",
    basDd: formatDate(input.requestedDate),
    status: resolveTelegramStatus(input),
    runId: input.krx.snapshotId,
    source: "KRX etf_bydd_trd, Kiwoom ka10099",
    sections: [
      {
        title: "일일 수집 상태",
        lines: [
          formatSourceStatus("KRX", input.krx),
          formatSourceStatus("Kiwoom", input.kiwoom),
        ],
      },
    ],
  };
}

function resolveTelegramStatus(
  input: KoreanDailyStatusInput,
): TelegramReportInput["status"] {
  if (input.krx.status === "FETCH_FAIL" || input.kiwoom.status === "FETCH_FAIL")
    return "FAILED";
  if (input.krx.status === "PARTIAL") return "PARTIAL";
  if (input.krx.status === "PUBLISH_PENDING") return "PENDING";
  return "SKIPPED";
}

function formatSourceStatus(name: string, source: SourceStatus): string {
  return `${name}: ${source.status}${source.duplicate ? " (중복 관측)" : ""}`;
}

function formatDate(value: string): string {
  if (!/^\d{8}$/.test(value)) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}
