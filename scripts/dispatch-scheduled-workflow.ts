import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// runner PC의 systemd timer가 호출한다. GitHub 예약 실행은 지연·누락이 잦아 workflow_dispatch로 실행한다.
// timer 설치본은 작업 사본과 분리해 복사해 쓰므로 node: 내장 모듈만 사용한다.

const REPOSITORY = "kwh8121/etf";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type DispatchTarget = "kr" | "us";

// 회사 PC의 운영 가능 시간만 dispatch한다. KST는 서머타임이 없다.
export function isWorkHour(now: Date): boolean {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return kst.getUTCDay() >= 1 && kst.getUTCDay() <= 5 &&
    kst.getUTCHours() >= 9 && kst.getUTCHours() < 17;
}

export function buildDispatchArgs(target: DispatchTarget): string[] {
  const base = ["workflow", "run"];
  const ref = ["-R", REPOSITORY, "--ref", "main"];
  if (target === "kr") return [...base, "kr-daily.yml", ...ref];
  return [...base, "us-etf-movers.yml", ...ref];
}

function main(): void {
  const target = process.argv[2];
  if (target !== "kr" && target !== "us") {
    console.error("usage: dispatch-scheduled-workflow.ts kr|us");
    process.exitCode = 2;
    return;
  }
  if (target === "kr" && !isWorkHour(new Date())) {
    console.log(JSON.stringify({ dispatched: false, reason: "outside_work_hours" }));
    return;
  }
  const args = buildDispatchArgs(target);
  execFileSync("gh", args, { stdio: "inherit" });
  console.log(JSON.stringify({ dispatched: target, args }));
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main();
}
