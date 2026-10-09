/** "Open now", "Closed" or "Open 24 hours", in words as well as colour. Requirements: US-01, FR-06, NFR-10. */
type OpenNowBadgeProps = { isOpenNow: boolean; is24Hours: boolean };

export function OpenNowBadge({ isOpenNow, is24Hours }: OpenNowBadgeProps) {
  const isOpen = is24Hours || isOpenNow; // a 24-hour place is open, whatever the clock says
  const label = is24Hours ? "Open 24 hours" : isOpenNow ? "Open now" : "Closed";
  const colours = isOpen ? "bg-open-bg text-open" : "bg-closed-bg text-closed";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-base font-semibold ${colours}`}>
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
