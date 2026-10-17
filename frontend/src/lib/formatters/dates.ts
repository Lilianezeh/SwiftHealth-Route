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

export function formatVerified(lastVerifiedAt: string | null, now: Date): string {
  const verifiedAt = lastVerifiedAt === null ? Number.NaN : new Date(lastVerifiedAt).getTime();
  if (Number.isNaN(verifiedAt)) return "Not yet verified";

  const days = Math.max(0, Math.floor((now.getTime() - verifiedAt) / MILLISECONDS_PER_DAY)); // the future counts as today
  if (days === 0) return "Verified today";
  return `Verified ${days} ${days === 1 ? "day" : "days"} ago`;
}
