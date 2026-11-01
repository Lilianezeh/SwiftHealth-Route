"use client";

/** Every field of an owner's request, for staff to read before they approve it. Requirements: US-17, FR-50, NFR-07, NFR-10.
 * Spec: specs/2026-11-01-owner-form-location-photo/; UI spec 3.10. The category, address, landmark, description, the email (for staff
 * only), the opening hours of each day ("Not given" when the owner left a day blank, which is not the same as "Closed"), the services,
 * the entrance photo (an https address only, lazy) and the pin on a map with its coordinates. When the owner did not place the pin,
 * it says so and links to the listing editor, where staff move it. The map is Leaflet: loaded by next/dynamic, in the browser only.
 */
import dynamic from "next/dynamic";
import Link from "next/link";

import { formatTime12 } from "@/lib/formatters/hours";
import { DAY_NAMES } from "@/lib/staff/listingForm";
import type { OwnerRequest } from "@/types/staff";

const FacilityMap = dynamic(() => import("@/components/map/FacilityMap").then((module) => module.FacilityMap), {
  ssr: false,
  loading: () => <p className="text-base text-ink-soft">Loading the map…</p>,
});

type Listing = OwnerRequest["listing"];

function hoursText(listing: Listing, day: number): string {
  const entry = listing.opening_hours.find((hours) => hours.day_of_week === day);
  if (!entry) return "Not given";
  if (entry.is_closed || !entry.opens_at || !entry.closes_at) return "Closed";
  const pastMidnight = entry.closes_at < entry.opens_at;
  return `${formatTime12(entry.opens_at)} – ${formatTime12(entry.closes_at)}${pastMidnight ? " (next day)" : ""}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-base font-semibold text-ink">{label}</dt>
      <dd className="text-base text-ink">{children}</dd>
    </div>
  );
}

export function OwnerRequestDetails({ listing }: { listing: Listing }) {
  const hasHttpsPhoto = listing.entrance_photo_url !== null && listing.entrance_photo_url.startsWith("https://");
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <p className="text-base font-bold text-forest">What the owner wrote</p>
      <dl className="flex flex-col gap-2">
        <Row label="Category">{listing.category.name}</Row>
        <Row label="Address">{listing.address}</Row>
        {listing.landmark && <Row label="Landmark">{listing.landmark}</Row>}
        {listing.description && <Row label="Description">{listing.description}</Row>}
        <Row label="Email">
          {listing.email ? (
            <>
              {listing.email}
              <span className="block text-base text-ink-soft">Only our team sees this email. It is never shown to the public.</span>
            </>
          ) : (
            "No email."
          )}
        </Row>
        <Row label="Opening hours">
          {listing.is_24_hours ? (
            "Open 24 hours"
          ) : (
            <div className="flex flex-col">
              {DAY_NAMES.map((dayName, day) => (
                <div key={dayName} className="flex justify-between gap-3">
                  <span>{dayName}</span>
                  <span>{hoursText(listing, day)}</span>
                </div>
              ))}
            </div>
          )}
        </Row>
        <Row label="Services">{listing.services.length > 0 ? listing.services.join(", ") : "None chosen."}</Row>
      </dl>

      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-ink">Entrance photo</p>
        {hasHttpsPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- a Cloudinary address the API checked; a fixed size, lazy, no optimiser
          <img src={listing.entrance_photo_url as string} alt="Entrance photo from the owner" loading="lazy" className="h-48 w-full max-w-sm rounded-2xl border border-line object-cover" />
        ) : (
          <p className="text-base text-ink">No entrance photo.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-ink">Pin</p>
        {listing.map_pin_is_default && (
          <p className="rounded-2xl border border-line bg-amber-wash p-3 text-base font-semibold text-amber-ink">
            The owner did not place the pin. It is still the default place, so move it to the facility before you approve.
          </p>
        )}
        <FacilityMap name={listing.name} latitude={listing.latitude} longitude={listing.longitude} />
        <Link href={`/admin/listings/${listing.id}`} prefetch={false} className="inline-flex min-h-12 items-center text-base font-semibold text-forest underline underline-offset-4">
          Open the listing editor
        </Link>
      </div>
    </div>
  );
}
