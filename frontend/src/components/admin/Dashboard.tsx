"use client";

/** The staff dashboard: five numbers that link to the screen that holds them, and the checks chart. Requirements: US-11, FR-34,
 * NFR-10. UI spec 3.2 and "Phase 11 details"; decision H8 in specs/2026-10-20-reports-queue/requirements.md.
 * All numbers come from one call to `GET /dashboard/stats`.
 */
import Link from "next/link";

import { CheckChart } from "@/components/admin/CheckChart";
import { QueueStatus } from "@/components/admin/QueueStatus";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import type { DashboardStats } from "@/types/staff";

type Card = { label: string; count: number; href: string; urgent?: number };

function cardsFor(stats: DashboardStats): Card[] {
  return [
    { label: "Published", count: stats.listings_by_status.published, href: "/admin/listings?status=published" },
    { label: "Pending review", count: stats.listings_by_status.pending_review, href: "/admin/listings?status=pending_review" },
    { label: "Due this week", count: stats.rechecks_due_this_week, href: "/admin/recheck?tab=this_week" },
    { label: "Overdue", count: stats.overdue_rechecks, href: "/admin/recheck?tab=overdue" },
    { label: "Open reports", count: stats.open_reports, href: "/admin/reports", urgent: stats.urgent_reports },
  ];
}

export function Dashboard() {
  const { status, stats, retry } = useDashboardStats();

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold text-forest">Dashboard</h1>

      <QueueStatus status={status} onRetry={retry} />

      {stats && (
        <>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {cardsFor(stats).map((card) => (
              <li key={card.label}>
                <Link
                  href={card.href}
                  prefetch={false}
                  className="flex min-h-24 flex-col justify-center gap-1 rounded-2xl border border-line bg-surface p-4 shadow-card"
                >
                  <span className="text-3xl font-bold text-forest">{card.count}</span>
                  <span className="text-base font-semibold text-ink">{card.label}</span>
                  {card.urgent ? <span className="text-base font-bold text-alert">{`${card.urgent} urgent`}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
          <CheckChart days={stats.checks_last_30_days} />
        </>
      )}
    </section>
  );
}
