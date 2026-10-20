/** Tests for formatVerified in lib/formatters/dates.ts. Requirements: FR-08, US-07, NFR-08 (the verified date is always shown).
 *
 * The current time is passed in, so the tests do not depend on the day they run.
 */
import { describe, expect, it } from "vitest";

import { formatLagosDateTime, formatNoticeDate, formatTimeAgo, formatVerified } from "@/lib/formatters/dates";

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

describe("formatNoticeDate (the date in the offline notice of SwiftRescue, FR-17)", () => {
  it("writes the day, the short month and the year in Lagos time", () => {
    expect(formatNoticeDate("2026-10-17T10:00:00Z")).toBe("17 Oct 2026");
  });

  it("uses the Lagos date, not the UTC one (23:30 UTC is already the next day in Lagos)", () => {
    expect(formatNoticeDate("2026-10-17T23:30:00Z")).toBe("18 Oct 2026");
  });

  it("does not throw on text that is not a date", () => {
    expect(formatNoticeDate("not a date")).toBe("an earlier visit");
  });
});

describe("formatTimeAgo (when a report came in, phase 11)", () => {
  it.each([
    ["2026-10-09T11:59:40Z", "just now"],
    ["2026-10-09T11:59:00Z", "1 minute ago"],
    ["2026-10-09T11:15:00Z", "45 minutes ago"],
    ["2026-10-09T11:00:00Z", "1 hour ago"],
    ["2026-10-09T08:00:00Z", "4 hours ago"],
    ["2026-10-08T12:00:00Z", "1 day ago"],
    ["2026-10-02T12:00:00Z", "7 days ago"],
    ["2026-10-10T12:00:00Z", "just now"], // a phone clock that is wrong: the future is "just now"
  ])("%s becomes '%s'", (iso, expected) => {
    expect(formatTimeAgo(iso, NOW)).toBe(expected);
  });

  it("does not throw on text that is not a date", () => {
    expect(formatTimeAgo("not a date", NOW)).toBe("some time ago");
  });
});

describe("formatLagosDateTime (the full time in a tooltip)", () => {
  it("writes the day, the month, the year and the 24-hour time in Lagos time", () => {
    expect(formatLagosDateTime("2026-10-17T10:05:00Z")).toBe("17 Oct 2026, 11:05");
  });
});
