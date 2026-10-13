"use client";

/** The listing page, loaded in the browser like /search. Requirements: US-02, US-03, US-06, US-07, FR-09 to FR-13, FR-22, FR-47, NFR-01, NFR-07, NFR-10.
 * Spec: specs/2026-10-13-listing-page/requirements.md; UI spec 2.4. The free API can take a minute to wake and the hosting gives up on a
 * server page after about 30 seconds, so the page shows a skeleton, then "The service is waking up", then Retry (hooks/useListing.ts).
 * Order: the reported notice, the name and badges, the contact buttons, the address and photo, the other numbers, the hours, the services
 * and fees, share and report, the disclaimer. No map, no position, no chart: this page stays small.
 */
import Link from "next/link";
import { useEffect } from "react";

import { ContactButtons } from "@/components/listing/ContactButtons";
import { EntrancePhoto } from "@/components/listing/EntrancePhoto";
import { HoursTable } from "@/components/listing/HoursTable";
import { ListingNotFound } from "@/components/listing/ListingNotFound";
import { ListingSkeleton } from "@/components/listing/ListingSkeleton";
import { OtherPhones } from "@/components/listing/OtherPhones";
import { ReportedNotice } from "@/components/listing/ReportedNotice";
import { ServicesFees } from "@/components/listing/ServicesFees";
import { ShareButtons } from "@/components/listing/ShareButtons";
import { HoursNote } from "@/components/listings/HoursNote";
import { OpenNowBadge } from "@/components/listings/OpenNowBadge";
import { VerifiedDate } from "@/components/listings/VerifiedDate";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { brand } from "@/config/brand";
import { useListing } from "@/hooks/useListing";

type ListingDetailViewProps = { slug: string };

export function ListingDetailView({ slug }: ListingDetailViewProps) {
  const { status, listing, retry } = useListing(slug);

  useEffect(() => {
    if (status === "ready" && listing) document.title = `${listing.name} | ${brand.name}`;
    if (status === "not-found") document.title = `Listing not found | ${brand.name}`;
  }, [status, listing]);

  if (status === "not-found") return <ListingNotFound />;

  if (status === "loading" || status === "slow") {
    return (
      <div aria-busy="true" className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        {/* The live region is always there, so a screen reader announces the sentence when it is filled in. */}
        <p role="status" aria-live="polite" className="text-base text-ink">
          {status === "slow" ? "The service is waking up. This can take up to a minute." : ""}
        </p>
        <ListingSkeleton />
      </div>
    );
  }

  if (status === "error" || !listing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-base text-ink">We couldn&apos;t load this. Check your connection and try again.</p>
          <button type="button" onClick={retry} className={buttonClasses("primary")}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const otherPhones = listing.phones.filter((phone) => !phone.is_primary);

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      {listing.recently_reported_not_working && <ReportedNotice />}

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-forest">{listing.name}</h1>
        <p className="text-base text-ink-soft">
          {listing.category.name} · {listing.area}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <OpenNowBadge isOpenNow={listing.is_open_now} is24Hours={listing.is_24_hours} />
        </div>
        <HoursNote note={listing.hours_note} />
        <VerifiedDate lastVerifiedAt={listing.last_verified_at} verificationDue={listing.verification_due} />
        {listing.description && <p className="text-base text-ink">{listing.description}</p>}
      </header>

      <ContactButtons listing={listing} />

      <section aria-labelledby="address-heading">
        <h2 id="address-heading" className="text-xl font-bold text-forest">
          Address
        </h2>
        <p className="mt-2 text-base text-ink">{listing.address}</p>
        {listing.landmark && <p className="text-base text-ink-soft">Landmark: {listing.landmark}</p>}
      </section>

      <EntrancePhoto url={listing.entrance_photo_url} facilityName={listing.name} />
      <OtherPhones phones={otherPhones} facilityName={listing.name} />
      <HoursTable openingHours={listing.opening_hours} is24Hours={listing.is_24_hours} />
      <ServicesFees services={listing.services} />

      <section aria-labelledby="share-heading" className="flex flex-col gap-3">
        <h2 id="share-heading" className="text-xl font-bold text-forest">
          Share this listing
        </h2>
        <ShareButtons slug={listing.slug} facilityName={listing.name} />
        <Link
          href={`/report/${listing.id}`}
          prefetch={false}
          className="inline-flex min-h-12 items-center text-base font-semibold text-forest underline underline-offset-4"
        >
          Report a problem with this listing
        </Link>
      </section>

      <p className="border-t border-line pt-4 text-base text-ink-soft">{listing.disclaimer}</p>
    </article>
  );
}
