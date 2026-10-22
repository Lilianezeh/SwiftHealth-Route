/** The emergency contacts in their groups, and a link to the blood pages after them. Requirements: FR-15, FR-16, FR-19, NFR-10.
 * UI spec 2.5, points 5 and 6; decisions K1 to K3 and K6 in specs/2026-10-22-swiftrescue-order/requirements.md (no pharmacies here:
 * FR-25 was removed on 2026-10-22).
 * Ambulance, Fire service, Police, Hospital emergency (24 hours) and Road accidents are always drawn first, even with no contact, and then
 * say "No contacts added yet. In danger, call 112." Every other group (Security and the three of 2026-10-22) is not drawn when it has no
 * contact. The groups, their headings and their order are in lib/emergency/groups.ts (specs/2026-10-22-swiftrescue-groups/). Ambulance and
 * Fire service each have a small lazy photo under the heading (GroupPhoto; specs/2026-10-22-home-photos/, part 6). Every card
 * gets `sponsored: false` here, so the page can never show a sponsored tag (FR-19), whatever an answer holds.
 */
import { BloodLinkCard } from "@/components/emergency/BloodLinkCard";
import { EmergencyContactCard } from "@/components/emergency/EmergencyContactCard";
import { GroupPhoto } from "@/components/emergency/GroupPhoto";
import { groupsToDraw, usedGroups } from "@/lib/emergency/groups";
import type { EmergencyResponse, ListingSummary } from "@/types/api";

type EmergencyGroupsProps = { response: EmergencyResponse; now?: Date };

const NO_CONTACTS = "No contacts added yet. In danger, call 112.";

function neverSponsored(listing: ListingSummary): ListingSummary {
  return { ...listing, sponsored: false };
}

export function EmergencyGroups({ response, now }: EmergencyGroupsProps) {
  const groups = groupsToDraw(response.groups);
  const nothingYet = usedGroups(response.groups).every((group) => group.contacts.length === 0);

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
          <GroupPhoto slug={group.category.slug} />
          {group.contacts.length === 0 ? (
            <p className="rounded-2xl border border-line bg-white p-4 text-base text-ink">{NO_CONTACTS}</p>
          ) : (
            group.contacts.map((contact) => <EmergencyContactCard key={contact.id} contact={neverSponsored(contact)} now={now} />)
          )}
        </section>
      ))}
      <BloodLinkCard />
    </div>
  );
}
