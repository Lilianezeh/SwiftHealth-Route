"use client";

/** Everything on SwiftRescue that comes from the API, with its states. Requirements: FR-14 to FR-17, FR-25, NFR-03, NFR-07.
 * UI spec 2.5 and "Standard states". The 112 card above it is static and does not wait for this.
 * Distances need the position the visitor allowed on another page, or one they allow here by tapping the button; it is never
 * asked for when the page loads.
 */
import { LocateFixed } from "lucide-react";

import { EmergencyGroups } from "@/components/emergency/EmergencyGroups";
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
    <div className="flex flex-col gap-6">
      {!position && locationStatus === "idle" && (
        <button type="button" onClick={ask} className={buttonClasses("secondary")}>
          <DecorativeIcon icon={LocateFixed} />
          Show distances from my location
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
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
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
        <EmergencyGroups response={response} hasPosition={position !== null && status === "ready"} />
      )}
    </div>
  );
}
