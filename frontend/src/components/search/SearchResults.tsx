"use client";

/** The results part of /search: search box, Filters, status, list and Load more. Requirements: US-01, US-05, FR-04 to
 * FR-08, NFR-07. UI spec 2.3. The filters come from the address; the position comes from sessionStorage (useLocation)
 * and goes only to the API. Results load in the browser (45 second limit, see useSearchResults).
 */
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { FiltersDialog } from "@/components/search/FiltersDialog";
import { ResultsList } from "@/components/search/ResultsList";
import { SearchBox } from "@/components/search/SearchBox";
import { SearchStatus } from "@/components/search/SearchStatus";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { useLocation } from "@/hooks/useLocation";
import { useSearchResults } from "@/hooks/useSearchResults";
import { queryToFilters } from "@/lib/search/searchQuery";

export function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const filters = useMemo(() => queryToFilters(query), [query]); // lat and lng in a shared link are ignored
  const { position, ready } = useLocation();
  const results = useSearchResults(filters, position, ready);
  const hasPosition = position !== null;

  return (
    <div className="flex flex-col gap-4">
      <SearchBox key={filters.q ?? ""} defaultValue={filters.q ?? ""} filters={filters} />
      <FiltersDialog filters={filters} hasPosition={hasPosition} />
      <SearchStatus status={results.status} total={results.total} hasPosition={hasPosition} onRetry={results.retry} />
      <ResultsList items={results.items} />
      {results.loadMoreFailed && (
        <p className="text-base text-ink">We couldn&apos;t load more. Check your connection and try again.</p>
      )}
      {results.hasMore && (
        <button type="button" onClick={results.loadMore} disabled={results.isLoadingMore} className={buttonClasses("secondary")}>
          {results.isLoadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
