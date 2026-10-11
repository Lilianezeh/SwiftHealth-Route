/** The content of a pin's popup on the results map. Requirements: FR-07, US-01, US-03, NFR-10. UI spec, the `MapPopup` row.
 * Name, category and distance, the open badge, then Call and Directions: the same components as the cards use.
 * All text is rendered as text (React escapes it), never as HTML. It is drawn into the popup by ResultsMap.
 */
import Link from "next/link";

import { CallButton } from "@/components/listings/CallButton";
import { DirectionsButton } from "@/components/listings/DirectionsButton";
import { OpenNowBadge } from "@/components/listings/OpenNowBadge";
import { formatDistance } from "@/lib/formatters/distance";
import type { ListingSummary } from "@/types/api";

type MapPopupProps = { listing: ListingSummary };

export function MapPopup({ listing }: MapPopupProps) {
  const distance = formatDistance(listing.distance_km);
  const eyebrow = distance ? `${listing.category.name} · ${distance}` : listing.category.name;

  return (
    // `map-popup` keeps Leaflet's link colour off the buttons (see styles/map.css). The right padding leaves room for the
    // 48 px close button of the popup.
    <div className="map-popup flex flex-col gap-2">
      <div className="pr-10">
        <p className="text-base font-semibold text-ink-soft">{eyebrow}</p>
        <p className="text-lg font-bold leading-snug text-forest">
          <Link href={`/listing/${listing.slug}`} className="inline-flex min-h-12 items-center underline">
            {listing.name}
          </Link>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <OpenNowBadge isOpenNow={listing.is_open_now} is24Hours={listing.is_24_hours} />
        {listing.sponsored && (
          <span className="inline-flex rounded-full bg-amber px-3 py-1 text-base font-semibold text-ink">Sponsored</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {listing.primary_phone && <CallButton phone={listing.primary_phone} facilityName={listing.name} />}
        <DirectionsButton latitude={listing.latitude} longitude={listing.longitude} facilityName={listing.name} />
      </div>
    </div>
  );
}
