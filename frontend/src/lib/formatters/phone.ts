/** Format a Nigerian number as +234XXXXXXXXXX. Returns null if it is not valid. */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}
