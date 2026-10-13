/** The other phone numbers of a listing, each with its own Call button (and a WhatsApp button when that number is marked).
 * Requirements: FR-10, FR-47, NFR-10. Spec: specs/2026-10-13-listing-page/requirements.md D1. Nothing at all when there is no other number.
 * Numbers are shown in the reading format, 0803 123 4567 (D12); the links stay international.
 */
import { WhatsAppButton } from "@/components/listing/WhatsAppButton";
import { CallButton } from "@/components/listings/CallButton";
import { formatPhoneForReading } from "@/lib/formatters/phone";
import type { PhoneRead } from "@/types/api";

type OtherPhonesProps = { phones: PhoneRead[]; facilityName: string };

export function OtherPhones({ phones, facilityName }: OtherPhonesProps) {
  if (phones.length === 0) return null;

  return (
    <section aria-labelledby="other-phones-heading">
      <h2 id="other-phones-heading" className="text-xl font-bold text-forest">
        Other phone numbers
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {phones.map((phone) => (
          <li key={phone.number} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-base font-semibold text-ink">{phone.label ?? "Other number"}</p>
            <p className="text-base text-ink-soft">{formatPhoneForReading(phone.number)}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <div className="min-w-[8.5rem] flex-1">
                <CallButton phone={phone.number} facilityName={facilityName} label={phone.label} />
              </div>
              {phone.is_whatsapp && (
                <div className="min-w-[8.5rem] flex-1">
                  <WhatsAppButton phone={phone.number} facilityName={facilityName} label={phone.label} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
