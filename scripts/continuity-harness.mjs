import { access, readdir, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const command = process.argv[2] ?? "check";

const requiredDocuments = [
  "AGENTS.md",
  "docs/plans/ETF-signal-MVP-plan-v2.2.md",
  "docs/plans/ETF-signal-MVP-v2.2-ROADMAP.md",
  "docs/plans/ETF-signal-MVP-v2.2-상세-개발-실행방안.md",
  "docs/guides/etf-signal-mvp-continuity-harness.md",
];

if (command !== "check") {
  console.error("Usage: node scripts/continuity-harness.mjs check");
  process.exit(2);
}

async function exists(path) {
  try {
    await access(resolve(root, path));
    return true;
  } catch {
    return false;
  }
}

function runGit(args) {
  try {
    return {
      ok: true,
      output: execFileSync("git", args, {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch (error) {
    return {
      ok: false,
      output: Buffer.isBuffer(error.stderr)
        ? error.stderr.toString().trim()
        : "git command failed",
    };
  }
}

const documentStatus = await Promise.all(
  requiredDocuments.map(async (path) => ({ path, exists: await exists(path) })),
);

const jobDirectory = resolve(root, "docs/jobs");
const jobFiles = await Promise.all(
  (await readdir(jobDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map(async (entry) => {
      const path = `docs/jobs/${entry.name}`;
      return { path, modifiedAt: (await stat(resolve(root, path))).mtimeMs };
    }),
);
jobFiles.sort((left, right) => right.modifiedAt - left.modifiedAt);

const diffCheck = runGit(["diff", "--check"]);
const worktree = runGit(["status", "--short"]);
const result = {
  harness: "etf-signal-mvp-continuity",
  requiredDocuments: documentStatus,
  latestJob: jobFiles[0]?.path ?? null,
  diffCheck,
  worktree,
  nextRequiredActions: [
    "최신 작업 기록을 정본 문서·검증 증거와 대조",
    "Linear 이슈와 프로젝트 건강 상태를 실제 실행 상태로 갱신",
    "세션 결론과 다음 정확한 작업을 OpenViking 메모리에 저장",
  ],
};

console.log(JSON.stringify(result, null, 2));

if (
  !documentStatus.every((document) => document.exists) ||
  !result.latestJob ||
  !diffCheck.ok
) {
  process.exit(1);
}
