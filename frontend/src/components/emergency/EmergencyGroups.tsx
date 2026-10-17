/** The emergency contacts in their groups, and the 24-hour pharmacies. Requirements: FR-15, FR-16, FR-19, FR-25. UI spec 2.5, points 5 and 6.
 * A group with no contact is not drawn. Every card gets `sponsored: false` here, so the page can never show a sponsored tag (FR-19),
 * whatever an answer holds.
 */
import { EmergencyContactCard } from "@/components/emergency/EmergencyContactCard";
import { ListingCard } from "@/components/listings/ListingCard";
import type { EmergencyResponse, ListingSummary } from "@/types/api";

type EmergencyGroupsProps = { response: EmergencyResponse; hasPosition: boolean; now?: Date };

function neverSponsored(listing: ListingSummary): ListingSummary {
  return { ...listing, sponsored: false };
}

export function EmergencyGroups({ response, hasPosition, now }: EmergencyGroupsProps) {
  const groups = response.groups.filter((group) => group.contacts.length > 0);
  const pharmacies = response.pharmacies_24h.map(neverSponsored);

  if (groups.length === 0 && pharmacies.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">
        We are still adding verified contacts. In danger, call 112.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.category.slug} aria-labelledby={`group-${group.category.slug}`} className="flex flex-col gap-3">
          <h2 id={`group-${group.category.slug}`} className="text-2xl font-bold text-forest">
            {group.category.name}
          </h2>
          {group.contacts.map((contact) => (
            <EmergencyContactCard key={contact.id} contact={neverSponsored(contact)} now={now} />
          ))}
        </section>
      ))}
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
