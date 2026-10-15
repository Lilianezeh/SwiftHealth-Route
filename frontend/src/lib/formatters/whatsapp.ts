/** The WhatsApp contact link and the share links of the listing page. Requirements: FR-47, FR-12, NFR-07.
 * Spec: specs/2026-10-13-listing-page/requirements.md D2 and D4.
 *
 * Format of a click-to-chat link, from WhatsApp's help page "How to use click to chat" (https://whatsapp.com/faq/en/general/26000030):
 * `https://wa.me/<number>` where the number is a full phone number in international format, with zeroes, brackets and dashes left out
 * (and no leading 0), and `https://wa.me/<number>?text=<urlencodedtext>` for a pre-filled message. A link with no number
 * (`https://wa.me/?text=...`) opens WhatsApp's own list of contacts to choose from.
 *
 * Privacy (NFR-07): nothing built here holds a position. The contact message is a fixed sentence; the share link is the page's own
 * address only.
 */
import { brand } from "@/config/brand";
import { toE164 } from "@/lib/formatters/phone";

/** The pre-filled message of the WhatsApp button. Exactly this sentence, with the name from config/brand.ts. */
export const WHATSAPP_MESSAGE = `Hello, I found you on ${brand.name}.`;

/** A Nigerian number as wa.me wants it: "234" and ten digits, no plus, no spaces, no leading zero. Null when it is not one. */
export function toWhatsAppNumber(raw: string): string | null {
  const international = toE164(raw);
  return international === null ? null : international.slice(1); // "+2348030000000" -> "2348030000000"
}

/** The link of the WhatsApp button: the number and the fixed message, nothing else. */
export function whatsAppContactUrl(number: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
}

/** The link a visitor shares: the site address and `/listing/<slug>`, never a query, a hash or a position. */
export function shareLink(slug: string, origin: string): string {
  return `${new URL(origin).origin}/listing/${encodeURIComponent(slug)}`;
}

/** Opens WhatsApp with no number (WhatsApp asks who to send it to) and the message "<name> on SwiftHealth Route: <link>". */
export function whatsAppShareUrl(facilityName: string, link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${facilityName} on ${brand.name}: ${link}`)}`;
}
