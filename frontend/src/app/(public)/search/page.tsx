/** Search results. Requirements: US-01, US-05, FR-04 to FR-08. UI spec 2.3.
 * A server page: the results load in the browser inside <Suspense> (reading the address needs it), because the free API can
 * take about a minute to wake and the hosting gives up on a server page after about 30 seconds.
 */
import { Suspense } from "react";

import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { SearchResults } from "@/components/search/SearchResults";

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-forest">Search results</h1>
      <Suspense fallback={<ResultsSkeleton />}>
        <SearchResults />
      </Suspense>
    </div>
  );
}
