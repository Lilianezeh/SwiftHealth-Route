"use client";

/** The provider's dashboard: my listing, its status, when it was last verified, whether it is featured. Requirements: FR-43, FR-44,
 * NFR-10. UI spec 4.1 and "Phase 12 details".
 */
import Link from "next/link";

import { QueueStatus } from "@/components/admin/QueueStatus";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { MyFacilities } from "@/components/provider/MyFacilities";
import { MyPayments } from "@/components/provider/MyPayments";
import { NoLinkedFacility } from "@/components/provider/NoLinkedFacility";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { useProviderListing } from "@/hooks/useProviderListing";
import { formatNoticeDate } from "@/lib/formatters/dates";
import { whyNotFeatured } from "@/lib/staff/featured";

export function ProviderHome() {
  const { status, listing, retry } = useProviderListing();

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold text-forest">My facility</h1>

      <QueueStatus status={status === "none" ? "ready" : status} onRetry={retry} />
      {status === "none" && <NoLinkedFacility />}
      <MyFacilities />
      <MyPayments />

      {listing && (
        <article className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <h2 className="text-xl font-bold text-forest">{listing.name}</h2>
          <p className="text-base text-ink-soft">
            {listing.category.name} · {listing.area}
          </p>
          <div>
            <StatusBadge status={listing.status} />
          </div>
          <p className="text-base text-ink">
            {listing.last_verified_at ? `Last verified ${formatNoticeDate(listing.last_verified_at)}` : "Not yet verified"}
          </p>
          <p className="text-base font-semibold text-ink">
            {listing.featured_until ? `Featured until ${formatNoticeDate(listing.featured_until)}` : "Not featured"}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/provider/edit" prefetch={false} className={buttonClasses("secondary")}>
              Edit my facility
            </Link>
            {whyNotFeatured(listing) === null ? (
              <Link href="/provider/featured" prefetch={false} className={buttonClasses("primary")}>
                Get featured
              </Link>
            ) : (
              <p className="text-base text-ink">{whyNotFeatured(listing)}</p>
            )}
          </div>
        </article>
      )}
    </section>
  );
}
