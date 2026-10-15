/** The opening hours table of the listing page. Requirements: FR-09, US-06, NFR-10. Spec: specs/2026-10-13-listing-page/requirements.md D6.
 * 12-hour times; a shift past midnight reads "(next day)"; a closed day reads "Closed"; today is the day in Africa/Lagos time, not the device's.
 */
import { describe, expect, it } from "vitest";

import { formatTime12, hoursRows, lagosWeekdayIndex } from "@/lib/formatters/hours";
import type { OpeningHoursRead } from "@/types/api";

const open = (day_of_week: number, opens_at: string, closes_at: string): OpeningHoursRead => ({
  day_of_week,
  opens_at,
  closes_at,
  is_closed: false,
});
const closed = (day_of_week: number): OpeningHoursRead => ({ day_of_week, opens_at: null, closes_at: null, is_closed: true });

describe("formatTime12", () => {
  it.each([
    ["00:00", "12:00 AM"], // midnight
    ["00:30", "12:30 AM"],
    ["01:05", "1:05 AM"],
    ["09:05", "9:05 AM"],
    ["11:59", "11:59 AM"],
    ["12:00", "12:00 PM"], // noon
    ["12:45", "12:45 PM"],
    ["13:00", "1:00 PM"],
    ["20:00", "8:00 PM"],
    ["23:59", "11:59 PM"],
  ])("writes %s as %s", (time, expected) => {
    expect(formatTime12(time)).toBe(expected);
  });

  it("accepts the seconds some databases add, and leaves anything it cannot read as it is", () => {
    expect(formatTime12("08:00:00")).toBe("8:00 AM");
    expect(formatTime12("later")).toBe("later");
  });
});

describe("lagosWeekdayIndex: today in Lagos time (0 = Monday ... 6 = Sunday), whatever the device's clock says", () => {
  it.each([
    ["2026-10-12T10:00:00Z", 0], // Monday 11:00 in Lagos
    ["2026-10-11T22:59:00Z", 6], // Sunday 23:59 in Lagos (UTC+1)
    ["2026-10-11T23:00:00Z", 0], // Monday 00:00 in Lagos: already Monday, though it is still Sunday in UTC
    ["2026-10-12T22:59:59Z", 0], // Monday 23:59:59 in Lagos
    ["2026-10-12T23:00:00Z", 1], // Tuesday 00:00 in Lagos
  ])("%s is day %i", (instant, expected) => {
    expect(lagosWeekdayIndex(new Date(instant))).toBe(expected);
  });
});

describe("hoursRows", () => {
  const week: OpeningHoursRead[] = [
    open(0, "08:00", "17:00"),
    open(1, "08:00", "17:00"),
    open(2, "00:00", "12:00"),
    open(3, "09:05", "12:00"),
    open(4, "20:00", "02:00"), // past midnight
    closed(5),
    closed(6),
  ];
  const monday = new Date("2026-10-12T10:00:00Z");

  it("has seven rows, Monday first, with the names of the days", () => {
    expect(hoursRows(week, monday).map((row) => row.dayName)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
  });

  it("writes the times in 12-hour form, 'next day' after a shift past midnight, and 'Closed' for a closed day", () => {
    expect(hoursRows(week, monday).map((row) => row.text)).toEqual([
      "8:00 AM – 5:00 PM",
      "8:00 AM – 5:00 PM",
      "12:00 AM – 12:00 PM",
      "9:05 AM – 12:00 PM",
      "8:00 PM – 2:00 AM (next day)",
      "Closed",
      "Closed",
    ]);
  });

  it("marks exactly one row as today, by Lagos time", () => {
    expect(hoursRows(week, monday).map((row) => row.isToday)).toEqual([true, false, false, false, false, false, false]);
    // Sunday 23:30 UTC is already Monday in Lagos; a device in another time zone does not change that.
    const sundayNightInUtc = new Date("2026-10-11T23:30:00Z");
    expect(hoursRows(week, sundayNightInUtc).filter((row) => row.isToday).map((row) => row.dayName)).toEqual(["Monday"]);
    const mondayNightInLagos = new Date("2026-10-12T22:30:00Z");
    expect(hoursRows(week, mondayNightInLagos).filter((row) => row.isToday).map((row) => row.dayName)).toEqual(["Monday"]);
  });

  it("treats a day that the API left out, or sent without times, as closed", () => {
    const rows = hoursRows([open(0, "08:00", "17:00"), { day_of_week: 1, opens_at: null, closes_at: null, is_closed: false }], monday);

    expect(rows[1].text).toBe("Closed");
    expect(rows[3].text).toBe("Closed"); // no entry at all
    expect(rows.every((row, index) => (index === 0 ? !row.isClosed : row.isClosed))).toBe(true);
  });

  it("does not depend on the order the API sends the days in", () => {
    const shuffled = [week[4], week[0], week[6], week[2], week[1], week[5], week[3]];

    expect(hoursRows(shuffled, monday).map((row) => row.text)).toEqual(hoursRows(week, monday).map((row) => row.text));
  });
});
