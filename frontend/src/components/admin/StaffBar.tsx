"use client";

/** The bar under the header on every staff page: who is logged in, the links the role can use, and Log out.
 * Requirements: FR-30, FR-42, NFR-10. UI spec "Phase 10 details". Every link and button is at least 48 px high.
 */
import Link from "next/link";

import { canOpen } from "@/lib/staff/roles";
import type { StaffRole, StaffUser } from "@/types/staff";

const ROLE_LABELS: Record<StaffRole, string> = { verifier: "Verifier", editor: "Editor", admin: "Admin", provider: "Provider" };

const LINK_CLASSES = "inline-flex min-h-12 items-center text-base font-semibold text-forest underline underline-offset-4";

type StaffBarProps = { user: StaffUser; onLogout: () => void };

export function StaffBar({ user, onLogout }: StaffBarProps) {
  return (
    <nav aria-label="Staff" className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
        <p className="text-base text-ink">
          <span className="font-semibold">{user.name}</span> <span className="text-ink-soft">·</span>{" "}
          <span className="text-ink-soft">{ROLE_LABELS[user.role]}</span>
        </p>
        {canOpen(user.role, "listings") && (
          <Link href="/admin/listings" prefetch={false} className={LINK_CLASSES}>
            Listings
          </Link>
        )}
        {canOpen(user.role, "staff") && (
          <Link href="/admin/staff" prefetch={false} className={LINK_CLASSES}>
            Staff
          </Link>
        )}
        <button type="button" onClick={onLogout} className={`${LINK_CLASSES} ml-auto`}>
          Log out
        </button>
      </div>
    </nav>
  );
}
