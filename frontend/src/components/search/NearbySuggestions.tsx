"use client";

/** The two "near you" cards: closest open pharmacy and closest open 24-hour place. Requirements: FR-03, US-01, FR-06.
 * UI spec 2.2, item 6. The cards load independently. A card with no result says so (never an empty card), and a failed
 * card has its own error and Retry. Nothing here puts the position in an address.
 */
import Link from "next/link";
import { useId } from "react";

import { ListingCard } from "@/components/listings/ListingCard";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { useNearbyListing } from "@/hooks/useNearbyListing";
import type { Position } from "@/lib/api/search";
import { filtersToQuery, type SearchFilters } from "@/lib/search/searchQuery";

// Constants, so the hook sees the same object on every render.
const OPEN_PHARMACY: SearchFilters = { category: "pharmacy", open_now: true };
const OPEN_24_HOURS: SearchFilters = { is_24_hours: true };

type NearbySuggestionsProps = { position: Position | null; area: string | null };

type NearbyCardProps = {
  title: string;
  emptyMessage: string;
  filters: SearchFilters;
  position: Position | null;
  area: string | null;
};

function NearbyCard({ title, emptyMessage, filters, position, area }: NearbyCardProps) {
  const titleId = useId();
  const { status, listing, retry } = useNearbyListing(filters, position, area);
  const isWaiting = status === "loading" || status === "slow";

  return (
    <section aria-labelledby={titleId} aria-busy={isWaiting} className="flex flex-col gap-3">
      <p id={titleId} className="text-base font-semibold text-ink-soft">
        {title}
      </p>

      {isWaiting && (
        <>
          <div className="h-48 animate-pulse rounded-2xl bg-closed-bg" />
          {status === "slow" && (
            <p role="status" className="text-base text-ink">
              The service is waking up. This can take up to a minute.
            </p>
          )}
        </>
      )}

      {status === "error" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-base text-ink">We couldn&apos;t load this. Check your connection and try again.</p>
          <button type="button" onClick={retry} className={buttonClasses("primary")}>
            Retry
          </button>
        </div>
      )}

      {status === "ready" && listing && <ListingCard listing={listing} />}

      {status === "ready" && !listing && (
        <div className="flex flex-col items-start gap-1 rounded-2xl border border-line bg-pine-50 p-4">
          <p className="text-base font-semibold text-ink">{emptyMessage}</p>
          <p className="text-base text-ink-soft">Try a wider search.</p>
          <Link href="/search" className="inline-flex min-h-12 items-center text-base font-semibold text-forest underline">
            Search all places
          </Link>
        </div>
      )}
    </section>
  );
}

export function NearbySuggestions({ position, area }: NearbySuggestionsProps) {
  if (!position && !area) return null;

  // A new position or area gives the cards a new key, so they start a new load instead of showing the old answer.
  const placeKey = position ? `${position.latitude},${position.longitude}` : `area:${area}`;
  const seeAllQuery = filtersToQuery({ open_now: true, ...(position || !area ? {} : { area }) });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <NearbyCard
          key={`pharmacy-${placeKey}`}
          title="Closest open pharmacy"
          emptyMessage="No open pharmacy found nearby"
          filters={OPEN_PHARMACY}
          position={position}
          area={area}
        />
        <NearbyCard
          key={`24-hours-${placeKey}`}
          title="Closest open 24-hour place"
          emptyMessage="No 24-hour place found nearby"
          filters={OPEN_24_HOURS}
          position={position}
          area={area}
        />
      </div>
      <Link href={`/search?${seeAllQuery}`} className={buttonClasses("secondary")}>
        See all open places near me
      </Link>
    </div>
  );
}
