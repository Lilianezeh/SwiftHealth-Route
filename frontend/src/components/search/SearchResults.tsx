"use client";

/** The results part of /search: search box, Filters, the List | Map toggle, status, list or map, and Load more.
 * Requirements: US-01, US-05, FR-04 to FR-08, NFR-07; the toggle and the map are FR-07. UI spec 2.3.
 * The filters and the view come from the address; the position comes from sessionStorage (useLocation) and goes only to the
 * API and to the map's own dot. Results load in the browser (45 second limit, see useSearchResults). The list is the
 * default and is always complete; the map draws the same loaded results and is loaded only when it is shown.
 */
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { FiltersDialog } from "@/components/search/FiltersDialog";
import { ResultsList } from "@/components/search/ResultsList";
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { SearchBox } from "@/components/search/SearchBox";
import { SearchStatus } from "@/components/search/SearchStatus";
import { ViewToggle } from "@/components/search/ViewToggle";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { useLocation } from "@/hooks/useLocation";
import { useSearchResults } from "@/hooks/useSearchResults";
import { filtersToQuery, queryToFilters } from "@/lib/search/searchQuery";
import { readView, type ResultsView, withView } from "@/lib/search/searchView";

// Leaflet needs the browser (window), and the list view should not carry its weight (NFR-01): no server rendering, and the
// code is fetched only when the map is first shown. The skeleton shows while it loads.
const ResultsMap = dynamic(() => import("@/components/search/ResultsMap").then((module) => module.ResultsMap), {
  ssr: false,
  loading: () => <ResultsSkeleton />,
});

export function SearchResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const filters = useMemo(() => queryToFilters(query), [query]); // lat and lng in a shared link are ignored
  const view = readView(query);
  const { position, ready } = useLocation();
  const results = useSearchResults(filters, position, ready);
  const hasPosition = position !== null;
  const showMap = view === "map" && results.status === "ready" && results.items.length > 0;

  /** Adds a history entry, so Back from the map returns to the list. Only the filters and the view go in the address. */
  function changeView(next: ResultsView) {
    const nextQuery = withView(filtersToQuery(filters), next);
    router.push(nextQuery ? `/search?${nextQuery}` : "/search");
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchBox key={filters.q ?? ""} defaultValue={filters.q ?? ""} filters={filters} view={view} />
      <FiltersDialog filters={filters} hasPosition={hasPosition} view={view} />
      <ViewToggle view={view} onChange={changeView} />
      <SearchStatus status={results.status} total={results.total} hasPosition={hasPosition} onRetry={results.retry} />
      {showMap ? <ResultsMap listings={results.items} position={position} /> : <ResultsList items={results.items} />}
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
