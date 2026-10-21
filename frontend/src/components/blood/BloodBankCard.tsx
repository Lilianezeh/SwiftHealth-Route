/** One blood bank in the Find blood list. Requirements: US-15, FR-27, FR-08, FR-19, NFR-10. UI spec 2.6.
 * The groups it lists, the date they were confirmed, and the API's sentence that stock changes daily.
 */
import { BloodCardContact, BloodCardHeading, BloodCardStatus } from "@/components/blood/BloodCardParts";
import { formatNoticeDate } from "@/lib/formatters/dates";
import type { BloodBank } from "@/types/api";

type BloodBankCardProps = { bank: BloodBank; now?: Date };

export function BloodBankCard({ bank, now }: BloodBankCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
      <BloodCardHeading listing={bank} />

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

      <BloodCardStatus listing={bank} now={now} />
      <BloodCardContact listing={bank} />
    </article>
  );
}
