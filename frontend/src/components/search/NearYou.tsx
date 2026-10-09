"use client";

/** The "Open now near me" button and the Near you section of the Find page. Requirements: FR-03, US-01, NFR-07.
 * UI spec 2.2, items 5 and 6. One `useLocation` serves both, so the button and the cards agree on the position.
 * The position stays in sessionStorage (useLocation); the address gets only filters such as `open_now` or `area`.
 */
import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LocationPrompt } from "@/components/location/LocationPrompt";
import { NearbySuggestions } from "@/components/search/NearbySuggestions";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { useLocation } from "@/hooks/useLocation";
import { filtersToQuery } from "@/lib/search/searchQuery";

const OPEN_NOW_ADDRESS = "/search?open_now=true";

export function NearYou() {
  const router = useRouter();
  const { status, position, area, ready, ask, chooseArea } = useLocation();
  // True after a tap on "Open now near me" that had to ask for the position first: go to the results once it is granted.
  const [searchWhenLocated, setSearchWhenLocated] = useState(false);

  useEffect(() => {
    if (searchWhenLocated && status === "granted") router.push(OPEN_NOW_ADDRESS);
  }, [searchWhenLocated, status, router]);

  function openNowNearMe() {
    if (position) {
      router.push(OPEN_NOW_ADDRESS);
    } else if (area) {
      router.push(`/search?${filtersToQuery({ area, open_now: true })}`);
    } else {
      setSearchWhenLocated(true);
      ask();
    }
  }

  function showPlacesNearMe() {
    setSearchWhenLocated(false);
    ask();
  }

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={openNowNearMe} className={buttonClasses("primary")}>
        <DecorativeIcon icon={Clock} />
        Open now near me
      </button>

      {ready && (
        <section aria-labelledby="near-you-heading" className="flex flex-col gap-4">
          <h2 id="near-you-heading" className="text-2xl font-bold text-forest">
            Near you
          </h2>
          {!position && (
            <LocationPrompt status={status} area={area} onAsk={showPlacesNearMe} onChooseArea={chooseArea} />
          )}
          <NearbySuggestions position={position} area={area} />
        </section>
      )}
    </div>
  );
}
