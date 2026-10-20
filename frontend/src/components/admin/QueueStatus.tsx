/** What a staff data screen says while it loads or when the load failed: skeleton, "waking up", error with Retry.
 * Requirements: FR-34, FR-35, NFR-07. UI spec "Standard states". Nothing for a screen that is ready.
 */
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";

type QueueStatusProps = { status: "loading" | "slow" | "ready" | "error"; onRetry: () => void };

export function QueueStatus({ status, onRetry }: QueueStatusProps) {
  if (status === "loading" || status === "slow") {
    return (
      <div data-testid="queue-status" aria-busy="true" className="flex flex-col gap-4">
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

  return null;
}
