import { describe, expect, it } from "vitest";

import {
  getRequiredServerSecret,
  maskSecret,
  serverSecretEnvKeys,
} from "@/lib/config/server-env";

describe("server environment contract", () => {
  it("lists only server-side secrets", () => {
    expect(serverSecretEnvKeys).toEqual(
      expect.arrayContaining([
        "SUPABASE_SERVICE_ROLE_KEY",
        "KIWOOM_APP_KEY",
        "KIWOOM_SECRET_KEY",
        "KRX_API_KEY",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
      ]),
    );
    expect(serverSecretEnvKeys.every((key) => !key.startsWith("NEXT_PUBLIC_"))).toBe(
      true,
    );
  });

  it("rejects missing required secrets", () => {
    expect(() => getRequiredServerSecret("KIWOOM_APP_KEY", {})).toThrow(
      "Missing required server environment variable: KIWOOM_APP_KEY",
    );
  });

  it("trims required secrets before returning them", () => {
    expect(
      getRequiredServerSecret("KIWOOM_APP_KEY", {
        KIWOOM_APP_KEY: "  secret-value  ",
      }),
    ).toBe("secret-value");
  });

  it("masks secrets before they can be logged", () => {
    expect(maskSecret("abcdefgh")).toBe("ab…gh");
    expect(maskSecret("abcd")).toBe("****");
  });
});
