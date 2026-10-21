"use client";

/** The "near me" button of the blood pages and what to say when the position is not available.
 * Requirements: FR-03, FR-27, FR-28, NFR-07. The browser's permission prompt is shown only after the tap, never when the page loads.
 */
import { LocateFixed } from "lucide-react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import type { LocationStatus } from "@/hooks/useLocation";

type NearMePromptProps = {
  status: LocationStatus;
  hasPosition: boolean;
  thing: string; // "blood banks" or "donation centres"
  onAsk: () => void;
};

export function NearMePrompt({ status, hasPosition, thing, onAsk }: NearMePromptProps) {
  if (hasPosition) return null;

  if (status === "idle") {
    return (
      <button type="button" onClick={onAsk} className={buttonClasses("secondary")}>
        <DecorativeIcon icon={LocateFixed} />
        {`Show ${thing} near me`}
      </button>
    );
  }
  if (status === "asking") {
    return (
      <p role="status" className="text-base text-ink">
        Finding your location…
      </p>
    );
  }
  return (
    <p role="status" className="text-base text-ink">
      {`We could not use your location, so ${thing} are listed A to Z.`}
    </p>
  );
}
