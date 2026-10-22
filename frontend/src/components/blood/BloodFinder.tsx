"use client";

/** The list part of Find blood: the group chips, the near-me button, the blood banks. Requirements: US-15, FR-27, FR-19,
 * FR-22, NFR-03, NFR-07. UI spec 2.6. The chosen group is held in the page only (not in the address), and the position is
 * sent to the API as lat and lng, never put in an address.
 *
 * Offline (feature specs/2026-10-22-blood-offline/): every visit that loads saves the blood banks without a position (decision N2).
 * When the network fails or times out and a copy exists, the saved list is shown with its date; an error answer of the API is an
 * error, not old data (N5). The chips then filter the saved list and ask nothing; "Try again" asks the network again.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BloodBankCard } from "@/components/blood/BloodBankCard";
import { BloodGroupChips } from "@/components/blood/BloodGroupChips";
import { BloodListStatus } from "@/components/blood/BloodListStatus";
import { NearMePrompt } from "@/components/blood/NearMePrompt";
import { OfflineBloodBanks } from "@/components/blood/OfflineBloodBanks";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { useLocation } from "@/hooks/useLocation";
import { usePagedList } from "@/hooks/usePagedList";
import { getBloodBanks } from "@/lib/api/blood";
import type { RequestOptions } from "@/lib/api/request";
import type { Page } from "@/lib/api/search";
import { MAX_SAVED_BANKS, readBloodCopy, saveBloodCopy } from "@/lib/blood/offlineCopy";
import type { BloodBank } from "@/types/api";

export function BloodFinder() {
  const location = useLocation();
  const [bloodGroup, setBloodGroup] = useState<string | null>(null); // the chip that is pressed
  const [askedGroup, setAskedGroup] = useState<string | null>(null); // the group the list was asked for (offline, the chips ask nothing)
  const { position } = location;
  // The list is asked for again when the group or the position changes (the key stands for both).
  const key = `${askedGroup ?? "any"}|${position?.latitude ?? ""}|${position?.longitude ?? ""}`;
  const fetchPage = useCallback(
    (page: Page, options: RequestOptions) => getBloodBanks(askedGroup, position, page, options),
    [askedGroup, position],
  );
  const list = usePagedList<BloodBank>(key, fetchPage, location.ready);

  // The saved list is used only after a network failure or a timeout, and only if there is a good copy.
  const copy = useMemo(
    () => (list.status === "error" && list.failure === "network" ? readBloodCopy() : null),
    [list.status, list.failure],
  );
  const isOffline = copy !== null;

  const savedThisVisit = useRef(false);
  useEffect(() => {
    if (list.status !== "ready" || savedThisVisit.current) return;
    savedThisVisit.current = true;
    const isPlainList = position === null && askedGroup === null && list.items.length === list.total;
    if (isPlainList) {
      saveBloodCopy(list.items);
      return;
    }
    // The list on screen is not the plain one (a position, a group, or more than one page): one quiet request makes the copy.
    getBloodBanks(null, null, { limit: MAX_SAVED_BANKS, offset: 0 })
      .then((answer) => saveBloodCopy(answer.items))
      .catch(() => {
        // the copy is an extra: nothing to tell the visitor
      });
  }, [list.status, list.items, list.total, position, askedGroup]);

  function chooseGroup(group: string | null) {
    setBloodGroup(group);
    if (!isOffline) setAskedGroup(group); // offline the saved list is filtered here, with no request
  }

  function tryAgain() {
    if (askedGroup !== bloodGroup) setAskedGroup(bloodGroup);
    else list.retry();
  }

  return (
    <div className="flex flex-col gap-4">
      <BloodGroupChips selected={bloodGroup} onSelect={chooseGroup} />

      {copy ? (
        <OfflineBloodBanks copy={copy} bloodGroup={bloodGroup} onTryAgain={tryAgain} />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
