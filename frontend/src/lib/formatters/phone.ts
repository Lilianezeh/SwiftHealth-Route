/** Format a Nigerian number as +234XXXXXXXXXX. Returns null if it is not valid. */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

/** A masked number from the API (`+234******0001`) in the reading shape: "0*** *** 0001" (the stars stay, the last four digits show).
 * Anything that is not in that shape is returned as it was given.
 */
export function formatMaskedPhone(masked: string): string {
  const match = /^\+234([\d*]{10})$/.exec(masked);
  if (!match) return masked;
  const local = `0${match[1]}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** A number for reading as text: +2348031234567 -> "0803 123 4567" (leading 0, groups of 4, 3 and 4). Spec: listing page D12.
 * A value that is not a Nigerian number is returned as it was given, never guessed at. Links (tel:, wa.me) keep the international form.
 */
export function formatPhoneForReading(raw: string): string {
  const international = toE164(raw);
  if (international === null) return raw;
  const local = `0${international.slice(4)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
