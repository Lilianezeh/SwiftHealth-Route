/** Search results. Requirements: US-01, US-05, FR-04 to FR-08. UI spec 2.3.
 * A server page: the results load in the browser inside <Suspense> (reading the address needs it), because the free API can
 * take about a minute to wake and the hosting gives up on a server page after about 30 seconds.
 * The h1 is written by SearchResults, because its words depend on the chosen type in the address (D3 of specs/2026-10-15-find-by-type/).
 * Until then the page shows a grey bar of the same height (and "Loading results" for screen readers), never the words "Search results".
 */
import type { Metadata } from "next";
import { Suspense } from "react";

import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { SearchResults } from "@/components/search/SearchResults";

export const metadata: Metadata = {
  title: "Search", // the page's own h1 is written by SearchResults
  description: "Hospitals, clinics, pharmacies, maternity homes and laboratories near you, open now, nearest first.",
};

function WaitingForTheAddress() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-forest">
        <span className="sr-only">Loading results</span>
        <span aria-hidden="true" className="block h-8 w-2/3 animate-pulse rounded-lg bg-closed-bg motion-reduce:animate-none" />
      </h1>
      <ResultsSkeleton />
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Suspense fallback={<WaitingForTheAddress />}>
        <SearchResults />
      </Suspense>
    </div>
  );
}
