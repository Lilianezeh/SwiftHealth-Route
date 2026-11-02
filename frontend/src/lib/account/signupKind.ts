/** The kind of account a link to the sign-up page names: `/sign-up?as=owner` (from For facilities) and `/sign-up?as=staff` (from the
 * Staff portal). Requirements: FR-48, FR-49. UI spec 3.1c (the owner's request of 2026-11-02). Any other value, a list of values or
 * none means "no choice": the page then asks, as it always did. It is a reading of the address, not a guess, and it keeps nothing.
 */
import type { AccountType } from "@/types/account";

export function signUpKindFromAddress(value: string | string[] | undefined): AccountType | null {
  if (value === "owner") return "provider";
  if (value === "staff") return "staff";
  return null;
}
