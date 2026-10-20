/** What a blood list says about itself: skeleton, "waking up", error with Retry, or the count line. Requirements: FR-27, FR-28,
 * NFR-07. UI spec "Standard states". Nothing for an empty list: each page has its own words for that.
 */
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";
import type { PagedListStatus } from "@/hooks/usePagedList";

type BloodListStatusProps = {
  status: PagedListStatus;
  total: number;
  hasPosition: boolean;
  singular: string; // "blood bank"
  plural: string; // "blood banks"
  onRetry: () => void;
};

export function BloodListStatus({ status, total, hasPosition, singular, plural, onRetry }: BloodListStatusProps) {
  if (status === "loading" || status === "slow") {
    return (
      <div data-testid="blood-status" aria-busy="true" className="flex flex-col gap-4">
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

  if (total === 0) return null;
  return (
    <p className="text-base font-semibold text-ink">
      {total} {total === 1 ? singular : plural}, {hasPosition ? "nearest first" : "A to Z"}
    </p>
  );
}
