"use client";

/** The staff list of listings. Requirements: FR-31, FR-42, NFR-06, NFR-10. UI spec 3.3 and "Phase 10 details"; decision C14 in
 * specs/2026-10-20-staff-screens/requirements.md (cards on a phone, two columns from 768 px). Every status is listed; the API
 * decides what each role may read. The text filter waits 300 ms after the last key so it does not call on every letter.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

import { StatusBadge, STATUS_LABELS } from "@/components/admin/StatusBadge";
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { useMeta } from "@/hooks/useMeta";
import { useStaffListings } from "@/hooks/useStaffListings";
import { formatNoticeDate } from "@/lib/formatters/dates";
import type { ListingStatus } from "@/types/staff";

const FIELD_CLASSES = "min-h-12 rounded-xl border border-line bg-white px-3 text-base text-ink";
const SEARCH_DELAY_MS = 300;
const STATUSES = Object.keys(STATUS_LABELS) as ListingStatus[];

type StaffListingsProps = { initialMine: boolean };

export function StaffListings({ initialMine }: StaffListingsProps) {
  const { meta } = useMeta();
  const [status, setStatus] = useState<ListingStatus | "">("");
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const [typed, setTyped] = useState("");
  const [searchText, setSearchText] = useState("");
  const [mine, setMine] = useState(initialMine);

  useEffect(() => {
    const timer = setTimeout(() => setSearchText(typed), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const { status: loadStatus, items, total, hasMore, isLoadingMore, loadMoreFailed, loadMore, retry } = useStaffListings({
    status: status || undefined,
    category: category || undefined,
    area: area || undefined,
    q: searchText || undefined,
    mine: mine || undefined,
  });

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-forest">Listings</h1>
        <Link href="/admin/listings/new" prefetch={false} className={`${buttonClasses("primary")} sm:w-auto sm:px-6`}>
          New listing
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-status" className="text-base font-semibold text-ink">Status</label>
          <select id="filter-status" value={status} onChange={(event) => setStatus(event.target.value as ListingStatus | "")} className={FIELD_CLASSES}>
            <option value="">Any status</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>{STATUS_LABELS[value]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-category" className="text-base font-semibold text-ink">Category</label>
          <select id="filter-category" value={category} onChange={(event) => setCategory(event.target.value)} className={FIELD_CLASSES}>
            <option value="">Any category</option>
            {meta?.categories.map((entry) => (
              <option key={entry.slug} value={entry.slug}>{entry.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-area" className="text-base font-semibold text-ink">Area</label>
          <select id="filter-area" value={area} onChange={(event) => setArea(event.target.value)} className={FIELD_CLASSES}>
            <option value="">Any area</option>
            {meta?.areas.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-search" className="text-base font-semibold text-ink">Search by name</label>
          <input id="filter-search" type="search" value={typed} onChange={(event) => setTyped(event.target.value)} className={FIELD_CLASSES} />
        </div>
      </div>
      <label className="inline-flex min-h-12 items-center gap-3 text-base text-ink">
        <input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} className="h-5 w-5 accent-pine" />
        Only mine
      </label>

      {loadStatus === "loading" && (
        <div aria-busy="true">
          <ResultsSkeleton />
        </div>
      )}

      {loadStatus === "error" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-base text-ink">We couldn&apos;t load this. Check your connection and try again.</p>
          <button type="button" onClick={retry} className={buttonClasses("primary")}>Retry</button>
        </div>
      )}

      {loadStatus === "ready" && items.length === 0 && (
        <p className="rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">No listings match.</p>
      )}

      {loadStatus === "ready" && items.length > 0 && (
        <>
          <p className="text-base font-semibold text-ink">{total} {total === 1 ? "listing" : "listings"}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {items.map((item) => (
              <article key={item.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4 shadow-card">
                <p className="text-base font-semibold text-ink-soft">{item.category.name} · {item.area}</p>
                <h2 className="text-lg font-bold leading-snug text-forest">
                  <Link href={`/admin/listings/${item.id}`} prefetch={false} className="inline-flex min-h-12 items-center underline">
                    {item.name}
                  </Link>
                </h2>
                <div><StatusBadge status={item.status} /></div>
                <p className="text-base text-ink-soft">
                  {item.next_check_due ? `Next check ${formatNoticeDate(item.next_check_due)}` : "No next check"}
                </p>
              </article>
            ))}
          </div>
          {loadMoreFailed && <p role="alert" className="text-base font-semibold text-amber-ink">We couldn&apos;t load more. Try again.</p>}
          {hasMore && (
            <button type="button" onClick={loadMore} disabled={isLoadingMore} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
              {isLoadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
