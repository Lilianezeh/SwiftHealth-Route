"use client";

/** The re-check lists: listings past their check date, and listings due within a week. Requirements: US-11, FR-33, FR-36,
 * NFR-10. UI spec 3.7 and "Phase 11 details"; decision H6 in specs/2026-10-20-reports-queue/requirements.md.
 *
 * The two lists are the two answers of `GET /listings?due=`, the same ones the dashboard counts. The tabs are links, so each tab
 * has its own address and the back button works.
 */
import Link from "next/link";
import { useCallback } from "react";

import { QueueStatus } from "@/components/admin/QueueStatus";
import { useStaff } from "@/components/admin/StaffGate";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { usePagedList } from "@/hooks/usePagedList";
import type { RequestOptions } from "@/lib/api/request";
import type { Page } from "@/lib/api/search";
import { listStaffListings } from "@/lib/api/staff";
import { formatNoticeDate } from "@/lib/formatters/dates";
import type { DueFilter, StaffListingSummary } from "@/types/staff";

const TABS: { due: DueFilter; label: string; empty: string; dueWord: string }[] = [
  { due: "overdue", label: "Overdue", empty: "Nothing is overdue.", dueWord: "Check was due" },
  { due: "this_week", label: "Due this week", empty: "Nothing is due this week.", dueWord: "Check due" },
];

type RechecksProps = { due: DueFilter };

export function Rechecks({ due }: RechecksProps) {
  const { call } = useStaff();
  const tab = TABS.find((entry) => entry.due === due) ?? TABS[0];
  const fetchPage = useCallback(
    (page: Page, options: RequestOptions) => call((token) => listStaffListings(token, { due, ...page }, options)),
    [call, due],
  );
  const list = usePagedList<StaffListingSummary>(due, fetchPage, true);

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold text-forest">Re-checks</h1>

      <nav aria-label="Re-check lists">
        <ul className="grid grid-cols-2 gap-2">
          {TABS.map((entry) => {
            const isCurrent = entry.due === due;
            return (
              <li key={entry.due}>
                <Link
                  href={`/admin/recheck?tab=${entry.due}`}
                  prefetch={false}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`inline-flex min-h-12 w-full items-center justify-center rounded-xl border px-3 text-base font-semibold ${
                    isCurrent ? "border-pine bg-pine text-white" : "border-pine bg-surface text-forest"
                  }`}
                >
                  {entry.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <QueueStatus status={list.status} onRetry={list.retry} />

      {list.status === "ready" && list.items.length === 0 && (
        <p className="rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">{tab.empty}</p>
      )}

      {list.status === "ready" && list.items.length > 0 && (
        <p className="text-base font-semibold text-ink">
          {list.total} {list.total === 1 ? "listing" : "listings"}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {list.items.map((item) => (
          <article key={item.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <p className="text-base font-semibold text-ink-soft">
              {item.category.name} · {item.area}
            </p>
            <h2 className="text-lg font-bold leading-snug text-forest">
              <Link href={`/admin/listings/${item.id}`} prefetch={false} className="inline-flex min-h-12 items-center underline">
                {item.name}
              </Link>
            </h2>
            <div>
              <StatusBadge status={item.status} />
            </div>
            {item.next_check_due && <p className="text-base text-ink-soft">{`${tab.dueWord} ${formatNoticeDate(item.next_check_due)}`}</p>}
            <Link href={`/admin/listings/${item.id}/checks`} prefetch={false} className={buttonClasses("secondary")}>
              Open verification log
            </Link>
          </article>
        ))}
      </div>
      <LoadMoreButton hasMore={list.hasMore} isLoading={list.isLoadingMore} failed={list.loadMoreFailed} onLoadMore={list.loadMore} />
    </section>
  );
}
