/** Find blood with no network: the notice with the date, the saved blood banks that match the chosen group, and Try again.
 * Requirements: US-15, FR-27, NFR-03, NFR-10. UI spec 2.6, "Offline"; decisions N3 to N5 in specs/2026-10-22-blood-offline/requirements.md.
 * The group chips work on the saved list, with no request. Nothing here asks the browser for the position.
 */
import { SavedBloodBankCard } from "@/components/blood/SavedBloodBankCard";
import { buttonClasses } from "@/components/ui/buttonStyles";
import type { BloodCopy } from "@/lib/blood/offlineCopy";
import { formatNoticeDate } from "@/lib/formatters/dates";

type OfflineBloodBanksProps = { copy: BloodCopy; bloodGroup: string | null; onTryAgain: () => void };

export function OfflineBloodBanks({ copy, bloodGroup, onTryAgain }: OfflineBloodBanksProps) {
  const banks = bloodGroup === null ? copy.banks : copy.banks.filter((bank) => bank.blood_groups.includes(bloodGroup));

  return (
    <>
      <p
        role="status"
        className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink"
      >{`Offline — showing saved blood banks from ${formatNoticeDate(copy.savedAt)}`}</p>
      <button type="button" onClick={onTryAgain} className={buttonClasses("secondary")}>
        Try again
      </button>

      {banks.length > 0 ? (
        <>
          <p className="text-base font-semibold text-ink">
            {banks.length} saved {banks.length === 1 ? "blood bank" : "blood banks"}, A to Z
          </p>
          <h2 className="sr-only">Saved blood banks</h2>
          <div className="flex flex-col gap-4">
            {banks.map((bank) => (
              <SavedBloodBankCard key={bank.id} bank={bank} />
            ))}
          </div>
        </>
      ) : (
        <p className="rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">
          {`No saved blood bank lists ${bloodGroup}. Connect to see the latest list. In an emergency, call 112.`}
        </p>
      )}
    </>
  );
}
