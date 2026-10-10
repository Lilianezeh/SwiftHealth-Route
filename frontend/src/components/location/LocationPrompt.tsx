"use client";

/** What the visitor sees when there is no position yet: a button that asks, a message, and the area list.
 * Requirements: FR-03, NFR-07. UI spec 2.2, "Location". The browser's permission prompt appears only after a tap.
 */
import { LocateFixed } from "lucide-react";

import { AreaSelect } from "@/components/location/AreaSelect";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import type { LocationStatus } from "@/hooks/useLocation";

type LocationPromptProps = {
  status: LocationStatus;
  area: string | null;
  onAsk: () => void;
  onChooseArea: (area: string) => void;
};

const MESSAGES: Partial<Record<LocationStatus, string>> = {
  asking: "Finding your location…",
  denied: "We could not use your location. Choose an area instead.",
  unavailable: "Location is unavailable. Choose an area instead.",
  timeout: "Location is unavailable. Choose an area instead.",
};

export function LocationPrompt({ status, area, onAsk, onChooseArea }: LocationPromptProps) {
  const message = MESSAGES[status];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-pine-50 p-4">
      <button
        type="button"
        onClick={onAsk}
        disabled={status === "asking"}
        className={buttonClasses("secondary")}
      >
        <DecorativeIcon icon={LocateFixed} />
        Show places near me
      </button>
      {message && (
        <p role="status" className="text-base text-ink">
          {message}
        </p>
      )}
      <AreaSelect value={area} onChange={onChooseArea} />
    </div>
  );
}
