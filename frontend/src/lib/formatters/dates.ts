/** When a listing was last verified, in words. Requirements: FR-08, US-07, NFR-08.
 * The current time is passed in, so tests do not depend on the day they run.
 */
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** A date for a notice, in Lagos time: "17 Oct 2026". Returns "an earlier visit" if the value is not a date. */
export function formatNoticeDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "an earlier visit";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
}

/** How long ago something happened, in words: "just now", "5 minutes ago", "2 hours ago", "3 days ago". The future counts as just now. */
export function formatTimeAgo(isoDate: string, now: Date): string {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return "some time ago";

  const minutes = Math.floor((now.getTime() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** The full time in Lagos time, 24-hour: "17 Oct 2026, 11:05". Returns "an unknown time" if the value is not a date. */
export function formatLagosDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "an unknown time";
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
  return `${day}, ${time}`;
}

export function formatVerified(lastVerifiedAt: string | null, now: Date): string {
  const verifiedAt = lastVerifiedAt === null ? Number.NaN : new Date(lastVerifiedAt).getTime();
  if (Number.isNaN(verifiedAt)) return "Not yet verified";

  const days = Math.max(0, Math.floor((now.getTime() - verifiedAt) / MILLISECONDS_PER_DAY)); // the future counts as today
  if (days === 0) return "Verified today";
  return `Verified ${days} ${days === 1 ? "day" : "days"} ago`;
}
