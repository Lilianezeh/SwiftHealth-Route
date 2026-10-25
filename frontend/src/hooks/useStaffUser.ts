"use client";

/** The person logged in in this tab, or null: for the header only (Log in / Sign up, or My account). Requirements: FR-02, NFR-10.
 * It reads the tab's own `sessionStorage` (lib/staff/session.ts) and never calls the API. The server and the first draw in the
 * browser both give null, so the page the visitor first sees is the same one for everybody (no mismatch, and nothing moves for a
 * visitor with no session); a saved session is picked up right after, and a login or logout in this tab is heard at once.
 */
import { useMemo, useSyncExternalStore } from "react";

import { readStaffSession, STAFF_SESSION_CHANGED, STAFF_SESSION_KEY } from "@/lib/staff/session";
import type { StaffUser } from "@/types/staff";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange); // another tab
  window.addEventListener(STAFF_SESSION_CHANGED, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STAFF_SESSION_CHANGED, onChange);
  };
}

/** The saved text itself: a string compares by value, so React redraws only when the session really changed. */
function currentSession(): string | null {
  try {
    return window.sessionStorage.getItem(STAFF_SESSION_KEY);
  } catch {
    return null;
  }
}

export function useStaffUser(): StaffUser | null {
  const saved = useSyncExternalStore(subscribe, currentSession, () => null);
  return useMemo(() => (saved === null ? null : (readStaffSession()?.user ?? null)), [saved]);
}
