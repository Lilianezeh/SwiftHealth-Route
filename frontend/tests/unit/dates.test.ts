/** Tests for formatVerified in lib/formatters/dates.ts. Requirements: FR-08, US-07, NFR-08 (the verified date is always shown).
 *
 * The current time is passed in, so the tests do not depend on the day they run.
 */
import { describe, expect, it } from "vitest";

import { formatVerified } from "@/lib/formatters/dates";

const NOW = new Date("2026-10-09T12:00:00Z");

describe("formatVerified", () => {
  it.each([
    ["2026-10-09T10:00:00Z", "Verified today"],
    ["2026-10-08T11:00:00Z", "Verified 1 day ago"],
    ["2026-10-08T13:00:00Z", "Verified today"], // 23 hours ago is not yet a full day
    ["2026-10-06T09:00:00Z", "Verified 3 days ago"],
    ["2026-08-25T12:00:00Z", "Verified 45 days ago"],
    ["2025-10-09T12:00:00Z", "Verified 365 days ago"],
  ])("%s becomes '%s'", (iso, expected) => {
    expect(formatVerified(iso, NOW)).toBe(expected);
  });

  it("counts a date in the future (a phone clock that is wrong) as today", () => {
    expect(formatVerified("2026-10-10T12:00:00Z", NOW)).toBe("Verified today");
  });

  it("says 'Not yet verified' when there is no date", () => {
    expect(formatVerified(null, NOW)).toBe("Not yet verified");
  });

  it("does not throw on text that is not a date", () => {
    expect(formatVerified("not a date", NOW)).toBe("Not yet verified");
  });
});
