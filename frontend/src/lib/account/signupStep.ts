/** The sign-up step kept for the tab, so the confirm page knows where to go on. Requirements: FR-48, NFR-06, NFR-07.
 * Only the code token, where the code went (masked), the account type and the moment a new code may be asked for. Never the
 * password, never a typed code, never the email or the phone in full. `sessionStorage`: gone when the tab closes, never
 * `localStorage`, a cookie or an address. Every function copes with a storage that throws (private mode): the person then simply
 * starts again.
 */
import type { AccountType } from "@/types/account";

export const SIGNUP_STEP_KEY = "swifthealth.signup-step";

export type SignUpStep = {
  step: "email" | "phone";
  token: string; // the code token of the current step (not the password)
  sentTo: string; // masked: a***@example.com or +234******0123
  kind: AccountType;
  readyAt: number; // the moment (ms since 1970) when "Send a new code" may be used
};

export function saveSignUpStep(step: SignUpStep): void {
  const { step: name, token, sentTo, kind, readyAt } = step; // only the five known fields are written
  try {
    window.sessionStorage.setItem(SIGNUP_STEP_KEY, JSON.stringify({ step: name, token, sentTo, kind, readyAt }));
  } catch {
    // nothing to do: without storage the person starts again
  }
}

/** The saved step, or null if there is none or the saved value is damaged. */
export function readSignUpStep(): SignUpStep | null {
  try {
    const stored = window.sessionStorage.getItem(SIGNUP_STEP_KEY);
    if (stored === null) return null;
    const value: unknown = JSON.parse(stored);
    if (typeof value !== "object" || value === null) return null;
    const { step, token, sentTo, kind, readyAt } = value as Record<string, unknown>;
    if (step !== "email" && step !== "phone") return null;
    if (kind !== "staff" && kind !== "provider") return null;
    if (typeof token !== "string" || token === "" || typeof sentTo !== "string" || typeof readyAt !== "number") return null;
    return { step, token, sentTo, kind, readyAt };
  } catch {
    return null;
  }
}

export function clearSignUpStep(): void {
  try {
    window.sessionStorage.removeItem(SIGNUP_STEP_KEY);
  } catch {
    // nothing to do
  }
}
