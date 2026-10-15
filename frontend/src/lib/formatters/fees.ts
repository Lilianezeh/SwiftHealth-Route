/** The fee line of a service on the listing page. Requirements: FR-09, FR-11, US-06. Spec: specs/2026-10-13-listing-page/requirements.md D6
 * (the owner's decision 5 of specs/2026-10-11-listing-detail-api/requirements.md). The API sends money as a string with 2 decimals
 * ("1500.00"); it is formatted here as text and is never turned into a floating point number (CLAUDE.md: money is Decimal and strings).
 */
import type { ServiceRead } from "@/types/api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "1500.00" -> "₦1,500"; "1500.50" -> "₦1,500.50". Null when the text is not an amount of money. */
export function formatNaira(amount: string): string | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) return null;
  const whole = match[1].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = (match[2] ?? "").padEnd(2, "0");
  return `₦${whole}${decimals === "00" ? "" : `.${decimals}`}`;
}

/** "2026-09-28" -> "28 Sep 2026", read as plain text so no time zone can move the day. Null for no date or a date that does not exist. */
export function formatCollected(date: string | null): string | null {
  const match = date ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const real = new Date(Date.UTC(year, month - 1, day));
  if (real.getUTCFullYear() !== year || real.getUTCMonth() !== month - 1 || real.getUTCDate() !== day) return null;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export type FeeText = { amount: string | null; collected: string | null };

/** The text of one fee: a range, one amount, "From ...", "Up to ...", or no amount (and then no date either; the page says "Ask for price"). */
export function describeFee(service: ServiceRead): FeeText {
  const minimum = service.fee_min_naira === null ? null : formatNaira(service.fee_min_naira);
  const maximum = service.fee_max_naira === null ? null : formatNaira(service.fee_max_naira);

  let amount: string | null = null;
  if (minimum && maximum) amount = minimum === maximum ? minimum : `${minimum} – ${maximum}`;
  else if (minimum) amount = `From ${minimum}`;
  else if (maximum) amount = `Up to ${maximum}`;
  if (amount === null) return { amount: null, collected: null };

  const date = formatCollected(service.fee_collected_at);
  return { amount, collected: date ? `collected ${date}` : null };
}
