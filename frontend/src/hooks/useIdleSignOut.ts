"use client";

/** Signs the person out after no activity. Requirements: NFR-06, NFR-10. Spec: specs/2026-10-29-idle-sign-out/.
 *
 * While someone is logged in in this tab, it looks at the clock once a second (the real time, so a computer that slept is caught up
 * at the next look). "Activity" is a click, a key, a scroll or a touch in any open tab: every tab writes the moment of the last one
 * into one shared number (lib/staff/idle.ts) and every tab reads it. The limit comes from the session (the API's answer at login,
 * config/idle.ts). With `IDLE_WARNING_SECONDS` left it returns the seconds left, for the warning; at zero it clears the session and
 * goes to the login with the reason. While the person is active it asks the API for a fresh token, at most once a minute, because the
 * server also refuses a token that was not renewed within the limit. A renewal that fails for any reason except a 401 is ignored:
 * a sleeping API must not sign anyone out.
 *
 * While the warning is showing, only its button counts as activity: a stray scroll or click must not hide it.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ACTIVITY_EVENTS,
  ACTIVITY_WRITE_MIN_GAP_MS,
  IDLE_CHECK_EVERY_MS,
  IDLE_LOGIN_ADDRESS,
  IDLE_WARNING_SECONDS,
  KEEP_ALIVE_MIN_GAP_MS,
} from "@/config/idle";
import { useStaffUser } from "@/hooks/useStaffUser";
import { keepAlive } from "@/lib/api/staff";
import { ApiError } from "@/lib/api/request";
import { idleSecondsFor, readLastActivity, recordActivity } from "@/lib/staff/idle";
import { clearStaffSession, readStaffSession, saveStaffSession } from "@/lib/staff/session";

export type IdleSignOut = {
  /** Seconds until the sign-out while the warning is showing, else null. */
  secondsLeft: number | null;
  /** The "Stay signed in" button: counts as activity and renews the token at once. */
  stay: () => void;
};

export function useIdleSignOut(): IdleSignOut {
  const router = useRouter();
  const signedIn = useStaffUser() !== null;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const warningShown = useRef(false);
  const lastKeepAliveAt = useRef(0);
  // The moment of the last activity that the token is known to cover. A fresh token is asked for only when there is newer activity.
  const coveredActivity = useRef(0);
  const renewing = useRef(false);

  const signOut = useCallback(() => {
    clearStaffSession();
    warningShown.current = false;
    setSecondsLeft(null);
    router.replace(IDLE_LOGIN_ADDRESS);
  }, [router]);

  const renew = useCallback(async (activity: number) => {
    const session = readStaffSession();
    if (session === null || renewing.current) return;
    renewing.current = true;
    lastKeepAliveAt.current = Date.now();
    coveredActivity.current = activity;
    try {
      const fresh = await keepAlive(session.token);
      const current = readStaffSession(); // the person may have changed in the meantime
      if (current !== null) saveStaffSession({ ...current, token: fresh.access_token, idle_seconds: fresh.expires_in });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) signOut();
    } finally {
      renewing.current = false;
    }
  }, [signOut]);

  const stay = useCallback(() => {
    const now = Date.now();
    recordActivity(now);
    warningShown.current = false;
    setSecondsLeft(null);
    void renew(now);
  }, [renew]);

  useEffect(() => {
    if (!signedIn) {
      warningShown.current = false;
      setSecondsLeft(null);
      return;
    }
    const startedAt = Date.now();
    if (readLastActivity() === null) recordActivity(startedAt);
    coveredActivity.current = readLastActivity() ?? startedAt; // what happened before this page opened was renewed then
    let lastWrite = 0;

    const onActivity = () => {
      const now = Date.now();
      if (warningShown.current || now - lastWrite < ACTIVITY_WRITE_MIN_GAP_MS) return;
      lastWrite = now;
      recordActivity(now);
    };

    const check = () => {
      const session = readStaffSession();
      if (session === null) return;
      const now = Date.now();
      const lastActivity = readLastActivity() ?? startedAt;
      const millisecondsLeft = idleSecondsFor(session) * 1000 - (now - lastActivity);
      if (millisecondsLeft <= 0) {
        signOut();
        return;
      }
      const warn = millisecondsLeft <= IDLE_WARNING_SECONDS * 1000;
      warningShown.current = warn;
      setSecondsLeft(warn ? Math.ceil(millisecondsLeft / 1000) : null);
      const newActivity = lastActivity > coveredActivity.current;
      if (!warn && newActivity && now - lastKeepAliveAt.current >= KEEP_ALIVE_MIN_GAP_MS) void renew(lastActivity);
    };

    for (const eventName of ACTIVITY_EVENTS) {
      // capture: a scroll of any element does not bubble, but it can be heard on the way down
      window.addEventListener(eventName, onActivity, { capture: true, passive: true });
    }
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, IDLE_CHECK_EVERY_MS);
    check();
    return () => {
      for (const eventName of ACTIVITY_EVENTS) window.removeEventListener(eventName, onActivity, { capture: true });
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, [signedIn, signOut, renew]);

  return { secondsLeft, stay };
}
