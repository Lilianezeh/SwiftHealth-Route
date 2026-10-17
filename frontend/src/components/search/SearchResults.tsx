"use client";

/** The results part of /search: the heading, search box, the chip of the chosen type, Filters, the List | Map toggle, status, list or map,
 * and Load more. Requirements: US-01, US-05, FR-04 to FR-08, NFR-07; the toggle and the map are FR-07. UI spec 2.3.
 * Specs: specs/2026-10-15-find-by-type/ D2 to D5 (the heading, the chip and the typed type words).
 * The filters and the view come from the address; the position comes from sessionStorage (useLocation) and goes only to the
 * API and to the map's own dot. Results load in the browser (45 second limit, see useSearchResults). The list is the
 * default and is always complete; the map draws the same loaded results and is loaded only when it is shown.
 */
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FiltersDialog } from "@/components/search/FiltersDialog";
import { ResultsList } from "@/components/search/ResultsList";
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { SearchBox } from "@/components/search/SearchBox";
import { SearchHeading } from "@/components/search/SearchHeading";
import { SearchStatus } from "@/components/search/SearchStatus";
import { TypeChip } from "@/components/search/TypeChip";
import { ViewToggle } from "@/components/search/ViewToggle";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { findTypeChoice } from "@/config/types";
import { useLocation } from "@/hooks/useLocation";
import { useSearchResults } from "@/hooks/useSearchResults";
import { filtersToQuery, queryToFilters, type SearchFilters } from "@/lib/search/searchQuery";
import { searchHeading } from "@/lib/search/searchHeading";
import { readView, type ResultsView, withView } from "@/lib/search/searchView";
import { applyTypeWord } from "@/lib/search/typeWords";

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
  const addressFilters = useMemo(() => queryToFilters(query), [query]); // lat and lng in a shared link are ignored
  // A typed type word ("chemist") is turned into the type before the search, so there is one request, not two (D5).
  const filters = useMemo(() => applyTypeWord(addressFilters), [addressFilters]);
  const typeWordApplied = filters !== addressFilters;
  const view = readView(query);
  const { position, ready } = useLocation();
  const results = useSearchResults(filters, position, ready);
  const hasPosition = position !== null;
  const showMap = view === "map" && results.status === "ready" && results.items.length > 0;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [removedLabel, setRemovedLabel] = useState("");

  /** The address for these filters and this view, without the position: it never holds one. */
  const addressFor = useCallback(
    (nextFilters: SearchFilters, nextView: ResultsView) => {
      const nextQuery = withView(filtersToQuery(nextFilters), nextView);
      return nextQuery ? `/search?${nextQuery}` : "/search";
    },
    [],
  );

  // After a type word was applied, the address says so (?category=pharmacy): the chip, the heading, the Filters sheet and a shared link agree.
  // It is replaced, not pushed, like every filter change, and the filters are already those of the search, so nothing is searched again.
  useEffect(() => {
    if (typeWordApplied) router.replace(addressFor(filters, view));
  }, [typeWordApplied, filters, view, router, addressFor]);

  /** Adds a history entry, so Back from the map returns to the list. Only the filters and the view go in the address. */
  function changeView(next: ResultsView) {
    router.push(addressFor(filters, next));
  }

  /** The chip: removes only the type. Focus goes to the heading, so nobody is left on a button that has gone, and a polite note says so. */
  function removeType(label: string) {
    setRemovedLabel(`${label} filter removed`);
    headingRef.current?.focus();
    router.replace(addressFor({ ...filters, category: undefined }, view));
  }

  // The words of the heading depend on the position, which is read after the page opens: until then a type's heading waits (a grey bar).
  const headingText =
    findTypeChoice(filters.category) && !ready
      ? null
      : searchHeading(filters.category, { area: filters.area, hasPosition });

  return (
    <div className="flex flex-col gap-4">
      <SearchHeading text={headingText} headingRef={headingRef} />
      <SearchBox key={filters.q ?? ""} defaultValue={filters.q ?? ""} filters={filters} view={view} />
      {filters.category && <TypeChip category={filters.category} onRemove={removeType} />}
      {/* Only after the chip was used, so the page has one live region at a time (the loading note is another). */}
      {removedLabel && (
        <p role="status" aria-live="polite" className="sr-only">
          {removedLabel}
        </p>
      )}
      <FiltersDialog filters={filters} hasPosition={hasPosition} view={view} />
      <ViewToggle view={view} onChange={changeView} />
      <SearchStatus
        status={results.status}
        total={results.total}
        hasPosition={hasPosition}
        hasFilter={Object.keys(filters).length > 0}
        onRetry={results.retry}
      />
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
