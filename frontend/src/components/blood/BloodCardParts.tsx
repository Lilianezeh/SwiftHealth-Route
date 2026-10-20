/** The parts the blood bank card and the donation centre card share: the heading line, the verified and open
 * badges, the address, the hours note, Call and Directions, and the report link. Requirements: FR-06, FR-08, FR-10,
 * FR-19, NFR-10. All text is rendered as text. Neither blood card ever shows "Sponsored" (FR-19).
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

export function BloodCardHeading({ listing }: { listing: ListingSummary }) {
  const distance = formatDistance(listing.distance_km);
  const eyebrow = [listing.category.name, listing.area, distance].filter(Boolean).join(" · ");

  return (
    <div>
      <p className="text-base font-semibold text-ink-soft">{eyebrow}</p>
      <h3 className="text-lg font-bold leading-snug text-forest">
        <Link href={`/listing/${listing.slug}`} prefetch={false} className="inline-flex min-h-12 items-center underline">
          {listing.name}
        </Link>
      </h3>
    </div>
  );
}

export function BloodCardStatus({ listing, now }: { listing: ListingSummary; now?: Date }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <VerifiedDate lastVerifiedAt={listing.last_verified_at} verificationDue={listing.verification_due} now={now} />
      <OpenNowBadge isOpenNow={listing.is_open_now} is24Hours={listing.is_24_hours} />
    </div>
  );
}

export function BloodCardContact({ listing }: { listing: ListingSummary }) {
  return (
    <>
      <div className="flex gap-2 border-t border-line pt-3 text-base">
        <DecorativeIcon icon={MapPin} className="mt-1 h-5 w-5 text-ink-soft" />
        <p className="text-ink">{listing.address}</p>
      </div>
      <HoursNote note={listing.hours_note} />
      <div className="grid grid-cols-2 gap-3">
        {listing.primary_phone && <CallButton phone={listing.primary_phone} facilityName={listing.name} />}
        <DirectionsButton latitude={listing.latitude} longitude={listing.longitude} facilityName={listing.name} />
      </div>
      <Link
        href={`/report/${listing.slug}`}
        prefetch={false}
        aria-label={`Report a problem with ${listing.name}`}
        className="inline-flex min-h-12 items-center text-base font-semibold text-forest underline underline-offset-4"
      >
        Report a problem
      </Link>
    </>
  );
}
