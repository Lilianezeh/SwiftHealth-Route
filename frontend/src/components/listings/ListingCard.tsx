/** One result in a list. Requirements: US-01, FR-06, FR-08, NFR-10. UI spec: components table, ListingCard.
 * All text is rendered as text (React escapes it), never as HTML.
 */
import { MapPin } from "lucide-react";
import Link from "next/link";

import { CallButton } from "@/components/listings/CallButton";
import { DirectionsButton } from "@/components/listings/DirectionsButton";
import { HoursNote } from "@/components/listings/HoursNote";
import { OpenNowBadge } from "@/components/listings/OpenNowBadge";
import { VerifiedDate } from "@/components/listings/VerifiedDate";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { formatDistance } from "@/lib/formatters/distance";
import type { ListingSummary } from "@/types/api";

type ListingCardProps = { listing: ListingSummary; now?: Date };

export function ListingCard({ listing, now }: ListingCardProps) {
  const distance = formatDistance(listing.distance_km);
  const eyebrow = distance ? `${listing.category.name} · ${distance}` : listing.category.name;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div>
        <p className="text-base font-semibold text-ink-soft">{eyebrow}</p>
        <h3 className="text-lg font-bold leading-snug text-forest">
          <Link href={`/listing/${listing.slug}`} className="inline-flex min-h-12 items-center underline">
            {listing.name}
          </Link>
        </h3>
        {listing.branch_of && (
          <p className="text-base text-ink-soft">
            Branch of{" "}
            <Link href={`/listing/${listing.branch_of.slug}`} className="inline-flex min-h-12 items-center underline">
              {listing.branch_of.name}
            </Link>
          </p>
        )}
        {listing.sponsored && (
          <span className="mt-1 inline-flex rounded-full bg-amber px-3 py-1 text-base font-semibold text-on-amber">
            Sponsored
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <VerifiedDate
          lastVerifiedAt={listing.last_verified_at}
          verificationDue={listing.verification_due}
          now={now}
        />
        <OpenNowBadge isOpenNow={listing.is_open_now} is24Hours={listing.is_24_hours} />
      </div>

      <div className="flex gap-2 border-t border-line pt-3 text-base">
        <DecorativeIcon icon={MapPin} className="mt-1 h-5 w-5 text-ink-soft" />
        <div>
          <p className="text-ink">{listing.address}</p>
          <p className="text-ink-soft">{listing.area}</p>
        </div>
      </div>

      <HoursNote note={listing.hours_note} />

      <div className="grid grid-cols-2 gap-3">
        {listing.primary_phone && <CallButton phone={listing.primary_phone} facilityName={listing.name} />}
        <DirectionsButton
          latitude={listing.latitude}
          longitude={listing.longitude}
          facilityName={listing.name}
        />
      </div>
    </article>
  );
}
