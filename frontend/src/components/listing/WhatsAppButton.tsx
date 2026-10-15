/** The WhatsApp button of the listing page, for a phone marked as a WhatsApp number. Requirements: FR-47, NFR-07, NFR-10.
 * Spec: specs/2026-10-13-listing-page/requirements.md D2 (the owner's Option A, 2026-10-13).
 *
 * A white button with a dark green border and the label "WhatsApp" in ink, with WhatsApp's own glyph (the owner's file, only scaled:
 * public/images/brand/whatsapp-glyph-72.png, shown at 24 px, no alt text because the word names the button). The link is
 * `https://wa.me/<234...>?text=<fixed message>`: the number and the message, nothing else (no position, no slug). It opens in a new tab.
 * A number that is not a Nigerian number gives no button.
 */
import { buttonClasses } from "@/components/ui/buttonStyles";
import { toWhatsAppNumber, whatsAppContactUrl } from "@/lib/formatters/whatsapp";

/** `large` makes it 56 px high like the large Call button beside it (the main row of the listing page). */
type WhatsAppButtonProps = { phone: string; facilityName: string; label?: string | null; large?: boolean };

export function WhatsAppButton({ phone, facilityName, label, large }: WhatsAppButtonProps) {
  const number = toWhatsAppNumber(phone);
  if (number === null) return null;

  return (
    <a
      href={whatsAppContactUrl(number)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`WhatsApp ${facilityName}${label ? ` (${label})` : ""} (opens in a new tab)`}
      className={buttonClasses("whatsapp", { large })}
    >
      {/* A plain <img>: it is a small file of ours, with fixed size; next/image would add client code for nothing. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/brand/whatsapp-glyph-72.png" alt="" width={24} height={24} className="h-6 w-6 shrink-0" />
      WhatsApp
    </a>
  );
}
