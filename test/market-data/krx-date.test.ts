import { describe, expect, it, vi } from "vitest";

import {
  assertValidKrxRequestDate,
  InvalidKrxRequestDateError,
} from "@/lib/market-data/krx-date";

describe("KRX request date validation", () => {
  it.each(["20260230", "20260229", "20261301", "2026091", "2026-09-18"])(
    "rejects invalid calendar date %s before a network call",
    (value) => {
      const request = vi.fn();

      expect(() => {
        assertValidKrxRequestDate(value);
        request();
      }).toThrow(InvalidKrxRequestDateError);
      expect(request).not.toHaveBeenCalled();
    },
  );

  it.each(["20260228", "20280229", "20240229"])(
    "accepts valid calendar date %s",
    (value) => {
      expect(() => assertValidKrxRequestDate(value)).not.toThrow();
    },
  );
});
