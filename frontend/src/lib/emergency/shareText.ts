/** The words and links of Share emergency list and Share my location. Requirements: FR-18, US-09, FR-24, US-14, NFR-07.
 * UI spec 2.5 (points 3 and 4); decisions A7 and A8 in specs/2026-10-17-swiftrescue/requirements.md.
 *
 * The list text holds names and numbers only: no distance and no position. The location message holds the exact position the
 * visitor chose to send; it goes to the app they pick and is never stored or sent to our API.
 */
import { formatPhoneForReading } from "@/lib/formatters/phone";
import type { EmergencyResponse } from "@/types/api";

const TITLE = "SwiftRescue emergency numbers";
const CLOSING_LINE = "In danger, call 112.";

/** A plain-text list: 112 first, then each group that has a contact with a number, then the page address. */
export function buildEmergencyListText(response: EmergencyResponse | null, pageAddress: string): string {
  const lines = [TITLE, "National emergency number: 112"];
  for (const group of response?.groups ?? []) {
    const contacts = group.contacts.filter((contact) => contact.primary_phone !== null);
    if (contacts.length === 0) continue;
    lines.push("", group.category.name);
    for (const contact of contacts) {
      lines.push(`${contact.name}: ${formatPhoneForReading(contact.primary_phone ?? "")}`);
    }
  }
  lines.push("", CLOSING_LINE, pageAddress);
  return lines.join("\n");
}

/** The message for Share my location: a short call for help and a Google Maps link of the exact position. */
export function buildLocationMessage(position: { latitude: number; longitude: number }): string {
  return `I need help. My location: https://www.google.com/maps?q=${position.latitude},${position.longitude}`;
}

export function whatsappShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** `sms:?&body=` opens the messages app with the text on Android and on iPhone. */
export function smsShareLink(text: string): string {
  return `sms:?&body=${encodeURIComponent(text)}`;
}
