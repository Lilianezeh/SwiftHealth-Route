"use client";

/** The "Sign up" and "Log in" buttons of a page that is for one kind of person: For facilities (owners) and the Staff portal (staff).
 * Requirements: FR-48, FR-49, NFR-01, NFR-10. UI spec 2.9b and 2.9c; the owner's request of 2026-11-02: Log in and Sign up are not in
 * the header, so visitors do not think they need an account.
 *
 * Sign up is a link only while sign-up is open (`signup_open` of GET /meta, which `getMeta` keeps, so any number of these on a page
 * cost one request); a link to a page that cannot work is worse than none, so while it is closed, or the API cannot be reached, a
 * short sentence takes its place. While the answer is on its way the room is kept, so nothing moves. Log in never depends on it.
 * The sign-up link names the kind of account (`?as=owner`, `?as=staff`), so the sign-up page opens with that kind already chosen.
 * Nothing is stored in the browser.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { useMeta } from "@/hooks/useMeta";

type AccountButtonsProps = {
  signUp: { label: string; href: string };
  /** A sentence under the buttons, shown while sign-up is open (for example that an admin must approve). */
  note?: string;
  /** More buttons after these two, each on a row of its own from tablet width. */
  extra?: ReactNode;
};

export function AccountButtons({ signUp, note, extra }: AccountButtonsProps) {
  const { status, meta } = useMeta();
  const signupOpen = meta?.signup_open === true;
  return (
    <div className="flex flex-col gap-3">
      <div data-account-buttons className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {signupOpen ? (
          <Link href={signUp.href} prefetch={false} className={buttonClasses("primary")}>
            {signUp.label}
          </Link>
        ) : status === "loading" ? (
          <div aria-hidden="true" className="min-h-[50px]" />
        ) : (
          <p className="flex min-h-[50px] items-center text-base text-ink">Sign-up is not open yet.</p>
        )}
        <Link href="/log-in" prefetch={false} className={buttonClasses("secondary")}>
          Log in
        </Link>
        {extra}
      </div>
      {signupOpen && note && <p className="text-base text-ink">{note}</p>}
    </div>
  );
}
