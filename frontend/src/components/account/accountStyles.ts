/** The classes the account screens share. UI spec 3.1d. Fields and links are at least 48 px high (min-h-12), the buttons come from
 * buttonClasses (50 px); 16 px text; the problem box is amber, never red (red is for SwiftRescue). */
export const FIELD = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink";
export const PROBLEM = "rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink";
export const LINK_BUTTON = "inline-flex min-h-12 items-center justify-center rounded-xl px-3 text-base font-semibold text-forest underline";
export const FIELD_LABEL = "text-base font-semibold text-ink";
export const SECTION = "flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4";
export const CODE_LENGTH = 6;

/** What was typed for a 6-digit code: digits only, at most six. */
export function cleanSixDigits(typed: string): string {
  return typed.replace(/\D/g, "").slice(0, CODE_LENGTH);
}
