import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("KR daily command", () => {
  it("allows GitHub Actions environment variables when the local .env file is absent", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["daily:kr"]).toContain("--env-file-if-exists=.env");
  });
});
