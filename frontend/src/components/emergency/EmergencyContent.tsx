"use client";

/** Everything on SwiftRescue that comes from the API, with its states. Requirements: FR-14 to FR-17, NFR-03, NFR-07.
 * UI spec 2.5 and "Standard states". The 112 card and the photo banner above it are static and do not wait for this. The two location actions are
 * "Send my location to someone" (ShareMyLocation: the exact position goes into a message the visitor sends) and "Sort by distance from me" (below:
 * the visitor's position sorts the contacts and is kept nowhere), named so they cannot be mistaken for each other (owner, 2026-11-03).
 * Distances need the position the visitor allowed on another page, or one they allow here by tapping the button; it is never
 * asked for when the page loads.
 */
import { LocateFixed } from "lucide-react";

import { EmergencyGroups } from "@/components/emergency/EmergencyGroups";
import { ShareEmergencyList } from "@/components/emergency/ShareEmergencyList";
import { ShareMyLocation } from "@/components/emergency/ShareMyLocation";
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { useEmergency } from "@/hooks/useEmergency";
import { useLocation } from "@/hooks/useLocation";
import { formatNoticeDate } from "@/lib/formatters/dates";

export function EmergencyContent() {
  const { status: locationStatus, position, ask } = useLocation();
  const { status, response, savedAt, retry } = useEmergency(position, true);

  return (
    // 2 rem (gap-8) between the parts: "Send my location to someone", the share buttons and "Sort by distance from me" are clearly apart.
    <div className="flex flex-col gap-8">
      <ShareMyLocation />
      <ShareEmergencyList response={response} />

      {!position && locationStatus === "idle" && (
        <button type="button" onClick={ask} className={buttonClasses("secondary")}>
          <DecorativeIcon icon={LocateFixed} />
          Sort by distance from me
        </button>
      )}
      {locationStatus === "asking" && (
        <p role="status" className="text-base text-ink">
          Finding your location…
        </p>
      )}
      {!position && locationStatus !== "idle" && locationStatus !== "asking" && (
        <p role="status" className="text-base text-ink">
          We could not use your location, so contacts are listed A to Z.
        </p>
      )}

      {(status === "loading" || status === "slow") && (
        <div data-testid="emergency-status" aria-busy="true" className="flex flex-col gap-4">
          <p role="status" aria-live="polite" className="text-base text-ink">
            {status === "slow" ? "The service is waking up. This can take up to a minute." : ""}
          </p>
          <ResultsSkeleton />
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-base text-ink">We couldn&apos;t load this. Check your connection and try again.</p>
          <button type="button" onClick={retry} className={buttonClasses("primary")}>
            Retry
          </button>
        </div>
      )}

      {status === "offline" && savedAt && (
        <p role="status" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
          {`Offline — showing saved contacts from ${formatNoticeDate(savedAt)}`}
        </p>
      )}

      {response && (status === "ready" || status === "offline") && (
        <EmergencyGroups response={response} />
      )}
    </div>
  );
}
