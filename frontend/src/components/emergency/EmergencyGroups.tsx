/** The emergency contacts in their groups, a link to the blood pages, and the 24-hour pharmacies last. Requirements: FR-15, FR-16, FR-19,
 * FR-25, NFR-10. UI spec 2.5, points 5 to 7; decisions K1 to K3 in specs/2026-10-22-swiftrescue-order/requirements.md.
 * Ambulance and Fire are always drawn first, even with no contact, and then say "No contacts added yet. In danger, call 112." Every
 * other group is not drawn when it has no contact. Every card gets `sponsored: false` here, so the page can never show a sponsored tag
 * (FR-19), whatever an answer holds.
 */
import { BloodLinkCard } from "@/components/emergency/BloodLinkCard";
import { EmergencyContactCard } from "@/components/emergency/EmergencyContactCard";
import { ListingCard } from "@/components/listings/ListingCard";
import type { EmergencyGroup, EmergencyResponse, ListingSummary } from "@/types/api";

type EmergencyGroupsProps = { response: EmergencyResponse; hasPosition: boolean; now?: Date };

// Always shown, first, in this order. The names are the page's own, for an answer (an old saved copy) that lacks the group.
const ALWAYS_SHOWN = [
  { slug: "ambulance", name: "Ambulance" },
  { slug: "fire", name: "Fire" },
] as const;
const NO_CONTACTS = "No contacts added yet. In danger, call 112.";

function neverSponsored(listing: ListingSummary): ListingSummary {
  return { ...listing, sponsored: false };
}

/** Ambulance and Fire first (empty or not), then the other groups that have a contact, in the order of the answer. */
function groupsToDraw(response: EmergencyResponse): EmergencyGroup[] {
  const alwaysSlugs: string[] = ALWAYS_SHOWN.map((group) => group.slug);
  const first = ALWAYS_SHOWN.map(
    (always) =>
      response.groups.find((group) => group.category.slug === always.slug) ?? {
        category: { slug: always.slug, name: always.name },
        contacts: [],
      },
  );
  const others = response.groups.filter((group) => !alwaysSlugs.includes(group.category.slug) && group.contacts.length > 0);
  return [...first, ...others];
}

export function EmergencyGroups({ response, hasPosition, now }: EmergencyGroupsProps) {
  const groups = groupsToDraw(response);
  const pharmacies = response.pharmacies_24h.map(neverSponsored);
  const nothingYet = response.groups.every((group) => group.contacts.length === 0) && pharmacies.length === 0;

  return (
    <div className="flex flex-col gap-8">
      {nothingYet && (
        <p className="rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">
          We are still adding verified contacts. In danger, call 112.
        </p>
      )}
      {groups.map((group) => (
        <section key={group.category.slug} aria-labelledby={`group-${group.category.slug}`} className="flex flex-col gap-3">
          <h2 id={`group-${group.category.slug}`} className="text-2xl font-bold text-forest">
            {group.category.name}
          </h2>
          {group.contacts.length === 0 ? (
            <p className="rounded-2xl border border-line bg-white p-4 text-base text-ink">{NO_CONTACTS}</p>
          ) : (
            group.contacts.map((contact) => <EmergencyContactCard key={contact.id} contact={neverSponsored(contact)} now={now} />)
          )}
        </section>
      ))}
      <BloodLinkCard />
      {pharmacies.length > 0 && (
        <section aria-labelledby="pharmacies-24h-heading" className="flex flex-col gap-3">
          <h2 id="pharmacies-24h-heading" className="text-2xl font-bold text-forest">
            {hasPosition ? "24-hour pharmacies nearby" : "24-hour pharmacies"}
          </h2>
          {pharmacies.map((pharmacy) => (
            <ListingCard key={pharmacy.id} listing={pharmacy} now={now} />
          ))}
        </section>
      )}
    </div>
  );
}
