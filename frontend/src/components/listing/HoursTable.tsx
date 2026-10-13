/** The opening hours of the listing page: seven rows in 12-hour time, today marked with the word "Today". Requirements: FR-09, US-06, NFR-10.
 * Spec: specs/2026-10-13-listing-page/requirements.md D6. A 24-hour listing says "Open 24 hours, every day" instead of the table.
 * Today is the day in Lagos time, not the device's (lib/formatters/hours.ts). `now` is only for tests.
 */
import { hoursRows } from "@/lib/formatters/hours";
import type { OpeningHoursRead } from "@/types/api";

type HoursTableProps = { openingHours: OpeningHoursRead[]; is24Hours: boolean; now?: Date };

export function HoursTable({ openingHours, is24Hours, now = new Date() }: HoursTableProps) {
  return (
    <section aria-labelledby="hours-heading">
      <h2 id="hours-heading" className="text-xl font-bold text-forest">
        Opening hours
      </h2>
      {is24Hours ? (
        <p className="mt-3 text-base text-ink">Open 24 hours, every day</p>
      ) : (
        <table className="mt-3 w-full text-left text-base">
          <tbody>
            {hoursRows(openingHours, now).map((row) => (
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
      )}
    </section>
  );
}
