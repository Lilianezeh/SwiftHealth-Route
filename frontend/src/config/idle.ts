/** Automatic sign-out after no activity. Requirements: NFR-06, NFR-10. Spec: specs/2026-10-29-idle-sign-out/.
 * The real limits are settings of the API (IDLE_MINUTES_ADMIN, IDLE_MINUTES_OTHER): the login answers with the limit of the
 * account's role (`expires_in`, in seconds) and the page keeps it in the session as `idle_seconds`. The numbers below are only the
 * fallback for a session saved before that existed, and they are the same as the API's defaults (admin 5 minutes, others 15).
 */
import type { StaffRole } from "@/types/staff";

export const DEFAULT_IDLE_SECONDS_ADMIN = 5 * 60;
export const DEFAULT_IDLE_SECONDS_OTHER = 15 * 60;

/** The warning comes this long before the sign-out. */
export const IDLE_WARNING_SECONDS = 60;
/** The page looks at the clock this often. It compares the real time, so a sleeping computer is caught up at the next look. */
export const IDLE_CHECK_EVERY_MS = 1000;
/** A fresh token is asked for at most this often while the person is active (the API's idle limit is never under 2 minutes). */
export const KEEP_ALIVE_MIN_GAP_MS = 60 * 1000;
/** Writing the moment of the last activity more often than this is wasted work (a scroll fires many events). */
export const ACTIVITY_WRITE_MIN_GAP_MS = 500;

/** The moment (ms) of the last click, key or scroll in any open tab of this browser. Only a number: no token, no name. */
export const LAST_ACTIVITY_KEY = "swifthealth.last-activity";

/** Clicks, typing and scrolling (and touch, which is how a phone clicks and scrolls). */
export const ACTIVITY_EVENTS = ["click", "keydown", "scroll", "touchstart", "wheel"] as const;

/** Where the person goes after an automatic sign-out, and the sentence the login page shows for it. */
export const IDLE_SIGNED_OUT_PARAM = "signed-out";
export const IDLE_SIGNED_OUT_VALUE = "idle";
export const IDLE_LOGIN_ADDRESS = `/log-in?${IDLE_SIGNED_OUT_PARAM}=${IDLE_SIGNED_OUT_VALUE}`;
export const IDLE_SIGNED_OUT_MESSAGE = "You were signed out because you were inactive. Log in again to continue.";

export function defaultIdleSeconds(role: StaffRole): number {
  return role === "admin" ? DEFAULT_IDLE_SECONDS_ADMIN : DEFAULT_IDLE_SECONDS_OTHER;
}
