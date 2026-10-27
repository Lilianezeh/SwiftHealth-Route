"use client";

/** The "near you" cards: closest open pharmacy and closest open 24-hour place. Requirements: FR-03, US-01, FR-06.
 * UI spec 2.2, item 6, and D9 of specs/2026-10-15-find-by-type/requirements.md (the owner's point 10, 2026-10-13): the two cards never show
 * the same place twice. The pharmacy card asks for 1 result and the 24-hour card for 2; the 24-hour card shows the first one that is not the
 * pharmacy card's place. If its only place is that pharmacy, ONE card carries both labels and spans both columns.
 * The two requests still go out together and one failure does not change the other card. The 24-hour card shows nothing until the pharmacy
 * answer is in, so it never shows a place and then replaces it. A card with no result says so (never an empty card), and a failed card has its
 * own error and Retry. Nothing here puts the position in an address.
 */
import Link from "next/link";
import { useId } from "react";

import { ListingCard } from "@/components/listings/ListingCard";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { useNearbyListings } from "@/hooks/useNearbyListings";
import type { Position } from "@/lib/api/search";
import { filtersToQuery, type SearchFilters } from "@/lib/search/searchQuery";
import type { ListingSummary } from "@/types/api";

// Constants, so the hook sees the same object on every render.
const OPEN_PHARMACY: SearchFilters = { category: "pharmacy", open_now: true };
const OPEN_24_HOURS: SearchFilters = { is_24_hours: true };

type NearbySuggestionsProps = { position: Position | null; area: string | null };

/** What one card shows: a status and at most one listing. */
type CardView = { status: "loading" | "slow" | "ready" | "error"; listing: ListingSummary | null; retry: () => void };

type NearbyCardProps = {
  titles: string[]; // one title, or two when one card carries both labels
  emptyMessage: string;
  view: CardView;
  className?: string;
};

function NearbyCard({ titles, emptyMessage, view, className = "" }: NearbyCardProps) {
  const firstTitleId = useId();
  const secondTitleId = useId();
  const titleIds = [firstTitleId, secondTitleId];
  const { status, listing, retry } = view;
  const isWaiting = status === "loading" || status === "slow";

  return (
    <section
      aria-labelledby={titles.map((_title, index) => titleIds[index]).join(" ")}
      aria-busy={isWaiting}
      className={`flex flex-col gap-3 ${className}`}
    >
      <div className="flex flex-col">
        {titles.map((title, index) => (
          <p key={title} id={titleIds[index]} className="text-base font-semibold text-ink-soft">
            {title}
          </p>
        ))}
      </div>

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
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
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

/** The two cards for one place. It is given a new `key` when the position or the area changes, so the loads start again. */
function NearbyCards({ position, area }: NearbySuggestionsProps) {
  const pharmacy = useNearbyListings(OPEN_PHARMACY, position, area, 1);
  const twentyFourHours = useNearbyListings(OPEN_24_HOURS, position, area, 2);

  const pharmacyListing = pharmacy.listings[0] ?? null;
  const pharmacyHasAnswered = pharmacy.status === "ready" || pharmacy.status === "error";
  const pharmacyView: CardView = { status: pharmacy.status, listing: pharmacyListing, retry: pharmacy.retry };

  // The 24-hour card waits for the pharmacy answer, so that it never shows a place and then has to replace it.
  const isWaitingForPharmacy = twentyFourHours.status === "ready" && !pharmacyHasAnswered;
  const otherPlaces = pharmacyListing
    ? twentyFourHours.listings.filter((place) => place.id !== pharmacyListing.id)
    : twentyFourHours.listings;
  const isSamePlaceOnly =
    twentyFourHours.status === "ready" && pharmacyHasAnswered && pharmacyListing !== null && otherPlaces.length === 0 &&
    twentyFourHours.listings.length > 0;
  const twentyFourHoursView: CardView = isWaitingForPharmacy
    ? { status: "loading", listing: null, retry: twentyFourHours.retry }
    : { status: twentyFourHours.status, listing: otherPlaces[0] ?? null, retry: twentyFourHours.retry };

  if (isSamePlaceOnly) {
    return (
      <NearbyCard
        titles={["Closest open pharmacy", "Closest open 24-hour place"]}
        emptyMessage="No open pharmacy found nearby"
        view={pharmacyView}
        className="sm:col-span-2"
      />
    );
  }

  return (
    <>
      <NearbyCard titles={["Closest open pharmacy"]} emptyMessage="No open pharmacy found nearby" view={pharmacyView} />
      <NearbyCard titles={["Closest open 24-hour place"]} emptyMessage="No 24-hour place found nearby" view={twentyFourHoursView} />
    </>
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
        <NearbyCards key={placeKey} position={position} area={area} />
      </div>
      <Link href={`/search?${seeAllQuery}`} className={buttonClasses("secondary")}>
        See all open places near me
      </Link>
    </div>
  );
}
