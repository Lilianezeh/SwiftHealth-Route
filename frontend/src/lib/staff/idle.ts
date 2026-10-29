/** The moment of the last activity, shared by every open tab. Requirements: NFR-06. Spec: specs/2026-10-29-idle-sign-out/.
 * The session (the token) is kept per tab in `sessionStorage`, but "the person is active" is a fact about the browser, so the moment
 * of the last click, key or scroll is one number in `localStorage` that every tab writes and reads. It holds no token and no
 * name. When the storage throws (private mode) each tab keeps its own number in memory and simply counts its own activity.
 */
import { LAST_ACTIVITY_KEY, defaultIdleSeconds } from "@/config/idle";
import type { StaffSession } from "@/types/staff";

let lastActivityInMemory: number | null = null;

export function readLastActivity(): number | null {
  try {
    const stored = window.localStorage.getItem(LAST_ACTIVITY_KEY);
    const moment = stored === null ? NaN : Number(stored);
    return Number.isFinite(moment) ? moment : null; // the shared number is the truth whenever the storage works
  } catch {
    return lastActivityInMemory; // the storage throws: this tab's own number
  }
}

export function recordActivity(moment: number): void {
  lastActivityInMemory = moment;
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(moment));
  } catch {
    // nothing to do: this tab's number is enough for this tab
  }
}

/** How long this session may be idle, in seconds: the API's answer kept at login, else the default of the role. */
export function idleSecondsFor(session: StaffSession): number {
  return session.idle_seconds ?? defaultIdleSeconds(session.user.role);
}
