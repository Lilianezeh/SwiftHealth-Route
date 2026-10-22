/** One saved blood bank, shown when there is no network. Requirements: US-15, FR-27, NFR-03, NFR-10. UI spec 2.6, "Offline"; decisions N3 and N4
 * in specs/2026-10-22-blood-offline/requirements.md. It is the online card without what would be out of date or needs the network: no
 * open or closed badge, no hours line, no distance, no link to the listing page and no "Report a problem". The name is plain text.
 * Call works (a tel: link) and Directions stays a link.
 */
import { MapPin } from "lucide-react";

import { CallButton } from "@/components/listings/CallButton";
import { DirectionsButton } from "@/components/listings/DirectionsButton";
import { VerifiedDate } from "@/components/listings/VerifiedDate";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { formatNoticeDate } from "@/lib/formatters/dates";
import type { SavedBloodBank } from "@/lib/blood/offlineCopy";

type SavedBloodBankCardProps = { bank: SavedBloodBank; now?: Date };

export function SavedBloodBankCard({ bank, now }: SavedBloodBankCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
      <div>
        <p className="text-base font-semibold text-ink-soft">{`${bank.category.name} · ${bank.area}`}</p>
        <h3 className="text-lg font-bold leading-snug text-forest">{bank.name}</h3>
      </div>

      <div className="flex flex-col gap-2">
        {bank.blood_groups.length > 0 ? (
          <ul aria-label="Blood groups" className="flex flex-wrap gap-2">
            {bank.blood_groups.map((group) => (
              <li key={group} className="rounded-full bg-pine-100 px-3 py-1 text-base font-bold text-forest">
                {group}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-ink">No groups listed</p>
        )}
        {bank.blood_groups_confirmed_at && (
          <p className="text-base text-ink-soft">{`Confirmed ${formatNoticeDate(bank.blood_groups_confirmed_at)}`}</p>
        )}
        <p className="text-base text-ink">{bank.stock_note}</p>
      </div>

      <div>
        <VerifiedDate lastVerifiedAt={bank.last_verified_at} verificationDue={bank.verification_due} now={now} />
      </div>

      <div className="flex gap-2 border-t border-line pt-3 text-base">
        <DecorativeIcon icon={MapPin} className="mt-1 h-5 w-5 text-ink-soft" />
        <p className="text-ink">{bank.address}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {bank.primary_phone && <CallButton phone={bank.primary_phone} facilityName={bank.name} />}
        <DirectionsButton latitude={bank.latitude} longitude={bank.longitude} facilityName={bank.name} />
      </div>
    </article>
  );
}
