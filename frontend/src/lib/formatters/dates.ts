/** When a listing was last verified, in words. Requirements: FR-08, US-07, NFR-08.
 * The current time is passed in, so tests do not depend on the day they run.
 */
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function formatVerified(lastVerifiedAt: string | null, now: Date): string {
  const verifiedAt = lastVerifiedAt === null ? Number.NaN : new Date(lastVerifiedAt).getTime();
  if (Number.isNaN(verifiedAt)) return "Not yet verified";

  const days = Math.max(0, Math.floor((now.getTime() - verifiedAt) / MILLISECONDS_PER_DAY)); // the future counts as today
  if (days === 0) return "Verified today";
  return `Verified ${days} ${days === 1 ? "day" : "days"} ago`;
}
