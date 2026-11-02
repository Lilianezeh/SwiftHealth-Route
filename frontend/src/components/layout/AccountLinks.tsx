"use client";

/** My account in the header bar, for someone who is logged in (a session in this tab). Requirements: FR-02, NFR-01, NFR-10.
 * UI spec, "Layout" (accounts phase 3b, decision D16; changed on 2026-11-02 by the owner: Log in and Sign up are not in the header any
 * more, so visitors do not think they need an account; they are on For facilities and the Staff portal). A visitor sees nothing here:
 * the first draw is empty, so a visitor's page does not change after it loads, and the header asks the API for nothing. It reads the
 * tab's session (hooks/useStaffUser.ts). From tablet width only: on a phone My account is in the Menu (MobileMenu).
 * `prefetch` is false on the home page, like every link there (R43).
 */
import Link from "next/link";

import { siteConfig } from "@/config/site";
import { useStaffUser } from "@/hooks/useStaffUser";
import { homeAddressFor } from "@/lib/staff/roles";

// The same classes as the other bar links (HeaderNavigation): hidden on a phone, shown from tablet width.
const BAR_LINK = "hidden min-h-12 items-center rounded-md px-2 text-base font-semibold hover:underline md:inline-flex lg:px-3";

type AccountLinksProps = { prefetch?: boolean };

export function AccountLinks({ prefetch }: AccountLinksProps) {
  const user = useStaffUser();
  if (user === null) return null;
  return (
    <Link href={homeAddressFor(user.role)} prefetch={prefetch} className={BAR_LINK}>
      {siteConfig.myAccountLabel}
    </Link>
  );
}
