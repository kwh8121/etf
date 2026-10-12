import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const PATH = ".github/workflows/us-verify.yml";

describe("US ETF movers verification workflow", () => {
  const workflow = readFileSync(PATH, "utf8");

  it("runs on a GitHub-hosted runner because it never calls Kiwoom", () => {
    expect(workflow).toContain("runs-on: ubuntu-latest");
    expect(workflow).not.toContain("self-hosted");
  });

  it("starts after the US workflow succeeds and can be run manually", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain('workflows: ["US ETF movers (P1 experimental)"]');
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
        expect(workflow).toContain("contents: read");
  });

  it("uses the same environment as the US run workflow so the P1 flag value is the one the run saw", () => {
    const usRun = readFileSync(".github/workflows/us-etf-movers.yml", "utf8");
    const environmentOf = (text: string) => /^\s+environment: (\S+)/m.exec(text)?.[1];
    expect(environmentOf(workflow)).toBeDefined();
    expect(environmentOf(workflow)).toBe(environmentOf(usRun));
  });

  it("skips verification while the US P1 flag is not true, so a disabled run is not a failure", () => {
    expect(workflow).toContain("ENABLE_US_ETF_P1: ${{ vars.ENABLE_US_ETF_P1 }}");
    expect(workflow).toMatch(/if: env\.ENABLE_US_ETF_P1 == 'true'/);
  });

  it("verifies the latest US run and writes a job summary", () => {
    expect(workflow).toMatch(/npm run verify:us-candidate( --silent)? -- latest/);
    expect(workflow).toContain("GITHUB_STEP_SUMMARY");
  });
});
