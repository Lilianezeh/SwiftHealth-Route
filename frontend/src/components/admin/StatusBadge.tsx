/** A listing's status in words (and a colour, never the colour alone). Requirements: FR-31, FR-42, NFR-10.
 * UI spec 3.3. Published is green, everything that waits for a person is amber, the rest is grey. */
import type { ListingStatus } from "@/types/staff";

export const STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  recheck_due: "Re-check due",
  hidden: "Hidden",
};

const STATUS_CLASSES: Record<ListingStatus, string> = {
  draft: "bg-closed-bg text-closed",
  pending_review: "bg-amber-wash text-amber-ink",
  published: "bg-open-bg text-open",
  recheck_due: "bg-amber-wash text-amber-ink",
  hidden: "bg-closed-bg text-closed",
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-base font-semibold ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
