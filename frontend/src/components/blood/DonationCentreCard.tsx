/** One donation centre in the Donate blood list. Requirements: US-16, FR-28, FR-08, FR-19, NFR-10. UI spec 2.7.
 * The week of donation hours sits in a closed "Donation hours" disclosure, so a long list stays short on a small phone.
 * (HoursTable of the listing page is not reused: it has a fixed id, and a page lists many centres.)
 */
import { BloodCardContact, BloodCardHeading, BloodCardStatus } from "@/components/blood/BloodCardParts";
import { hoursRows } from "@/lib/formatters/hours";
import type { DonationCentre } from "@/types/api";

type DonationCentreCardProps = { centre: DonationCentre; now?: Date };

export function DonationCentreCard({ centre, now = new Date() }: DonationCentreCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <BloodCardHeading listing={centre} />
      <BloodCardStatus listing={centre} now={now} />

      {centre.is_24_hours ? (
        <p className="text-base text-ink">Open 24 hours, every day</p>
      ) : (
        <details className="rounded-xl border border-line px-4">
          <summary className="flex min-h-12 cursor-pointer items-center text-base font-semibold text-forest">
            Donation hours
          </summary>
          <table className="mb-3 w-full text-left text-base">
            <tbody>
              {hoursRows(centre.donation_hours, now).map((row) => (
                <tr
                  key={row.dayName}
                  aria-current={row.isToday ? "date" : undefined}
                  className={`border-b border-line text-ink ${row.isToday ? "font-bold" : ""}`}
                >
                  <th scope="row" className="py-2 pr-4 font-[inherit]">
                    {row.dayName}
                    {row.isToday && <span className="ml-2 rounded-full bg-pine-100 px-2 py-0.5 text-forest">Today</span>}
                  </th>
                  <td className="py-2">{row.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <BloodCardContact listing={centre} />
    </article>
  );
}
