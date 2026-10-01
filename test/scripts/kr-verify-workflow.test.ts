import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const PATH = ".github/workflows/kr-verify.yml";

describe("KR daily verification workflow", () => {
  const workflow = readFileSync(PATH, "utf8");

  it("runs on a GitHub-hosted runner because it never calls Kiwoom", () => {
    expect(workflow).toContain("runs-on: ubuntu-latest");
    expect(workflow).not.toContain("self-hosted");
  });

  it("starts after the KR daily workflow succeeds and can be run manually", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain('workflows: ["KR daily ETF signals"]');
    expect(workflow).toContain("types: [completed]");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("workflow_dispatch:");
  });

  it("never runs on pull requests or a schedule", () => {
    expect(workflow).not.toContain("pull_request");
    expect(workflow).not.toContain("schedule:");
  });

  it("gets only the Supabase credential needed for read-only verification", () => {
    expect(workflow).toContain("SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}");
    expect(workflow).toContain("NEXT_PUBLIC_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_SUPABASE_URL }}");
    for (const unrelated of ["KIWOOM", "KRX_API_KEY", "TELEGRAM"]) {
      expect(workflow).not.toContain(unrelated);
    }
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("contents: read");
  });

  it("verifies the latest KR reference date and fails the job when it is not complete", () => {
    expect(workflow).toMatch(/npm run verify:kr-candidate( --silent)? -- latest/);
    expect(workflow).toContain("GITHUB_STEP_SUMMARY");
  });
});
