import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// runner PC의 systemd timer가 호출한다. GitHub 예약 실행은 지연·누락이 잦아 workflow_dispatch로 실행한다.
// timer 설치본은 작업 사본과 분리해 복사해 쓰므로 node: 내장 모듈만 사용한다.

const REPOSITORY = "kwh8121/etf";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KR_SLOT_MINUTES = 19 * 60 + 15;

export type DispatchTarget = "kr" | "us";

// 지금 이전의 가장 최근 평일 19:15 KST 슬롯 날짜(YYYYMMDD). 지연·따라잡기 실행도 원래 기준일을 유지한다.
// KST는 서머타임이 없어 UTC+9 고정으로 계산한다.
export function latestKrSlotDate(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const day = new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()),
  );
  if (kst.getUTCHours() * 60 + kst.getUTCMinutes() < KR_SLOT_MINUTES)
    day.setUTCDate(day.getUTCDate() - 1);
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6)
    day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10).replaceAll("-", "");
}

export function buildDispatchArgs(target: DispatchTarget, now: Date): string[] {
  const base = ["workflow", "run"];
  const ref = ["-R", REPOSITORY, "--ref", "main"];
  if (target === "kr")
    return [
      ...base,
      "kr-daily.yml",
      ...ref,
      "-f",
      `market_date=${latestKrSlotDate(now)}`,
    ];
  return [...base, "us-etf-movers.yml", ...ref];
}

function main(): void {
  const target = process.argv[2];
  if (target !== "kr" && target !== "us") {
    console.error("usage: dispatch-scheduled-workflow.ts kr|us");
    process.exitCode = 2;
    return;
  }
  const args = buildDispatchArgs(target, new Date());
  execFileSync("gh", args, { stdio: "inherit" });
  console.log(JSON.stringify({ dispatched: target, args }));
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main();
}
