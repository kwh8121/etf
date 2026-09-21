import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("US P1 command isolation", () => {
  it("has separate manual commands and workflow without importing the KR daily runner", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    const workflow = readFileSync(
      ".github/workflows/us-etf-movers.yml",
      "utf8",
    );
    expect(packageJson.scripts["ingest:us-movers"]).toContain(
      "--env-file-if-exists=.env",
    );
    expect(packageJson.scripts["report:us-movers"]).toContain(
      "--env-file-if-exists=.env",
    );
    expect(workflow).toContain("ENABLE_US_ETF_P1");
    expect(workflow).toContain("environment: staging");
    expect(workflow).not.toContain("environment: production");
    expect(workflow).toContain("steps.ingest.outputs.duplicate != 'true'");
    expect(workflow).toContain("--run-id=${{ steps.ingest.outputs.run_id }}");
    expect(workflow).not.toContain("daily:kr");
  });
});
