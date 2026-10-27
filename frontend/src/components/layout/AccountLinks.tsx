"use client";

/** Log in and Sign up in the header bar, or My account when a session exists in the tab. Requirements: FR-02, NFR-01, NFR-10.
 * UI spec, "Layout" (accounts phase 3b, decision D16). From tablet width only: on a phone these live in the Menu (MobileMenu).
 * The swap must move nothing: both versions are drawn in the same grid cell, and the one not in use is `invisible` and
 * `aria-hidden`, so the cell is as wide as the wider version and a screen reader hears only the real links. A visitor with no
 * session sees no change after the page loads (the first draw is always the logged-out one). It reads the tab's session
 * (hooks/useStaffUser.ts). "Sign up" is a link only while sign-up is open (`signup_open` of GET /meta, hooks/useSignupOpen.ts, which
 * shares one request with the Menu); until then, and when sign-up is closed or the call fails, its room is kept empty so nothing
 * moves. "Log in" never depends on it. `prefetch` is false on the home page, like every link there (R43).
 */
import Link from "next/link";

import { siteConfig } from "@/config/site";
import { useSignupOpen } from "@/hooks/useSignupOpen";
import { useStaffUser } from "@/hooks/useStaffUser";
import { homeAddressFor } from "@/lib/staff/roles";

// The same classes as the other bar links (HeaderNavigation): hidden on a phone, shown from tablet width.
const BAR_LINK = "hidden min-h-12 items-center rounded-md px-2 text-base font-semibold hover:underline md:inline-flex lg:px-3";
const SAME_CELL = "col-start-1 row-start-1 flex items-center";

type AccountLinksProps = { prefetch?: boolean };

export function AccountLinks({ prefetch }: AccountLinksProps) {
  const user = useStaffUser();
  const signUpIsOpen = useSignupOpen();
  const signedIn = user !== null;
  const accountAddress = user ? homeAddressFor(user.role) : siteConfig.logInLink.href; // never used while hidden

  return (
    <div className="hidden md:grid">
      <div className={`${SAME_CELL} ${signedIn ? "invisible" : ""}`} aria-hidden={signedIn ? true : undefined}>
        <Link href={siteConfig.logInLink.href} prefetch={prefetch} tabIndex={signedIn ? -1 : undefined} className={BAR_LINK}>
          {siteConfig.logInLink.label}
        </Link>
        {signUpIsOpen && !signedIn ? (
          <Link href={siteConfig.signUpLink.href} prefetch={prefetch} className={BAR_LINK}>
            {siteConfig.signUpLink.label}
          </Link>
        ) : (
          // Not a link and not read out, but drawn: the bar is as wide as when sign-up is open, so nothing moves when the answer
          // of GET /meta arrives, and no page-load shift is counted (owner, 2026-10-26: no Sign up link while sign-up is closed).
          <span aria-hidden="true" className={`${BAR_LINK} invisible`}>
            {siteConfig.signUpLink.label}
          </span>
        )}
      </div>
      <div className={`${SAME_CELL} justify-end ${signedIn ? "" : "invisible"}`} aria-hidden={signedIn ? undefined : true}>
        <Link href={accountAddress} prefetch={prefetch} tabIndex={signedIn ? undefined : -1} className={BAR_LINK}>
          {siteConfig.myAccountLabel}
        </Link>
      </div>
    </div>
  );
}
