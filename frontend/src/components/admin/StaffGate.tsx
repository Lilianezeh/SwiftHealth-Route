"use client";

/** The gate of every staff screen. Requirements: FR-30, FR-42, NFR-06, NFR-10. UI spec "Phase 10 details"; decisions C2 and C11 in
 * specs/2026-10-20-staff-screens/requirements.md.
 *
 * It reads the session (after the first render, so the server and the browser draw the same page). With none it goes to the login
 * screen and draws nothing of the page. A role that may not open the page sees a short message and a link to where it starts. The
 * page gets the session and a `call` helper: a call whose answer is 401 clears the session and goes to the login. The gate only
 * chooses what to show: the API checks the role of every request again, from the database.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { StaffBar } from "@/components/admin/StaffBar";
import { TwoFactorOffer } from "@/components/admin/TwoFactorOffer";
import { ApiError } from "@/lib/api/request";
import { canOpen, homeAddressFor, type StaffArea } from "@/lib/staff/roles";
import { clearStaffSession, readStaffSession, saveStaffSession } from "@/lib/staff/session";
import type { StaffSession, StaffUser } from "@/types/staff";

type StaffContextValue = {
  session: StaffSession;
  /** Runs a staff call with the token. A 401 logs the user out; the error is still thrown to the caller. */
  call: <T>(operation: (token: string) => Promise<T>) => Promise<T>;
  logout: () => void;
  /** Changes what the screens know about the logged-in user (for example that the authenticator app is now on). */
  updateUser: (changes: Partial<StaffUser>) => void;
};

const StaffContext = createContext<StaffContextValue | null>(null);

export function useStaff(): StaffContextValue {
  const value = useContext(StaffContext);
  if (value === null) throw new Error("useStaff must be used inside a StaffGate.");
  return value;
}

type StaffGateProps = { area: StaffArea; children: ReactNode };

export function StaffGate({ area, children }: StaffGateProps) {
  const router = useRouter();
  const [session, setSession] = useState<StaffSession | null | undefined>(undefined); // undefined: not read yet

  useEffect(() => {
    const saved = readStaffSession();
    setSession(saved);
    if (saved === null) router.replace("/log-in");
  }, [router]);

  const logout = useCallback(() => {
    clearStaffSession();
    setSession(null);
    router.replace("/log-in");
  }, [router]);

  const updateUser = useCallback((changes: Partial<StaffUser>) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, user: { ...current.user, ...changes } };
      saveStaffSession(next);
      return next;
    });
  }, []);

  const value = useMemo<StaffContextValue | null>(() => {
    if (!session) return null;
    return {
      session,
      logout,
      updateUser,
      call: async <T,>(operation: (token: string) => Promise<T>) => {
        try {
          return await operation(session.token);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) logout();
          throw error;
        }
      },
    };
  }, [session, logout, updateUser]);

  if (!session || value === null) {
    return (
      <p role="status" className="mx-auto max-w-4xl px-4 py-10 text-base text-ink">
        {session === null ? "Going to the login…" : "Loading…"}
      </p>
    );
  }

  if (!canOpen(session.user.role, area)) {
    return (
      <StaffContext.Provider value={value}>
        <StaffBar user={session.user} onLogout={logout} />
        <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-10">
          <p className="text-lg text-ink">Your role cannot open this page.</p>
          <Link
            href={homeAddressFor(session.user.role)}
            prefetch={false}
            className="inline-flex min-h-12 items-center text-base font-semibold text-forest underline underline-offset-4"
          >
            Go to your start page
          </Link>
        </section>
      </StaffContext.Provider>
    );
  }

  return (
    <StaffContext.Provider value={value}>
      <StaffBar user={session.user} onLogout={logout} />
      {area !== "security" && !session.user.two_factor_enabled && <TwoFactorOffer role={session.user.role} />}
      {children}
    </StaffContext.Provider>
  );
}
