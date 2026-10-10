/** The list of result cards, in the order the API gave (a sponsored listing, if any, comes first). Requirements: US-01,
 * FR-06, FR-08. UI spec 2.3, item 4.
 */
import { ListingCard } from "@/components/listings/ListingCard";
import type { ListingSummary } from "@/types/api";

type ResultsListProps = { items: ListingSummary[]; now?: Date };

export function ResultsList({ items, now }: ResultsListProps) {
  if (items.length === 0) return null;

  return (
    <ul aria-label="Search results" className="flex flex-col gap-4">
      {items.map((listing) => (
        <li key={listing.id}>
          <ListingCard listing={listing} now={now} />
        </li>
      ))}
    </ul>
  );
}
