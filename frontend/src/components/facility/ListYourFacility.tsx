"use client";

/** "List your facility" `/list-your-facility`. Requirements: FR-50, FR-51, US-17, NFR-07. UI spec 2.9; decision D14 in
 * specs/2026-10-23-accounts-and-facility-ownership/requirements.md. What the page shows depends on who looks, read from the tab's
 * session after the first render (so the server and the browser draw the same page): a visitor is asked to sign up or log in, a
 * provider can register a facility or claim one, and a staff account is sent to the admin screens. The API checks the role on every
 * call; this only chooses what to show. A 401 from a call ends the session and shows the visitor part.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ClaimFacility } from "@/components/facility/ClaimFacility";
import { RegisterFacility } from "@/components/facility/RegisterFacility";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { useSignupOpen } from "@/hooks/useSignupOpen";
import { ApiError } from "@/lib/api/request";
import { homeAddressFor, LIST_YOUR_FACILITY_ADDRESS } from "@/lib/staff/roles";
import { clearStaffSession, readStaffSession } from "@/lib/staff/session";
import type { StaffSession } from "@/types/staff";

type Target = { id: number; name: string };

function Visitor() {
  const signupOpen = useSignupOpen();
  return (
    <>
      <p className="text-base text-ink">
        To list a facility or ask to manage one, you need an account. This lets our team know who is asking and keeps listings accurate.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {signupOpen ? (
          <Link href="/sign-up" className={buttonClasses("primary")}>Sign up</Link>
        ) : (
          <p className="text-base text-ink">Sign-up is not open yet.</p>
        )}
        <Link href={`/log-in?next=${LIST_YOUR_FACILITY_ADDRESS}`} className={buttonClasses("secondary")}>Log in</Link>
      </div>
    </>
  );
}

export function ListYourFacility() {
  const [session, setSession] = useState<StaffSession | null | undefined>(undefined); // undefined: not read yet
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    setSession(readStaffSession());
  }, []);

  const token = session?.token ?? null;
  const call = useCallback(
    async <T,>(operation: (token: string) => Promise<T>): Promise<T> => {
      if (token === null) throw new ApiError(401);
      try {
        // The newest token in the session: the idle sign-out renews it in the background (hooks/useIdleSignOut.ts).
        return await operation(readStaffSession()?.token ?? token);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearStaffSession();
          setSession(null);
        }
        throw error;
      }
    },
    [token],
  );

  const askToManage = useCallback((facility: Target) => {
    setTarget(facility);
    document.getElementById("claim-section")?.scrollIntoView?.({ behavior: "smooth" });
  }, []);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold text-forest">List your facility</h1>
      {session === undefined && <p className="text-base text-ink">Listing is free during our launch. Our team checks every listing before it goes live.</p>}
      {session === null && <Visitor />}
      {session && session.user.role !== "provider" && (
        <>
          <p className="text-base text-ink">This page is for facility owners. Use the admin screens to add or change listings.</p>
          <Link href={homeAddressFor(session.user.role)} className={buttonClasses("secondary")}>Go to the admin screens</Link>
        </>
      )}
      {session && session.user.role === "provider" && (
        <>
          <RegisterFacility call={call} onAskToManage={askToManage} />
          <ClaimFacility key={target?.id ?? "search"} call={call} initialTarget={target} />
        </>
      )}
    </section>
  );
}
