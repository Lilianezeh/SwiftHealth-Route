/** "Load more" under a blood list, and the sentence when the next page failed. Requirements: FR-27, FR-28, NFR-07. */
import { buttonClasses } from "@/components/ui/buttonStyles";

type LoadMoreButtonProps = { hasMore: boolean; isLoading: boolean; failed: boolean; onLoadMore: () => void };

export function LoadMoreButton({ hasMore, isLoading, failed, onLoadMore }: LoadMoreButtonProps) {
  return (
    <>
      {failed && <p className="text-base text-ink">We couldn&apos;t load more. Check your connection and try again.</p>}
      {hasMore && (
        <button type="button" onClick={onLoadMore} disabled={isLoading} className={buttonClasses("secondary")}>
          {isLoading ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}
