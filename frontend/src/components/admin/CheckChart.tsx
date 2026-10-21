"use client";

/** The bar chart of the dashboard: checks passed and failed for each of the last 30 days. Requirements: FR-34, NFR-10.
 * UI spec 3.2 and "Phase 11 details". The colours (green for passed, red for failed) are over 3:1 on white, and the two series
 * are named in words under the chart and again in the table, so colour is never the only difference. The chart itself is one
 * picture for a screen reader (`role="img"` with a description); the same numbers are in the table below it.
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { formatNoticeDate } from "@/lib/formatters/dates";
import type { DashboardStats } from "@/types/staff";

// The design tokens (src/styles/globals.css), so no colour is written by hand here.
const PASSED_COLOUR = "var(--color-open)";
const FAILED_COLOUR = "var(--color-emergency)";
const CHART_HEIGHT = 240;

type CheckChartProps = { days: DashboardStats["checks_last_30_days"] };

export function CheckChart({ days }: CheckChartProps) {
  // The axis shows the day of the month; the table has the whole date.
  const bars = days.map((day) => ({ ...day, dayOfMonth: String(Number(day.date.slice(8))) }));

  return (
    <section aria-labelledby="checks-heading" className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
      <h2 id="checks-heading" className="text-xl font-bold text-forest">
        Checks in the last 30 days
      </h2>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-base text-ink">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 rounded-sm bg-open" />
          Passed
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 rounded-sm bg-emergency" />
          Failed
        </li>
      </ul>

      <div role="img" aria-label="Bar chart of the checks passed and failed per day in the last 30 days. The numbers are in the table below.">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} initialDimension={{ width: 320, height: CHART_HEIGHT }}>
          <BarChart data={bars} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dayOfMonth" interval="preserveStartEnd" tick={{ fontSize: 16 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 16 }} width={44} />
            <Bar dataKey="passed" stackId="checks" fill={PASSED_COLOUR} isAnimationActive={false} />
            <Bar dataKey="failed" stackId="checks" fill={FAILED_COLOUR} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="rounded-xl border border-line px-4">
        <summary className="flex min-h-12 cursor-pointer items-center text-base font-semibold text-forest">Show the numbers</summary>
        <table className="mb-3 w-full text-left text-base">
          <thead>
            <tr className="border-b border-line text-ink">
              <th scope="col" className="py-2 pr-4">Day</th>
              <th scope="col" className="py-2 pr-4">Passed</th>
              <th scope="col" className="py-2">Failed</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date} className="border-b border-line text-ink">
                <th scope="row" className="py-2 pr-4 font-normal">{formatNoticeDate(`${day.date}T12:00:00+01:00`)}</th>
                <td className="py-2 pr-4">{day.passed}</td>
                <td className="py-2">{day.failed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
