/** The friendly page for a listing that is not there. Requirements: FR-09, NFR-10. Spec: specs/2026-10-13-listing-page/requirements.md D8.
 * The API answers 404 for an unknown slug and for a listing that is not published (draft, hidden, re-check due all look the same to the
 * public). No red: a missing listing is not an emergency. Links have prefetch off, like the rest of the page.
 */
import Link from "next/link";

import { buttonClasses } from "@/components/ui/buttonStyles";

export function ListingNotFound() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-forest">Listing not found</h1>
      <p className="mt-3 text-lg text-ink">This listing isn&apos;t available. It may be under re-verification.</p>
      <div className="mt-6 flex flex-col gap-3 sm:max-w-xs">
        <Link href="/search" prefetch={false} className={buttonClasses("primary")}>
          Search for care
        </Link>
        <Link href="/" prefetch={false} className={buttonClasses("secondary")}>
          Go to the home page
        </Link>
      </div>
    </section>
  );
}
