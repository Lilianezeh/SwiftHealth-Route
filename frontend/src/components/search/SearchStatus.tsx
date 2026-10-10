/** What the results page says about the search: skeleton, "waking up", error, the count line, or nothing found.
 * Requirements: US-01, FR-04, FR-06, NFR-10. UI spec 2.3 (count line, states) and "Standard states".
 */
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";
import type { SearchStatusName } from "@/hooks/useSearchResults";

type SearchStatusProps = {
  status: SearchStatusName;
  total: number;
  hasPosition: boolean; // the results are sorted by distance when there is a position, by name when not
  onRetry: () => void;
};

export function SearchStatus({ status, total, hasPosition, onRetry }: SearchStatusProps) {
  if (status === "loading" || status === "slow") {
    return (
      <div data-testid="search-status" aria-busy="true" className="flex flex-col gap-4">
        {/* The live region is always there, so a screen reader announces the sentence when it is filled in. */}
        <p role="status" aria-live="polite" className="text-base text-ink">
          {status === "slow" ? "The service is waking up. This can take up to a minute." : ""}
        </p>
        <ResultsSkeleton />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
        <p className="text-base text-ink">We couldn&apos;t load this. Check your connection and try again.</p>
        <button type="button" onClick={onRetry} className={buttonClasses("primary")}>
          Retry
        </button>
      </div>
    );
  }

  if (total === 0) {
    return (
      <p className="rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">
        No matches. Try removing a filter or widening the distance.
      </p>
    );
  }

  return (
    <p className="text-base font-semibold text-ink">
      {total} {total === 1 ? "place" : "places"}, {hasPosition ? "nearest first" : "A to Z"}
    </p>
  );
}
