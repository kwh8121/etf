import { describe, expect, it } from "vitest";

import { parseVerifyDataAccuracyArgs } from "../../scripts/verify-data-accuracy.ts";

describe("parseVerifyDataAccuracyArgs", () => {
  it("parses all mode with a local sanitized output path", () => {
    expect(
      parseVerifyDataAccuracyArgs(["all", "--output", "/tmp/data-accuracy.json"]),
    ).toEqual({
      mode: "all",
      runId: null,
      outputPath: "/tmp/data-accuracy.json",
    });
  });

  it("parses explicit run id without enabling writes", () => {
    expect(parseVerifyDataAccuracyArgs(["--run-id", "run-123"])).toEqual({
      mode: "run",
      runId: "run-123",
      outputPath: null,
    });
  });
});
