/** A short offer under the staff bar to anyone who has not switched on the authenticator app. Requirements: FR-58, NFR-10.
 * Spec: specs/2026-10-23-accounts-and-facility-ownership/ (owner's request: "offered at login to every account without it, and
 * admins are asked more firmly"). Nothing is forced. Plain colours, no red; the link is at least 48 px high.
 */
import Link from "next/link";

import type { StaffRole } from "@/types/staff";

type TwoFactorOfferProps = { role: StaffRole };

export function TwoFactorOffer({ role }: TwoFactorOfferProps) {
  const sentence =
    role === "admin"
      ? "Admins: please switch on the authenticator app. It is free, and it protects every listing."
      : "Switch on the authenticator app: free login codes, no SMS.";
  return (
    <div className="border-b border-line bg-pine-50">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 px-4 py-1">
        <p className="text-base text-ink">{sentence}</p>
        <Link
          href="/admin/security"
          prefetch={false}
          className="inline-flex min-h-12 items-center text-base font-semibold text-forest underline underline-offset-4"
        >
          Set it up
        </Link>
      </div>
    </div>
  );
}
