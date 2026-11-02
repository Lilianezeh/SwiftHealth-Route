"use client";

/** The buttons of the Staff portal page: Log in, and Sign up as staff while sign-up is open. Requirements: FR-48, FR-49, NFR-10.
 * UI spec 2.9c. The sign-up page opens with Staff already chosen, and the sentence under the buttons says that an admin must approve
 * every staff sign-up (the sign-up form says it again). The two buttons are the shared ones of AccountButtons.
 */
import { AccountButtons } from "@/components/account/AccountButtons";

const SIGN_UP_AS_STAFF = { label: "Sign up as staff", href: "/sign-up?as=staff" };

export function StaffPortalButtons() {
  return <AccountButtons signUp={SIGN_UP_AS_STAFF} note="An admin must approve every staff sign-up before it can be used." />;
}
