"use client";

/** The list part of Find blood: the group chips, the near-me button, the blood banks. Requirements: US-15, FR-27, FR-19,
 * FR-22, NFR-07. UI spec 2.6. The chosen group is held in the page only (not in the address), and the position is
 * sent to the API as lat and lng, never put in an address.
 */
import Link from "next/link";
import { useCallback, useState } from "react";

import { BloodBankCard } from "@/components/blood/BloodBankCard";
import { BloodGroupChips } from "@/components/blood/BloodGroupChips";
import { BloodListStatus } from "@/components/blood/BloodListStatus";
import { LoadMoreButton } from "@/components/blood/LoadMoreButton";
import { NearMePrompt } from "@/components/blood/NearMePrompt";
import { useLocation } from "@/hooks/useLocation";
import { usePagedList } from "@/hooks/usePagedList";
import { getBloodBanks } from "@/lib/api/blood";
import type { RequestOptions } from "@/lib/api/request";
import type { Page } from "@/lib/api/search";
import type { BloodBank } from "@/types/api";

export function BloodFinder() {
  const location = useLocation();
  const [bloodGroup, setBloodGroup] = useState<string | null>(null);
  const { position } = location;
  // The list is asked for again when the group or the position changes (the key stands for both).
  const key = `${bloodGroup ?? "any"}|${position?.latitude ?? ""}|${position?.longitude ?? ""}`;
  const fetchPage = useCallback(
    (page: Page, options: RequestOptions) => getBloodBanks(bloodGroup, position, page, options),
    [bloodGroup, position],
  );
  const list = usePagedList<BloodBank>(key, fetchPage, location.ready);

  return (
    <div className="flex flex-col gap-4">
      <BloodGroupChips selected={bloodGroup} onSelect={setBloodGroup} />
      <NearMePrompt status={location.status} hasPosition={position !== null} thing="blood banks" onAsk={location.ask} />
      <BloodListStatus
        status={list.status}
        total={list.total}
        hasPosition={position !== null}
        singular="blood bank"
        plural="blood banks"
        onRetry={list.retry}
      />

      {list.status === "ready" && list.total === 0 && (
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">
          <p>No blood banks found. In an emergency, call 112.</p>
          <Link href="/emergency" className="inline-flex min-h-12 items-center font-semibold text-forest underline">
            SwiftRescue
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {list.items.map((bank) => (
          <BloodBankCard key={bank.id} bank={bank} />
        ))}
      </div>
      <LoadMoreButton hasMore={list.hasMore} isLoading={list.isLoadingMore} failed={list.loadMoreFailed} onLoadMore={list.loadMore} />
    </div>
  );
}
