/** The opening hours table of the listing page. Requirements: FR-09, US-06. Spec: specs/2026-10-13-listing-page/requirements.md D6.
 * The API sends "HH:MM" in Lagos time. The page shows 12-hour times, "(next day)" for a shift that runs past midnight (the closing
 * time is earlier than the opening time) and "Closed" for a day with no hours. "Today" is the day in Africa/Lagos, not the device's.
 */
import type { OpeningHoursRead } from "@/types/api";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const LAGOS = "Africa/Lagos";

/** "20:00" -> "8:00 PM"; midnight is "12:00 AM" and noon "12:00 PM". Text that is not a time is returned as it is. */
export function formatTime12(time: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) return time;
  const hour24 = Number(match[1]);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${match[2]} ${hour24 >= 12 ? "PM" : "AM"}`;
}

/** Today in Lagos time: 0 = Monday ... 6 = Sunday. */
export function lagosWeekdayIndex(now: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: LAGOS, weekday: "long" }).format(now);
  return DAY_NAMES.indexOf(name as (typeof DAY_NAMES)[number]);
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export type HoursRow = { dayName: string; text: string; isToday: boolean; isClosed: boolean };

/** Seven rows, Monday first, whatever order the API sent. A day that is missing, or has no times, is closed. */
export function hoursRows(openingHours: OpeningHoursRead[], now: Date = new Date()): HoursRow[] {
  const today = lagosWeekdayIndex(now);

  return DAY_NAMES.map((dayName, index) => {
    const entry = openingHours.find((hours) => hours.day_of_week === index);
    const isClosed = !entry || entry.is_closed || !entry.opens_at || !entry.closes_at;
    if (isClosed) return { dayName, text: "Closed", isToday: index === today, isClosed: true };

    const pastMidnight = toMinutes(entry.closes_at as string) < toMinutes(entry.opens_at as string);
    const text = `${formatTime12(entry.opens_at as string)} – ${formatTime12(entry.closes_at as string)}${pastMidnight ? " (next day)" : ""}`;
    return { dayName, text, isToday: index === today, isClosed: false };
  });
}
