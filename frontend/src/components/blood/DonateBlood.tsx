"use client";

/** The list part of Donate blood: the near-me button and the donation centres. Requirements: US-16, FR-28, FR-19, FR-22,
 * NFR-07. UI spec 2.7. The position is sent to the API as lat and lng, never put in an address.
 */
import Link from "next/link";
import { useCallback } from "react";

import { BloodListStatus } from "@/components/blood/BloodListStatus";
import { DonationCentreCard } from "@/components/blood/DonationCentreCard";
import { NearMePrompt } from "@/components/blood/NearMePrompt";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { useLocation } from "@/hooks/useLocation";
import { usePagedList } from "@/hooks/usePagedList";
import { getDonationCentres } from "@/lib/api/blood";
import type { RequestOptions } from "@/lib/api/request";
import type { Page } from "@/lib/api/search";
import type { DonationCentre } from "@/types/api";

export function DonateBlood() {
  const location = useLocation();
  const { position } = location;
  const key = `${position?.latitude ?? ""}|${position?.longitude ?? ""}`;
  const fetchPage = useCallback(
    (page: Page, options: RequestOptions) => getDonationCentres(position, page, options),
    [position],
  );
  const list = usePagedList<DonationCentre>(key, fetchPage, location.ready);

  return (
    <div className="flex flex-col gap-4">
      <NearMePrompt status={location.status} hasPosition={position !== null} thing="donation centres" onAsk={location.ask} />
      <BloodListStatus
        status={list.status}
        total={list.total}
        hasPosition={position !== null}
        singular="donation centre"
        plural="donation centres"
        onRetry={list.retry}
      />

      {list.status === "ready" && list.total === 0 && (
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">
          <p>No donation centres are listed yet. Call a blood bank to ask.</p>
          <Link href="/blood" className="inline-flex min-h-12 items-center font-semibold text-forest underline">
            Find a blood bank
          </Link>
        </div>
      )}

      {list.items.length > 0 && <h2 className="sr-only">Donation centres</h2>}
      <div className="flex flex-col gap-4">
        {list.items.map((centre) => (
          <DonationCentreCard key={centre.id} centre={centre} />
        ))}
      </div>
      <LoadMoreButton hasMore={list.hasMore} isLoading={list.isLoadingMore} failed={list.loadMoreFailed} onLoadMore={list.loadMore} />
    </div>
  );
}
