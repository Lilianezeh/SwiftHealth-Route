/** The staff session: the token and the user, kept for the tab only. Requirements: FR-30, NFR-06, NFR-07.
 * Decision C2 in specs/2026-10-20-staff-screens/requirements.md: `sessionStorage`, so it is gone when the tab closes; never
 * `localStorage`, a cookie or a page address, and never logged. The token holds no role (the API reads the role from the database on
 * every request); the user kept here is only for showing the name and choosing the links. Every function copes with a storage that
 * throws (private mode): the visitor then simply has to log in again.
 */
import type { StaffRole, StaffSession, StaffUser } from "@/types/staff";

export const STAFF_SESSION_KEY = "swifthealth.staff-session";
/** Fired on `window` when this tab saves or clears the session. The browser's own `storage` event only reaches other tabs, and the
 * header (Log in / Sign up or My account) must change at once in this one. */
export const STAFF_SESSION_CHANGED = "swifthealth:staff-session-changed";

function announceChange(): void {
  window.dispatchEvent(new Event(STAFF_SESSION_CHANGED));
}

const ROLES: StaffRole[] = ["verifier", "editor", "admin", "provider"];

export function saveStaffSession(session: StaffSession): void {
  try {
    window.sessionStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
  } catch {
    // nothing to do: without storage the visitor logs in again
  }
  announceChange();
}

function looksLikeAUser(value: unknown): value is StaffUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "number" &&
    typeof user.name === "string" &&
    typeof user.email === "string" &&
    (user.phone === null || typeof user.phone === "string") &&
    ROLES.includes(user.role as StaffRole) &&
    typeof user.is_active === "boolean"
  );
}

/** The saved session, or null if there is none or the saved value is damaged. */
export function readStaffSession(): StaffSession | null {
  try {
    const stored = window.sessionStorage.getItem(STAFF_SESSION_KEY);
    if (stored === null) return null;
    const value: unknown = JSON.parse(stored);
    if (typeof value !== "object" || value === null) return null;
    const { token, user } = value as Record<string, unknown>;
    if (typeof token !== "string" || token === "" || !looksLikeAUser(user)) return null;
    return { token, user };
  } catch {
    return null;
  }
}

export function clearStaffSession(): void {
  try {
    window.sessionStorage.removeItem(STAFF_SESSION_KEY);
  } catch {
    // nothing to do
  }
  announceChange();
}
