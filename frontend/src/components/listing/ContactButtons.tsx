/** The main buttons of the listing page: Call (the primary number, the biggest button), WhatsApp beside it (only when that number is marked
 * as a WhatsApp number), then Directions. Requirements: US-02, US-03, FR-10, FR-47, NFR-10. Spec: specs/2026-10-13-listing-page/requirements.md D1.
 * The buttons wrap (each at least 8.5 rem wide), so on a 320 px screen WhatsApp drops under Call instead of being squeezed.
 */
import { WhatsAppButton } from "@/components/listing/WhatsAppButton";
import { CallButton } from "@/components/listings/CallButton";
import { DirectionsButton } from "@/components/listings/DirectionsButton";
import type { ListingDetail } from "@/types/api";

type ContactButtonsProps = { listing: ListingDetail };

export function ContactButtons({ listing }: ContactButtonsProps) {
  const primary = listing.phones.find((phone) => phone.is_primary) ?? listing.phones[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {primary && (
          <div className="min-w-[8.5rem] flex-1">
            <CallButton phone={primary.number} facilityName={listing.name} large />
          </div>
        )}
        {primary?.is_whatsapp && (
          <div className="min-w-[8.5rem] flex-1">
            <WhatsAppButton phone={primary.number} facilityName={listing.name} />
          </div>
        )}
      </div>
      <DirectionsButton latitude={listing.latitude} longitude={listing.longitude} facilityName={listing.name} />
    </div>
  );
}
